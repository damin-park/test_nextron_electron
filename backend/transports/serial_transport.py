from __future__ import annotations

from typing import Any, Optional

from backend.transports.protocol import ProtocolTransaction, TransportResponse


class SerialTransport:
    """Serial transport for protocol transactions.

    The transport owns pyserial I/O only. It does not interpret FB100 command
    names or response payloads.
    """

    def __init__(self) -> None:
        self._config: Optional[dict[str, Any]] = None

    def open(self, config: dict[str, Any]) -> None:
        self._config = dict(config)

    def close(self) -> None:
        self._config = None

    def transaction(self, tx: ProtocolTransaction) -> TransportResponse:
        if self._config is None:
            raise RuntimeError("Serial transport is not open")

        import serial

        with serial.Serial(
            self._config["port"],
            baudrate=int(self._config.get("baudrate", 9600)),
            bytesize=int(self._config.get("bytesize", 8)),
            parity=self._config.get("parity", "N"),
            stopbits=float(self._config.get("stopbits", 1.0)),
            timeout=max(0.1, float(tx.timeout_sec)),
            write_timeout=1.0,
        ) as ser:
            if hasattr(ser, "reset_input_buffer"):
                ser.reset_input_buffer()
            ser.write(tx.request)
            ser.flush()

            if not tx.expects_response:
                return TransportResponse(name=tx.name, raw=b"")

            raw = bytearray()
            while True:
                chunk = ser.read(1)
                if not chunk:
                    break
                raw.extend(chunk)
                if chunk == b"\x03":
                    bcc = ser.read(1)
                    if bcc:
                        raw.extend(bcc)
                    break

            return TransportResponse(name=tx.name, raw=bytes(raw))
