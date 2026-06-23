"""공통 HTTP 응답 모델.

모든 장비 endpoint는 ApiCommandResponse를 통해 동일한 응답 envelope를 반환한다.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel

from backend.schemas.command import CommandResult


class ApiCommandResponse(BaseModel):
    status: Literal["ok", "error", "accepted"]
    commandId: str
    deviceId: Optional[str] = None
    data: dict[str, Any] = {}
    error: Optional[str] = None


def to_api_response(result: CommandResult) -> ApiCommandResponse:
    """CommandResult → ApiCommandResponse 변환 헬퍼."""
    return ApiCommandResponse(
        status="ok" if result.ok else "error",
        commandId=result.command_id,
        deviceId=result.device_id,
        data=result.data,
        error=result.error,
    )
