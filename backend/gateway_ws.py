import asyncio
import inspect
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

import websockets
from dotenv import load_dotenv
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)

chat_ws_router = APIRouter()

DEFAULT_RUNTIME = "openclaw"
RUNTIME_SET = {"openclaw", "hermes"}
DEFAULT_MODEL = "huggingface/Qwen/Qwen3-Coder-480B-A35B-Instruct"


def _normalize_runtime(runtime: Optional[str]) -> str:
    candidate = (runtime or DEFAULT_RUNTIME).strip().lower()
    return candidate if candidate in RUNTIME_SET else DEFAULT_RUNTIME


def _runtime_gateway_url(runtime: str) -> str:
    if runtime == "hermes":
        return os.environ.get(
            "HERMES_GATEWAY_URL",
            os.environ.get("OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789"),
        )
    return os.environ.get("OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789")


def _runtime_auth_headers(runtime: str) -> Dict[str, str]:
    prefix = "HERMES" if runtime == "hermes" else "OPENCLAW"
    key = os.environ.get(f"{prefix}_API_KEY")
    if not key:
        return {}

    auth_header = os.environ.get(f"{prefix}_AUTH_HEADER", "Authorization")
    auth_scheme = os.environ.get(f"{prefix}_AUTH_SCHEME", "Bearer")

    if auth_scheme.lower() == "none":
        value = key
    else:
        value = f"{auth_scheme} {key}"
    return {auth_header: value}


def _connect_with_headers_kwargs(headers: Dict[str, str]) -> Dict[str, Any]:
    """
    websockets changed connect() kwarg from extra_headers -> additional_headers in v15.
    Build kwargs dynamically so the bridge works across supported versions.
    """
    connect_sig = inspect.signature(websockets.connect)
    header_kwarg = (
        "additional_headers"
        if "additional_headers" in connect_sig.parameters
        else "extra_headers"
    )
    return {header_kwarg: headers or None}


def _is_gateway_ws_closed(ws: Any) -> bool:
    """
    Support both legacy and newer websockets connection objects.
    """
    if ws is None:
        return True

    closed = getattr(ws, "closed", None)
    if isinstance(closed, bool):
        return closed

    is_open = getattr(ws, "open", None)
    if isinstance(is_open, bool):
        return not is_open

    state = getattr(ws, "state", None)
    if state is None:
        return False

    state_name = getattr(state, "name", str(state))
    return str(state_name).upper() != "OPEN"


class GatewayConnection:
    def __init__(self, client_ws: WebSocket) -> None:
        self.client_ws = client_ws
        self.gateway_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.listen_task: Optional[asyncio.Task] = None
        self.connected = False
        self.runtime = DEFAULT_RUNTIME
        self.thread_id: Optional[str] = None
        self.run_id: Optional[str] = None

    async def connect(self, thread_id: str, runtime: str) -> None:
        runtime = _normalize_runtime(runtime)
        target_url = _runtime_gateway_url(runtime)
        headers = _runtime_auth_headers(runtime)

        needs_new_connection = (
            not self.connected
            or not self.gateway_ws
            or _is_gateway_ws_closed(self.gateway_ws)
            or runtime != self.runtime
        )
        self.thread_id = thread_id

        if not needs_new_connection:
            return

        await self.close()
        logger.info(
            "Connecting to runtime gateway runtime=%s thread=%s url=%s",
            runtime,
            thread_id,
            target_url,
        )

        self.gateway_ws = await websockets.connect(
            target_url,
            **_connect_with_headers_kwargs(headers),
            open_timeout=10,
            ping_interval=20,
            ping_timeout=20,
        )
        self.connected = True
        self.runtime = runtime
        self.listen_task = asyncio.create_task(self._listen_to_gateway())

    async def _listen_to_gateway(self) -> None:
        if not self.gateway_ws:
            return

        try:
            async for raw in self.gateway_ws:
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    await self.client_ws.send_json(
                        {
                            "type": "gateway.raw",
                            "runtime": self.runtime,
                            "threadId": self.thread_id,
                            "raw": str(raw),
                        }
                    )
                    continue

                await self._forward_to_client(data)
        except websockets.exceptions.ConnectionClosed:
            logger.info(
                "Gateway closed runtime=%s thread=%s",
                self.runtime,
                self.thread_id,
            )
        except Exception:
            logger.exception(
                "Gateway listener error runtime=%s thread=%s",
                self.runtime,
                self.thread_id,
            )
        finally:
            self.connected = False

    async def _forward_to_client(self, data: Dict[str, Any]) -> None:
        msg_type = data.get("type") or data.get("event")
        payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}
        run_id = (
            data.get("runId")
            or data.get("id")
            or payload.get("runId")
            or payload.get("id")
            or self.run_id
        )
        thread_id = data.get("threadId") or payload.get("threadId") or self.thread_id

        chunk_types = {
            "assistant.response.chunk",
            "assistant_response_chunk",
            "chat.chunk",
            "chat.response.chunk",
        }
        complete_types = {
            "assistant.response.complete",
            "assistant_response_complete",
            "chat.complete",
            "chat.response.complete",
        }
        error_types = {"assistant.error", "assistant_error", "chat.error"}

        if msg_type in chunk_types:
            chunk = (
                payload.get("chunk")
                or payload.get("delta")
                or payload.get("content")
                or data.get("chunk")
                or data.get("delta")
                or data.get("content")
                or ""
            )
            await self.client_ws.send_json(
                {
                    "type": "chat.chunk",
                    "runId": run_id,
                    "threadId": thread_id,
                    "runtime": self.runtime,
                    "chunk": chunk,
                }
            )
            return

        if msg_type in complete_types:
            content = (
                payload.get("content")
                or payload.get("text")
                or data.get("content")
                or data.get("text")
                or ""
            )
            await self.client_ws.send_json(
                {
                    "type": "chat.complete",
                    "runId": run_id,
                    "threadId": thread_id,
                    "runtime": self.runtime,
                    "content": content,
                }
            )
            return

        if msg_type in error_types:
            error = payload.get("error") or data.get("error") or "Unknown error"
            await self.client_ws.send_json(
                {
                    "type": "chat.error",
                    "runId": run_id,
                    "threadId": thread_id,
                    "runtime": self.runtime,
                    "error": error,
                }
            )
            return

        if msg_type in {"tool.permission_request", "tool_permission_request"}:
            await self.client_ws.send_json(
                {
                    "type": "tool.permission_request",
                    "requestId": data.get("requestId")
                    or data.get("request_id")
                    or payload.get("requestId")
                    or payload.get("request_id"),
                    "threadId": thread_id,
                    "runtime": self.runtime,
                    "tool": data.get("tool") or payload.get("tool"),
                    "parameters": data.get("parameters") or payload.get("parameters") or {},
                    "reason": data.get("reason") or payload.get("reason"),
                }
            )
            return

        if msg_type == "connect.challenge":
            await self.client_ws.send_json(
                {
                    "type": "gateway.connect_challenge",
                    "runtime": self.runtime,
                    "threadId": thread_id,
                    "payload": payload,
                }
            )
            return

        await self.client_ws.send_json(
            {
                "type": "gateway.event",
                "runtime": self.runtime,
                "threadId": thread_id,
                "payload": data,
            }
        )

    async def send_to_gateway(self, data: Dict[str, Any]) -> None:
        if not self.connected or not self.gateway_ws:
            raise RuntimeError("Not connected to runtime gateway")

        msg_type = data.get("type")
        if msg_type == "chat.message":
            self.run_id = data.get("id")
            outbound = {
                "type": "chat.message",
                "id": data.get("id"),
                "threadId": data.get("threadId") or self.thread_id,
                "runtime": _normalize_runtime(data.get("runtime") or self.runtime),
                "content": data.get("content", ""),
                "model": data.get("model") or DEFAULT_MODEL,
                "provider": data.get("provider"),
                "timestamp": data.get("timestamp") or int(time.time() * 1000),
            }
        elif msg_type == "tool.permission_response":
            outbound = {
                "type": "tool.permission_response",
                "requestId": data.get("requestId"),
                "response": data.get("response", {}),
                "threadId": data.get("threadId") or self.thread_id,
            }
        else:
            outbound = data

        await self.gateway_ws.send(json.dumps(outbound))

    async def close(self) -> None:
        self.connected = False
        if self.listen_task:
            self.listen_task.cancel()
            self.listen_task = None
        if self.gateway_ws:
            await self.gateway_ws.close()
            self.gateway_ws = None


@chat_ws_router.websocket("/api/ws/chat")
async def chat_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    gateway_conn = GatewayConnection(websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = data.get("type")
            runtime = _normalize_runtime(data.get("runtime"))
            thread_id = data.get("threadId") or gateway_conn.thread_id or "default-thread"

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if msg_type == "connect":
                await gateway_conn.connect(thread_id, runtime)
                await websocket.send_json(
                    {
                        "type": "connected",
                        "threadId": thread_id,
                        "runtime": gateway_conn.runtime,
                        "gatewayUrl": _runtime_gateway_url(gateway_conn.runtime),
                    }
                )
                continue

            if msg_type in {"chat.message", "tool.permission_response"}:
                await gateway_conn.connect(thread_id, runtime)
                data["threadId"] = thread_id
                data["runtime"] = runtime
                await gateway_conn.send_to_gateway(data)
                continue

            await websocket.send_json(
                {"type": "error", "message": f"Unsupported message type: {msg_type}"}
            )
    except WebSocketDisconnect:
        logger.info(
            "Client websocket disconnected runtime=%s thread=%s",
            gateway_conn.runtime,
            gateway_conn.thread_id,
        )
    except Exception:
        logger.exception("Unhandled chat websocket error")
    finally:
        await gateway_conn.close()
