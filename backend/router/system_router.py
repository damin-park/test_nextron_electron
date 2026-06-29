"""System-level shutdown routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from backend.schemas.common_response import ApiCommandResponse, to_api_response
from backend.services.system_service import SystemService

router = APIRouter(prefix="/api/system", tags=["system"])


@router.post("/prepare-shutdown", response_model=ApiCommandResponse)
async def prepare_shutdown(request: Request) -> ApiCommandResponse:
    svc: SystemService = request.app.state.system_service
    result = await svc.prepare_shutdown()
    return to_api_response(result)


@router.get("/shutdown-status", response_model=ApiCommandResponse)
async def shutdown_status(request: Request) -> ApiCommandResponse:
    svc: SystemService = request.app.state.system_service
    result = await svc.shutdown_status()
    return to_api_response(result)


@router.post("/force-stop-all", response_model=ApiCommandResponse)
async def force_stop_all(request: Request) -> ApiCommandResponse:
    svc: SystemService = request.app.state.system_service
    result = await svc.force_stop_all()
    return to_api_response(result)
