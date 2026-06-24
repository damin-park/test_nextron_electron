"""Device registry router (기존 init-connect 흐름).

init-connect 팝업에서 사용하는 장비 등록/조회 endpoint.
신규 command-based device-specific endpoint는 별도 router 참조.

경로:
  GET  /api/devices/registered
  GET  /api/devices/registered/summary
  POST /api/devices/register
  DELETE /api/devices/{device_id}
  GET  /api/devices/{device_id}/state

  GET  /api/devices/temperature/status    (init-connect 흐름)
  POST /api/devices/temperature/probe     (init-connect 흐름)
  POST /api/devices/temperature/connect   (init-connect 흐름)
  POST /api/devices/temperature/disconnect (init-connect 흐름)
  GET  /api/devices/temperature/read      (init-connect 흐름)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from backend.managers.device_registry import DeviceRegistryManager
from backend.managers.device_mode import get_device_mode
from backend.schemas.device import (
    RegisterDeviceRequest,
    RegisteredDevice,
    RegisteredDevicesSummary,
    TemperatureConnectRequest,
    TemperatureProbeRequest,
    TemperatureReading,
    TemperatureStatus,
)
from backend.schemas.temperature import (
    TemperatureConnectRequest as CommandTemperatureConnectRequest,
)
from backend.services.temperature_service import TemperatureService

router = APIRouter(prefix="/api/devices", tags=["devices"])
DEFAULT_TEMPERATURE_DEVICE_ID = "temperature-1"


# ── Device registry ───────────────────────────────────────────────────────────


@router.get("/registered/summary", response_model=RegisteredDevicesSummary)
def get_registered_summary() -> RegisteredDevicesSummary:
    registry = DeviceRegistryManager.instance()
    return registry.summary()


@router.get("/registered")
def get_registered() -> dict:
    registry = DeviceRegistryManager.instance()
    devices = registry.list_devices()
    return {
        "status": "ok",
        "devices": [
            {
                "deviceId": d.id,
                "deviceType": d.type.value,
                "displayName": d.displayName,
                "registered": True,
                "connected": False,
            }
            for d in devices
        ],
    }


@router.post("/register", response_model=RegisteredDevice)
def register_device(request: RegisterDeviceRequest) -> RegisteredDevice:
    registry = DeviceRegistryManager.instance()
    return registry.register(request)


@router.delete("/{device_id}")
def unregister_device(device_id: str) -> dict:
    registry = DeviceRegistryManager.instance()
    ok = registry.unregister(device_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"device '{device_id}' not found")
    return {"status": "ok", "deviceId": device_id}


@router.get("/{device_id}/state")
def get_device_state(device_id: str) -> dict:
    registry = DeviceRegistryManager.instance()
    device = registry.get_device(device_id)
    if device is None:
        raise HTTPException(status_code=404, detail=f"device '{device_id}' not found")
    return {
        "status": "ok",
        "deviceId": device_id,
        "deviceType": device.type.value,
        "displayName": device.displayName,
        "registered": True,
        "connected": False,
    }


# ── Temperature init-connect endpoints (device_id 없는 단일 장비 흐름) ──────────
# 신규 command-based endpoint는 /api/devices/temperature/{device_id}/... 참조.


@router.get("/temperature/status", response_model=TemperatureStatus)
async def temperature_status(request: Request) -> TemperatureStatus:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.get_state(DEFAULT_TEMPERATURE_DEVICE_ID)
    data = result.data if result.ok else {}
    connected = bool(data.get("connected"))
    reading = None
    if connected:
        reading = TemperatureReading(
            connected=True,
            currentTemperature=data.get("currentTemperature"),
            setpoint=data.get("targetSetpoint") or data.get("sv"),
            unit=str(data.get("unit") or "C"),
        )
    return TemperatureStatus(
        mode=get_device_mode(),
        connected=connected,
        port=data.get("port") or data.get("resource"),
        model=data.get("model"),
        reading=reading,
    )


@router.post("/temperature/probe")
async def temperature_probe(body: TemperatureProbeRequest, request: Request) -> dict:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.probe(
        device_id=DEFAULT_TEMPERATURE_DEVICE_ID,
        port=body.connection.port,
        baudrate=body.connection.baudrate,
        timeout_sec=body.connection.timeoutMs / 1000.0,
    )
    return {"ok": result.ok}


@router.post("/temperature/connect")
async def temperature_connect(body: TemperatureConnectRequest, request: Request) -> dict:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.connect(
        DEFAULT_TEMPERATURE_DEVICE_ID,
        CommandTemperatureConnectRequest(
            port=body.connection.port,
            baudrate=body.connection.baudrate,
            timeoutSec=body.connection.timeoutMs / 1000.0,
            model=body.model,
        ),
    )
    return {"ok": result.ok}


@router.post("/temperature/disconnect")
async def temperature_disconnect(request: Request) -> dict:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.disconnect(DEFAULT_TEMPERATURE_DEVICE_ID)
    return {"ok": result.ok}


@router.get("/temperature/read", response_model=TemperatureReading)
async def temperature_read(request: Request) -> TemperatureReading:
    svc: TemperatureService = request.app.state.temperature_service
    result = await svc.read_status(DEFAULT_TEMPERATURE_DEVICE_ID)
    data = result.data if result.ok else {}
    return TemperatureReading(
        connected=bool(data.get("connected")),
        currentTemperature=data.get("currentTemperature"),
        setpoint=data.get("targetSetpoint") or data.get("sv"),
        unit=str(data.get("unit") or "C"),
    )
