"""WebSocket fan-out for F7 — `/api/ws/agents`.

Per F7 §3.6 and BACKEND_PRINCIPLES_UPDATE.md §1.6.

Two message families:
  agent.event       — one per agent_events insert
  agent.run.status  — on status transitions, with diff + acceptance summary
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


log = logging.getLogger(__name__)

agents_ws_router = APIRouter()

_connected: Set[WebSocket] = set()
_lock = asyncio.Lock()


async def broadcast(message: Dict[str, Any]) -> None:
    """Fan out a JSON message to every connected client. Drops dead sockets."""
    if not _connected:
        return
    payload = json.dumps(message)
    async with _lock:
        targets = list(_connected)
    dead: list[WebSocket] = []
    for ws in targets:
        try:
            await ws.send_text(payload)
        except Exception as exc:  # noqa: BLE001
            log.debug("agents ws drop: %s", exc)
            dead.append(ws)
    if dead:
        async with _lock:
            for ws in dead:
                _connected.discard(ws)


def connection_count() -> int:
    return len(_connected)


@agents_ws_router.websocket("/api/ws/agents")
async def ws_agents(websocket: WebSocket) -> None:
    await websocket.accept()
    async with _lock:
        _connected.add(websocket)
    try:
        await websocket.send_text(
            json.dumps({"type": "agents.hello", "n_clients": len(_connected)})
        )
        while True:
            msg = await websocket.receive_text()
            try:
                payload = json.loads(msg)
                if payload.get("type") == "ping":
                    await websocket.send_text(
                        json.dumps({"type": "pong", "ts": payload.get("ts")})
                    )
            except (json.JSONDecodeError, ValueError):
                pass
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        log.warning("agents ws error: %s", exc)
    finally:
        async with _lock:
            _connected.discard(websocket)
