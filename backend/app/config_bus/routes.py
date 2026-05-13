"""HTTP endpoints for the config bus — Phase 0.1 §3.2.

  GET    /api/v2/config                      list keys (redacted)
  GET    /api/v2/config/categories           list categories with counts
  GET    /api/v2/config/export               full snapshot (redacted)
  POST   /api/v2/config/import               apply snapshot (atomic)
  POST   /api/v2/config/bulk                 atomic multi-set
  GET    /api/v2/config/schema/{key}         JSON Schema for one key
  GET    /api/v2/config/{key}                value + metadata for one key
  PUT    /api/v2/config/{key}                set value
  DELETE /api/v2/config/{key}                reset to default

Response shape per BACKEND_PRINCIPLES_UPDATE.md §2.2:
  success → { ok: true, data: {...}, ts }
  failure → HTTP 200 with { ok: false, error, code, detail, available, ts }
            except 400 (validation), 409 (conflict)
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .bus import bus, ConfigValidationError, ConfigVersionConflict


config_router = APIRouter(prefix="/api/v2/config", tags=["config"])


# ── Pydantic input models ──────────────────────────────────────────────


class SetBody(BaseModel):
    value: Any
    expected_version: Optional[int] = Field(default=None)
    actor: Optional[str] = Field(default=None)


class BulkChange(BaseModel):
    key: str
    value: Any
    expected_version: Optional[int] = None


class BulkBody(BaseModel):
    changes: List[BulkChange]
    actor: Optional[str] = None


class ImportBody(BaseModel):
    snapshot: Dict[str, Any]  # {key: value} or {key: {value, expected_version}}
    actor: Optional[str] = None
    overwrite: bool = True


# ── Helpers ────────────────────────────────────────────────────────────


def _now_ms() -> int:
    return int(time.time() * 1000)


def _ok(data: Any) -> JSONResponse:
    return JSONResponse({"ok": True, "data": data, "ts": _now_ms()})


def _fail(status: int, error: str, code: str, detail: Any = None) -> JSONResponse:
    return JSONResponse(
        {"ok": False, "error": error, "code": code, "detail": detail, "ts": _now_ms()},
        status_code=status,
    )


def _resolve_actor(supplied: Optional[str]) -> str:
    return supplied or "user:meg"


# ── Routes ─────────────────────────────────────────────────────────────


@config_router.get("")
async def list_keys(
    category: Optional[str] = Query(None),
    prefix: Optional[str] = Query(None),
) -> JSONResponse:
    category_value = None if hasattr(category, "default") else category
    prefix_value = None if hasattr(prefix, "default") else prefix
    docs = bus.list_docs(category=category_value)
    if prefix_value:
        docs = [doc for doc in docs if str(doc.get("_id") or doc.get("key") or "").startswith(prefix_value)]
    data = {"items": docs, "total": len(docs)}
    return JSONResponse({"ok": True, "data": data, "items": docs, "total": len(docs), "ts": _now_ms()})


@config_router.get("/categories")
async def list_categories() -> JSONResponse:
    return _ok({"categories": bus.list_categories()})


@config_router.get("/export")
async def export_snapshot() -> JSONResponse:
    """Return full snapshot (secrets redacted) for backup/migration."""
    docs = bus.list_docs()
    snapshot = {
        d["_id"]: {
            "value": d["value"],
            "version": d.get("version", 0),
            "schema": d.get("schema"),
            "secret": d.get("secret", False),
        }
        for d in docs
    }
    return _ok({"snapshot": snapshot, "exported_at": _now_ms()})


@config_router.post("/import")
async def import_snapshot(body: ImportBody) -> JSONResponse:
    """Atomic import. Each key may carry expected_version for safety."""
    actor = _resolve_actor(body.actor)
    changes: List[Dict[str, Any]] = []
    for key, raw in body.snapshot.items():
        if isinstance(raw, dict) and "value" in raw:
            change: Dict[str, Any] = {"key": key, "value": raw["value"]}
            if "expected_version" in raw:
                change["expected_version"] = raw["expected_version"]
        else:
            change = {"key": key, "value": raw}
        changes.append(change)
    try:
        applied = await bus.bulk_set(changes, actor=actor)
    except ConfigValidationError as exc:
        return JSONResponse(exc.to_response(), status_code=400)
    except ConfigVersionConflict as exc:
        return _fail(
            409,
            "version_conflict",
            "VERSION_CONFLICT",
            {"key": exc.key, "expected": exc.expected, "current": exc.current},
        )
    return _ok({"applied": applied, "count": len(applied)})


@config_router.post("/bulk")
async def bulk_set(body: BulkBody) -> JSONResponse:
    actor = _resolve_actor(body.actor)
    changes = [c.model_dump(exclude_none=True) for c in body.changes]
    try:
        applied = await bus.bulk_set(changes, actor=actor)
    except ConfigValidationError as exc:
        return JSONResponse(exc.to_response(), status_code=400)
    except ConfigVersionConflict as exc:
        return _fail(
            409,
            "version_conflict",
            "VERSION_CONFLICT",
            {"key": exc.key, "expected": exc.expected, "current": exc.current},
        )
    return _ok({"applied": applied, "count": len(applied)})


@config_router.get("/schema/{key:path}")
async def get_schema(key: str) -> JSONResponse:
    try:
        doc = bus.get_doc(key)
    except KeyError:
        return _fail(404, "key_not_found", "KEY_NOT_FOUND", {"key": key})
    schema = doc.get("schema") or {}
    return _ok({
        "key": key,
        "schema": schema,
        "type": doc.get("type"),
        "secret": doc.get("secret", False),
    })


@config_router.get("/{key:path}")
async def get_key(key: str) -> JSONResponse:
    try:
        doc = bus.get_doc(key)
    except KeyError:
        return _fail(404, "key_not_found", "KEY_NOT_FOUND", {"key": key})
    return _ok(doc)


@config_router.put("/{key:path}")
async def set_key(key: str, body: SetBody) -> JSONResponse:
    actor = _resolve_actor(body.actor)
    try:
        doc = await bus.set(
            key,
            body.value,
            actor=actor,
            expected_version=body.expected_version,
        )
    except ConfigValidationError as exc:
        return JSONResponse(exc.to_response(), status_code=400)
    except ConfigVersionConflict as exc:
        return _fail(
            409,
            "version_conflict",
            "VERSION_CONFLICT",
            {"key": exc.key, "expected": exc.expected, "current": exc.current},
        )
    return _ok(doc)


@config_router.delete("/{key:path}")
async def delete_key(key: str, actor: Optional[str] = Query(None)) -> JSONResponse:
    deleted = await bus.delete(key, actor=_resolve_actor(actor))
    return _ok({"key": key, "deleted": bool(deleted)})
