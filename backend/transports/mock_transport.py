from __future__ import annotations

from typing import Any

from backend.transports.protocol import ProtocolTransaction, TransportResponse


class MockTransport:
    """Mock transport returning FB100-like raw response frames."""

    def __init__(self) -> None:
        self._open = False
        self._pv = 25.3
        self._sv = 30.0
        self._hot_power = 12.5
        self._cool_power = 0.0

    def open(self, config: dict[str, Any]) -> None:
        self._open = True

    def close(self) -> None:
        self._open = False

    def transaction(self, tx: ProtocolTransaction) -> TransportResponse:
        if not self._open:
            raise RuntimeError("Mock transport is not open")

        payloads = {
            "ID": "FB100",
            "XU": "1",
            "SR": "0",
            "MS": f"{self._sv:.1f}",
            "O1": f"{self._hot_power:.1f}",
            "O2": f"{self._cool_power:.1f}",
        }
        if tx.name == "M1":
            self._pv += 0.01
            payload = f"{self._pv:.2f}"
        else:
            payload = payloads.get(tx.name)
        if payload is None:
            raise RuntimeError(f"unsupported mock transaction: {tx.name}")
        return TransportResponse(name=tx.name, raw=self._frame(tx.name, payload))

    @staticmethod
    def _frame(name: str, payload: str) -> bytes:
        body = f"{name}{payload}".encode()
        body_with_etx = body + b"\x03"
        bcc = 0
        for b in body_with_etx:
            bcc ^= b
        return b"\x02" + body_with_etx + bytes([bcc])
