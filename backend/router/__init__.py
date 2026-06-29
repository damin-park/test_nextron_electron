from fastapi import APIRouter

from backend.router.devices import (
    measurement_router,
    mfc_router,
    registry_router,
    temperature_router,
)
from backend.router.health_router import router as health_router
from backend.router.resources_router import router as resources_router
from backend.router.system_router import router as system_router
from backend.router.telemetry_router import router as telemetry_router

api_router = APIRouter()

# 기존 health / init-connect 흐름 유지
api_router.include_router(health_router)
api_router.include_router(registry_router)
api_router.include_router(resources_router)
api_router.include_router(system_router)

# Telemetry WebSocket (경로는 telemetry_router 내 TELEMETRY_WS_PATH 상수로 관리)
api_router.include_router(telemetry_router)

# 신규 command-based device-specific routers
api_router.include_router(temperature_router, prefix="/api/devices/temperature")
api_router.include_router(mfc_router, prefix="/api/devices/mfc")
api_router.include_router(measurement_router, prefix="/api/devices/measurement")

__all__ = ["api_router"]
