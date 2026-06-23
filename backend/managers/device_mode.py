"""장비 동작 모드(mock/real) 결정.

기본값은 real 이다.
NEXTRON_DEVICE_MODE=mock 일 때만 mock 어댑터를 사용한다.
"""

from __future__ import annotations

import os

from backend.schemas.device import DeviceMode


def get_device_mode() -> DeviceMode:
    raw = (os.environ.get("NEXTRON_DEVICE_MODE") or "real").strip().lower()
    if raw == "mock":
        return DeviceMode.MOCK
    return DeviceMode.REAL
