"""Temperature device router (command-based, device_id 포함).

prefix: /api/devices/temperature

경로:
  POST /{device_id}/probe
  POST /{device_id}/connect
  POST /{device_id}/disconnect
  GET  /{device_id}/read-current
  POST /{device_id}/setpoint
  POST /{device_id}/polling/start
  POST /{device_id}/polling/stop
  GET  /{device_id}/state

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


@router.get("/{device_id}/read-current", response_model=ApiCommandResponse)
async def read_current(device_id: str, request: Request) -> ApiCommandResponse:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.read_current(device_id=device_id)
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

