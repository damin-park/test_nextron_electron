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
from backend.schemas.command import (
    CommandQueueType,
    CommandResult,
    DeviceCommand,
    ResponseMode,
)
from backend.schemas.temperature import (
    TemperatureConnectRequest,
    TemperatureManualStartRequest,
    TemperaturePollingStartRequest,
    TemperatureRecipeStepStartRequest,
)
from backend.state.state_manager import StateManager


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
        req = request or TemperatureConnectRequest()
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
            queue_type=CommandQueueType.CONTROL,
            action="set_stop_mode",
            payload={},
            response_mode=ResponseMode.WAIT,
            timeout_sec=5.0,
            context={"origin": "gui"},
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
            data={"polling": True, "intervalSec": req.intervalSec},
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
