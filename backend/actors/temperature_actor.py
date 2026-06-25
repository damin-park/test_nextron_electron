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

        self._polling_thread: Optional[threading.Thread] = None
        self._polling_stop_event = threading.Event()
        self._polling_interval_sec: float = 1.0
        self._polling_device_id: Optional[str] = None
        self._polling_active = False
        self._poll_pending = threading.Event()

        self._connected = False
        self._connection_config: Optional[dict[str, Any]] = None

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
        self.stop_polling()
        self._shutdown_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=5.0)
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

    def start_polling(self, device_id: str, interval_sec: float = 1.0) -> None:
        if self._polling_active:
            self.stop_polling()

        self._polling_device_id = device_id
        self._polling_interval_sec = interval_sec
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
            device_id, {"polling": True, "intervalSec": interval_sec}
        )
        logger.info(
            "[TemperatureActor] polling started device=%s interval=%.1fs",
            device_id,
            interval_sec,
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
            self._state_manager.update_temperature_state(
                command.device_id,
                {**result.data, "error": None, "lastCommandId": command.command_id},
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
        if action in ("write_setpoint", "set_run_mode", "set_stop_mode"):
            return self._run_control(command)
        if action == "write_ramping_rate":
            return self._run_write_ramping_rate(command)
        return CommandResult(
            command_id=command.command_id,
            ok=False,
            device_id=command.device_id,
            error=f"unknown action: {action}",
        )

    def _run_probe(self, command: DeviceCommand) -> CommandResult:
        config = self._transport_config(command)
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
        self._transport.open(config)
        responses = self._run_transactions(command)
        result = self._controller.parse_result(command, responses)
        if result.ok:
            self._connected = True
            self._connection_config = config
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
        responses = [self._transport.transaction(tx) for tx in write_transactions]
        return self._controller.parse_result(command, responses)

    def _run_transactions(self, command: DeviceCommand) -> list[TransportResponse]:
        transactions = self._controller.build_transactions(command)
        return [self._transport.transaction(tx) for tx in transactions]

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
        interval_sec = self._polling_interval_sec
        next_tick = time.monotonic()

        while not self._polling_stop_event.is_set():
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
