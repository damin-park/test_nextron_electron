"""System-level shutdown coordination service."""

from __future__ import annotations

import uuid
from concurrent.futures import Future

from backend.actors.temperature_actor import TemperatureActor
from backend.schemas.command import (
    CommandQueueType,
    CommandResult,
    DeviceCommand,
    ResponseMode,
)
from backend.services.temperature_service import TemperatureService
from backend.managers.state_manager import StateManager


TEMPERATURE_DEVICE_ID = "temperature-1"


class SystemService:
    def __init__(
        self,
        temperature_actor: TemperatureActor,
        temperature_service: TemperatureService,
        state_manager: StateManager,
    ) -> None:
        self._temperature_actor = temperature_actor
        self._temperature_service = temperature_service
        self._state_manager = state_manager

    async def prepare_shutdown(self) -> CommandResult:
        result = await self._temperature_service.set_stop_mode(TEMPERATURE_DEVICE_ID)
        status = self._shutdown_status_data()
        return CommandResult(
            command_id=result.command_id,
            ok=result.ok,
            device_id=None,
            data={
                **status,
                "temperatureStop": {
                    "ok": result.ok,
                    "error": result.error,
                    "data": result.data,
                },
            },
            error=result.error,
        )

    async def shutdown_status(self) -> CommandResult:
        return CommandResult(
            command_id=str(uuid.uuid4()),
            ok=True,
            device_id=None,
            data=self._shutdown_status_data(),
        )

    async def force_stop_all(self) -> CommandResult:
        command = DeviceCommand(
            device_id=TEMPERATURE_DEVICE_ID,
            device_type="temperature",
            queue_type=CommandQueueType.SAFETY,
            action="force_stop_mode",
            payload={},
            response_mode=ResponseMode.WAIT,
            timeout_sec=8.0,
            context={"origin": "system_shutdown"},
        )
        future = self._temperature_actor.submit(command)
        result = await self._await(future, command)
        status = self._shutdown_status_data()
        return CommandResult(
            command_id=command.command_id,
            ok=result.ok,
            device_id=None,
            data={
                **status,
                "temperatureForceStop": {
                    "ok": result.ok,
                    "error": result.error,
                    "data": result.data,
                },
            },
            error=result.error,
        )

    async def _await(self, future: Future | None, command: DeviceCommand) -> CommandResult:
        if future is None:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error="command did not return a future",
            )

        import asyncio

        try:
            return await asyncio.wait_for(
                asyncio.wrap_future(future),
                timeout=command.timeout_sec,
            )
        except asyncio.TimeoutError:
            future.cancel()
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"command timed out after {command.timeout_sec}s",
            )

    def _shutdown_status_data(self) -> dict[str, object]:
        temp = self._state_manager.get_temperature_state(TEMPERATURE_DEVICE_ID) or {}
        safe_stopping = temp.get("safeStopping") is True
        target = temp.get("safeStopTarget")
        safe_stop_info = {}
        if safe_stopping:
            safe_stop_info["TEMPERATURE"] = {
                "safeStopping": True,
                "target": target,
                "pv": temp.get("pv", temp.get("currentTemperature")),
                "sv": temp.get("sv", temp.get("targetSetpoint")),
                "hotPower": temp.get("hotPower"),
                "coolPower": temp.get("coolPower"),
                "unit": temp.get("unit") or "C",
            }
        return {
            "safeStopRequired": bool(safe_stop_info),
            "safeStopInfo": safe_stop_info,
        }

    def set_data_update_interval(self, interval_sec: float) -> None:
        self._temperature_actor.set_polling_interval(interval_sec)
