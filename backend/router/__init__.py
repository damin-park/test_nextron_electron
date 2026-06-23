from fastapi import APIRouter

from backend.router.devices_router import router as devices_router
from backend.router.health_router import router as health_router
from backend.router.resources_router import router as resources_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(devices_router)
api_router.include_router(resources_router)

__all__ = ["api_router"]
