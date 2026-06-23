"""Telemetry WebSocket router.

장비 telemetry snapshot 을 push 하는 WebSocket endpoint.

경로(단일 상수 관리):
  TELEMETRY_WS_PATH = "/ws/telemetry"

REST 와 달리 command 가 아니라 "Backend → Frontend 실시간 상태 push" 전용이다.
Frontend Dashboard 는 이 WebSocket 메시지로 값을 갱신한다(REST /state 반복 폴링 대체).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.telemetry.websocket_manager import TelemetryBroadcaster

logger = logging.getLogger(__name__)

# 최종 WebSocket 경로 — 한 곳에서만 정의한다.
TELEMETRY_WS_PATH = "/ws/telemetry"

router = APIRouter(tags=["telemetry"])


@router.websocket(TELEMETRY_WS_PATH)
async def telemetry_ws(websocket: WebSocket) -> None:
    """Telemetry snapshot push 용 WebSocket.

    client 는 별도 메시지를 보낼 필요가 없다(수신 전용). 연결 직후 최신 snapshot 을
    한 번 받고, 이후 StateManager 가 갱신될 때마다 device.telemetry 메시지를 받는다.
    """
    broadcaster: TelemetryBroadcaster = websocket.app.state.telemetry_broadcaster
    await broadcaster.connect(websocket)
    try:
        # client disconnect 를 감지하기 위해 수신 대기한다(메시지 자체는 무시).
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("[Telemetry] websocket loop error", exc_info=True)
    finally:
        broadcaster.disconnect(websocket)
