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

from fastapi import APIRouter, HTTPException

from backend.managers.device_registry import DeviceRegistryManager
from backend.managers.temperature_service import (
    TemperatureService as TemperatureManager,
)
from backend.schemas.device import (
    RegisterDeviceRequest,
    RegisteredDevice,
    RegisteredDevicesSummary,
    TemperatureConnectRequest,
    TemperatureProbeRequest,
    TemperatureReading,
    TemperatureStatus,
)

router = APIRouter(prefix="/api/devices", tags=["devices"])


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
async def temperature_status() -> TemperatureStatus:
    svc = TemperatureManager.instance()
    return await svc.status()


@router.post("/temperature/probe")
async def temperature_probe(request: TemperatureProbeRequest) -> dict:
    svc = TemperatureManager.instance()
    ok = await svc.probe(request)
    return {"ok": ok}


@router.post("/temperature/connect")
async def temperature_connect(request: TemperatureConnectRequest) -> dict:
    svc = TemperatureManager.instance()
    ok = await svc.connect(request.connection, request.model)
    return {"ok": ok}


@router.post("/temperature/disconnect")
async def temperature_disconnect() -> dict:
    svc = TemperatureManager.instance()
    ok = await svc.disconnect()
    return {"ok": ok}


@router.get("/temperature/read", response_model=TemperatureReading)
async def temperature_read() -> TemperatureReading:
    svc = TemperatureManager.instance()
    return await svc.read()
