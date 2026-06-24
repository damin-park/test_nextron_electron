"""Legacy temperature service for init-connect compatibility.

New device-id based endpoints use backend.services.temperature_service with
TemperatureActor. This service remains only for older imports and avoids the
removed adapter/controller I/O shape.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Optional

from backend.controllers.temperature.fb100 import FB100
from backend.managers.device_mode import get_device_mode
from backend.schemas.command import CommandQueueType, DeviceCommand
from backend.schemas.device import (
    ConnectionConfig,
    DeviceMode,
    TemperatureProbeRequest,
    TemperatureReading,
    TemperatureStatus,
)
from backend.transports.mock_transport import MockTransport
from backend.transports.serial_transport import SerialTransport


class TemperatureService:
    _instance: Optional["TemperatureService"] = None

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._mode = get_device_mode()
        self._controller = FB100()
        self._transport = (
            SerialTransport() if self._mode == DeviceMode.REAL else MockTransport()
        )
        self._connected = False
        self._port: Optional[str] = None
        self._model: Optional[str] = None

    @classmethod
    def instance(cls) -> "TemperatureService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def probe(self, request: TemperatureProbeRequest) -> bool:
        async with self._lock:
            return await asyncio.to_thread(
                self._execute_probe,
                request.connection,
                request.model,
            )

    async def connect(self, connection: ConnectionConfig, model: Optional[str]) -> bool:
        async with self._lock:
            ok = await asyncio.to_thread(self._execute_connect, connection, model)
            if ok:
                self._port = connection.port
                self._model = model
                self._connected = True
            return ok

    async def disconnect(self) -> bool:
        async with self._lock:
            self._transport.close()
            self._connected = False
            self._port = None
            return True

    async def read(self) -> TemperatureReading:
        async with self._lock:
            if not self._connected:
                return TemperatureReading(connected=False)
            result = await asyncio.to_thread(self._execute_read_status)
            data = result.data if result.ok else {}
            return TemperatureReading(
                connected=result.ok,
                currentTemperature=data.get("currentTemperature"),
                setpoint=data.get("targetSetpoint") or data.get("sv"),
                unit=str(data.get("unit") or "C"),
            )

    async def status(self) -> TemperatureStatus:
        async with self._lock:
            reading = None
            if self._connected:
                result = await asyncio.to_thread(self._execute_read_status)
                data = result.data if result.ok else {}
                reading = TemperatureReading(
                    connected=result.ok,
                    currentTemperature=data.get("currentTemperature"),
                    setpoint=data.get("targetSetpoint") or data.get("sv"),
                    unit=str(data.get("unit") or "C"),
                )
            return TemperatureStatus(
                mode=self._mode,
                connected=self._connected,
                port=self._port,
                model=self._model,
                reading=reading,
            )

    def _execute_probe(
        self,
        connection: ConnectionConfig,
        model: Optional[str],
    ) -> bool:
        self._transport.open(self._config(connection))
        try:
            command = self._command("probe", {"model": model or "FB100"})
            responses = [
                self._transport.transaction(tx)
                for tx in self._controller.build_transactions(command)
            ]
            return self._controller.parse_result(command, responses).ok
        finally:
            self._transport.close()

    def _execute_connect(
        self,
        connection: ConnectionConfig,
        model: Optional[str],
    ) -> bool:
        payload = {
            "port": connection.port,
            "baudrate": connection.baudrate,
            "timeoutSec": connection.timeoutMs / 1000.0,
            "model": model or "FB100",
        }
        self._transport.open(self._config(connection))
        command = self._command("connect", payload)
        responses = [
            self._transport.transaction(tx)
            for tx in self._controller.build_transactions(command)
        ]
        result = self._controller.parse_result(command, responses)
        if not result.ok:
            self._transport.close()
        return result.ok

    def _execute_read_status(self):
        command = self._command("read_status", {})
        responses = [
            self._transport.transaction(tx)
            for tx in self._controller.build_transactions(command)
        ]
        return self._controller.parse_result(command, responses)

    @staticmethod
    def _config(connection: ConnectionConfig) -> dict:
        return {
            "port": connection.port,
            "baudrate": connection.baudrate,
            "bytesize": connection.bytesize,
            "parity": connection.parity,
            "stopbits": connection.stopbits,
            "timeoutMs": connection.timeoutMs,
        }

    @staticmethod
    def _command(action: str, payload: dict) -> DeviceCommand:
        return DeviceCommand(
            device_id="temperature-1",
            device_type="temperature",
            queue_type=CommandQueueType.CONNECTION,
            action=action,
            payload=payload,
            command_id=str(uuid.uuid4()),
        )
