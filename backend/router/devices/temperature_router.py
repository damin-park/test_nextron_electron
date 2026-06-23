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
    TemperaturePollingStartRequest,
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

