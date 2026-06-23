"""실제 RKC FB100 temperature controller 어댑터 (read-only 우선).

기존 tkinter `FB100.test_connection` 의 ID 확인 로직을 read-only probe 로 재현한다.
setpoint write 등 제어 명령은 이번 작업 범위 밖이라 구현하지 않는다.
blocking serial I/O 이므로 호출부(TemperatureService)에서 asyncio.to_thread 로 감싼다.
"""

from __future__ import annotations

import math
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

    def _read_value(self, ser, cmd: str) -> float:
        """RKC FB100 단일 명령 read 후 float 파싱.

        요청:  {EOT}{addr:02d}{cmd}{ENQ}{EOT}
        응답:  {STX}{cmd echo(2)}{value}{ETX}{BCC}
        """
        if hasattr(ser, "reset_input_buffer"):
            ser.reset_input_buffer()
        request = f"{EOT}{self._channel:02d}{cmd}{ENQ}{EOT}".encode()
        ser.write(request)
        ser.flush()
        raw = ser.read(DATA_LENGTH)
        text = raw.decode(errors="ignore")
        start = text.find(STX)
        end = text.find(ETX)
        if start == -1 or end == -1 or end <= start:
            raise RuntimeError(f"invalid FB100 response for {cmd!r}: {raw!r}")
        payload = text[start + 1 : end]
        # payload = 2자리 명령 echo + 값 문자열
        value_str = payload[2:].strip()
        return float(value_str)

    @staticmethod
    def _normalize(value: Optional[float], decimal_point: Optional[int]) -> Optional[float]:
        """원본 normalize_temperature_value 재현 (스케일 변환 아님, 정밀도 절삭).

        기기는 이미 소수점이 포함된 값을 반환하므로 값 자체는 그대로 사용한다.
        decimal_point(XU) 0 = 정수, 1 = 소수 1자리로 절삭한다.
        """
        if value is None:
            return None
        numeric = float(value)
        if decimal_point == 0:
            return float(math.trunc(numeric))
        if decimal_point == 1:
            return math.trunc(numeric * 10) / 10
        return numeric

    def read_dashboard_values(self) -> dict:
        """Dashboard용 PV/SV/Hot/Cool 순차 read (한 serial 세션).

        FB100 명령: PV=M1, SV=MS, Hot Power=O1(%), Cool Power=O2(%),
        decimal point=XU, run/stop=SR.
        원본 get_data 규칙을 재현한다:
          - PV/SV 는 decimal point(XU)로 정밀도 절삭한다.
          - run_mode(SR==0)일 때만 MS(set value)를 읽고, 정지 상태면 SV에 PV값을 표시한다.
          - Hot/Cool power(O1/O2) 는 원시 % 값(절삭 없음).
        실패 시 예외를 그대로 전파한다(mock fallback 없음).
        단, XU/SR 은 보조 정보이므로 실패해도 기본값으로 진행한다.
        """
        import serial

        if not self._connection or not self._connected:
            raise RuntimeError("Not connected")
        conn = self._connection
        timeout_s = max(0.1, conn.timeoutMs / 1000.0)
        with serial.Serial(
            conn.port,
            baudrate=conn.baudrate,
            bytesize=conn.bytesize,
            parity=self._parity(conn.parity),
            stopbits=conn.stopbits,
            timeout=timeout_s,
            write_timeout=1.0,
        ) as ser:
            # 보조 정보: decimal point(XU), run/stop(SR) — 실패해도 진행
            decimal_point: Optional[int] = None
            try:
                xu = int(self._read_value(ser, "XU"))
                if xu in (0, 1):
                    decimal_point = xu
            except Exception:
                decimal_point = None
            run_mode = True
            try:
                run_mode = int(self._read_value(ser, "SR")) == 0
            except Exception:
                run_mode = True

            pv = self._normalize(self._read_value(ser, "M1"), decimal_point)
            # 정지 상태면 SV에 PV를 표시한다(원본 get_data 규칙)
            if run_mode:
                sv = self._normalize(self._read_value(ser, "MS"), decimal_point)
            else:
                sv = pv
            hot = self._read_value(ser, "O1")
            cool = self._read_value(ser, "O2")
        return {
            "sv": sv,
            "pv": pv,
            "hotPower": hot,
            "coolPower": cool,
            "unit": "C",
            "currentTemperature": pv,
            "targetSetpoint": sv,
        }

    def is_connected(self) -> bool:
        return self._connected
