"""Command / Result 공통 모델.

Actor.submit(command) 구조를 위한 envelope.

Queue 분류:
  safety_queue    : emergency stop, safe stop, abort, output off
  connection_queue: probe, connect, disconnect, reconnect
  control_queue   : GUI 수동 제어 명령 + Recipe 제어 명령
  polling_queue   : current value, status, alarm, device health read
  background_queue: firmware info, device info, resource discovery
"""

from __future__ import annotations

import time
import uuid
from concurrent.futures import Future
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class CommandQueueType(str, Enum):
    SAFETY = "safety"
    CONNECTION = "connection"
    CONTROL = "control"
    POLLING = "polling"
    BACKGROUND = "background"


class ResponseMode(str, Enum):
    WAIT = "wait"
    ACCEPTED = "accepted"
    NONE = "none"


@dataclass
class DeviceCommand:
    """Actor.submit(command) 구조를 위한 command envelope.

    context 딕셔너리로 origin 등 선택적 메타를 기록한다.
    예: context={"origin": "gui"} | context={"origin": "polling_loop"}
    """

    device_id: str
    device_type: str
    queue_type: CommandQueueType
    action: str
    payload: dict[str, Any]
    response_mode: ResponseMode = ResponseMode.WAIT
    command_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timeout_sec: float = 5.0
    created_at: float = field(default_factory=time.monotonic)
    context: dict[str, Any] = field(default_factory=dict)
    result_future: Optional[Future] = field(default=None, compare=False, repr=False)


@dataclass
class CommandResult:
    """Service → Router 응답 envelope.

    ok=True  → status "ok"
    ok=False → status "error", error 필드에 메시지
    """

    command_id: str
    ok: bool
    device_id: Optional[str] = None
    data: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
