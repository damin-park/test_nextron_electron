from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TemperatureSetpointRequest(BaseModel):
    value: float


class TemperatureConnectRequest(BaseModel):
    """신규 command-based connect endpoint 용 request.

    device_id 기반 endpoint에서 사용. init-connect 흐름의
    schemas/device.py:TemperatureConnectRequest 와는 별도.
    """

    port: Optional[str] = None
    baudrate: Optional[int] = None
    timeoutSec: Optional[float] = None
    model: Optional[str] = "FB100"


class TemperaturePollingStartRequest(BaseModel):
    intervalSec: float = 1.0
