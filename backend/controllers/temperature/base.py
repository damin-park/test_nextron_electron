"""Temperature controller adapter 인터페이스.

read-only probe / read 위주. setpoint write 는 이번 작업 범위 밖(mock 제한적).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from backend.schemas.device import ConnectionConfig, TemperatureReading


class TemperatureControllerBase(ABC):
    """Temperature controller 어댑터 공통 인터페이스."""

    @abstractmethod
    def probe(self, connection: ConnectionConfig, model: Optional[str]) -> bool:
        """read-only 방식으로 해당 포트가 temperature controller 인지 확인."""

    @abstractmethod
    def connect(self, connection: ConnectionConfig, model: Optional[str]) -> bool:
        """장비에 연결."""

    @abstractmethod
    def disconnect(self) -> bool:
        """장비 연결 해제."""

    @abstractmethod
    def read(self) -> TemperatureReading:
        """현재 온도/설정값 read-only 조회."""

    @abstractmethod
    def is_connected(self) -> bool:
        ...
