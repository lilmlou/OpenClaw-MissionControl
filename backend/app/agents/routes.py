"""HTTP endpoints for F7 — Phase 0 §3.5 / F7 §2.2.

  GET  /api/v2/agents/runs?status=&since=        list
  GET  /api/v2/agents/runs/{id}                  detail
  GET  /api/v2/agents/runs/{id}/events?since=    paginated events
  GET  /api/v2/agents/runs/{id}/diff             git diff
  GET  /api/v2/agents/runs/{id}/checks           acceptance check rows
  POST /api/v2/agents/runs                       dispatch (testing/manual)
  POST /api/v2/agents/runs/{id}/event            record an event (used by
                                                 in-process agent runners)
  POST /api/v2/agents/runs/{id}/complete         agent.task.complete
  POST /api/v2/agents/runs/{id}/verify           run §6 acceptance
  POST /api/v2/agents/runs/{id}/kill             SIGTERM/SIGKILL

Response shape per BACKEND_PRINCIPLES_UPDATE.md §2.2:
  success → { ok: true, data: ..., available: true, ts }
  failure → HTTP 200 with { ok: false, error, code, available: false, fix: [], ts }
            (4xx reserved for validation/auth/etc.)
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import dispatch, store


agents_router = APIRouter(prefix="/api/v2/agents", tags=["agents"])


def _now_ms() -> int:
    return int(time.time() * 1000)


def _ok(data: Any) -> JSONResponse:
    return JSONResponse({"ok": True, "data": data, "available": True, "ts": _now_ms()})


def _fail(
    error: str,
    code: str,
    *,
    fix: Optional[List[Dict[str, Any]]] = None,
    detail: Any = None,
    status: int = 200,
) -> JSONResponse:
    return JSONResponse(
        {
            "ok": False,
            "error": error,
            "code": code,
            "available": False,
            "fix": fix or [],
            "detail": detail,
            "ts": _now_ms(),
        },
        status_code=status,
    )


# ── input models ─────────────────────────────────────────────────────────


class DispatchBody(BaseModel):
    agent_id: str
    handoff_doc: str
    wave: Optional[str] = None
    phase_id: Optional[str] = None
    repo_root: Optional[str] = None
    actor: Optional[str] = None
    base_url: Optional[str] = None


class EventBody(BaseModel):
    kind: str
    summary: str = ""
    detail: Optional[Dict[str, Any]] = None
    duration_ms: Optional[int] = None


class CompleteBody(BaseModel):
    actor: Optional[str] = None


class FailBody(BaseModel):
    error: str
    actor: Optional[str] = None


class VerifyBody(BaseModel):
    actor: Optional[str] = None


class KillBody(BaseModel):
    actor: Optional[str] = None


# ── routes ───────────────────────────────────────────────────────────────


@agents_router.get("/runs")
async def list_runs(
    status: Optional[str] = Query(None),
    since: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
) -> JSONResponse:
    rows = await store.list_runs(status=status, since=since, limit=limit)
    return _ok({"items": rows, "total": len(rows)})


@agents_router.get("/runs/{run_id}")
async def get_run(run_id: str) -> JSONResponse:
    run = await store.get_run(run_id)
    if not run:
        return _fail(
            "run_not_found",
            "RUN_NOT_FOUND",
            fix=[{"label": "Back to runs", "action": "agents.list", "args": {}}],
            detail={"run_id": run_id},
        )
    checks = await store.list_checks(run_id)
    events = await store.list_events(run_id, limit=50)
    return _ok({"run": run, "checks": checks, "events": events[-50:]})


@agents_router.get("/runs/{run_id}/events")
async def get_events(
    run_id: str,
    since: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=2000),
) -> JSONResponse:
    events = await store.list_events(run_id, since_ts=since, limit=limit)
    return _ok({"items": events, "total": len(events)})


@agents_router.get("/runs/{run_id}/diff")
async def get_diff(run_id: str) -> JSONResponse:
    info = await dispatch.get_run_diff(run_id)
    if not info.get("available", False) and not info.get("files"):
        return _fail(
            "diff_unavailable",
            "DIFF_UNAVAILABLE",
            fix=[
                {"label": "Re-dispatch with repo_root", "action": "agents.redispatch", "args": {"run_id": run_id}},
            ],
            detail={"run_id": run_id},
        )
    return _ok(info)


@agents_router.get("/runs/{run_id}/checks")
async def get_checks(run_id: str) -> JSONResponse:
    checks = await store.list_checks(run_id)
    return _ok({"items": checks, "total": len(checks)})


@agents_router.post("/runs")
async def dispatch_run(body: DispatchBody) -> JSONResponse:
    run = await dispatch.dispatch_run(
        agent_id=body.agent_id,
        handoff_doc=body.handoff_doc,
        wave=body.wave,
        phase_id=body.phase_id,
        repo_root=body.repo_root,
        actor=body.actor or "user:meg",
        base_url=body.base_url or "http://127.0.0.1:8765",
    )
    return _ok({"run": run})


@agents_router.post("/runs/{run_id}/event")
async def post_event(run_id: str, body: EventBody) -> JSONResponse:
    run = await store.get_run(run_id)
    if not run:
        return _fail(
            "run_not_found",
            "RUN_NOT_FOUND",
            fix=[{"label": "Back to runs", "action": "agents.list", "args": {}}],
            detail={"run_id": run_id},
        )
    event = await dispatch.record_event(
        run_id,
        kind=body.kind,
        summary=body.summary,
        detail=body.detail,
        duration_ms=body.duration_ms,
    )
    return _ok({"event": event})


@agents_router.post("/runs/{run_id}/complete")
async def post_complete(run_id: str, body: CompleteBody = Body(default=CompleteBody())) -> JSONResponse:
    run = await dispatch.complete_run(run_id, actor=body.actor or "system")
    if not run:
        return _fail(
            "run_not_found",
            "RUN_NOT_FOUND",
            fix=[{"label": "Back to runs", "action": "agents.list", "args": {}}],
            detail={"run_id": run_id},
        )
    return _ok({"run": run})


@agents_router.post("/runs/{run_id}/fail")
async def post_fail(run_id: str, body: FailBody) -> JSONResponse:
    run = await dispatch.fail_run(run_id, error=body.error, actor=body.actor or "system")
    if not run:
        return _fail(
            "run_not_found",
            "RUN_NOT_FOUND",
            fix=[{"label": "Back to runs", "action": "agents.list", "args": {}}],
            detail={"run_id": run_id},
        )
    return _ok({"run": run})


@agents_router.post("/runs/{run_id}/verify")
async def post_verify(run_id: str, body: VerifyBody = Body(default=VerifyBody())) -> JSONResponse:
    res = await dispatch.verify_run(run_id, actor=body.actor or "user:meg")
    if not res.get("ok"):
        return _fail(
            res.get("error", "verify_failed"),
            res.get("code", "VERIFY_FAILED"),
            fix=[{"label": "Back to runs", "action": "agents.list", "args": {}}],
            detail={"run_id": run_id},
        )
    return _ok(res["data"])


@agents_router.post("/runs/{run_id}/kill")
async def post_kill(run_id: str, body: KillBody = Body(default=KillBody())) -> JSONResponse:
    res = await dispatch.kill_run(run_id, actor=body.actor or "user:meg")
    if not res.get("ok"):
        return _fail(
            res.get("error", "kill_failed"),
            res.get("code", "KILL_FAILED"),
            fix=[{"label": "Back to runs", "action": "agents.list", "args": {}}],
            detail={"run_id": run_id},
        )
    return _ok(res["data"])


@agents_router.get("/health")
async def get_health() -> JSONResponse:
    return _ok(dispatch.health())
