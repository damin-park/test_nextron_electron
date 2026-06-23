"""MFC (Mass Flow Controller) device service (command-based, mock phase).

이번 단계에서는 mock CommandResult를 반환한다.
다음 단계에서 Actor.submit(command) 구조로 교체 예정.
"""

from __future__ import annotations

from typing import Optional

from backend.schemas.command import (
    CommandQueueType,
    CommandResult,
    DeviceCommand,
    ResponseMode,
)


class MfcService:
    """MFC 장비 use-case service. 현재는 mock CommandResult 반환."""

    # ── probe ─────────────────────────────────────────────────────────────────

    def _build_probe_command(self, device_id: str) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="mfc",
            queue_type=CommandQueueType.CONNECTION,
            action="probe",
            payload={},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )

    async def probe(self, device_id: str) -> CommandResult:
        command = self._build_probe_command(device_id)
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=device_id,
            data={"probed": True},
        )

    # ── connect ───────────────────────────────────────────────────────────────

    def _build_connect_command(self, device_id: str) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="mfc",
            queue_type=CommandQueueType.CONNECTION,
            action="connect",
            payload={},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )

    async def connect(self, device_id: str) -> CommandResult:
        command = self._build_connect_command(device_id)
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=device_id,
            data={"connected": True},
        )

    # ── disconnect ────────────────────────────────────────────────────────────

    def _build_disconnect_command(self, device_id: str) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="mfc",
            queue_type=CommandQueueType.CONNECTION,
            action="disconnect",
            payload={},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )

    async def disconnect(self, device_id: str) -> CommandResult:
        command = self._build_disconnect_command(device_id)
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=device_id,
            data={"connected": False},
        )

    # ── read flow ─────────────────────────────────────────────────────────────

    def _build_read_flow_command(self, device_id: str) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="mfc",
            queue_type=CommandQueueType.POLLING,
            action="read_flow",
            payload={},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )

    async def read_flow(self, device_id: str) -> CommandResult:
        command = self._build_read_flow_command(device_id)
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=device_id,
            data={
                "flowSccm": 50.0,
                "unit": "sccm",
            },
        )

    # ── set flow rate ─────────────────────────────────────────────────────────

    def _build_set_flow_command(
        self, device_id: str, flow_sccm: float, channel: Optional[int]
    ) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="mfc",
            queue_type=CommandQueueType.CONTROL,
            action="set_flow_rate",
            payload={"flowSccm": flow_sccm, "channel": channel},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )

    async def set_flow_rate(
        self, device_id: str, flow_sccm: float, channel: Optional[int] = None
    ) -> CommandResult:
        command = self._build_set_flow_command(device_id, flow_sccm, channel)
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=device_id,
            data={
                "flowSccm": flow_sccm,
                "unit": "sccm",
            },
        )
