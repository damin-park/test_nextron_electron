"""Application settings persistence.

The legacy Tkinter app stores the shared data update interval at
config/app_state.json -> settings.intervals.data_update. Keep the same shape so
future device actors can consume one common polling interval.
"""

from __future__ import annotations

import json
import logging
import threading
import uuid
from typing import Any

from backend.managers.app_paths import get_config_dir
from backend.schemas.command import CommandResult

logger = logging.getLogger(__name__)

DEFAULT_DATA_UPDATE_INTERVAL_SEC = 1.0
MIN_DATA_UPDATE_INTERVAL_SEC = 0.5
LAB_BUILD_ENABLED = True
DEFAULT_LAB_ENABLED = False
DEFAULT_LAB_UNIT_TIME_SEC = 60


class AppSettingsService:
    """Load and persist app-level settings shared by device services."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._path = get_config_dir() / "app_state.json"

    def get_data_update_interval(self) -> float:
        with self._lock:
            state = self._load_state()
            value = (
                state.get("settings", {})
                .get("intervals", {})
                .get("data_update")
            )
            try:
                return self._coerce_interval(value, DEFAULT_DATA_UPDATE_INTERVAL_SEC)
            except ValueError:
                logger.warning(
                    "[AppSettingsService] invalid stored data_update interval: %s",
                    value,
                )
                return DEFAULT_DATA_UPDATE_INTERVAL_SEC

    async def get_intervals(self) -> CommandResult:
        interval = self.get_data_update_interval()
        return CommandResult(
            command_id=str(uuid.uuid4()),
            ok=True,
            device_id=None,
            data={
                "dataUpdate": interval,
                "minimum": MIN_DATA_UPDATE_INTERVAL_SEC,
                "default": DEFAULT_DATA_UPDATE_INTERVAL_SEC,
            },
        )

    async def set_data_update_interval(self, interval_sec: float) -> CommandResult:
        try:
            interval = self._coerce_interval(interval_sec, DEFAULT_DATA_UPDATE_INTERVAL_SEC)
        except ValueError as exc:
            return CommandResult(
                command_id=str(uuid.uuid4()),
                ok=False,
                device_id=None,
                error=str(exc),
            )

        with self._lock:
            state = self._load_state()
            settings = state.setdefault("settings", {})
            if not isinstance(settings, dict):
                settings = {}
                state["settings"] = settings
            intervals = settings.setdefault("intervals", {})
            if not isinstance(intervals, dict):
                intervals = {}
                settings["intervals"] = intervals
            intervals["data_update"] = interval
            self._save_state(state)

        return CommandResult(
            command_id=str(uuid.uuid4()),
            ok=True,
            device_id=None,
            data={
                "dataUpdate": interval,
                "minimum": MIN_DATA_UPDATE_INTERVAL_SEC,
                "default": DEFAULT_DATA_UPDATE_INTERVAL_SEC,
            },
        )

    def get_lab_settings_data(self) -> dict[str, Any]:
        with self._lock:
            state = self._load_state()
            lab = state.get("settings", {}).get("lab", {})
            if not isinstance(lab, dict):
                lab = {}
            return {
                "enabled": bool(lab.get("enabled", DEFAULT_LAB_ENABLED))
                if LAB_BUILD_ENABLED
                else False,
                "unitTimeSec": self._coerce_unit_time(
                    lab.get("unit_time", DEFAULT_LAB_UNIT_TIME_SEC)
                ),
                "available": LAB_BUILD_ENABLED,
            }

    async def get_lab_settings(self) -> CommandResult:
        return CommandResult(
            command_id=str(uuid.uuid4()),
            ok=True,
            device_id=None,
            data=self.get_lab_settings_data(),
        )

    async def set_lab_enabled(self, enabled: bool) -> CommandResult:
        if not LAB_BUILD_ENABLED:
            enabled = False
        with self._lock:
            state = self._load_state()
            lab = self._lab_section(state)
            lab["enabled"] = bool(enabled)
            self._save_state(state)
            data = self.get_lab_settings_data()
        return CommandResult(
            command_id=str(uuid.uuid4()),
            ok=True,
            device_id=None,
            data=data,
        )

    async def set_lab_unit_time(self, unit_time_sec: int) -> CommandResult:
        try:
            unit_time = self._coerce_unit_time(unit_time_sec)
        except ValueError as exc:
            return CommandResult(
                command_id=str(uuid.uuid4()),
                ok=False,
                device_id=None,
                error=str(exc),
            )

        with self._lock:
            state = self._load_state()
            lab = self._lab_section(state)
            lab["unit_time"] = unit_time
            self._save_state(state)
            data = self.get_lab_settings_data()
        return CommandResult(
            command_id=str(uuid.uuid4()),
            ok=True,
            device_id=None,
            data=data,
        )

    def _load_state(self) -> dict[str, Any]:
        if not self._path.exists():
            return {}
        try:
            with self._path.open("r", encoding="utf-8") as file:
                state = json.load(file)
            return state if isinstance(state, dict) else {}
        except Exception:
            logger.warning("[AppSettingsService] failed to load %s", self._path, exc_info=True)
            return {}

    def _save_state(self, state: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("w", encoding="utf-8") as file:
            json.dump(state, file, indent=2)

    @staticmethod
    def _lab_section(state: dict[str, Any]) -> dict[str, Any]:
        settings = state.setdefault("settings", {})
        if not isinstance(settings, dict):
            settings = {}
            state["settings"] = settings
        lab = settings.setdefault("lab", {})
        if not isinstance(lab, dict):
            lab = {}
            settings["lab"] = lab
        return lab

    @staticmethod
    def _coerce_interval(value: Any, fallback: float) -> float:
        if value is None:
            interval = fallback
        else:
            try:
                interval = float(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid interval value: {value}") from exc

        # Legacy compatibility: some old configs stored milliseconds.
        if interval >= 1000:
            interval = interval / 1000.0

        if interval <= 0:
            raise ValueError("Interval must be a positive number")
        return max(interval, MIN_DATA_UPDATE_INTERVAL_SEC)

    @staticmethod
    def _coerce_unit_time(value: Any) -> int:
        try:
            unit_time = int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid lab unit time: {value}") from exc
        if unit_time <= 0:
            raise ValueError("Lab unit time must be a positive integer")
        return unit_time
