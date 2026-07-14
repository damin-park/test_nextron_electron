"""Temperature device service.

Routers call this service only. The service creates DeviceCommand envelopes and
submits them to TemperatureActor; it does not touch controllers or transports.
"""

from __future__ import annotations

import asyncio
import uuid
from concurrent.futures import Future
from typing import Optional

from backend.actors.temperature_actor import TemperatureActor
from backend.managers.device_registry import DeviceRegistryManager
from backend.schemas.command import (
    CommandQueueType,
    CommandResult,
    DeviceCommand,
    ResponseMode,
)
from backend.schemas.device import DeviceType
from backend.schemas.temperature import (
    TemperatureConnectRequest,
    TemperatureDecimalPointRequest,
    TemperatureManualStartRequest,
    TemperaturePidSettingsRequest,
    TemperaturePollingStartRequest,
    TemperatureRecipeStepStartRequest,
)
from backend.managers.state_manager import StateManager


class TemperatureService:
    """Temperature device use-case service."""

    def __init__(self, actor: TemperatureActor, state_manager: StateManager) -> None:
        self._actor = actor
        self._state_manager = state_manager

    async def _await(
        self, future: Future, command_id: str, device_id: str, timeout: float
    ) -> CommandResult:
        try:
            return await asyncio.wait_for(
                asyncio.wrap_future(future), timeout=timeout
            )
        except asyncio.TimeoutError:
            future.cancel()
            return CommandResult(
                command_id=command_id,
                ok=False,
                device_id=device_id,
                error=f"command timed out after {timeout}s",
            )
        except Exception as exc:
            return CommandResult(
                command_id=command_id,
                ok=False,
                device_id=device_id,
                error=str(exc),
            )

    async def probe(
        self,
        device_id: str,
        port: str = "",
        baudrate: int = 9600,
        timeout_sec: float = 1.0,
    ) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONNECTION,
            action="probe",
            payload={
                "port": port,
                "baudrate": baudrate,
                "timeoutSec": timeout_sec,
            },
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def connect(
        self, device_id: str, request: Optional[TemperatureConnectRequest] = None
    ) -> CommandResult:
        req = self._resolve_connect_request(device_id, request)
        if not req.port:
            return CommandResult(
                command_id=str(uuid.uuid4()),
                ok=False,
                device_id=device_id,
                error=(
                    "Temperature connection port is not configured. "
                    "Register the temperature controller connection first."
                ),
            )

        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONNECTION,
            action="connect",
            payload={
                "port": req.port or "",
                "baudrate": req.baudrate or 9600,
                "timeoutSec": req.timeoutSec or 1.0,
                "model": req.model or "FB100",
            },
            response_mode=ResponseMode.WAIT,
            timeout_sec=10.0,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    def _resolve_connect_request(
        self,
        device_id: str,
        request: Optional[TemperatureConnectRequest],
    ) -> TemperatureConnectRequest:
        req = request or TemperatureConnectRequest()
        if req.port:
            return req

        registry = DeviceRegistryManager.instance()
        device = registry.get_device(device_id)
        if device is None:
            device = registry.find_by_type(DeviceType.TEMPERATURE)
        if device is None or device.connection is None:
            return req

        return TemperatureConnectRequest(
            port=device.connection.port,
            baudrate=req.baudrate or device.connection.baudrate,
            timeoutSec=req.timeoutSec or device.connection.timeoutMs / 1000.0,
            model=device.model or req.model or "FB100",
        )

    async def disconnect(self, device_id: str) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONNECTION,
            action="disconnect",
            payload={},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def read_status(self, device_id: str) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.POLLING,
            action="read_status",
            payload={},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def write_setpoint(self, device_id: str, value: float) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONTROL,
            action="write_setpoint",
            payload={"value": value},
            response_mode=ResponseMode.WAIT,
            timeout_sec=5.0,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def write_ramping_rate(self, device_id: str, value: float) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONTROL,
            action="write_ramping_rate",
            payload={"value": value},
            response_mode=ResponseMode.WAIT,
            timeout_sec=6.0,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def set_run_mode(self, device_id: str) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONTROL,
            action="set_run_mode",
            payload={},
            response_mode=ResponseMode.WAIT,
            timeout_sec=5.0,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def set_stop_mode(self, device_id: str) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.SAFETY,
            action="set_stop_mode",
            payload={},
            response_mode=ResponseMode.WAIT,
            timeout_sec=5.0,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def read_settings(self, device_id: str) -> CommandResult:
        heat = await self._submit_temperature_settings_command(
            device_id=device_id,
            action="read_heat_pid",
            payload={},
        )
        if not heat.ok:
            return heat

        cool = await self._submit_temperature_settings_command(
            device_id=device_id,
            action="read_cool_pid",
            payload={},
        )
        if not cool.ok:
            return cool

        decimal = await self._submit_temperature_settings_command(
            device_id=device_id,
            action="read_decimal_point",
            payload={},
        )
        if not decimal.ok:
            return decimal

        state = self._state_manager.get_temperature_state(device_id) or {}
        return CommandResult(
            command_id=decimal.command_id,
            ok=True,
            device_id=device_id,
            data={
                "model": state.get("model"),
                "heat": heat.data.get("heat"),
                "cool": cool.data.get("cool"),
                "decimalPoint": decimal.data.get("decimalPoint"),
            },
        )

    async def write_pid_settings(
        self, device_id: str, request: TemperaturePidSettingsRequest
    ) -> CommandResult:
        result_data = {}
        command_id = str(uuid.uuid4())

        if request.heat is not None:
            heat = await self._submit_temperature_settings_command(
                device_id=device_id,
                action="write_heat_pid",
                payload={"values": request.heat.dict()},
            )
            command_id = heat.command_id
            if not heat.ok:
                return heat
            result_data.update(heat.data)

        if request.cool is not None:
            cool = await self._submit_temperature_settings_command(
                device_id=device_id,
                action="write_cool_pid",
                payload={"values": request.cool.dict()},
            )
            command_id = cool.command_id
            if not cool.ok:
                return cool
            result_data.update(cool.data)

        return CommandResult(
            command_id=command_id,
            ok=True,
            device_id=device_id,
            data=result_data,
        )

    async def write_decimal_point(
        self, device_id: str, request: TemperatureDecimalPointRequest
    ) -> CommandResult:
        return await self._submit_temperature_settings_command(
            device_id=device_id,
            action="write_decimal_point",
            payload={"value": request.value},
        )

    async def _submit_temperature_settings_command(
        self,
        device_id: str,
        action: str,
        payload: dict,
    ) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONTROL,
            action=action,
            payload=payload,
            response_mode=ResponseMode.WAIT,
            timeout_sec=8.0,
            context={"origin": "settings"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def start_polling(
        self,
        device_id: str,
        request: Optional[TemperaturePollingStartRequest] = None,
    ) -> CommandResult:
        req = request or TemperaturePollingStartRequest()
        command_id = str(uuid.uuid4())
        self._actor.start_polling(device_id=device_id, interval_sec=req.intervalSec)
        return CommandResult(
            command_id=command_id,
            ok=True,
            device_id=device_id,
            data={"polling": True, "intervalSec": self._actor.get_polling_interval()},
        )

    async def stop_polling(self, device_id: str) -> CommandResult:
        command_id = str(uuid.uuid4())
        self._actor.stop_polling()
        return CommandResult(
            command_id=command_id,
            ok=True,
            device_id=device_id,
            data={"polling": False},
        )

    async def get_state(self, device_id: str) -> CommandResult:
        command_id = str(uuid.uuid4())
        state = self._state_manager.get_temperature_state(device_id)
        if state is None:
            return CommandResult(
                command_id=command_id,
                ok=False,
                device_id=device_id,
                error=f"no state found for device '{device_id}'",
            )
        return CommandResult(
            command_id=command_id,
            ok=True,
            device_id=device_id,
            data=state,
        )

    async def manual_start(
        self, device_id: str, request: TemperatureManualStartRequest
    ) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONTROL,
            action="manual_start",
            payload={
                "setValue": request.setValue,
                "rampingRate": request.rampingRate,
            },
            response_mode=ResponseMode.WAIT,
            timeout_sec=20.0,
            context={"origin": "gui"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)

    async def recipe_step_start(
        self, device_id: str, request: TemperatureRecipeStepStartRequest
    ) -> CommandResult:
        command = DeviceCommand(
            device_id=device_id,
            device_type="temperature",
            queue_type=CommandQueueType.CONTROL,
            action="recipe_step_start",
            payload={
                "recipeRunId": request.recipeRunId,
                "cycleIndex": request.cycleIndex,
                "stepIndex": request.stepIndex,
                "setValue": request.setValue,
                "rampingRate": request.rampingRate,
            },
            response_mode=ResponseMode.WAIT,
            timeout_sec=20.0,
            context={"origin": "recipe"},
        )
        future = self._actor.submit(command)
        return await self._await(future, command.command_id, device_id, command.timeout_sec)
