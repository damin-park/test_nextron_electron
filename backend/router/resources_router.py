"""Resources router (serial / VISA 포트 조회).

경로:
  GET /api/resources/serial
  GET /api/resources/visa
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.managers.resource_service import list_serial_resources, list_visa_resources
from backend.schemas.device import SerialResource, VisaResource

router = APIRouter(prefix="/api/resources", tags=["resources"])


@router.get("/serial", response_model=list[SerialResource])
def get_serial_resources() -> list[SerialResource]:
    return list_serial_resources()


@router.get("/visa", response_model=list[VisaResource])
def get_visa_resources() -> list[VisaResource]:
    return list_visa_resources()
