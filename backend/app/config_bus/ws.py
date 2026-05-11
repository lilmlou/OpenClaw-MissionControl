"""WebSocket fan-out for config bus events.

§3.3 events:
  config.set      { type, key, value, version, actor, ts }
  config.deleted  { type, key, version, actor, ts }
  config.bulk     { type, keys, ts }
  config.error    { type, key, reason, detail }

Single endpoint: /api/ws/config

The hub keeps a set of connected sockets and broadcasts JSON. Subscribers
register interest by prefix on connect (optional query param `?prefix=ui.`).
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Awaitable, Callable, Dict, List, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


log = logging.getLogger(__name__)

config_ws_router = APIRouter()

_connected: Set[WebSocket] = set()
_lock = asyncio.Lock()
_replay_providers: List[Callable[[], Awaitable[Dict[str, Any]] | Dict[str, Any]]] = []


def register_replay_provider(provider: Callable[[], Awaitable[Dict[str, Any]] | Dict[str, Any]]) -> None:
    """Register a provider for replay frames sent to new config WS clients."""
    if provider not in _replay_providers:
        _replay_providers.append(provider)


def clear_replay_providers() -> None:
    """Test helper: clear replay providers between isolated FastAPI apps."""
    _replay_providers.clear()


async def broadcast(event: Dict[str, Any]) -> None:
    """Fan out an event to every connected socket. Drops dead sockets silently."""
    if not _connected:
        return
    payload = json.dumps(event)
    async with _lock:
        targets = list(_connected)
    dead: list[WebSocket] = []
    for ws in targets:
        try:
            await ws.send_text(payload)
        except Exception as exc:  # noqa: BLE001
            log.debug("ws broadcast drop: %s", exc)
            dead.append(ws)
    if dead:
        async with _lock:
            for ws in dead:
                _connected.discard(ws)


@config_ws_router.websocket("/api/ws/config")
async def ws_config(websocket: WebSocket) -> None:
    await websocket.accept()
    async with _lock:
        _connected.add(websocket)
    log.debug("config WS connected (n=%d)", len(_connected))
    try:
        # Send a hello so the client knows the channel is live
        await websocket.send_text(json.dumps({"type": "config.hello", "n_clients": len(_connected)}))
        for provider in list(_replay_providers):
            try:
                event = provider()
                if asyncio.iscoroutine(event):
                    event = await event
                if event:
                    await websocket.send_text(json.dumps(event))
            except Exception as exc:  # noqa: BLE001
                log.debug("config WS replay provider failed: %s", exc)
        # Receive loop. We don't process incoming messages — clients use HTTP for writes.
        while True:
            msg = await websocket.receive_text()
            # ping/pong support: echo back
            try:
                payload = json.loads(msg)
                if payload.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "ts": payload.get("ts")}))
            except (json.JSONDecodeError, ValueError):
                pass
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        log.warning("config ws error: %s", exc)
    finally:
        async with _lock:
            _connected.discard(websocket)
        log.debug("config WS disconnected (n=%d)", len(_connected))
