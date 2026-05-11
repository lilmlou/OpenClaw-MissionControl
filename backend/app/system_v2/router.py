"""FastAPI router for /api/v2/system/* — Phase D1.

Contract: SYSTEM_V2_BACKEND.md §3 (paired with SYSTEM_V2_FRONTEND.md §3).

All endpoints return HTTP 200 even on failure. On uncaught error we emit
{available: false, error, ts}. The frontend hides panels with available:false.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from . import battery, bluetooth, cpu, disk, gpu, net, processes, ram, sensors
from . import services, apps
from . import cache as ttl_cache
from ._util import is_darwin, now_ms

log = logging.getLogger(__name__)

system_v2_router = APIRouter(prefix="/api/v2/system", tags=["system_v2"])


# ── TTL configuration (server-side) per §4 ─────────────────────────────────
_STATS_TTL_S = 1.0
_SENSORS_TTL_S = 2.0
_BATTERY_TTL_S = 15.0
_BLUETOOTH_TTL_S = 5.0
_PROCESSES_TTL_S = 2.0


def _safe(producer, label: str) -> Dict[str, Any]:
    """Call a section reader; on exception return its sub-dict empty.

    We never let one bad reader take down the whole /stats payload.
    """
    try:
        return producer()
    except Exception as exc:  # noqa: BLE001
        log.warning("system_v2 %s read failed: %s", label, exc)
        return {}


def _build_stats() -> Dict[str, Any]:
    if not is_darwin():
        return {"ts": now_ms(), "available": False, "error": "platform not supported"}
    return {
        "ts": now_ms(),
        "cpu": _safe(cpu.read, "cpu"),
        "gpu": _safe(gpu.read, "gpu"),
        "ram": _safe(ram.read, "ram"),
        "disk": _safe(disk.read, "disk"),
        "net": _safe(net.read, "net"),
    }


@system_v2_router.get("/stats")
async def get_stats() -> JSONResponse:
    try:
        payload = ttl_cache.get_or_set("system_v2:stats", _STATS_TTL_S, _build_stats)
    except Exception as exc:  # noqa: BLE001
        log.exception("system_v2 stats failed: %s", exc)
        payload = {"ts": now_ms(), "available": False, "error": str(exc)}
    return JSONResponse(payload, status_code=200)


@system_v2_router.get("/sensors")
async def get_sensors() -> JSONResponse:
    try:
        payload = ttl_cache.get_or_set("system_v2:sensors", _SENSORS_TTL_S, sensors.read)
    except Exception as exc:  # noqa: BLE001
        log.exception("system_v2 sensors failed: %s", exc)
        payload = {"ts": now_ms(), "available": False, "error": str(exc)}
    return JSONResponse(payload, status_code=200)


@system_v2_router.get("/battery")
async def get_battery() -> JSONResponse:
    try:
        payload = ttl_cache.get_or_set("system_v2:battery", _BATTERY_TTL_S, battery.read)
    except Exception as exc:  # noqa: BLE001
        log.exception("system_v2 battery failed: %s", exc)
        payload = {"ts": now_ms(), "available": False, "error": str(exc)}
    return JSONResponse(payload, status_code=200)


@system_v2_router.get("/bluetooth")
async def get_bluetooth() -> JSONResponse:
    try:
        payload = ttl_cache.get_or_set(
            "system_v2:bluetooth", _BLUETOOTH_TTL_S, bluetooth.read
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("system_v2 bluetooth failed: %s", exc)
        payload = {"ts": now_ms(), "available": False, "error": str(exc)}
    return JSONResponse(payload, status_code=200)


@system_v2_router.get("/processes")
async def get_processes(
    sort: str = Query("cpu"),
    limit: int = Query(10),
) -> JSONResponse:
    """processes.read() does soft validation (clamps limit, fallback sort).

    We don't use FastAPI Query patterns/ge/le because that produces 422 errors,
    and §3.6 requires HTTP 200 always.
    """
    key = f"system_v2:processes:{sort}:{limit}"
    try:
        payload = ttl_cache.get_or_set(
            key, _PROCESSES_TTL_S, lambda: processes.read(sort=sort, limit=limit)
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("system_v2 processes failed: %s", exc)
        payload = {
            "ts": now_ms(),
            "sort": sort,
            "limit": limit,
            "available": False,
            "error": str(exc),
        }
    return JSONResponse(payload, status_code=200)


# ── /services & /apps stubs (§0 prose — no §3 contract yet) ────────────────
_SERVICES_TTL_S = 10.0
_APPS_TTL_S = 10.0


@system_v2_router.get("/services")
async def get_services() -> JSONResponse:
    """Stub for /api/v2/system/services — returns {available: false}."""
    try:
        payload = ttl_cache.get_or_set("system_v2:services", _SERVICES_TTL_S, services.read)
    except Exception as exc:  # noqa: BLE001
        log.exception("system_v2 services failed: %s", exc)
        payload = {"ts": now_ms(), "available": False, "error": str(exc)}
    return JSONResponse(payload, status_code=200)


@system_v2_router.get("/apps")
async def get_apps() -> JSONResponse:
    """Stub for /api/v2/system/apps — returns {available: false}."""
    try:
        payload = ttl_cache.get_or_set("system_v2:apps", _APPS_TTL_S, apps.read)
    except Exception as exc:  # noqa: BLE001
        log.exception("system_v2 apps failed: %s", exc)
        payload = {"ts": now_ms(), "available": False, "error": str(exc)}
    return JSONResponse(payload, status_code=200)
