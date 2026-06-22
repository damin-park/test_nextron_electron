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


@router.get("/health/live")
def health_live() -> dict[str, str]:
    """프로세스가 살아있는지 확인하는 liveness probe."""
    return {"status": "alive"}


@router.get("/health/ready")
def health_ready() -> dict[str, str]:
    """요청을 처리할 준비가 되었는지 확인하는 readiness probe."""
    return {"status": "ready"}
