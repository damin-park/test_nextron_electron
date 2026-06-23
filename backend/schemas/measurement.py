from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class SourceVoltageRequest(BaseModel):
    voltage: float
    complianceCurrent: Optional[float] = None


class OutputRequest(BaseModel):
    enabled: bool
