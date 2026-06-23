"""애플리케이션 데이터/설정 경로 관리.

개발 PC 경로를 하드코딩하지 않는다.
우선순위:
  1) 환경변수 NEXTRON_DATA_DIR (Electron 이 userData 경로를 전달)
  2) Windows: %LOCALAPPDATA%\\Nextron
  3) 기타: ~/.nextron
"""

from __future__ import annotations

import os
from pathlib import Path


def get_data_dir() -> Path:
    env_dir = os.environ.get("NEXTRON_DATA_DIR")
    if env_dir:
        base = Path(env_dir)
    elif os.name == "nt":
        local = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        base = Path(local) / "Nextron"
    else:
        base = Path(os.path.expanduser("~")) / ".nextron"

    base.mkdir(parents=True, exist_ok=True)
    return base


def get_config_dir() -> Path:
    config_dir = get_data_dir() / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir


def get_devices_config_path() -> Path:
    """등록된 장비 목록 파일 경로."""
    return get_config_dir() / "registered_devices.json"
