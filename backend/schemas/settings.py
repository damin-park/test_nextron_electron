from __future__ import annotations

from pydantic import BaseModel


class DataUpdateIntervalRequest(BaseModel):
    intervalSec: float


class LabModeRequest(BaseModel):
    enabled: bool


class LabUnitTimeRequest(BaseModel):
    unitTimeSec: int
