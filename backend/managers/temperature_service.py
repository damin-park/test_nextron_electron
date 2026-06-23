"""Temperature service (싱글톤).

connect/read/probe/disconnect 명령을 asyncio.Lock 으로 직렬화하여
connect-during-read, read-during-disconnect, probe-during-register 등의
충돌을 방지한다. blocking serial I/O 는 asyncio.to_thread 로 분리한다.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from backend.controllers.temperature import (
    FB100TemperatureController,
    MockTemperatureController,
    TemperatureControllerBase,
)
from backend.managers.device_mode import get_device_mode
from backend.schemas.device import (
    ConnectionConfig,
    DeviceMode,
    TemperatureProbeRequest,
    TemperatureReading,
    TemperatureStatus,
)


class TemperatureService:
    _instance: Optional["TemperatureService"] = None
    _instance_lock = asyncio.Lock()

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._mode = get_device_mode()
        self._controller: TemperatureControllerBase = self._make_controller()
        # Connection Test(probe)는 mock/real 모드와 무관하게 실제 시리얼 포트를
        # read-only 방식으로 검증한다(설정값 write 없음).
        self._probe_controller = FB100TemperatureController()
        self._port: Optional[str] = None
        self._model: Optional[str] = None

    def _make_controller(self) -> TemperatureControllerBase:
        if self._mode == DeviceMode.REAL:
            return FB100TemperatureController()
        return MockTemperatureController()

    @classmethod
    def instance(cls) -> "TemperatureService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def probe(self, request: TemperatureProbeRequest) -> bool:
        async with self._lock:
            return await asyncio.to_thread(
                self._probe_controller.probe, request.connection, request.model
            )

    async def connect(self, connection: ConnectionConfig, model: Optional[str]) -> bool:
        async with self._lock:
            ok = await asyncio.to_thread(self._controller.connect, connection, model)
            if ok:
                self._port = connection.port
                self._model = model
            return ok

    async def disconnect(self) -> bool:
        async with self._lock:
            ok = await asyncio.to_thread(self._controller.disconnect)
            if ok:
                self._port = None
            return ok

    async def read(self) -> TemperatureReading:
        async with self._lock:
            return await asyncio.to_thread(self._controller.read)

    async def status(self) -> TemperatureStatus:
        async with self._lock:
            connected = self._controller.is_connected()
            reading = await asyncio.to_thread(self._controller.read) if connected else None
            return TemperatureStatus(
                mode=self._mode,
                connected=connected,
                port=self._port,
                model=self._model,
                reading=reading,
            )
