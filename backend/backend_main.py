from fastapi import FastAPI

from backend.handlers.handler_loader import HandlerLoader
from backend.router import api_router


def create_app() -> FastAPI:
    app = FastAPI(title="Nextron Backend")
    HandlerLoader.load_handlers()
    app.include_router(api_router)
    return app


app = create_app()
