from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProtocolTransaction:
    name: str
    request: bytes
    expects_response: bool = True
    timeout_sec: float = 1.0


@dataclass(frozen=True)
class TransportResponse:
    name: str
    raw: bytes
