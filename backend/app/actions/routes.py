"""HTTP endpoints for actions (Phase 0.3 §5).

  GET  /api/v2/actions             list (with destructive flag, schemas)
  POST /api/v2/actions/{key}       invoke

Each invocation emits an activity event and broadcasts on the config WS bus.
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.activity import emit as activity_emit
from app.config_bus import ws_broadcast

from .registry import ActionInputError, actions


actions_router = APIRouter(prefix="/api/v2/actions", tags=["actions"])


class InvokeBody(BaseModel):
    args: Any = None
    actor: Optional[str] = None


def _now_ms() -> int:
    return int(time.time() * 1000)


def _ok(data: Any) -> JSONResponse:
    return JSONResponse({"ok": True, "data": data, "ts": _now_ms()})


def _fail(status: int, error: str, code: str, detail: Any = None) -> JSONResponse:
    return JSONResponse(
        {"ok": False, "error": error, "code": code, "detail": detail, "ts": _now_ms()},
        status_code=status,
    )


@actions_router.get("")
async def list_actions(category: Optional[str] = Query(None)) -> JSONResponse:
    items = actions.list_actions(category=category)
    return _ok({"items": items, "total": len(items)})


@actions_router.get("/{key:path}")
async def get_action(key: str) -> JSONResponse:
    defn = actions.get(key)
    if defn is None:
        return _fail(404, "action_not_found", "ACTION_NOT_FOUND", {"key": key})
    return _ok(defn.public())


@actions_router.post("/{key:path}")
async def invoke_action(key: str, body: InvokeBody = Body(default=InvokeBody())) -> JSONResponse:
    defn = actions.get(key)
    if defn is None:
        return _fail(404, "action_not_found", "ACTION_NOT_FOUND", {"key": key})
    actor = body.actor or "user:meg"
    try:
        result = await actions.invoke(key, body.args, actor=actor)
    except ActionInputError as exc:
        return JSONResponse(exc.to_response(), status_code=400)
    except Exception as exc:  # noqa: BLE001
        return _fail(500, "action_failed", "ACTION_FAILED", {"key": key, "exc": str(exc)})

    # Activity feed + WS broadcast
    try:
        activity_emit(
            kind="action.invoked",
            summary=f"{key} invoked by {actor}",
            actor=actor,
            subject=key,
            severity="info",
            detail={"key": key, "args": body.args, "result": result},
        )
    except Exception:  # noqa: BLE001
        pass

    try:
        await ws_broadcast({
            "type": "action.invoked",
            "key": key,
            "actor": actor,
            "result": result,
            "ts": _now_ms(),
        })
    except Exception:  # noqa: BLE001
        pass

    return _ok({"key": key, "result": result})
