"""Measurement / SMU device service (command-based, mock phase).

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


class MeasurementService:
    """Measurement / SMU 장비 use-case service. 현재는 mock CommandResult 반환."""

    # ── probe ─────────────────────────────────────────────────────────────────

    def _build_probe_command(self, device_id: str) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="measurement",
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
            device_type="measurement",
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
            device_type="measurement",
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

    # ── read ──────────────────────────────────────────────────────────────────

    def _build_read_command(self, device_id: str) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="measurement",
            queue_type=CommandQueueType.POLLING,
            action="read",
            payload={},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )

    async def read(self, device_id: str) -> CommandResult:
        command = self._build_read_command(device_id)
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=device_id,
            data={
                "voltage": 1.0,
                "current": 0.001,
                "outputEnabled": False,
            },
        )

    # ── source voltage ────────────────────────────────────────────────────────

    def _build_source_voltage_command(
        self, device_id: str, voltage: float, compliance_current: Optional[float]
    ) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="measurement",
            queue_type=CommandQueueType.CONTROL,
            action="source_voltage",
            payload={"voltage": voltage, "complianceCurrent": compliance_current},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )

    async def source_voltage(
        self, device_id: str, voltage: float, compliance_current: Optional[float] = None
    ) -> CommandResult:
        command = self._build_source_voltage_command(device_id, voltage, compliance_current)
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=device_id,
            data={
                "voltage": voltage,
                "complianceCurrent": compliance_current,
            },
        )

    # ── output on/off ─────────────────────────────────────────────────────────

    def _build_output_command(self, device_id: str, enabled: bool) -> DeviceCommand:
        return DeviceCommand(
            device_id=device_id,
            device_type="measurement",
            queue_type=CommandQueueType.CONTROL,
            action="output_enable",
            payload={"enabled": enabled},
            response_mode=ResponseMode.WAIT,
            context={"origin": "gui"},
        )

    async def set_output(self, device_id: str, enabled: bool) -> CommandResult:
        command = self._build_output_command(device_id, enabled)
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=device_id,
            data={
                "outputEnabled": enabled,
            },
        )
