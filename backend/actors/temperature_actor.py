"""TemperatureActor.

Temperature device I/O is serialized through this actor worker. The actor owns
the command scheduler, protocol controller, transport, polling loop, state
updates, and future completion.
"""

from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import Future
from typing import Any, Optional

from backend.actors.scheduler import CommandScheduler
from backend.controllers.temperature.fb100 import FB100
from backend.schemas.command import (
    CommandQueueType,
    CommandResult,
    DeviceCommand,
    ResponseMode,
)
from backend.state.state_manager import StateManager
from backend.transports.protocol import TransportResponse

logger = logging.getLogger(__name__)


class TemperatureActor:
    """Temperature FB100 actor."""

    def __init__(
        self,
        state_manager: StateManager,
        controller: Optional[FB100] = None,
        transport: Optional[Any] = None,
    ) -> None:
        self._state_manager = state_manager
        self._controller = controller or FB100()
        self._transport = transport
        self._scheduler = CommandScheduler()

        self._worker_thread: Optional[threading.Thread] = None
        self._shutdown_event = threading.Event()
        self._io_lock = threading.Lock()

        self._polling_thread: Optional[threading.Thread] = None
        self._polling_stop_event = threading.Event()
        self._polling_interval_sec: float = 1.0
        self._polling_device_id: Optional[str] = None
        self._polling_active = False
        self._poll_pending = threading.Event()

        self._connected = False
        self._connection_config: Optional[dict[str, Any]] = None
        self._model: str = "FB100"

        self._safe_stop_thread: Optional[threading.Thread] = None
        self._safe_stop_cancel = threading.Event()
        self._safe_stopping = False
        self._safe_stop_target: Optional[float] = None

    def start(self) -> None:
        self._shutdown_event.clear()
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            name="temp-actor-worker",
            daemon=True,
        )
        self._worker_thread.start()
        logger.info("[TemperatureActor] worker started")

    def stop(self) -> None:
        self._safe_stop_cancel.set()
        self.stop_polling()
        self._shutdown_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=5.0)
        if self._safe_stop_thread and self._safe_stop_thread.is_alive():
            self._safe_stop_thread.join(timeout=3.0)
        try:
            if self._transport is not None:
                self._transport.close()
        except Exception:
            logger.debug("[TemperatureActor] transport close failed", exc_info=True)
        logger.info("[TemperatureActor] stopped")

    def submit(self, command: DeviceCommand) -> Optional[Future]:
        future: Optional[Future] = None
        if command.response_mode == ResponseMode.WAIT:
            future = Future()
            command.result_future = future
        self._scheduler.enqueue(command)
        return future

    def get_polling_interval(self) -> float:
        return self._polling_interval_sec

    def set_polling_interval(self, interval_sec: float) -> None:
        self._polling_interval_sec = max(float(interval_sec), 0.5)
        if self._polling_active and self._polling_device_id:
            self._state_manager.update_temperature_state(
                self._polling_device_id, {"intervalSec": self._polling_interval_sec}
            )

    def start_polling(self, device_id: str, interval_sec: float | None = None) -> None:
        if self._polling_active:
            self.stop_polling()

        self._polling_device_id = device_id
        if interval_sec is not None:
            self.set_polling_interval(interval_sec)
        self._polling_stop_event.clear()
        self._poll_pending.clear()
        self._polling_thread = threading.Thread(
            target=self._polling_loop,
            name="temp-polling",
            daemon=True,
        )
        self._polling_thread.start()
        self._polling_active = True
        self._state_manager.update_temperature_state(
            device_id, {"polling": True, "intervalSec": self._polling_interval_sec}
        )
        logger.info(
            "[TemperatureActor] polling started device=%s interval=%.1fs",
            device_id,
            self._polling_interval_sec,
        )

    def stop_polling(self) -> None:
        if not self._polling_active:
            return
        self._polling_stop_event.set()
        self._polling_active = False
        if self._polling_thread and self._polling_thread.is_alive():
            self._polling_thread.join(timeout=3.0)
        self._polling_thread = None
        if self._polling_device_id:
            self._state_manager.update_temperature_state(
                self._polling_device_id, {"polling": False}
            )
        logger.info("[TemperatureActor] polling stopped")

    def _worker_loop(self) -> None:
        while not self._shutdown_event.is_set():
            command = self._scheduler.dequeue()
            if command is not None:
                self._execute_command(command)
            else:
                self._shutdown_event.wait(0.02)

    def _execute_command(self, command: DeviceCommand) -> None:
        try:
            result = self._dispatch(command)
        except Exception as exc:
            logger.exception(
                "[TemperatureActor] unhandled error action=%s", command.action
            )
            result = CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=str(exc),
            )

        if result.ok and result.data:
            result_data = self._with_safe_stop_state(result.data)
            if command.action in ("manual_start", "recipe_step_start"):
                # composite command는 내부에서 이미 step별 state 업데이트를 수행했다.
                # result.data의 composite 응답 필드(steps/action/state)를
                # device state에 병합하지 않고 lastCommandId만 기록한다.
                self._state_manager.update_temperature_state(
                    command.device_id,
                    {"error": None, "lastCommandId": command.command_id},
                )
            else:
                self._state_manager.update_temperature_state(
                    command.device_id,
                    {**result_data, "error": None, "lastCommandId": command.command_id},
                )
        elif not result.ok and result.error:
            self._state_manager.update_temperature_state(
                command.device_id,
                {"error": result.error, "lastCommandId": command.command_id},
            )

        if command.queue_type == CommandQueueType.POLLING:
            self._poll_pending.clear()

        if command.result_future is not None and not command.result_future.done():
            command.result_future.set_result(result)

    def _dispatch(self, command: DeviceCommand) -> CommandResult:
        if self._transport is None:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature transport is not configured",
            )

        action = command.action
        if action == "probe":
            return self._run_probe(command)
        if action == "connect":
            return self._run_connect(command)
        if action == "disconnect":
            return self._run_disconnect(command)
        if action == "read_status":
            return self._run_read_status(command)
        if action == "set_stop_mode":
            return self._run_safe_stop_mode(command)
        if action == "force_stop_mode":
            return self._run_force_stop_mode(command)
        if action in (
            "write_setpoint",
            "set_run_mode",
            "read_heat_pid",
            "read_cool_pid",
            "write_heat_pid",
            "write_cool_pid",
            "read_decimal_point",
            "write_decimal_point",
        ):
            return self._run_control(command)
        if action == "write_ramping_rate":
            return self._run_write_ramping_rate(command)
        if action == "manual_start":
            return self._run_manual_start(command)
        if action == "recipe_step_start":
            return self._run_recipe_step_start(command)
        return CommandResult(
            command_id=command.command_id,
            ok=False,
            device_id=command.device_id,
            error=f"unknown action: {action}",
        )

    def _run_probe(self, command: DeviceCommand) -> CommandResult:
        config = self._transport_config(command)
        if not config["port"]:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature connection port is not configured",
            )
        responses: list[TransportResponse] = []
        try:
            self._transport.open(config)
            responses = self._run_transactions(command)
        finally:
            self._transport.close()
            if self._connected and self._connection_config is not None:
                self._transport.open(self._connection_config)
        return self._controller.parse_result(command, responses)

    def _run_connect(self, command: DeviceCommand) -> CommandResult:
        config = self._transport_config(command)
        if not config["port"]:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature connection port is not configured",
            )
        self._transport.open(config)
        responses = self._run_transactions(command)
        result = self._controller.parse_result(command, responses)
        if result.ok:
            self._connected = True
            self._connection_config = config
            self._model = str(
                result.data.get("model") or command.payload.get("model") or "FB100"
            )
            self.start_polling(
                device_id=command.device_id,
                interval_sec=self._polling_interval_sec,
            )
        else:
            self._connected = False
            self._connection_config = None
            self._transport.close()
        return result

    def _run_disconnect(self, command: DeviceCommand) -> CommandResult:
        if self._polling_active:
            self.stop_polling()
        responses = self._run_transactions(command)
        result = self._controller.parse_result(command, responses)
        self._connected = False
        self._connection_config = None
        self._model = "FB100"
        self._transport.close()
        return result

    def _run_read_status(self, command: DeviceCommand) -> CommandResult:
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature device is not connected",
            )
        responses = self._run_transactions(command)
        return self._controller.parse_result(command, responses)

    def _run_control(self, command: DeviceCommand) -> CommandResult:
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature device is not connected",
            )
        if self._safe_stopping and command.action in ("write_setpoint", "set_run_mode"):
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                data=self._safe_stop_patch(),
                error="Temperature safe stop is in progress",
            )
        return self._run_control_internal(command)

    def _run_control_internal(self, command: DeviceCommand) -> CommandResult:
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature device is not connected",
            )
        responses = self._run_transactions(command)
        return self._controller.parse_result(command, responses)

    def _run_write_ramping_rate(self, command: DeviceCommand) -> CommandResult:
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature device is not connected",
            )
        if self._safe_stopping:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                data=self._safe_stop_patch(),
                error="Temperature safe stop is in progress",
            )
        return self._run_write_ramping_rate_internal(command)

    def _run_write_ramping_rate_internal(self, command: DeviceCommand) -> CommandResult:
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature device is not connected",
            )
        hu_responses = self._run_transactions(command)
        hu_response = next(
            (response for response in hu_responses if response.name == "HU"),
            None,
        )
        if hu_response is None:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="missing FB100 HU response",
            )

        write_transactions = self._controller.build_ramping_write_transactions(
            float(command.payload["value"]),
            hu_response,
        )
        responses = [self._transaction(tx) for tx in write_transactions]
        return self._controller.parse_result(command, responses)

    def _run_manual_start(self, command: DeviceCommand) -> CommandResult:
        """Composite command: write_setpoint → write_ramping_rate → set_run_mode.

        Runs all steps sequentially inside the worker. Stops on first failure.
        Returns a CommandResult whose data contains the composite response fields.
        """
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature device is not connected",
            )
        if self._safe_stopping:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                data=self._safe_stop_patch(),
                error="Temperature safe stop is in progress",
            )

        set_value: float = float(command.payload["setValue"])
        ramping_rate: float = float(command.payload["rampingRate"])

        steps: list[dict[str, Any]] = []

        # ── Step 1: write_setpoint ────────────────────────────────────────
        sp_cmd = DeviceCommand(
            device_id=command.device_id,
            device_type=command.device_type,
            queue_type=command.queue_type,
            action="write_setpoint",
            payload={"value": set_value},
            response_mode=command.response_mode,
            context={"origin": "manual_start"},
        )
        sp_result = self._run_control(sp_cmd)
        steps.append({"action": "write_setpoint", "ok": sp_result.ok, "error": sp_result.error})
        if sp_result.ok and sp_result.data:
            self._state_manager.update_temperature_state(
                command.device_id,
                {**sp_result.data, "error": None},
            )
        if not sp_result.ok:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"write_setpoint failed: {sp_result.error}",
                data={
                    "action": "manual_start",
                    "failedStep": "write_setpoint",
                    "steps": steps,
                },
            )

        # ── Step 2: write_ramping_rate ────────────────────────────────────
        rr_cmd = DeviceCommand(
            device_id=command.device_id,
            device_type=command.device_type,
            queue_type=command.queue_type,
            action="write_ramping_rate",
            payload={"value": ramping_rate},
            response_mode=command.response_mode,
            context={"origin": "manual_start"},
        )
        rr_result = self._run_write_ramping_rate(rr_cmd)
        steps.append({"action": "write_ramping_rate", "ok": rr_result.ok, "error": rr_result.error})
        if rr_result.ok and rr_result.data:
            self._state_manager.update_temperature_state(
                command.device_id,
                {**rr_result.data, "error": None},
            )
        if not rr_result.ok:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"write_ramping_rate failed: {rr_result.error}",
                data={
                    "action": "manual_start",
                    "failedStep": "write_ramping_rate",
                    "steps": steps,
                },
            )

        # ── Step 3: set_run_mode ──────────────────────────────────────────
        run_cmd = DeviceCommand(
            device_id=command.device_id,
            device_type=command.device_type,
            queue_type=command.queue_type,
            action="set_run_mode",
            payload={},
            response_mode=command.response_mode,
            context={"origin": "manual_start"},
        )
        run_result = self._run_control(run_cmd)
        steps.append({"action": "set_run_mode", "ok": run_result.ok, "error": run_result.error})
        if run_result.ok and run_result.data:
            self._state_manager.update_temperature_state(
                command.device_id,
                {**run_result.data, "error": None},
            )
        if not run_result.ok:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"set_run_mode failed: {run_result.error}",
                data={
                    "action": "manual_start",
                    "failedStep": "set_run_mode",
                    "steps": steps,
                },
            )

        # ── All steps succeeded ───────────────────────────────────────────
        final_state = self._state_manager.get_temperature_state(command.device_id) or {}
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=command.device_id,
            data={
                "action": "manual_start",
                "steps": steps,
                "state": final_state,
            },
        )

    def _run_recipe_step_start(self, command: DeviceCommand) -> CommandResult:
        """Composite command: write_setpoint → write_ramping_rate → set_run_mode.

        Recipe step 단위로 실행한다. manual_start와 동일한 순차 실행/실패 정책을
        따르되, 응답 data에 recipeRunId/cycleIndex/stepIndex 식별자를 포함한다.
        첫 단계 실패 시 이후 단계는 실행하지 않고 failedStep/steps/error를 반환한다.
        """
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature device is not connected",
            )
        if self._safe_stopping:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                data=self._safe_stop_patch(),
                error="Temperature safe stop is in progress",
            )

        recipe_run_id = command.payload.get("recipeRunId")
        cycle_index = command.payload.get("cycleIndex")
        step_index = command.payload.get("stepIndex")
        set_value: float = float(command.payload["setValue"])
        ramping_rate: float = float(command.payload["rampingRate"])

        identifiers: dict[str, Any] = {
            "action": "recipe_step_start",
            "recipeRunId": recipe_run_id,
            "cycleIndex": cycle_index,
            "stepIndex": step_index,
        }
        steps: list[dict[str, Any]] = []

        # ── Step 1: write_setpoint ────────────────────────────────────────
        sp_cmd = DeviceCommand(
            device_id=command.device_id,
            device_type=command.device_type,
            queue_type=command.queue_type,
            action="write_setpoint",
            payload={"value": set_value},
            response_mode=command.response_mode,
            context={"origin": "recipe_step_start"},
        )
        sp_result = self._run_control(sp_cmd)
        steps.append({"action": "write_setpoint", "ok": sp_result.ok, "error": sp_result.error})
        if sp_result.ok and sp_result.data:
            self._state_manager.update_temperature_state(
                command.device_id,
                {**sp_result.data, "error": None},
            )
        if not sp_result.ok:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"write_setpoint failed: {sp_result.error}",
                data={**identifiers, "failedStep": "write_setpoint", "steps": steps},
            )

        # ── Step 2: write_ramping_rate ────────────────────────────────────
        rr_cmd = DeviceCommand(
            device_id=command.device_id,
            device_type=command.device_type,
            queue_type=command.queue_type,
            action="write_ramping_rate",
            payload={"value": ramping_rate},
            response_mode=command.response_mode,
            context={"origin": "recipe_step_start"},
        )
        rr_result = self._run_write_ramping_rate(rr_cmd)
        steps.append({"action": "write_ramping_rate", "ok": rr_result.ok, "error": rr_result.error})
        if rr_result.ok and rr_result.data:
            self._state_manager.update_temperature_state(
                command.device_id,
                {**rr_result.data, "error": None},
            )
        if not rr_result.ok:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"write_ramping_rate failed: {rr_result.error}",
                data={**identifiers, "failedStep": "write_ramping_rate", "steps": steps},
            )

        # ── Step 3: set_run_mode ──────────────────────────────────────────
        run_cmd = DeviceCommand(
            device_id=command.device_id,
            device_type=command.device_type,
            queue_type=command.queue_type,
            action="set_run_mode",
            payload={},
            response_mode=command.response_mode,
            context={"origin": "recipe_step_start"},
        )
        run_result = self._run_control(run_cmd)
        steps.append({"action": "set_run_mode", "ok": run_result.ok, "error": run_result.error})
        if run_result.ok and run_result.data:
            self._state_manager.update_temperature_state(
                command.device_id,
                {**run_result.data, "error": None},
            )
        if not run_result.ok:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"set_run_mode failed: {run_result.error}",
                data={**identifiers, "failedStep": "set_run_mode", "steps": steps},
            )

        # ── All steps succeeded ───────────────────────────────────────────
        final_state = self._state_manager.get_temperature_state(command.device_id) or {}
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=command.device_id,
            data={**identifiers, "steps": steps, "state": final_state},
        )

    def _run_safe_stop_mode(self, command: DeviceCommand) -> CommandResult:
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="Temperature device is not connected",
            )

        if self._safe_stopping:
            return CommandResult(
                command_id=command.command_id,
                ok=True,
                device_id=command.device_id,
                data=self._safe_stop_patch(),
            )

        state = self._state_manager.get_temperature_state(command.device_id) or {}
        run_mode = bool(state.get("temperatureRunMode", state.get("runMode", False)))
        pv = self._coerce_float(state.get("pv", state.get("currentTemperature")))
        plan = self._safe_stop_plan(pv)

        if not run_mode or plan is None:
            return self._run_control_internal(command)

        mode, target, threshold = plan
        self._safe_stopping = True
        self._safe_stop_target = target
        self._safe_stop_cancel.clear()
        self._state_manager.update_temperature_state(
            command.device_id,
            {
                "safeStopping": True,
                "safeStopTarget": target,
                "temperatureRunMode": False,
                "runMode": False,
                "connected": True,
                "error": None,
                "lastCommandId": command.command_id,
            },
        )
        self._safe_stop_thread = threading.Thread(
            target=self._safe_stop_worker,
            args=(command.device_id, mode, target, threshold),
            name="temp-safe-stop",
            daemon=True,
        )
        self._safe_stop_thread.start()
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=command.device_id,
            data=self._safe_stop_patch(),
        )

    def _run_force_stop_mode(self, command: DeviceCommand) -> CommandResult:
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=True,
                device_id=command.device_id,
                data={
                    "connected": False,
                    "safeStopping": False,
                    "safeStopTarget": None,
                    "temperatureRunMode": False,
                    "runMode": False,
                },
            )

        self._safe_stop_cancel.set()
        if self._safe_stop_thread and self._safe_stop_thread.is_alive():
            self._safe_stop_thread.join(timeout=3.0)

        self._safe_stopping = False
        self._safe_stop_target = None
        result = self._run_control_internal(
            self._make_command(command.device_id, "set_stop_mode")
        )
        data = {
            **(result.data if result.data else {}),
            "safeStopping": False,
            "safeStopTarget": None,
            "temperatureRunMode": False,
            "runMode": False,
            "connected": True,
        }
        self._state_manager.update_temperature_state(
            command.device_id,
            {**data, "error": None, "lastCommandId": command.command_id},
        )
        return CommandResult(
            command_id=command.command_id,
            ok=result.ok,
            device_id=command.device_id,
            data=data,
            error=result.error,
        )

    def _safe_stop_worker(
        self,
        device_id: str,
        mode: str,
        target: float,
        threshold: float,
    ) -> None:
        max_wait_sec = 1800.0
        poll_interval_sec = 1.0
        stable_required_sec = 3.0
        reapply_interval_sec = 30.0
        ramping_rate = 30.0
        elapsed = 0.0
        stable_elapsed = 0.0
        next_reapply = 0.0

        try:
            while elapsed < max_wait_sec and not self._safe_stop_cancel.is_set():
                if elapsed >= next_reapply:
                    self._apply_safe_stop_parameters(device_id, target, ramping_rate)
                    next_reapply += reapply_interval_sec

                status = self._read_status_internal(device_id)
                if status.ok and status.data:
                    self._state_manager.update_temperature_state(
                        device_id,
                        {**self._with_safe_stop_state(status.data), "error": None},
                    )

                pv = self._coerce_float(status.data.get("pv") if status.data else None)
                reached = (
                    pv is not None and pv >= threshold
                    if mode == "cold"
                    else pv is not None and pv < threshold
                )
                if reached:
                    stable_elapsed += poll_interval_sec
                    if stable_elapsed >= stable_required_sec:
                        logger.info(
                            "[TemperatureActor] safe stop target reached mode=%s pv=%s target=%s",
                            mode,
                            pv,
                            target,
                        )
                        break
                else:
                    stable_elapsed = 0.0

                time.sleep(poll_interval_sec)
                elapsed += poll_interval_sec

            if elapsed >= max_wait_sec:
                logger.warning("[TemperatureActor] safe stop timed out; forcing stop")

            if not self._safe_stop_cancel.is_set():
                stop_result = self._run_control_internal(
                    self._make_command(device_id, "set_stop_mode")
                )
                if stop_result.ok and stop_result.data:
                    self._state_manager.update_temperature_state(
                        device_id,
                        {
                            **stop_result.data,
                            "safeStopping": False,
                            "safeStopTarget": None,
                            "error": None,
                        },
                    )
                elif not stop_result.ok:
                    logger.warning(
                        "[TemperatureActor] safe stop final stop failed: %s",
                        stop_result.error,
                    )
        except Exception:
            logger.exception("[TemperatureActor] safe stop worker failed")
        finally:
            self._safe_stopping = False
            self._safe_stop_target = None
            self._safe_stop_cancel.clear()
            self._state_manager.update_temperature_state(
                device_id,
                {
                    "safeStopping": False,
                    "safeStopTarget": None,
                    "temperatureRunMode": False,
                    "runMode": False,
                },
            )
            self._safe_stop_thread = None

    def _apply_safe_stop_parameters(
        self,
        device_id: str,
        target: float,
        ramping_rate: float,
    ) -> None:
        if self._safe_stop_cancel.is_set():
            return

        setpoint = self._run_control_internal(
            self._make_command(device_id, "write_setpoint", {"value": target})
        )
        if not setpoint.ok:
            logger.warning("[TemperatureActor] safe stop setpoint failed: %s", setpoint.error)

        run = self._run_control_internal(self._make_command(device_id, "set_run_mode"))
        if not run.ok:
            logger.warning("[TemperatureActor] safe stop run mode failed: %s", run.error)

        ramp = self._run_write_ramping_rate_internal(
            self._make_command(device_id, "write_ramping_rate", {"value": ramping_rate})
        )
        if not ramp.ok:
            logger.warning("[TemperatureActor] safe stop ramping rate failed: %s", ramp.error)

        self._state_manager.update_temperature_state(
            device_id,
            {
                "sv": target,
                "targetSetpoint": target,
                "rampingRate": ramping_rate,
                **self._safe_stop_patch(),
                "error": None,
            },
        )

    def _read_status_internal(self, device_id: str) -> CommandResult:
        command = self._make_command(device_id, "read_status")
        if not self._connected:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=device_id,
                error="Temperature device is not connected",
            )
        responses = self._run_transactions(command)
        return self._controller.parse_result(command, responses)

    def _safe_stop_plan(self, pv: Optional[float]) -> Optional[tuple[str, float, float]]:
        if pv is None:
            return None
        model = self._model.upper()
        target = 100.0 if "CH" in model else 30.0
        threshold = target + 2.0
        if pv >= threshold:
            return ("high", target, threshold)
        if pv < 0:
            cold_target = 10.0
            return ("cold", cold_target, cold_target - 1.0)
        return None

    def _safe_stop_patch(self) -> dict[str, Any]:
        patch: dict[str, Any] = {
            "safeStopping": self._safe_stopping,
            "safeStopTarget": self._safe_stop_target,
        }
        if self._safe_stopping:
            patch.update({"temperatureRunMode": False, "runMode": False})
        return patch

    def _with_safe_stop_state(self, data: dict[str, Any]) -> dict[str, Any]:
        if not self._safe_stopping:
            return data
        return {**data, **self._safe_stop_patch()}

    def _make_command(
        self,
        device_id: str,
        action: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.SAFETY,
            action=action,
            payload=payload or {},
            response_mode=ResponseMode.WAIT,
            context={"origin": "safe_stop"},
        )

    @staticmethod
    def _coerce_float(value: Any) -> Optional[float]:
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    def _run_transactions(self, command: DeviceCommand) -> list[TransportResponse]:
        transactions = self._controller.build_transactions(command)
        return [self._transaction(tx) for tx in transactions]

    def _transaction(self, tx: Any) -> TransportResponse:
        with self._io_lock:
            return self._transport.transaction(tx)

    @staticmethod
    def _transport_config(command: DeviceCommand) -> dict[str, Any]:
        payload = command.payload
        return {
            "port": payload.get("port", ""),
            "baudrate": int(payload.get("baudrate") or 9600),
            "bytesize": int(payload.get("bytesize") or 8),
            "parity": payload.get("parity") or "N",
            "stopbits": float(payload.get("stopbits") or 1.0),
            "timeoutMs": int((payload.get("timeoutSec") or 1.0) * 1000),
        }

    def _polling_loop(self) -> None:
        device_id = self._polling_device_id
        next_tick = time.monotonic()

        while not self._polling_stop_event.is_set():
            interval_sec = self._polling_interval_sec
            next_tick += interval_sec
            if not self._poll_pending.is_set():
                self._poll_pending.set()
                self._scheduler.enqueue(
                    DeviceCommand(
                        device_id=device_id,
                        device_type="temperature",
                        queue_type=CommandQueueType.POLLING,
                        action="read_status",
                        payload={},
                        response_mode=ResponseMode.NONE,
                        context={"origin": "polling_loop"},
                    )
                )
            sleep_sec = max(0.0, next_tick - time.monotonic())
            self._polling_stop_event.wait(sleep_sec)
