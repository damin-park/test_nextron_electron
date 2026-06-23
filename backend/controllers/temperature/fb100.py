"""실제 RKC FB100 temperature controller 어댑터 (read-only 우선).

기존 tkinter `FB100.test_connection` 의 ID 확인 로직을 read-only probe 로 재현한다.
setpoint write 등 제어 명령은 이번 작업 범위 밖이라 구현하지 않는다.
blocking serial I/O 이므로 호출부(TemperatureService)에서 asyncio.to_thread 로 감싼다.
"""

from __future__ import annotations

from typing import Optional

from backend.controllers.temperature.base import TemperatureControllerBase
from backend.schemas.device import ConnectionConfig, TemperatureReading
from .fb100_static import *

class FB100TemperatureController(TemperatureControllerBase):
    def __init__(self, channel: int = 1) -> None:
        self._channel = channel
        self._connection: Optional[ConnectionConfig] = None
        self._model: Optional[str] = None
        self._connected = False

    def _parity(self, parity: str):
        import serial

        mapping = {
            "N": serial.PARITY_NONE,
            "E": serial.PARITY_EVEN,
            "O": serial.PARITY_ODD,
        }
        return mapping.get((parity or "N").upper(), serial.PARITY_NONE)

    def _read_id(self, connection: ConnectionConfig) -> bytes:
        import serial

        timeout_s = max(0.1, connection.timeoutMs / 1000.0)
        with serial.Serial(
            connection.port,
            baudrate=connection.baudrate,
            bytesize=connection.bytesize,
            parity=self._parity(connection.parity),
            stopbits=connection.stopbits,
            timeout=timeout_s,
            write_timeout=1.0,
        ) as ser:
            if hasattr(ser, "reset_input_buffer"):
                ser.reset_input_buffer()
            cmd = f"{EOT}{self._channel:02d}ID{ENQ}{EOT}".encode()
            ser.write(cmd)
            ser.flush()
            return ser.read(DATA_LENGTH)

    def probe(self, connection: ConnectionConfig, model: Optional[str]) -> bool:
        try:
            response = self._read_id(connection)
            return b"FB100" in response
        except Exception:
            return False

    def connect(self, connection: ConnectionConfig, model: Optional[str]) -> bool:
        if not self.probe(connection, model):
            return False
        self._connection = connection
        self._model = model
        self._connected = True
        return True

    def disconnect(self) -> bool:
        self._connection = None
        self._connected = False
        return True

    def read(self) -> TemperatureReading:
        # 실제 PV/SV read 는 후속 단계. 현재는 연결 여부만 반환(read-only).
        return TemperatureReading(
            connected=self._connected,
            currentTemperature=None,
            setpoint=None,
            unit="\u00b0C",
        )

    def is_connected(self) -> bool:
        return self._connected
