"""장비 동작 모드(mock/real) 결정.

기본값은 안전하게 mock 이다.
NEXTRON_DEVICE_MODE=real 일 때만 실제 장비 어댑터를 사용한다.
"""

from __future__ import annotations

import os

from backend.schemas.device import DeviceMode


def get_device_mode() -> DeviceMode:
    raw = (os.environ.get("NEXTRON_DEVICE_MODE") or "mock").strip().lower()
    if raw == "real":
        return DeviceMode.REAL
    return DeviceMode.MOCK
