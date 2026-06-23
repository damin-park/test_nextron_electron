"""Resource discovery (serial / visa).

현재 시스템에 실제로 연결된 포트를 조회한다(read-only, 안전).
- serial: pyserial `list_ports.comports()`
- visa: pyvisa `ResourceManager().list_resources()`
device mode(mock/real)와 무관하게 항상 실제 포트를 반환한다.
"""

from __future__ import annotations

from backend.schemas.device import SerialResource, VisaResource


def list_serial_resources() -> list[SerialResource]:
    try:
        from serial.tools import list_ports
    except Exception:
        return []

    resources: list[SerialResource] = []
    for port in list_ports.comports():
        resources.append(
            SerialResource(
                port=port.device,
                description=port.description or "",
            )
        )
    return resources


def list_visa_resources() -> list[VisaResource]:
    try:
        import pyvisa
    except Exception:
        return []

    try:
        rm = pyvisa.ResourceManager()
        resources = [VisaResource(resource=r, description="") for r in rm.list_resources()]
        rm.close()
        return resources
    except Exception:
        return []
