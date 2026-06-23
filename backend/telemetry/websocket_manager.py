"""TelemetryBroadcaster.

기존 Tkinter DataConsumer가 받던 telemetry snapshot을 Electron으로 전달하는
경로의 backend 측 구현이다. StateManager가 업데이트될 때마다 최신 snapshot을
연결된 WebSocket client들에게 push 한다.

설계 원칙:
  - WebSocket broadcast 실패가 Actor worker thread를 죽이면 안 된다.
  - WebSocket client가 한 명도 없어도 backend polling은 정상 동작해야 한다.
  - 항상 "최신 snapshot"만 보낸다. 오래된 메시지를 큐에 무한히 쌓지 않는다.

스레딩:
  - StateManager.update_temperature_state() 는 Actor worker thread(동기)에서
    호출된다. 거기서 publish_snapshot() 이 동기로 불린다.
  - WebSocket 전송은 FastAPI event loop(비동기)에서만 가능하므로
    asyncio.run_coroutine_threadsafe 로 event loop 에 broadcast 를 스케줄한다.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)

TELEMETRY_MESSAGE_TYPE = "device.telemetry"


class TelemetryBroadcaster:
    """연결된 WebSocket client 관리 + 최신 snapshot broadcast."""

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._clients_lock = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        # 마지막으로 broadcast 한 메시지 (신규 client 연결 즉시 전달용)
        self._latest_message: Optional[dict[str, Any]] = None

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """FastAPI lifespan(event loop) 에서 호출. broadcast 스케줄 대상 loop."""
        self._loop = loop

    # ── client 관리 ───────────────────────────────────────────────────────────

    async def connect(self, websocket: WebSocket) -> None:
        """WebSocket 연결 수락 후 client 목록에 추가하고 최신 snapshot 즉시 전송."""
        await websocket.accept()
        with self._clients_lock:
            self._clients.add(websocket)
        logger.info("[Telemetry] client connected (total=%d)", len(self._clients))

        # WebSocket 연결 직후 최신 snapshot 을 한 번 보내 초기 표시를 빠르게 한다.
        latest = self._latest_message
        if latest is not None:
            try:
                await websocket.send_json(latest)
            except Exception:
                logger.debug("[Telemetry] initial snapshot send failed", exc_info=True)

    def disconnect(self, websocket: WebSocket) -> None:
        with self._clients_lock:
            self._clients.discard(websocket)
        logger.info("[Telemetry] client disconnected (total=%d)", len(self._clients))

    # ── publish (동기 — Actor worker thread 에서 호출) ──────────────────────────

    def publish_snapshot(self, devices_snapshot: dict[str, Any]) -> None:
        """StateManager listener 콜백. devices_snapshot 을 telemetry 메시지로 broadcast.

        Actor worker thread(동기)에서 호출된다. 어떤 예외도 호출자(Actor)로
        전파하지 않는다.
        """
        try:
            message = {
                "type": TELEMETRY_MESSAGE_TYPE,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "devices": devices_snapshot,
            }
            self._latest_message = message

            loop = self._loop
            if loop is None:
                # event loop 가 아직 bind 되지 않음 (startup 직후 등). client 도 없음.
                return

            # event loop 에 broadcast coroutine 을 스레드 안전하게 스케줄한다.
            asyncio.run_coroutine_threadsafe(self._broadcast(message), loop)
        except Exception:
            # broadcast 스케줄 실패가 Actor worker 를 죽이면 안 된다.
            logger.exception("[Telemetry] publish_snapshot failed (ignored)")

    async def _broadcast(self, message: dict[str, Any]) -> None:
        """event loop 안에서 실행. 모든 client 에 전송하고 죽은 연결을 정리한다.

        내부에서 모든 예외를 처리하여 run_coroutine_threadsafe future 에
        예외가 남지 않게 한다.
        """
        with self._clients_lock:
            clients = list(self._clients)

        if not clients:
            return

        dead: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        if dead:
            with self._clients_lock:
                for ws in dead:
                    self._clients.discard(ws)
            logger.info(
                "[Telemetry] removed %d dead client(s) (total=%d)",
                len(dead),
                len(self._clients),
            )
