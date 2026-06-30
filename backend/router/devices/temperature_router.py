"""Temperature device router (command-based, device_id 포함).

prefix: /api/devices/temperature

경로:
  POST /{device_id}/probe
  POST /{device_id}/connect
  POST /{device_id}/disconnect
  GET  /{device_id}/state      ← 최신 상태 snapshot (sv/pv/hotPower/coolPower)
  GET  /{device_id}/status     ← state alias
  GET  /{device_id}/read-current  (deprecated alias → read_status, 신규 코드 사용 금지)
  POST /{device_id}/setpoint
  POST /{device_id}/polling/start  (내부용: 연결 시 자동 폴링되므로 사용자 노출 안 함)
  POST /{device_id}/polling/stop   (내부용)

Router는 TemperatureService(app.state)만 호출한다.
실제 장비 연결, Controller, Transport, Actor를 직접 알지 않는다.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from backend.schemas.common_response import ApiCommandResponse, to_api_response
from backend.schemas.temperature import (
    TemperatureConnectRequest,
    TemperatureDecimalPointRequest,
    TemperatureManualStartRequest,
    TemperaturePidSettingsRequest,
    TemperaturePollingStartRequest,
    TemperatureRampingRateRequest,
    TemperatureRecipeStepStartRequest,
    TemperatureSetpointRequest,
)
from backend.services.temperature_service import TemperatureService

router = APIRouter(tags=["temperature"])


@router.post("/{device_id}/probe", response_model=ApiCommandResponse)
async def probe(device_id: str, request: Request) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.probe(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/connect", response_model=ApiCommandResponse)
async def connect(
    device_id: str, body: TemperatureConnectRequest, request: Request
) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.connect(device_id=device_id, request=body)
    return to_api_response(result)


@router.post("/{device_id}/disconnect", response_model=ApiCommandResponse)
async def disconnect(device_id: str, request: Request) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.disconnect(device_id=device_id)
    return to_api_response(result)


@router.get("/{device_id}/read-current", response_model=ApiCommandResponse, deprecated=True)
async def read_current(device_id: str, request: Request) -> ApiCommandResponse:
    """Deprecated: read_status(/state)로 대체. 기존 호환용으로만 유지."""
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.read_status(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/setpoint", response_model=ApiCommandResponse)
async def setpoint(
    device_id: str, body: TemperatureSetpointRequest, request: Request
) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.write_setpoint(device_id=device_id, value=body.value)
    return to_api_response(result)


@router.post("/{device_id}/ramping-rate", response_model=ApiCommandResponse)
async def ramping_rate(
    device_id: str, body: TemperatureRampingRateRequest, request: Request
) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.write_ramping_rate(device_id=device_id, value=body.value)
    return to_api_response(result)


@router.get("/{device_id}/settings", response_model=ApiCommandResponse)
async def get_settings(device_id: str, request: Request) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.read_settings(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/settings/pid", response_model=ApiCommandResponse)
async def set_pid_settings(
    device_id: str, body: TemperaturePidSettingsRequest, request: Request
) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.write_pid_settings(device_id=device_id, request=body)
    return to_api_response(result)


@router.post("/{device_id}/settings/decimal-point", response_model=ApiCommandResponse)
async def set_decimal_point(
    device_id: str, body: TemperatureDecimalPointRequest, request: Request
) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.write_decimal_point(device_id=device_id, request=body)
    return to_api_response(result)


@router.post("/{device_id}/run", response_model=ApiCommandResponse)
async def run(device_id: str, request: Request) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.set_run_mode(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/stop", response_model=ApiCommandResponse)
async def stop(device_id: str, request: Request) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.set_stop_mode(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/manual/start", response_model=ApiCommandResponse)
async def manual_start(
    device_id: str, body: TemperatureManualStartRequest, request: Request
) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.manual_start(device_id=device_id, request=body)
    return to_api_response(result)


@router.post("/{device_id}/recipe/step/start", response_model=ApiCommandResponse)
async def recipe_step_start(
    device_id: str, body: TemperatureRecipeStepStartRequest, request: Request
) -> ApiCommandResponse:
    """Recipe step composite command.

    Actor 내부에서 write_setpoint → write_ramping_rate → set_run_mode를
    순차 실행한다. 실패 시 failedStep/steps/error를 반환한다.
    """
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.recipe_step_start(device_id=device_id, request=body)
    return to_api_response(result)


@router.post("/{device_id}/polling/start", response_model=ApiCommandResponse)
async def polling_start(
    device_id: str, body: TemperaturePollingStartRequest, request: Request
) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.start_polling(device_id=device_id, request=body)
    return to_api_response(result)


@router.post("/{device_id}/polling/stop", response_model=ApiCommandResponse)
async def polling_stop(device_id: str, request: Request) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.stop_polling(device_id=device_id)
    return to_api_response(result)


@router.get("/{device_id}/state", response_model=ApiCommandResponse)
async def get_state(device_id: str, request: Request) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.get_state(device_id=device_id)
    return to_api_response(result)


@router.get("/{device_id}/status", response_model=ApiCommandResponse)
async def get_status(device_id: str, request: Request) -> ApiCommandResponse:
    """state alias. 최신 snapshot(sv/pv/hotPower/coolPower)을 반환."""
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.get_state(device_id=device_id)
    return to_api_response(result)
