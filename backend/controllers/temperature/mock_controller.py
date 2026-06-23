"""Mock temperature controller.

실제 장비 없이 Init Connect 흐름을 검증하기 위한 시뮬레이터.
probe/connect/read/disconnect 가 항상 안전하게 동작한다.
"""

from __future__ import annotations

from typing import Optional

from backend.controllers.temperature.base import TemperatureControllerBase
from backend.schemas.device import ConnectionConfig, TemperatureReading


class MockTemperatureController(TemperatureControllerBase):
    def __init__(self) -> None:
        self._connected = False
        self._port: Optional[str] = None
        self._model: Optional[str] = None
        self._current_temperature = 25.3
        self._setpoint = 30.0

    def probe(self, connection: ConnectionConfig, model: Optional[str]) -> bool:
        # mock 은 항상 probe 성공
        return True

    def connect(self, connection: ConnectionConfig, model: Optional[str]) -> bool:
        self._connected = True
        self._port = connection.port
        self._model = model
        return True

    def disconnect(self) -> bool:
        self._connected = False
        self._port = None
        return True

    def read(self) -> TemperatureReading:
        return TemperatureReading(
            connected=self._connected,
            currentTemperature=self._current_temperature if self._connected else None,
            setpoint=self._setpoint if self._connected else None,
            unit="\u00b0C",
        )

    def is_connected(self) -> bool:
        return self._connected
