"""MFC device router (command-based, device_id 포함).

prefix: /api/devices/mfc

경로:
  POST /{device_id}/probe
  POST /{device_id}/connect
  POST /{device_id}/disconnect
  GET  /{device_id}/read-flow
  POST /{device_id}/flow-rate

Router는 MfcService(app.state)만 호출한다.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from backend.schemas.common_response import ApiCommandResponse, to_api_response
from backend.schemas.mfc import MfcFlowRateRequest
from backend.services.mfc_service import MfcService

router = APIRouter(tags=["mfc"])


@router.post("/{device_id}/probe", response_model=ApiCommandResponse)
async def probe(device_id: str, request: Request) -> ApiCommandResponse:
    svc: MfcService = request.app.state.mfc_service
    result = await svc.probe(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/connect", response_model=ApiCommandResponse)
async def connect(device_id: str, request: Request) -> ApiCommandResponse:
    svc: MfcService = request.app.state.mfc_service
    result = await svc.connect(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/disconnect", response_model=ApiCommandResponse)
async def disconnect(device_id: str, request: Request) -> ApiCommandResponse:
    svc: MfcService = request.app.state.mfc_service
    result = await svc.disconnect(device_id=device_id)
    return to_api_response(result)


@router.get("/{device_id}/read-flow", response_model=ApiCommandResponse)
async def read_flow(device_id: str, request: Request) -> ApiCommandResponse:
    svc: MfcService = request.app.state.mfc_service
    result = await svc.read_flow(device_id=device_id)
    return to_api_response(result)


@router.post("/{device_id}/flow-rate", response_model=ApiCommandResponse)
async def flow_rate(
    device_id: str, body: MfcFlowRateRequest, request: Request
) -> ApiCommandResponse:
    svc: MfcService = request.app.state.mfc_service
    result = await svc.set_flow_rate(
        device_id=device_id,
        flow_sccm=body.flowSccm,
        channel=body.channel,
    )
    return to_api_response(result)
