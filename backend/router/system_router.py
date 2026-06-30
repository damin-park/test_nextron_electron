"""System-level shutdown routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

from backend.schemas.common_response import ApiCommandResponse, to_api_response
from backend.schemas.settings import (
    DataUpdateIntervalRequest,
    LabModeRequest,
    LabUnitTimeRequest,
)
from backend.services.app_settings_service import AppSettingsService
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


@router.get("/settings/intervals", response_model=ApiCommandResponse)
async def get_intervals(request: Request) -> ApiCommandResponse:
    svc: AppSettingsService = request.app.state.app_settings_service
    result = await svc.get_intervals()
    return to_api_response(result)


@router.post("/settings/intervals/data-update", response_model=ApiCommandResponse)
async def set_data_update_interval(
    body: DataUpdateIntervalRequest, request: Request
) -> ApiCommandResponse:
    settings_svc: AppSettingsService = request.app.state.app_settings_service
    system_svc: SystemService = request.app.state.system_service
    result = await settings_svc.set_data_update_interval(body.intervalSec)
    if result.ok:
        system_svc.set_data_update_interval(float(result.data["dataUpdate"]))
    return to_api_response(result)


@router.get("/settings/lab", response_model=ApiCommandResponse)
async def get_lab_settings(request: Request) -> ApiCommandResponse:
    svc: AppSettingsService = request.app.state.app_settings_service
    result = await svc.get_lab_settings()
    return to_api_response(result)


@router.post("/settings/lab/enabled", response_model=ApiCommandResponse)
async def set_lab_enabled(
    body: LabModeRequest, request: Request
) -> ApiCommandResponse:
    svc: AppSettingsService = request.app.state.app_settings_service
    result = await svc.set_lab_enabled(body.enabled)
    return to_api_response(result)


@router.post("/settings/lab/unit-time", response_model=ApiCommandResponse)
async def set_lab_unit_time(
    body: LabUnitTimeRequest, request: Request
) -> ApiCommandResponse:
    svc: AppSettingsService = request.app.state.app_settings_service
    result = await svc.set_lab_unit_time(body.unitTimeSec)
    return to_api_response(result)
