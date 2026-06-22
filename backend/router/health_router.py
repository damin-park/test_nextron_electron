from fastapi import APIRouter

from backend.managers import BackendStateManager


router = APIRouter(tags=["system"])
state_manager = BackendStateManager.create()


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "uptime_seconds": round(state_manager.uptime_seconds(), 3),
    }
