"""Thread-safe in-memory StateManager.

장비별 최신 상태를 저장한다. Actor worker thread와 FastAPI endpoint
양쪽에서 동시에 접근하므로 RLock으로 보호한다.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any, Optional


class StateManager:
    """장비 상태 in-memory 저장소."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._temperature: dict[str, dict[str, Any]] = {}

    # ── Temperature ───────────────────────────────────────────────────────────

    def update_temperature_state(
        self, device_id: str, patch: dict[str, Any]
    ) -> None:
        """device_id 항목을 patch로 업데이트 (없으면 신규 생성)."""
        with self._lock:
            if device_id not in self._temperature:
                self._temperature[device_id] = {
                    "deviceId": device_id,
                    "deviceType": "temperature",
                }
            self._temperature[device_id].update(patch)
            self._temperature[device_id]["lastUpdated"] = (
                datetime.now(timezone.utc).isoformat()
            )

    def get_temperature_state(self, device_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            entry = self._temperature.get(device_id)
            return dict(entry) if entry is not None else None

    # ── 전체 스냅샷 ───────────────────────────────────────────────────────────

    def get_snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "temperature": {
                    k: dict(v) for k, v in self._temperature.items()
                }
            }
