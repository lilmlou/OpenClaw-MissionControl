"""WebSocket fan-out for activity feed events.

§2.4 events emitted via app.activity.emitter.emit() reach this hub through
register_broadcaster(). Connected clients receive every event as a JSON frame.

Endpoint: /api/v2/activities/ws

Optional query parameter `?kind=<filter>` restricts the stream to events whose
`kind` matches (exact string). Multiple filters can be passed as a
comma-separated list (`?kind=chat.usage,config.set`). Omit to receive all
events.

On connect the client is sent:
  1. A `{"type":"activities.hello","n_clients":N}` greeting.
  2. A replay batch of the latest N events (default 50) as
     `{"type":"activities.replay","items":[...]}` so the UI can hydrate the
     feed without a separate HTTP fetch.
  3. Live `{"type":"activities.event","event":{...}}` frames as new events are
     emitted.

The client may send `{"type":"ping","ts":...}` and will receive a matching
`pong` frame — used by the FE to detect dead sockets.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, Optional, Set, Tuple

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from .emitter import get_recent


log = logging.getLogger(__name__)

activity_ws_router = APIRouter()

# Each connected socket carries an optional set of allowed event kinds.
# An empty set means "all kinds".
_connected: Set[Tuple[WebSocket, frozenset]] = set()
_lock = asyncio.Lock()


def _parse_kind_filter(raw: Optional[str]) -> frozenset:
    if not raw:
        return frozenset()
    return frozenset(k.strip() for k in raw.split(",") if k.strip())


async def broadcast(event: Dict[str, Any]) -> None:
    """Fan out an activity event to every connected socket.

    Respects per-socket `kind` filters. Drops dead sockets silently.
    """
    if not _connected:
        return
    frame = json.dumps({"type": "activities.event", "event": event})
    kind = event.get("kind")
    async with _lock:
        targets = list(_connected)
    dead: list[Tuple[WebSocket, frozenset]] = []
    for ws, kinds in targets:
        if kinds and kind not in kinds:
            continue
        try:
            await ws.send_text(frame)
        except Exception as exc:  # noqa: BLE001
            log.debug("activity ws broadcast drop: %s", exc)
            dead.append((ws, kinds))
    if dead:
        async with _lock:
            for entry in dead:
                _connected.discard(entry)


@activity_ws_router.websocket("/api/v2/activities/ws")
async def ws_activities(
    websocket: WebSocket,
    kind: Optional[str] = Query(None),
    replay: int = Query(50, ge=0, le=500),
) -> None:
    await websocket.accept()
    kinds = _parse_kind_filter(kind)
    entry = (websocket, kinds)
    async with _lock:
        _connected.add(entry)
    log.debug("activity WS connected (n=%d, kinds=%s)", len(_connected), kinds)
    try:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "activities.hello",
                    "n_clients": len(_connected),
                    "kinds": sorted(kinds),
                }
            )
        )
        if replay > 0:
            try:
                # If a single kind filter is set we can push it into the query;
                # multi-kind filters fall back to client-side filtering of the
                # broader replay.
                single_kind = next(iter(kinds)) if len(kinds) == 1 else None
                items = await get_recent(limit=int(replay), kind=single_kind)
                if kinds and not single_kind:
                    items = [e for e in items if e.get("kind") in kinds]
                await websocket.send_text(
                    json.dumps({"type": "activities.replay", "items": items})
                )
            except Exception as exc:  # noqa: BLE001
                log.debug("activity WS replay failed: %s", exc)

        while True:
            msg = await websocket.receive_text()
            try:
                payload = json.loads(msg)
            except (json.JSONDecodeError, ValueError):
                continue
            if payload.get("type") == "ping":
                await websocket.send_text(
                    json.dumps({"type": "pong", "ts": payload.get("ts")})
                )
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        log.warning("activity ws error: %s", exc)
    finally:
        async with _lock:
            _connected.discard(entry)
        log.debug("activity WS disconnected (n=%d)", len(_connected))
