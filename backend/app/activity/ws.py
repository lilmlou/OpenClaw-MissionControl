"""WebSocket fan-out for FastAPI activity feed events.

Canonical endpoint: /api/v2/activities/ws.  Express can also proxy
/api/ws/activities to this endpoint when that frontend route is used.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional, Set, Tuple

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from .emitter import get_recent

activity_ws_router = APIRouter()
_connected: Set[Tuple[WebSocket, frozenset[str]]] = set()
_lock = asyncio.Lock()


def _parse_kind_filter(raw: Optional[str]) -> frozenset[str]:
    if not raw:
        return frozenset()
    return frozenset(k.strip() for k in raw.split(",") if k.strip())


def _activity_frame(event: Dict[str, Any]) -> Dict[str, Any]:
    """Return a frontend-friendly frame with kind at top level.

    Older consumers accepted raw frames or {type:"activity", payload}; keeping the
    top-level kind/id/ts/data fields avoids the category/kind drift called out by
    the Sprint 4 handoff while preserving a wrapped `payload` for compatibility.
    """
    data = event.get("data")
    if data is None:
        data = event.get("detail") or {}
    ts = event.get("ts") or event.get("created_at")
    return {
        "type": "activity",
        "id": event.get("id"),
        "kind": event.get("kind"),
        "ts": ts,
        "data": data,
        "summary": event.get("summary") or event.get("description") or "",
        "actor": event.get("actor"),
        "severity": event.get("severity", "info"),
        "activity": {
            "id": event.get("id"),
            "kind": event.get("kind"),
            "severity": event.get("severity", "info"),
            "actor": event.get("actor"),
            "description": event.get("summary") or event.get("description") or "",
            "data": data,
            "ts": ts,
        },
        "payload": event,
    }


async def broadcast(event: Dict[str, Any]) -> None:
    """Fan out an activity event to connected sockets, honoring ?kind= filters."""
    if not _connected:
        return
    kind = event.get("kind")
    frame = _activity_frame(event)
    async with _lock:
        targets = list(_connected)
    dead: list[Tuple[WebSocket, frozenset[str]]] = []
    for ws, kinds in targets:
        if kinds and kind not in kinds:
            continue
        try:
            await ws.send_json(frame)
        except Exception:
            dead.append((ws, kinds))
    if dead:
        async with _lock:
            for entry in dead:
                _connected.discard(entry)


@activity_ws_router.websocket("/api/v2/activities/ws")
async def ws_activities(
    websocket: WebSocket,
    kind: Optional[str] = Query(None),
    replay: int = Query(0, ge=0, le=500),
) -> None:
    await websocket.accept()
    kinds = _parse_kind_filter(kind)
    entry = (websocket, kinds)
    async with _lock:
        _connected.add(entry)
    try:
        await websocket.send_json({"type": "hello", "kind": "activities.hello", "ts": None})
        if replay > 0:
            single_kind = next(iter(kinds)) if len(kinds) == 1 else None
            items = await get_recent(limit=int(replay), kind=single_kind)
            if kinds and not single_kind:
                items = [e for e in items if e.get("kind") in kinds]
            for item in items:
                await websocket.send_json(_activity_frame(item))
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "ts": msg.get("ts")})
    except WebSocketDisconnect:
        pass
    finally:
        async with _lock:
            _connected.discard(entry)
