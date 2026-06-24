"""Temperature device service (Actor 연동).

TemperatureActor를 통해서만 FB100 장비에 접근한다.
Router는 이 Service만 호출한다.
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
    TemperaturePollingStartRequest,
)
from backend.state.state_manager import StateManager


class TemperatureService:
    """온도 제어 장비 use-case service.

    Actor 주입 방식: backend_main.py lifespan에서 생성 후 app.state에 등록.
    """

    def __init__(
        self, actor: TemperatureActor, state_manager: StateManager
    ) -> None:
        self._actor = actor
        self._state_manager = state_manager

    # ── 공통 헬퍼 ─────────────────────────────────────────────────────────────

    async def _await(
        self, future: Future, command_id: str, device_id: str, timeout: float
    ) -> CommandResult:
        """concurrent.futures.Future → asyncio await + timeout 처리."""
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

    # ── probe ─────────────────────────────────────────────────────────────────

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

    # ── connect ───────────────────────────────────────────────────────────────

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

    # ── disconnect ────────────────────────────────────────────────────────────

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

    # ── read status (dashboard snapshot: sv/pv/hotPower/coolPower) ─────────────

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

    # ── write setpoint (mock 유지, 다음 단계에서 Actor 연동) ─────────────────

    async def write_setpoint(self, device_id: str, value: float) -> CommandResult:
        # TODO next phase: DeviceCommand CONTROL write_setpoint → Actor.submit
        command_id = str(uuid.uuid4())
        return CommandResult(
            command_id=command_id,
            ok=True,
            device_id=device_id,
            data={"targetSetpoint": value, "actualSetpoint": value, "unit": "C"},
        )

    # ── polling ───────────────────────────────────────────────────────────────

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

    # ── state 조회 ────────────────────────────────────────────────────────────

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
