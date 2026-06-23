"""TemperatureActor.

FB100 장비 I/O 접근 경로는 이 Actor의 worker thread 하나뿐이다.
Service / Router / polling loop 모두 Actor.submit(command)를 통해서만
장비에 접근한다.

구조:
  TemperatureActor
  ├── IFb100Adapter (인터페이스)
  │   ├── MockFb100Adapter   (기본 fallback, 장비 없이 Actor 구조 검증)
  │   └── RealFb100Adapter   (NEXTRON_DEVICE_MODE=real 시 사용)
  ├── CommandScheduler (5-priority queue)
  ├── worker thread   (scheduler.dequeue() → _execute_command)
  └── polling thread  (drift-free tick → polling_queue에 command enqueue)
"""

from __future__ import annotations

import logging
import threading
import time
from abc import ABC, abstractmethod
from concurrent.futures import Future
from typing import Any, Optional

from backend.actors.scheduler import CommandScheduler
from backend.schemas.command import (
    CommandQueueType,
    CommandResult,
    DeviceCommand,
    ResponseMode,
)
from backend.state.state_manager import StateManager

logger = logging.getLogger(__name__)


# ── Fb100 Adapter 인터페이스 ───────────────────────────────────────────────────

class IFb100Adapter(ABC):
    """FB100 장비 접근 추상 인터페이스."""

    @abstractmethod
    def probe(self, port: str = "", **kwargs: Any) -> bool:
        """지정 포트가 FB100 응답을 반환하는지 확인."""

    @abstractmethod
    def connect(
        self,
        port: str = "",
        baudrate: int = 9600,
        timeout_ms: int = 1000,
        model: Optional[str] = None,
    ) -> bool:
        """장비 연결."""

    @abstractmethod
    def disconnect(self) -> bool:
        """장비 연결 해제."""

    @abstractmethod
    def read_current(self) -> dict[str, Any]:
        """현재 온도 읽기. 반환: {"currentTemperature": float, "unit": "C"}"""

    @abstractmethod
    def is_connected(self) -> bool:
        """현재 연결 여부."""


# ── Mock Adapter ──────────────────────────────────────────────────────────────

class MockFb100Adapter(IFb100Adapter):
    """실제 장비 없이 Actor 구조를 검증하기 위한 mock adapter."""

    def __init__(self) -> None:
        self._connected = False
        self._model: Optional[str] = None
        self._temperature = 25.3

    def probe(self, port: str = "", **kwargs: Any) -> bool:
        return True

    def connect(
        self,
        port: str = "",
        baudrate: int = 9600,
        timeout_ms: int = 1000,
        model: Optional[str] = None,
    ) -> bool:
        self._connected = True
        self._model = model or "FB100"
        logger.info("[MockFb100] connected port=%s model=%s", port, self._model)
        return True

    def disconnect(self) -> bool:
        self._connected = False
        logger.info("[MockFb100] disconnected")
        return True

    def read_current(self) -> dict[str, Any]:
        if not self._connected:
            raise RuntimeError("Not connected")
        self._temperature += 0.01  # 미세 변화로 폴링 갱신 확인
        return {"currentTemperature": round(self._temperature, 2), "unit": "C"}

    def is_connected(self) -> bool:
        return self._connected


# ── Real Adapter ──────────────────────────────────────────────────────────────

class RealFb100Adapter(IFb100Adapter):
    """기존 FB100TemperatureController를 래핑한 실제 adapter.

    TODO: FB100TemperatureController.read()가 현재 실제 PV/SV를 반환하지 않음.
          실제 Modbus/serial read 구현 후 read_current()를 업데이트할 것.
    """

    def __init__(self) -> None:
        from backend.controllers.temperature.fb100 import FB100TemperatureController
        from backend.schemas.device import ConnectionConfig

        self._ctrl = FB100TemperatureController()
        self._ConnectionConfig = ConnectionConfig
        self._mock_temp = 25.3  # TODO: 실제 PV read 구현 전 임시 값

    def probe(self, port: str = "", **kwargs: Any) -> bool:
        if not port:
            return False
        try:
            from backend.schemas.device import ConnectionConfig

            cfg = ConnectionConfig(port=port, baudrate=kwargs.get("baudrate", 9600))
            return self._ctrl.probe(cfg, None)
        except Exception:
            return False

    def connect(
        self,
        port: str = "",
        baudrate: int = 9600,
        timeout_ms: int = 1000,
        model: Optional[str] = None,
    ) -> bool:
        cfg = self._ConnectionConfig(
            port=port,
            baudrate=baudrate,
            timeoutMs=timeout_ms,
        )
        ok = self._ctrl.connect(cfg, model)
        logger.info("[RealFb100] connect port=%s ok=%s", port, ok)
        return ok

    def disconnect(self) -> bool:
        ok = self._ctrl.disconnect()
        logger.info("[RealFb100] disconnect ok=%s", ok)
        return ok

    def read_current(self) -> dict[str, Any]:
        if not self._ctrl.is_connected():
            raise RuntimeError("Not connected")
        # TODO: FB100 실제 PV read 구현 후 self._ctrl.read().currentTemperature 사용
        self._mock_temp += 0.01
        return {"currentTemperature": round(self._mock_temp, 2), "unit": "C"}

    def is_connected(self) -> bool:
        return self._ctrl.is_connected()


# ── TemperatureActor ──────────────────────────────────────────────────────────

class TemperatureActor:
    """Temperature FB100 장비 전용 Actor.

    FB100 장비 I/O는 이 Actor의 worker thread 하나에서만 수행된다.
    """

    def __init__(
        self,
        state_manager: StateManager,
        adapter: Optional[IFb100Adapter] = None,
    ) -> None:
        self._state_manager = state_manager
        self._adapter: IFb100Adapter = adapter or MockFb100Adapter()
        self._scheduler = CommandScheduler()

        # Worker thread
        self._worker_thread: Optional[threading.Thread] = None
        self._shutdown_event = threading.Event()

        # Polling thread
        self._polling_thread: Optional[threading.Thread] = None
        self._polling_stop_event = threading.Event()
        self._polling_interval_sec: float = 1.0
        self._polling_device_id: Optional[str] = None
        self._polling_active = False

        # polling_queue에 command가 들어있는지 추적 (중복 방지)
        self._poll_pending = threading.Event()

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        self._shutdown_event.clear()
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            name="temp-actor-worker",
            daemon=True,
        )
        self._worker_thread.start()
        logger.info("[TemperatureActor] worker started")

    def stop(self) -> None:
        self.stop_polling()
        self._shutdown_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=5.0)
        logger.info("[TemperatureActor] stopped")

    # ── submit ────────────────────────────────────────────────────────────────

    def submit(self, command: DeviceCommand) -> Optional[Future]:
        """command를 적절한 queue에 넣고, WAIT 모드면 Future를 반환한다."""
        future: Optional[Future] = None
        if command.response_mode == ResponseMode.WAIT:
            future = Future()
            command.result_future = future

        self._scheduler.enqueue(command)
        return future

    # ── polling ───────────────────────────────────────────────────────────────

    def start_polling(self, device_id: str, interval_sec: float = 1.0) -> None:
        if self._polling_active:
            self.stop_polling()

        self._polling_device_id = device_id
        self._polling_interval_sec = interval_sec
        self._polling_stop_event.clear()
        self._poll_pending.clear()
        self._polling_thread = threading.Thread(
            target=self._polling_loop,
            name="temp-polling",
            daemon=True,
        )
        self._polling_thread.start()
        self._polling_active = True
        self._state_manager.update_temperature_state(
            device_id, {"polling": True, "intervalSec": interval_sec}
        )
        logger.info(
            "[TemperatureActor] polling started device=%s interval=%.1fs",
            device_id,
            interval_sec,
        )

    def stop_polling(self) -> None:
        if not self._polling_active:
            return
        self._polling_stop_event.set()
        self._polling_active = False
        if self._polling_thread and self._polling_thread.is_alive():
            self._polling_thread.join(timeout=3.0)
        self._polling_thread = None
        if self._polling_device_id:
            self._state_manager.update_temperature_state(
                self._polling_device_id, {"polling": False}
            )
        logger.info("[TemperatureActor] polling stopped")

    # ── worker loop ───────────────────────────────────────────────────────────

    def _worker_loop(self) -> None:
        while not self._shutdown_event.is_set():
            command = self._scheduler.dequeue()
            if command is not None:
                self._execute_command(command)
            else:
                # 할 일 없으면 20ms 대기 후 재확인
                self._shutdown_event.wait(0.02)

    def _execute_command(self, command: DeviceCommand) -> None:
        try:
            result = self._dispatch(command)
        except Exception as exc:
            logger.exception(
                "[TemperatureActor] unhandled error action=%s", command.action
            )
            result = CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=str(exc),
            )

        # StateManager 업데이트 (ok인 경우만)
        if result.ok and result.data:
            self._state_manager.update_temperature_state(
                command.device_id,
                {**result.data, "lastCommandId": command.command_id},
            )

        # polling pending 플래그 해제
        if command.queue_type == CommandQueueType.POLLING:
            self._poll_pending.clear()

        # Future 완료 처리
        if command.result_future is not None and not command.result_future.done():
            if result.ok:
                command.result_future.set_result(result)
            else:
                command.result_future.set_exception(
                    RuntimeError(result.error or "command failed")
                )

    def _dispatch(self, command: DeviceCommand) -> CommandResult:
        action = command.action
        if action == "probe":
            return self._handle_probe(command)
        elif action == "connect":
            return self._handle_connect(command)
        elif action == "disconnect":
            return self._handle_disconnect(command)
        elif action == "read_current":
            return self._handle_read_current(command)
        else:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"unknown action: {action}",
            )

    # ── command handlers ──────────────────────────────────────────────────────

    def _handle_probe(self, command: DeviceCommand) -> CommandResult:
        port = command.payload.get("port", "")
        ok = self._adapter.probe(port=port)
        return CommandResult(
            command_id=command.command_id,
            ok=ok,
            device_id=command.device_id,
            data={"probed": ok},
            error=None if ok else "probe failed",
        )

    def _handle_connect(self, command: DeviceCommand) -> CommandResult:
        p = command.payload
        port = p.get("port", "")
        baudrate = int(p.get("baudrate") or 9600)
        timeout_ms = int((p.get("timeoutSec") or 1.0) * 1000)
        model = p.get("model") or "FB100"

        ok = self._adapter.connect(
            port=port, baudrate=baudrate, timeout_ms=timeout_ms, model=model
        )
        return CommandResult(
            command_id=command.command_id,
            ok=ok,
            device_id=command.device_id,
            data={"connected": ok, "model": model, "polling": False} if ok else {},
            error=None if ok else "connect failed",
        )

    def _handle_disconnect(self, command: DeviceCommand) -> CommandResult:
        # polling 먼저 중지 (worker 내에서 호출되므로 join 빠름)
        if self._polling_active:
            self.stop_polling()

        ok = self._adapter.disconnect()
        return CommandResult(
            command_id=command.command_id,
            ok=ok,
            device_id=command.device_id,
            data={"connected": False, "polling": False},
            error=None if ok else "disconnect failed",
        )

    def _handle_read_current(self, command: DeviceCommand) -> CommandResult:
        if not self._adapter.is_connected():
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                data={},
                error="Temperature device is not connected",
            )
        data = self._adapter.read_current()
        data["connected"] = True
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=command.device_id,
            data=data,
        )

    # ── polling loop ──────────────────────────────────────────────────────────

    def _polling_loop(self) -> None:
        """drift-free tick 방식으로 polling_queue에 read_current command를 넣는다.

        controller를 직접 호출하지 않는다 — 반드시 queue를 통한다.
        """
        device_id = self._polling_device_id
        interval_sec = self._polling_interval_sec
        next_tick = time.monotonic()

        while not self._polling_stop_event.is_set():
            next_tick += interval_sec

            # pending polling command가 없을 때만 새로 추가 (중복 방지)
            if not self._poll_pending.is_set():
                self._poll_pending.set()
                poll_cmd = DeviceCommand(
                    device_id=device_id,
                    device_type="temperature",
                    queue_type=CommandQueueType.POLLING,
                    action="read_current",
                    payload={},
                    response_mode=ResponseMode.NONE,
                    context={"origin": "polling_loop"},
                )
                self._scheduler.enqueue(poll_cmd)

            sleep_sec = max(0.0, next_tick - time.monotonic())
            self._polling_stop_event.wait(sleep_sec)
