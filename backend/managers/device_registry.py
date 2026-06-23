"""Device Registry 매니저.

등록된 장비 목록을 JSON 파일로 영속화한다.
스레드 안전을 위해 간단한 Lock 으로 보호한다.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from typing import Optional

from backend.managers.app_paths import get_devices_config_path
from backend.schemas.device import (
    DeviceSummary,
    DeviceType,
    RegisterDeviceRequest,
    RegisteredDevice,
    RegisteredDevicesSummary,
)


class DeviceRegistryManager:
    """등록된 장비의 CRUD + 영속화."""

    _instance: Optional["DeviceRegistryManager"] = None
    _instance_lock = threading.Lock()

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._devices: dict[str, RegisteredDevice] = {}
        self._loaded = False

    @classmethod
    def instance(cls) -> "DeviceRegistryManager":
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls()
                cls._instance._load()
            return cls._instance

    # ── 영속화 ────────────────────────────────────────────
    def _load(self) -> None:
        path = get_devices_config_path()
        if not path.exists():
            self._devices = {}
            self._loaded = True
            return

        try:
            with path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
            devices = raw.get("devices", []) if isinstance(raw, dict) else []
            parsed: dict[str, RegisteredDevice] = {}
            for item in devices:
                device = RegisteredDevice(**item)
                parsed[device.id] = device
            self._devices = parsed
        except Exception:
            # 손상된 파일은 빈 레지스트리로 시작(크래시 방지)
            self._devices = {}
        finally:
            self._loaded = True

    def _save(self) -> None:
        path = get_devices_config_path()
        payload = {
            "devices": [device.model_dump() for device in self._devices.values()],
        }
        tmp_path = path.with_suffix(".json.tmp")
        with tmp_path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        tmp_path.replace(path)

    # ── 조회 ──────────────────────────────────────────────
    def list_devices(self) -> list[RegisteredDevice]:
        with self._lock:
            return list(self._devices.values())

    def get_device(self, device_id: str) -> Optional[RegisteredDevice]:
        with self._lock:
            return self._devices.get(device_id)

    def find_by_type(self, device_type: DeviceType) -> Optional[RegisteredDevice]:
        with self._lock:
            for device in self._devices.values():
                if device.type == device_type:
                    return device
            return None

    def summary(self) -> RegisteredDevicesSummary:
        with self._lock:
            devices = [
                DeviceSummary(
                    id=d.id,
                    type=d.type,
                    displayName=d.displayName,
                    enabled=d.enabled,
                )
                for d in self._devices.values()
            ]
        return RegisteredDevicesSummary(
            hasRegisteredDevices=len(devices) > 0,
            count=len(devices),
            devices=devices,
        )

    # ── 등록/해제 ─────────────────────────────────────────
    def _next_id(self, device_type: DeviceType) -> str:
        index = 1
        while f"{device_type.value}-{index}" in self._devices:
            index += 1
        return f"{device_type.value}-{index}"

    def register(self, request: RegisterDeviceRequest) -> RegisteredDevice:
        with self._lock:
            # 같은 type 이 이미 있으면 갱신(덮어쓰기)
            existing = next(
                (d for d in self._devices.values() if d.type == request.type),
                None,
            )
            display_name = request.displayName or _default_display_name(request.type)

            if existing is not None:
                updated = existing.model_copy(
                    update={
                        "displayName": display_name,
                        "enabled": request.enabled,
                        "model": request.model,
                        "connection": request.connection,
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    }
                )
                self._devices[existing.id] = updated
                self._save()
                return updated

            device_id = self._next_id(request.type)
            device = RegisteredDevice(
                id=device_id,
                type=request.type,
                displayName=display_name,
                enabled=request.enabled,
                model=request.model,
                connection=request.connection,
            )
            self._devices[device_id] = device
            self._save()
            return device

    def unregister(self, device_id: str) -> bool:
        with self._lock:
            if device_id not in self._devices:
                return False
            del self._devices[device_id]
            self._save()
            return True


_DISPLAY_NAMES: dict[DeviceType, str] = {
    DeviceType.TEMPERATURE: "Temperature Controller",
    DeviceType.MFC: "Mass Flow Controller",
    DeviceType.HUMIDITY: "Humidity Controller",
    DeviceType.PRESSURE: "Pressure Controller",
    DeviceType.MEASUREMENT: "SMU",
    DeviceType.VACUUM: "Vacuum Controller",
    DeviceType.CHILLER: "Chiller",
}


def _default_display_name(device_type: DeviceType) -> str:
    return _DISPLAY_NAMES.get(device_type, device_type.value)
