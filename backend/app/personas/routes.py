"""HTTP routes for /api/v2/personas — Phase I personas backend.

Wire pattern follows app/blockers/routes.py:
  - Phase 0.1 envelope `{ok, data, available, ts}` on success
  - 4xx/5xx envelope `{ok:false, error, code, detail, available, fix[], ts}`
  - Every mutation emits an activity event (`personas.<verb>` plus the umbrella
    `personas.changed`) so the FE shell at /personas can refresh via the
    existing activity WS hub on `/api/v2/activities/ws`.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.activity import emit as activity_emit

from . import store

log = logging.getLogger(__name__)

personas_router = APIRouter(prefix="/api/v2/personas", tags=["personas"])


# ---- Request bodies ----------------------------------------------------------


class PersonaCreate(BaseModel):
    name: str
    id: Optional[str] = None
    tagline: Optional[str] = None
    icon: Optional[str] = None
    accent: Optional[str] = None
    defaults: Optional[Dict[str, Any]] = None


class PersonaUpdate(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    icon: Optional[str] = None
    accent: Optional[str] = None
    defaults: Optional[Dict[str, Any]] = None


# ---- Helpers -----------------------------------------------------------------


def _now_ms() -> int:
    return int(time.time() * 1000)


def _ok(data: Any) -> JSONResponse:
    return JSONResponse({"ok": True, "data": data, "available": True, "ts": _now_ms()})


def _fail(
    status: int,
    error: str,
    code: str,
    detail: Any = None,
    fix: Optional[List[Dict[str, Any]]] = None,
) -> JSONResponse:
    return JSONResponse(
        {
            "ok": False,
            "error": error,
            "code": code,
            "detail": detail,
            "available": False,
            "fix": fix or [],
            "ts": _now_ms(),
        },
        status_code=status,
    )


def _changed_event(verb: str, persona: Dict[str, Any], **extra: Any) -> None:
    """Emit `personas.<verb>` and the umbrella `personas.changed`."""
    actor = extra.pop("actor", "user:meg")
    summary = extra.pop("summary", f"persona {verb}: {persona.get('name', persona.get('id', '?'))}")
    detail: Dict[str, Any] = {"persona": persona}
    detail.update(extra)
    activity_emit(
        kind=f"personas.{verb}",
        summary=summary,
        actor=actor,
        subject=persona.get("id"),
        severity="info",
        detail=detail,
    )
    activity_emit(
        kind="personas.changed",
        summary=summary,
        actor=actor,
        subject=persona.get("id"),
        severity="info",
        detail={"verb": verb, "persona": persona, **{k: v for k, v in extra.items() if k != "actor"}},
    )


# ---- Routes ------------------------------------------------------------------


@personas_router.get("")
async def list_personas() -> JSONResponse:
    items = await store.list_personas()
    active = await store.get_active()
    return _ok({"personas": items, "active_id": active.get("id") if active else None})


@personas_router.get("/active")
async def get_active_persona() -> JSONResponse:
    active = await store.get_active()
    if active is None:
        return _ok({"active": None})
    return _ok({"active": active})


@personas_router.get("/{persona_id}")
async def get_persona(persona_id: str = Path(..., min_length=1, max_length=64)) -> JSONResponse:
    doc = await store.get_one(persona_id)
    if doc is None:
        return _fail(
            404,
            f"persona '{persona_id}' not found",
            code="PERSONA_NOT_FOUND",
            detail={"id": persona_id},
            fix=[{"label": "List personas", "action": "open_page", "args": {"path": "/personas"}}],
        )
    return _ok(doc)


@personas_router.post("")
async def create_persona(body: PersonaCreate = Body(...)) -> JSONResponse:
    try:
        doc = await store.create(body.model_dump(exclude_none=True))
    except ValueError as exc:
        return _fail(400, str(exc), code="PERSONA_INVALID")
    _changed_event("created", doc)
    return _ok(doc)


@personas_router.put("/{persona_id}")
async def update_persona(
    persona_id: str = Path(..., min_length=1, max_length=64),
    body: PersonaUpdate = Body(...),
) -> JSONResponse:
    try:
        doc = await store.update(persona_id, body.model_dump(exclude_none=True))
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg:
            return _fail(404, msg, code="PERSONA_NOT_FOUND", detail={"id": persona_id})
        return _fail(400, msg, code="PERSONA_INVALID", detail={"id": persona_id})
    changed = doc.pop("_changed", []) if isinstance(doc, dict) else []
    if changed:
        _changed_event("updated", doc, changed=changed)
    return _ok(doc)


@personas_router.delete("/{persona_id}")
async def delete_persona(persona_id: str = Path(..., min_length=1, max_length=64)) -> JSONResponse:
    try:
        result = await store.delete(persona_id)
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg:
            return _fail(404, msg, code="PERSONA_NOT_FOUND", detail={"id": persona_id})
        if "system" in msg:
            return _fail(
                403,
                msg,
                code="PERSONA_SYSTEM_PROTECTED",
                detail={"id": persona_id},
                fix=[
                    {
                        "label": "System personas cannot be deleted",
                        "action": "noop",
                        "args": {"id": persona_id},
                    }
                ],
            )
        return _fail(400, msg, code="PERSONA_INVALID", detail={"id": persona_id})

    _changed_event(
        "deleted",
        {"id": persona_id, "name": persona_id},
        active_id=result.get("active_id"),
    )
    return _ok(result)


@personas_router.post("/{persona_id}/activate")
async def activate_persona(persona_id: str = Path(..., min_length=1, max_length=64)) -> JSONResponse:
    try:
        result = await store.activate(persona_id)
    except ValueError as exc:
        return _fail(404, str(exc), code="PERSONA_NOT_FOUND", detail={"id": persona_id})

    doc = await store.get_one(persona_id)
    _changed_event(
        "activated",
        doc or {"id": persona_id, "name": persona_id},
        previous=result.get("previous"),
    )
    return _ok({"active_id": result["current"], "previous": result.get("previous"), "persona": doc})
