"""FastAPI router for /api/v2/qudos/* — Qudos co-pilot / assistance backend.

Contract: INTEGRATION_REVIEW_NEXT.md §2.

Status: STUB — all endpoints return {available: false, error: "not_implemented"}
until the Qudos backend bridge is wired. The frontend qudosApi.js has 16
endpoint stubs documented, 0 implemented. macOS accessibility / screen capture
requires a native helper binary not yet wired.

When fully implemented, sessions should persist alongside cron jobs in Mongo.
Frontend qudosApi.js TODOs should be converted to real fetch() calls.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

qudos_router = APIRouter(prefix="/api/v2/qudos", tags=["qudos"])


# ---- Request models (per frontend qudosApi.js contracts) ----

class SessionStartRequest(BaseModel):
    app_id: str
    mode: str = "observe"  # observe | assist | drive


class SuggestionResolveRequest(BaseModel):
    action: str  # accept | dismiss | defer


# ---- Helper ----

def _stub_response(detail: str = "Qudos module is a stub — not yet implemented") -> dict:
    return {
        "available": False,
        "error": "not_implemented",
        "fix": [
            {
                "label": "Backend bridges pending",
                "action": "open_settings",
                "args": {"category": "qudos"},
            }
        ],
        "detail": detail,
        "ts": time.time() * 1000,
    }


# ---- App endpoints ----

@qudos_router.get("/apps")
async def list_apps() -> JSONResponse:
    """List available apps for Qudos integration. Frontend: qudosApi.js getApps()."""
    log.info("qudos/apps called (stub)")
    return JSONResponse(_stub_response("Qudos apps list not yet implemented"))


# ---- Permissions ----

@qudos_router.get("/permissions")
async def list_permissions() -> JSONResponse:
    """List/request macOS accessibility permissions. Frontend: qudosApi.js getPermissions()."""
    log.info("qudos/permissions called (stub)")
    return JSONResponse(_stub_response("Qudos permissions not yet implemented"))


# ---- Sessions ----

@qudos_router.post("/sessions")
async def start_session(req: SessionStartRequest) -> JSONResponse:
    """Start a Qudos session. Frontend: qudosApi.js startSession()."""
    log.info("qudos/sessions POST: app=%s mode=%s (stub)", req.app_id, req.mode)
    return JSONResponse(_stub_response("Qudos sessions not yet implemented"), status_code=503)


@qudos_router.get("/sessions")
async def list_sessions() -> JSONResponse:
    """List active/recent sessions. Frontend: qudosApi.js getSessions()."""
    log.info("qudos/sessions GET called (stub)")
    return JSONResponse(_stub_response("Qudos sessions not yet implemented"))


@qudos_router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> JSONResponse:
    """Get session detail. Frontend: qudosApi.js getSession()."""
    log.info("qudos/sessions/%s called (stub)", session_id)
    return JSONResponse(_stub_response("Qudos sessions not yet implemented"))


@qudos_router.post("/sessions/{session_id}/stop")
async def stop_session(session_id: str) -> JSONResponse:
    """Stop a running session. Frontend: qudosApi.js stopSession()."""
    log.info("qudos/sessions/%s/stop called (stub)", session_id)
    return JSONResponse(_stub_response("Qudos sessions not yet implemented"), status_code=503)


# ---- Suggestions ----

@qudos_router.get("/suggestions")
async def list_suggestions() -> JSONResponse:
    """List pending suggestions. Frontend: qudosApi.js getSuggestions()."""
    log.info("qudos/suggestions GET called (stub)")
    return JSONResponse(_stub_response("Qudos suggestions not yet implemented"))


@qudos_router.post("/suggestions/{suggestion_id}/resolve")
async def resolve_suggestion(suggestion_id: str, req: SuggestionResolveRequest) -> JSONResponse:
    """Resolve a suggestion (accept/dismiss/defer). Frontend: qudosApi.js resolveSuggestion()."""
    log.info("qudos/suggestions/%s/resolve: action=%s (stub)", suggestion_id, req.action)
    return JSONResponse(_stub_response("Qudos suggestions not yet implemented"), status_code=503)


# TODO: builder scaffold
