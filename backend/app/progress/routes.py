"""HTTP endpoints for VM-D2 Progress Pulse."""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.actions.registry import actions
from app.activity import emit as activity_emit
from app.config_bus import ws_broadcast

from . import mirror, store

progress_router = APIRouter(prefix="/api/v2/progress", tags=["Progress"])


def _now_ms() -> int:
    return int(time.time() * 1000)


def _ok(data: Any) -> JSONResponse:
    return JSONResponse({"ok": True, "data": data, "available": True, "ts": _now_ms()})


def _fail(status: int, error: str, code: str, detail: Any = None, fix: Optional[List[Dict[str, Any]]] = None) -> JSONResponse:
    return JSONResponse(
        {"ok": False, "error": error, "code": code, "detail": detail, "available": False, "fix": fix or [], "ts": _now_ms()},
        status_code=status,
    )


@progress_router.get("")
async def list_progress(
    status: str = Query("all", pattern="^(verified|claims_done|deceptive|in_flight|all)$"),
    since: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    unseen_only: bool = Query(False),
) -> JSONResponse:
    data = await store.list_progress(status=status, since=since, limit=limit, unseen_only=unseen_only)
    return _ok(data)


@progress_router.get("/counts")
async def progress_counts() -> JSONResponse:
    return _ok(await store.get_counts())


@progress_router.post("/scan")
async def scan_progress_now() -> JSONResponse:
    data = await mirror.scan_once()
    return _ok({"total": len(data["items"]), "counts": data["counts"], "scanned_ts": data["scanned_ts"]})


@progress_router.get("/health")
async def progress_health() -> JSONResponse:
    return _ok(mirror.health())


@progress_router.get("/{progress_id}")
async def get_progress(progress_id: str) -> JSONResponse:
    doc = await store.get_one(progress_id)
    if not doc:
        return _fail(
            404,
            "progress_entry_not_found",
            "PROGRESS_ENTRY_NOT_FOUND",
            {"id": progress_id},
            [{"label": "Refresh progress", "action": "progress.scan", "args": {}}],
        )
    return _ok(doc)


@progress_router.post("/{progress_id}/seen")
async def mark_progress_seen(progress_id: str) -> JSONResponse:
    updated = await store.mark_seen(progress_id)
    if not updated:
        return _fail(
            404,
            "progress_entry_not_found",
            "PROGRESS_ENTRY_NOT_FOUND",
            {"id": progress_id},
            [{"label": "Refresh progress", "action": "progress.scan", "args": {}}],
        )
    await ws_broadcast({"type": "progress.entry.changed", "data": updated})
    activity_emit(
        kind="progress.seen",
        summary=f"Marked progress entry as seen: {updated.get('name')}",
        actor="user:meg",
        subject=progress_id,
        severity="info",
        detail={"progress": updated},
        fix=updated.get("suggested_actions") or [],
    )
    return _ok(updated)


@actions.register(
    key="progress.mark_seen",
    title="Mark progress entry as seen",
    category="progress",
    destructive=False,
    requires_confirm=False,
    input_schema={"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
    result_schema={"type": "object", "properties": {"ok": {"type": "boolean"}}},
    description="Acknowledges a PROGRESS.md entry on the dashboard without modifying the file",
)
async def _mark_seen_action(args: Any, actor: str) -> Dict[str, Any]:
    if not isinstance(args, dict) or not args.get("id"):
        return {"ok": False, "error": "id required", "fix": [{"label": "Refresh progress", "action": "progress.scan", "args": {}}]}
    progress_id = str(args["id"])
    updated = await store.mark_seen(progress_id)
    if not updated:
        return {"ok": False, "error": "progress entry not found", "fix": [{"label": "Refresh progress", "action": "progress.scan", "args": {}}]}
    await ws_broadcast({"type": "progress.entry.changed", "data": updated})
    activity_emit(
        kind="progress.seen",
        summary=f"Marked progress entry as seen: {updated.get('name')}",
        actor=actor,
        subject=progress_id,
        severity="info",
        detail={"progress": updated},
        fix=updated.get("suggested_actions") or [],
    )
    return {"ok": True, "progress": updated}
