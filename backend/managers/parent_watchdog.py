"""부모 프로세스(Electron main) 감시 watchdog.

Electron 이 backend 를 spawn 할 때 NEXTRON_PARENT_PID 환경변수로 자신의 PID 를
전달한다. 이 watchdog 은 해당 부모 프로세스가 종료되면(정상 종료/크래시/강제 kill
무관) backend 프로세스를 스스로 종료시킨다.

이렇게 하면 Electron 이 before-quit 으로 taskkill 하지 못하는 비정상 종료
상황에서도 backend 가 orphan 으로 남지 않는다.

standalone 실행(수동 uvicorn 기동 등)에서는 NEXTRON_PARENT_PID 가 없으므로
watchdog 이 비활성화된다.
"""

from __future__ import annotations

import logging
import os
import sys
import threading
import time

logger = logging.getLogger(__name__)

_ENV_PARENT_PID = "NEXTRON_PARENT_PID"


def start_parent_watchdog() -> bool:
    """NEXTRON_PARENT_PID 가 설정돼 있으면 부모 감시 스레드를 시작한다.

    반환: watchdog 을 시작했으면 True, (env 없음/파싱 실패면) False.
    """
    raw = os.environ.get(_ENV_PARENT_PID)
    if not raw:
        return False

    try:
        parent_pid = int(raw)
    except (TypeError, ValueError):
        logger.warning("[Watchdog] invalid %s=%r", _ENV_PARENT_PID, raw)
        return False

    if parent_pid <= 0:
        return False

    thread = threading.Thread(
        target=_watch_parent,
        args=(parent_pid,),
        name="parent-watchdog",
        daemon=True,
    )
    thread.start()
    logger.info("[Watchdog] watching parent pid=%d", parent_pid)
    return True


def _watch_parent(parent_pid: int) -> None:
    """부모가 종료될 때까지 대기한 뒤 backend 프로세스를 종료한다."""
    try:
        if sys.platform == "win32":
            _wait_parent_windows(parent_pid)
        else:
            _wait_parent_posix(parent_pid)
    except Exception:
        logger.exception("[Watchdog] error (ignored)")
        return

    logger.info("[Watchdog] parent pid=%d exited — shutting down backend", parent_pid)
    # 부모가 죽었으므로 backend 도 즉시 종료한다.
    os._exit(0)


def _wait_parent_windows(parent_pid: int) -> None:
    """Win32 OpenProcess + WaitForSingleObject(INFINITE) 로 부모 종료를 대기."""
    import ctypes

    SYNCHRONIZE = 0x00100000
    WAIT_FAILED = 0xFFFFFFFF
    INFINITE = 0xFFFFFFFF

    kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
    handle = kernel32.OpenProcess(SYNCHRONIZE, False, parent_pid)
    if not handle:
        # 부모 핸들을 못 열면(이미 종료 등) 폴링으로 대체
        _wait_parent_posix(parent_pid)
        return

    try:
        result = kernel32.WaitForSingleObject(handle, INFINITE)
        if result == WAIT_FAILED:
            _wait_parent_posix(parent_pid)
    finally:
        kernel32.CloseHandle(handle)


def _wait_parent_posix(parent_pid: int) -> None:
    """POSIX(및 fallback): signal 0 으로 부모 생존을 1초 간격 폴링."""
    while True:
        try:
            os.kill(parent_pid, 0)
        except OSError:
            return
        time.sleep(1.0)
