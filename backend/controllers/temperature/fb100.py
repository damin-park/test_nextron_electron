"""RKC FB100 protocol controller.

This controller builds FB100 protocol transactions and parses raw FB100
responses. It does not open serial ports or perform transport I/O.
"""

from __future__ import annotations

import math
from typing import Optional

from backend.schemas.command import CommandResult, DeviceCommand
from backend.transports.protocol import ProtocolTransaction, TransportResponse
from .fb100_static import ENQ, EOT, ETX, STX


class FB100:
    def __init__(self, channel: int = 1) -> None:
        self._channel = channel

    def build_transactions(self, command: DeviceCommand) -> list[ProtocolTransaction]:
        action = command.action
        if action in ("probe", "connect"):
            return [self._read_transaction("ID")]
        if action == "disconnect":
            return []
        if action == "read_status":
            return [
                self._read_transaction("XU"),
                self._read_transaction("SR"),
                self._read_transaction("M1"),
                self._read_transaction("MS"),
                self._read_transaction("O1"),
                self._read_transaction("O2"),
            ]
        if action == "write_setpoint":
            return [self._write_transaction("S1", command.payload["value"])]
        if action == "write_ramping_rate":
            return [self._read_transaction("HU")]
        if action == "set_run_mode":
            return [self._write_transaction("SR", 0)]
        if action == "set_stop_mode":
            return [self._write_transaction("SR", 1)]
        raise ValueError(f"unknown FB100 action: {action}")

    def parse_result(
        self,
        command: DeviceCommand,
        responses: list[TransportResponse],
    ) -> CommandResult:
        action = command.action
        try:
            if action == "probe":
                ok = "FB100" in self._response_payload(responses, "ID")
                return CommandResult(
                    command_id=command.command_id,
                    ok=ok,
                    device_id=command.device_id,
                    data={"probed": ok},
                    error=None if ok else "probe failed",
                )

            if action == "connect":
                ok = "FB100" in self._response_payload(responses, "ID")
                model = command.payload.get("model") or "FB100"
                port = command.payload.get("port")
                resource = command.payload.get("resource") or port
                return CommandResult(
                    command_id=command.command_id,
                    ok=ok,
                    device_id=command.device_id,
                    data={
                        "connected": ok,
                        "model": model,
                        "polling": ok,
                        "port": port,
                        "resource": resource,
                    }
                    if ok
                    else {},
                    error=None if ok else "connect failed",
                )

            if action == "disconnect":
                return CommandResult(
                    command_id=command.command_id,
                    ok=True,
                    device_id=command.device_id,
                    data={
                        "connected": False,
                        "polling": False,
                        "port": None,
                        "resource": None,
                    },
                )

            if action == "read_status":
                return self._parse_read_status(command, responses)

            if action == "write_setpoint":
                self._require_ack(responses, "S1")
                value = float(command.payload["value"])
                return CommandResult(
                    command_id=command.command_id,
                    ok=True,
                    device_id=command.device_id,
                    data={
                        "sv": value,
                        "targetSetpoint": value,
                        "unit": "C",
                    },
                )

            if action == "write_ramping_rate":
                self._require_ack(responses, "HL")
                self._require_ack(responses, "HH")
                value = float(command.payload["value"])
                return CommandResult(
                    command_id=command.command_id,
                    ok=True,
                    device_id=command.device_id,
                    data={"rampingRate": value, "rampingRateUnit": "C/min"},
                )

            if action == "set_run_mode":
                self._require_ack(responses, "SR")
                return CommandResult(
                    command_id=command.command_id,
                    ok=True,
                    device_id=command.device_id,
                    data={
                        "temperatureRunMode": True,
                        "runMode": True,
                        "connected": True,
                    },
                )

            if action == "set_stop_mode":
                self._require_ack(responses, "SR")
                return CommandResult(
                    command_id=command.command_id,
                    ok=True,
                    device_id=command.device_id,
                    data={
                        "temperatureRunMode": False,
                        "runMode": False,
                        "connected": True,
                    },
                )

            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=f"unknown action: {action}",
            )
        except Exception as exc:
            return CommandResult(
                command_id=command.command_id,
                ok=False,
                device_id=command.device_id,
                error=str(exc),
            )

    def _parse_read_status(
        self,
        command: DeviceCommand,
        responses: list[TransportResponse],
    ) -> CommandResult:
        decimal_point: Optional[int] = None
        try:
            xu = int(self._response_payload(responses, "XU"))
            if xu in (0, 1):
                decimal_point = xu
        except Exception:
            decimal_point = None

        run_mode = True
        try:
            run_mode = int(self._response_payload(responses, "SR")) == 0
        except Exception:
            run_mode = True

        pv = self._normalize(float(self._response_payload(responses, "M1")), decimal_point)
        if run_mode:
            sv = self._normalize(
                float(self._response_payload(responses, "MS")),
                decimal_point,
            )
        else:
            sv = pv

        hot = float(self._response_payload(responses, "O1"))
        cool = float(self._response_payload(responses, "O2"))
        return CommandResult(
            command_id=command.command_id,
            ok=True,
            device_id=command.device_id,
            data={
                "sv": sv,
                "pv": pv,
                "hotPower": hot,
                "coolPower": cool,
                "unit": "C",
                "currentTemperature": pv,
                "targetSetpoint": sv,
                "temperatureRunMode": run_mode,
                "runMode": run_mode,
                "connected": True,
            },
        )

    def build_ramping_write_transactions(
        self,
        value_c_per_min: float,
        hu_response: TransportResponse,
    ) -> list[ProtocolTransaction]:
        unit_time_sec = float(self._parse_response("HU", hu_response.raw))
        if unit_time_sec <= 0:
            raise RuntimeError(f"invalid FB100 HU value: {unit_time_sec}")
        raw_rate = float(value_c_per_min) * (unit_time_sec / 60.0)
        return [
            self._write_transaction("HL", raw_rate),
            self._write_transaction("HH", raw_rate),
        ]

    def _read_transaction(self, name: str) -> ProtocolTransaction:
        request = f"{EOT}{self._channel:02d}{name}{ENQ}{EOT}".encode()
        return ProtocolTransaction(name=name, request=request, timeout_sec=0.8)

    def _write_transaction(self, name: str, value: float | int) -> ProtocolTransaction:
        cdata = f"{name}{self._format_write_value(value)}{ETX}"
        bcc = 0
        for b in cdata.encode():
            bcc ^= b
        request = f"{EOT}{self._channel:02d}{STX}{cdata}{chr(bcc)}".encode()
        return ProtocolTransaction(name=name, request=request, timeout_sec=0.5)

    def _response_payload(
        self,
        responses: list[TransportResponse],
        name: str,
    ) -> str:
        for response in responses:
            if response.name == name:
                return self._parse_response(name, response.raw)
        raise RuntimeError(f"missing FB100 response: {name}")

    @staticmethod
    def _format_write_value(value: float | int) -> str:
        numeric = float(value)
        if numeric.is_integer():
            return str(int(numeric))
        return f"{numeric:g}"

    @staticmethod
    def _require_ack(
        responses: list[TransportResponse],
        name: str,
    ) -> None:
        for response in responses:
            if response.name == name:
                if b"\x06" in response.raw:
                    return
                raise RuntimeError(
                    f"FB100 write {name!r} did not return ACK: {response.raw!r}"
                )
        raise RuntimeError(f"missing FB100 ACK response: {name}")

    @staticmethod
    def _parse_response(name: str, raw: bytes) -> str:
        stx = ord(STX)
        etx = ord(ETX)
        try:
            stx_pos = raw.index(stx)
            etx_pos = raw.index(etx, stx_pos + 1)
        except ValueError as exc:
            raise RuntimeError(f"invalid FB100 response for {name!r}: {raw!r}") from exc

        if len(raw) <= etx_pos + 1:
            raise RuntimeError(f"missing FB100 BCC for {name!r}: {raw!r}")

        bcc_recv = raw[etx_pos + 1]
        bcc_calc = 0
        for b in raw[stx_pos + 1 : etx_pos + 1]:
            bcc_calc ^= b
        if bcc_calc != bcc_recv:
            raise RuntimeError(
                f"invalid FB100 BCC for {name!r}: recv={bcc_recv:#x}, calc={bcc_calc:#x}, raw={raw!r}"
            )

        identifier = raw[stx_pos + 1 : stx_pos + 3].decode(errors="replace")
        if identifier != name:
            raise RuntimeError(
                f"unexpected FB100 response id for {name!r}: {identifier!r}"
            )
        data = raw[stx_pos + 3 : etx_pos].decode(errors="replace").strip()
        if not data:
            raise RuntimeError(f"empty FB100 response for {name!r}: {raw!r}")
        return data

    @staticmethod
    def _normalize(value: Optional[float], decimal_point: Optional[int]) -> Optional[float]:
        if value is None:
            return None
        numeric = float(value)
        if decimal_point == 0:
            return float(math.trunc(numeric))
        if decimal_point == 1:
            return math.trunc(numeric * 10) / 10
        return numeric
