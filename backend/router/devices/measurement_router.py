"""Measurement / SMU device router (command-based, device_id 포함).

prefix: /api/devices/measurement

경로:
  POST /{device_id}/probe
  POST /{device_id}/connect
  POST /{device_id}/disconnect
  GET  /{device_id}/read
  POST /{device_id}/source-voltage
  POST /{device_id}/output

Router는 MeasurementService(app.state)만 호출한다.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from backend.schemas.common_response import ApiCommandResponse, to_api_response
from backend.schemas.measurement import OutputRequest, SourceVoltageRequest
from backend.services.measurement_service import MeasurementService

router = APIRouter(tags=["measurement"])


@router.post("/{device_id}/probe", response_model=ApiCommandResponse)
async def probe(device_id: str, request: Request) -> ApiCommandResponse:
    svc: MeasurementService = request.app.state.measurement_service
    result = await svc.probe(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/connect", response_model=ApiCommandResponse)
async def connect(device_id: str, request: Request) -> ApiCommandResponse:
    svc: MeasurementService = request.app.state.measurement_service
    result = await svc.connect(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/disconnect", response_model=ApiCommandResponse)
async def disconnect(device_id: str, request: Request) -> ApiCommandResponse:
    svc: MeasurementService = request.app.state.measurement_service
    result = await svc.disconnect(device_id=device_id)
    return to_api_response(result)


@router.get("/{device_id}/read", response_model=ApiCommandResponse)
async def read(device_id: str, request: Request) -> ApiCommandResponse:
    svc: MeasurementService = request.app.state.measurement_service
    result = await svc.read(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/source-voltage", response_model=ApiCommandResponse)
async def source_voltage(
    device_id: str, body: SourceVoltageRequest, request: Request
) -> ApiCommandResponse:
    svc: MeasurementService = request.app.state.measurement_service
    result = await svc.source_voltage(
        device_id=device_id,
        voltage=body.voltage,
        compliance_current=body.complianceCurrent,
    )
    return to_api_response(result)


@router.post("/{device_id}/output", response_model=ApiCommandResponse)
async def output(
    device_id: str, body: OutputRequest, request: Request
) -> ApiCommandResponse:
    svc: MeasurementService = request.app.state.measurement_service
    result = await svc.set_output(device_id=device_id, enabled=body.enabled)
    return to_api_response(result)
