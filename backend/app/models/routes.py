"""Self-healing stubs for frontend model-resolution endpoints.

These routes intentionally return HTTP 200 with available:false so the visual
surface can show a degraded state with Fix buttons instead of hard-failing on
404 while the real model inventory backend is pending.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter

models_router = APIRouter(prefix="/api/v2/models", tags=["models"])


def _stub_response(endpoint: str) -> dict[str, Any]:
    return {
        "ok": False,
        "available": False,
        "error": "not_implemented",
        "code": "NOT_IMPLEMENTED",
        "detail": {"endpoint": f"/api/v2/models/{endpoint}"},
        "models": [],
        "endpoint": endpoint,
        "fix": [
            {
                "label": "Wire model inventory backend",
                "action": "open_handoff",
                "args": {"doc": "MODEL_ROUTER_BACKEND.md"},
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
        "capabilities": ["refresh_stub", "groups_stub", "resolve_stub"],
        "last_error": "model inventory backend not implemented",
        "fix": [
            {
                "label": "Wire model inventory backend",
                "action": "open_handoff",
                "args": {"doc": "MODEL_ROUTER_BACKEND.md"},
            }
        ],
        "ts": time.time() * 1000,
    }


@models_router.get("/health")
async def models_health() -> dict[str, Any]:
    return health()


@models_router.get("/refresh")
async def refresh_models() -> dict[str, Any]:
    return _stub_response("refresh")


@models_router.get("/groups")
async def model_groups() -> dict[str, Any]:
    return _stub_response("groups")


@models_router.get("/resolve")
async def resolve_model() -> dict[str, Any]:
    return _stub_response("resolve")
