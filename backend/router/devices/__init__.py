from backend.router.devices.measurement_router import router as measurement_router
from backend.router.devices.mfc_router import router as mfc_router
from backend.router.devices.registry_router import router as registry_router
from backend.router.devices.temperature_router import router as temperature_router

__all__ = [
    "measurement_router",
    "mfc_router",
    "registry_router",
    "temperature_router",
]
