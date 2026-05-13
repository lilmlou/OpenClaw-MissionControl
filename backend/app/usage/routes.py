"""Self-healing stubs for frontend usage telemetry endpoints.

The frontend polls these dashboard endpoints. Until the real usage aggregator
lands, return HTTP 200 with available:false + fix[] so the UI degrades visibly
instead of surfacing 404/network errors.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter

usage_router = APIRouter(prefix="/api/v2/usage", tags=["usage"])


def _stub_response(endpoint: str) -> dict[str, Any]:
    return {
        "ok": False,
        "available": False,
        "error": "not_implemented",
        "code": "NOT_IMPLEMENTED",
        "detail": {"endpoint": f"/api/v2/usage/{endpoint}"},
        "data": [],
        "endpoint": endpoint,
        "fix": [
            {
                "label": "Wire usage telemetry backend",
                "action": "open_handoff",
                "args": {"doc": "BACKEND_BOUNDARY.md"},
            }
        ],
        "ts": time.time() * 1000,
    }


def health() -> dict[str, Any]:
    """Module health callable required by BACKEND_PRINCIPLES_UPDATE §5."""
    return {
        "ok": True,
        "available": True,
        "status": "degraded",
        "capabilities": ["totals_stub", "by_agent_stub", "by_model_stub", "projections_stub"],
        "last_error": "usage telemetry backend not implemented",
        "fix": [
            {
                "label": "Wire usage telemetry backend",
                "action": "open_handoff",
                "args": {"doc": "BACKEND_BOUNDARY.md"},
            }
        ],
        "ts": time.time() * 1000,
    }


@usage_router.get("/health")
async def usage_health() -> dict[str, Any]:
    return health()


@usage_router.get("/totals")
async def usage_totals() -> dict[str, Any]:
    return _stub_response("totals")


@usage_router.get("/by-agent")
async def usage_by_agent() -> dict[str, Any]:
    return _stub_response("by-agent")


@usage_router.get("/by-model")
async def usage_by_model() -> dict[str, Any]:
    return _stub_response("by-model")


@usage_router.get("/projections")
async def usage_projections() -> dict[str, Any]:
    return _stub_response("projections")
