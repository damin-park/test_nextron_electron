from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class TemperatureSetpointRequest(BaseModel):
    value: float


class TemperatureRampingRateRequest(BaseModel):
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


class TemperatureManualStartRequest(BaseModel):
    setValue: float
    rampingRate: float


class TemperatureCommandStepResult(BaseModel):
    action: str
    ok: bool
    error: Optional[str] = None


class TemperatureManualStartResponse(BaseModel):
    ok: bool
    deviceId: str
    action: str = "manual_start"
    steps: List[TemperatureCommandStepResult]
    failedStep: Optional[str] = None
    error: Optional[str] = None
    state: Optional[Dict[str, Any]] = None


class TemperatureRecipeStepStartRequest(BaseModel):
    """Recipe step composite command request.

    Recipe 실행 중 한 step을 시작할 때 호출한다. Actor 내부에서
    write_setpoint → write_ramping_rate → set_run_mode 를 순차 실행한다.
    """

    recipeRunId: Optional[str] = None
    cycleIndex: int
    stepIndex: int
    setValue: float
    rampingRate: float


class TemperatureRecipeStepStartResponse(BaseModel):
    ok: bool
    deviceId: str
    action: str = "recipe_step_start"
    recipeRunId: Optional[str] = None
    cycleIndex: int
    stepIndex: int
    steps: List[TemperatureCommandStepResult]
    failedStep: Optional[str] = None
    error: Optional[str] = None
    state: Optional[Dict[str, Any]] = None
