"""Usage telemetry route bridge for the FastAPI stack.

Sprint 5 token tracking is owned by AgentRuntime/Express. MissionControl keeps
frontend calls on one backend contract by proxying the canonical v2 usage totals
route to AgentRuntime, re-emitting the same envelope and writing a visible
usage.snapshot activity the first time totals are requested in this process.
"""
from __future__ import annotations

import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Request

from app.activity import emit as activity_emit

usage_router = APIRouter(prefix="/api/v2/usage", tags=["usage"])

AGENT_RUNTIME_URL = os.getenv("AGENT_RUNTIME_URL", "http://127.0.0.1:7801").rstrip("/")
_snapshot_emitted = False


def _now_ms() -> int:
    return int(time.time() * 1000)


def _proxy_fix() -> list[dict[str, Any]]:
    return [
        {
            "label": "Restart AgentRuntime gateway",
            "action": "system.restart",
            "args": {"port": 7801},
        }
    ]


def _unavailable(endpoint: str, error: str, code: str = "USAGE_PROXY_UNAVAILABLE") -> dict[str, Any]:
    return {
        "ok": False,
        "available": False,
        "error": error,
        "code": code,
        "detail": {"endpoint": f"/api/v2/usage/{endpoint}", "upstream": AGENT_RUNTIME_URL},
        "data": [],
        "endpoint": endpoint,
        "fix": _proxy_fix(),
        "ts": _now_ms(),
    }


def _summary(data: dict[str, Any]) -> str:
    messages = int(data.get("messages") or 0)
    tokens = int(data.get("tokens_in") or 0) + int(data.get("tokens_out") or 0)
    cost = float(data.get("cost_estimate_usd") or 0)
    return f"today: {messages} messages, {tokens} tokens, ${cost:.4f}"


def _emit_snapshot_once(payload: dict[str, Any]) -> None:
    global _snapshot_emitted
    if _snapshot_emitted:
        return
    raw_data = payload.get("data")
    data: dict[str, Any] = raw_data if isinstance(raw_data, dict) else {}
    activity_emit(
        kind="usage.snapshot",
        summary=_summary(data),
        actor="system",
        subject="usage.today",
        severity="info",
        detail={"usage": data, "source": "agentruntime"},
    )
    _snapshot_emitted = True


async def _proxy_json(path: str, query: str = "") -> tuple[int, dict[str, Any]]:
    url = f"{AGENT_RUNTIME_URL}{path}{('?' + query) if query else ''}"
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.get(url)
    except Exception as exc:  # noqa: BLE001
        return 502, _unavailable(path.rsplit("/", 1)[-1], str(exc))

    try:
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001
        return 502, _unavailable(path.rsplit("/", 1)[-1], f"invalid upstream JSON: {exc}")

    if isinstance(payload, dict):
        payload.setdefault("ts", _now_ms())
        payload.setdefault("available", bool(payload.get("ok", resp.status_code < 400)))
        payload.setdefault("fix", [] if payload.get("ok", resp.status_code < 400) else _proxy_fix())
        return resp.status_code, payload

    return 502, _unavailable(path.rsplit("/", 1)[-1], "upstream returned non-object JSON")


def health() -> dict[str, Any]:
    """Module health callable required by BACKEND_PRINCIPLES_UPDATE §5."""
    return {
        "ok": True,
        "available": True,
        "status": "proxied",
        "capabilities": ["totals_proxy", "by_agent_proxy", "by_model_proxy", "projections_proxy"],
        "upstream": AGENT_RUNTIME_URL,
        "fix": [],
        "ts": _now_ms(),
    }


@usage_router.get("/health")
async def usage_health() -> dict[str, Any]:
    return health()


@usage_router.get("/totals")
async def usage_totals(request: Request) -> dict[str, Any]:
    status, payload = await _proxy_json("/api/v2/usage/totals", request.url.query)
    if status < 400 and payload.get("ok") is True:
        _emit_snapshot_once(payload)
    return payload


@usage_router.get("/by-agent")
async def usage_by_agent(request: Request) -> dict[str, Any]:
    _status, payload = await _proxy_json("/api/v2/usage/by-agent", request.url.query)
    return payload


@usage_router.get("/by-model")
async def usage_by_model(request: Request) -> dict[str, Any]:
    _status, payload = await _proxy_json("/api/v2/usage/by-model", request.url.query)
    return payload


@usage_router.get("/projections")
async def usage_projections(request: Request) -> dict[str, Any]:
    _status, payload = await _proxy_json("/api/v2/usage/projections", request.url.query)
    return payload
