from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.router import api_router


def create_app() -> FastAPI:
    app = FastAPI(title="Nextron Backend")
    # Electron renderer(dev: http://localhost:5173)에서 호출할 수 있도록 CORS 허용.
    # 로컬 전용 backend 이므로 모든 origin 을 허용한다.
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
