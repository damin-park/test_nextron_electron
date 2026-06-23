from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.router import api_router
from backend.schemas.device import DeviceMode
from backend.services.mfc_service import MfcService
from backend.services.measurement_service import MeasurementService
from backend.services.temperature_service import TemperatureService
from backend.state.state_manager import StateManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan — startup에서 long-lived 객체 생성, shutdown에서 정리."""
    from backend.managers.device_mode import get_device_mode

    # StateManager (thread-safe in-memory)
    state_manager = StateManager()

    # TemperatureActor — NEXTRON_DEVICE_MODE=real 이면 RealFb100Adapter 사용
    mode = get_device_mode()
    if mode == DeviceMode.REAL:
        from backend.actors.temperature_actor import RealFb100Adapter
        adapter = RealFb100Adapter()
    else:
        from backend.actors.temperature_actor import MockFb100Adapter
        adapter = MockFb100Adapter()

    from backend.actors.temperature_actor import TemperatureActor
    temperature_actor = TemperatureActor(state_manager=state_manager, adapter=adapter)
    temperature_actor.start()

    # app.state에 long-lived 인스턴스 등록
    app.state.state_manager = state_manager
    app.state.temperature_actor = temperature_actor
    app.state.temperature_service = TemperatureService(
        actor=temperature_actor,
        state_manager=state_manager,
    )
    app.state.mfc_service = MfcService()
    app.state.measurement_service = MeasurementService()

    yield

    # Shutdown — Actor 스레드 종료
    temperature_actor.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="Nextron Backend", lifespan=lifespan)
    # Electron renderer(dev: http://localhost:5173)에서 호출할 수 있도록 CORS 허용.
    # 로컬 전용 backend이므로 모든 origin을 허용한다.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    return app


app = create_app()
