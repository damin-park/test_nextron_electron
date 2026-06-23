"""장비 관련 Pydantic 스키마.

기존 init-connect 흐름과 신규 command/service 계층 모두에서 공유한다.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class DeviceMode(str, Enum):
    MOCK = "mock"
    REAL = "real"


class DeviceType(str, Enum):
    TEMPERATURE = "temperature"
    MFC = "mfc"
    MEASUREMENT = "measurement"
    HUMIDITY = "humidity"
    PRESSURE = "pressure"
    VACUUM = "vacuum"
    CHILLER = "chiller"


class ConnectionConfig(BaseModel):
    port: str
    baudrate: int = 9600
    bytesize: int = 8
    parity: str = "N"
    stopbits: float = 1.0
    timeoutMs: int = 1000


# ── Temperature ───────────────────────────────────────────────────────────────

class TemperatureReading(BaseModel):
    connected: bool
    currentTemperature: Optional[float] = None
    setpoint: Optional[float] = None
    unit: str = "\u00b0C"


class TemperatureStatus(BaseModel):
    mode: DeviceMode
    connected: bool
    port: Optional[str] = None
    model: Optional[str] = None
    reading: Optional[TemperatureReading] = None


class TemperatureProbeRequest(BaseModel):
    connection: ConnectionConfig
    model: Optional[str] = None


class TemperatureConnectRequest(BaseModel):
    connection: ConnectionConfig
    model: Optional[str] = None


# ── Resources ─────────────────────────────────────────────────────────────────

class SerialResource(BaseModel):
    port: str
    description: str


class VisaResource(BaseModel):
    resource: str
    description: str


# ── Device Registry ───────────────────────────────────────────────────────────

class DeviceSummary(BaseModel):
    id: str
    type: DeviceType
    displayName: str
    enabled: bool


class RegisterDeviceRequest(BaseModel):
    type: DeviceType
    model: Optional[str] = None
    connection: Optional[ConnectionConfig] = None
    enabled: bool = True
    displayName: Optional[str] = None


class RegisteredDevice(BaseModel):
    id: str
    type: DeviceType
    displayName: str
    enabled: bool
    model: Optional[str] = None
    connection: Optional[ConnectionConfig] = None
    updatedAt: Optional[str] = None


class RegisteredDevicesSummary(BaseModel):
    devices: list[DeviceSummary]
    hasRegisteredDevices: bool
    count: int = 0
