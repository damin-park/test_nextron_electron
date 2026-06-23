import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.router import api_router
from backend.schemas.device import DeviceMode
from backend.services.mfc_service import MfcService
from backend.services.measurement_service import MeasurementService
from backend.services.temperature_service import TemperatureService
from backend.state.state_manager import StateManager
from backend.telemetry.websocket_manager import TelemetryBroadcaster


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan — startup에서 long-lived 객체 생성, shutdown에서 정리."""
    from backend.managers.device_mode import get_device_mode
    from backend.managers.parent_watchdog import start_parent_watchdog

    # 부모(Electron main) 종료 감시 — 부모가 죽으면 backend 도 자동 종료.
    # (Electron 이 NEXTRON_PARENT_PID 로 자신의 PID 를 전달한 경우에만 활성화)
    start_parent_watchdog()

    # StateManager (thread-safe in-memory)
    state_manager = StateManager()

    # Telemetry broadcaster — StateManager 업데이트 시 최신 snapshot 을
    # WebSocket client 들에게 push 한다. 현재 event loop 를 bind 하고
    # StateManager listener 로 등록한다(Actor worker 스레드에서 동기 호출).
    telemetry_broadcaster = TelemetryBroadcaster()
    telemetry_broadcaster.bind_loop(asyncio.get_running_loop())
    state_manager.add_listener(telemetry_broadcaster.publish_snapshot)

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
    app.state.telemetry_broadcaster = telemetry_broadcaster
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
