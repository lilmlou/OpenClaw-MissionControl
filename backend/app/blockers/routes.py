"""HTTP endpoints for VM-D1 Blockers Mirror."""
from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.activity import emit as activity_emit
from app.config_bus import ws_broadcast
from app.actions.registry import actions

from . import mirror, store

blockers_router = APIRouter(prefix="/api/v2/blockers", tags=["blockers"])


class DismissBody(BaseModel):
    note: Optional[str] = None
    actor: Optional[str] = None


def _now_ms() -> int:
    return int(time.time() * 1000)


def _ok(data: Any) -> JSONResponse:
    return JSONResponse({"ok": True, "data": data, "available": True, "ts": _now_ms()})


def _fail(status: int, error: str, code: str, detail: Any = None, fix: Optional[List[Dict[str, Any]]] = None) -> JSONResponse:
    return JSONResponse(
        {"ok": False, "error": error, "code": code, "detail": detail, "available": False, "fix": fix or [], "ts": _now_ms()},
        status_code=status,
    )


@blockers_router.get("")
async def list_blockers(
    status: str = Query("open", pattern="^(open|closed|all)$"),
    since: Optional[int] = Query(None),
    severity: Optional[str] = Query(None, pattern="^(high|medium|low)$"),
    limit: int = Query(50, ge=1, le=100),
) -> JSONResponse:
    data = await store.list_blockers(status=status, since=since, severity=severity, limit=limit)
    return _ok(data)


@blockers_router.get("/count")
async def count_blockers() -> JSONResponse:
    return _ok({"count_open": await store.count_open()})


@blockers_router.post("/scan")
async def scan_blockers_now() -> JSONResponse:
    data = await mirror.scan_once()
    return _ok({"count_open": data["count_open"], "total": len(data["items"]), "scanned_ts": data["scanned_ts"]})


@blockers_router.get("/health")
async def blockers_health() -> JSONResponse:
    return _ok(mirror.health())


def _append_closure_line(doc: Dict[str, Any], *, note: Optional[str]) -> str:
    path = Path(doc["source_path"])
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    start = max(int(doc.get("source_lineno", 1)) - 1, 0)
    next_start = len(lines)
    for idx in range(start + 1, len(lines)):
        if lines[idx].startswith("## "):
            next_start = idx
            break
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    suffix = f": {note}" if note else ""
    closure = f"### Closure {stamp} — dismissed via UI{suffix}"
    if closure not in lines[start:next_start]:
        lines.insert(next_start, closure)
        path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    updated_section_end = next_start + 1
    updated_lines = lines[start:updated_section_end]
    return "\n".join(updated_lines).strip() + "\n"


@blockers_router.post("/{blocker_id}/dismiss")
async def dismiss_blocker(blocker_id: str, body: DismissBody = Body(default=DismissBody())) -> JSONResponse:
    doc = await store.get_one(blocker_id)
    if not doc:
        return _fail(
            404,
            "blocker_not_found",
            "BLOCKER_NOT_FOUND",
            {"id": blocker_id},
            [{"label": "Refresh blockers", "action": "blockers.scan", "args": {}}],
        )
    try:
        body_md = _append_closure_line(doc, note=body.note)
    except Exception as exc:  # noqa: BLE001
        return _fail(
            500,
            "blocker_dismiss_failed",
            "BLOCKER_DISMISS_FAILED",
            {"id": blocker_id, "error": str(exc)},
            [{"label": "Open blocker source", "action": "files.open", "args": {"path": doc.get("source_path"), "lineno": doc.get("source_lineno")}}],
        )

    closed_ts = _now_ms()
    updated = await store.close_one(blocker_id, closed_ts=closed_ts, body_md=body_md)
    if not updated:
        return _fail(
            404,
            "blocker_not_found",
            "BLOCKER_NOT_FOUND",
            {"id": blocker_id},
            [{"label": "Refresh blockers", "action": "blockers.scan", "args": {}}],
        )

    actor = body.actor or "user:meg"
    await ws_broadcast({"type": "blocker.closed", "data": updated})
    activity_emit(
        kind="blocker.closed",
        summary=f"Dismissed blocker: {updated.get('title')}",
        actor=actor,
        subject=blocker_id,
        severity="info",
        detail={"blocker": updated, "note": body.note},
        fix=updated.get("suggested_actions") or [],
    )
    return _ok(updated)


@blockers_router.get("/{blocker_id}")
async def get_blocker(blocker_id: str) -> JSONResponse:
    doc = await store.get_one(blocker_id)
    if not doc:
        return _fail(
            404,
            "blocker_not_found",
            "BLOCKER_NOT_FOUND",
            {"id": blocker_id},
            [{"label": "Refresh blockers", "action": "blockers.scan", "args": {}}],
        )
    return _ok(doc)


@actions.register(
    key="blockers.dismiss",
    title="Dismiss blocker",
    category="blockers",
    destructive=True,
    requires_confirm=True,
    input_schema={
        "type": "object",
        "properties": {"id": {"type": "string"}, "note": {"type": "string"}},
        "required": ["id"],
    },
    result_schema={"type": "object", "properties": {"ok": {"type": "boolean"}}},
    description="Mark a blocker as closed and write a closure line to BLOCKERS.md",
)
async def _dismiss_action(args: Any, actor: str) -> Dict[str, Any]:
    if not isinstance(args, dict) or not args.get("id"):
        return {"ok": False, "error": "id required", "fix": [{"label": "Refresh blockers", "action": "blockers.scan", "args": {}}]}
    doc = await store.get_one(str(args["id"]))
    if not doc:
        return {"ok": False, "error": "blocker not found", "fix": [{"label": "Refresh blockers", "action": "blockers.scan", "args": {}}]}
    body_md = _append_closure_line(doc, note=args.get("note"))
    updated = await store.close_one(str(args["id"]), closed_ts=_now_ms(), body_md=body_md)
    if updated:
        await ws_broadcast({"type": "blocker.closed", "data": updated})
        activity_emit(
            kind="blocker.closed",
            summary=f"Dismissed blocker: {updated.get('title')}",
            actor=actor,
            subject=updated.get("id"),
            severity="info",
            detail={"blocker": updated, "note": args.get("note")},
            fix=updated.get("suggested_actions") or [],
        )
    return {"ok": bool(updated), "blocker": updated}
