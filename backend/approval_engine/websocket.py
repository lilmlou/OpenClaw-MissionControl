import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set
from .events import (
    tool_permission_request_event,
    tool_permission_resolved_event,
)

logger = logging.getLogger(__name__)
ws_router = APIRouter()
_connections: Set[WebSocket] = set()


@ws_router.websocket("/api/ws/approvals")
async def approval_websocket(websocket: WebSocket):
    await websocket.accept()
    _connections.add(websocket)
    logger.info(f"Approval WS client connected. Total: {len(_connections)}")
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                msg_type = data.get("type")
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                elif msg_type == "subscribe":
                    session_id = data.get("session_id")
                    await websocket.send_json(
                        {
                            "type": "subscribed",
                            "session_id": session_id,
                            "timestamp": __import__("datetime", fromlist=["datetime"])
                            .datetime.now(
                                __import__(
                                    "datetime", fromlist=["timezone"]
                                ).timezone.utc
                            )
                            .isoformat(),
                        }
                    )
                else:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": f"Unknown message type: {msg_type}",
                        }
                    )
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
    except WebSocketDisconnect:
        logger.info("Approval WS client disconnected")
    finally:
        _connections.discard(websocket)


async def broadcast_approval_event(event: dict):
    dead = set()
    for ws in _connections:
        try:
            await ws.send_json(event)
        except Exception:
            dead.add(ws)
    _connections -= dead


def get_connection_count() -> int:
    return len(_connections)


approval_ws_router = ws_router
