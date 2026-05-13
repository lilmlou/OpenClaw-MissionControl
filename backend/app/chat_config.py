"""Chat foundation config bus registration and cross-stack sync.

P0-C Chat Foundation backend handoff §3.5. Importing this module registers all
chat.* keys on the FastAPI config bus. Updates hot-sync to AgentRuntime through
its existing /api/internal/config-sync endpoint and surface as activity events.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from app.activity import emit as activity_emit
from app.config_bus.bus import bus

log = logging.getLogger(__name__)

AGENT_RUNTIME_URL = "http://127.0.0.1:7801"

CHAT_CONFIG_DEFAULTS: Dict[str, tuple[Any, Dict[str, Any]]] = {
    "chat.history.token_budget": (6000, {"type": "integer", "minimum": 1, "maximum": 200000}),
    "chat.history.max_turns_hard_cap": (30, {"type": "integer", "minimum": 1, "maximum": 500}),
    "chat.threads.archive_after_days": (90, {"type": "integer", "minimum": 0, "maximum": 3650}),
    "chat.threads.autotitle.enabled": (True, {"type": "boolean"}),
    "chat.threads.autotitle.model": ("", {"type": "string"}),
    "chat.parallel.max_active_streams": (3, {"type": "integer", "minimum": 1, "maximum": 100}),
    "chat.input.disabled_on_error": (False, {"type": "boolean"}),
    "chat.reconnect.backoff_ms": (5000, {"type": "integer", "minimum": 0, "maximum": 60000}),
    "chat.reconnect.max_attempts": (10, {"type": "integer", "minimum": 0, "maximum": 100}),
    "chat.persistence.flush_interval_ms": (0, {"type": "integer", "minimum": 0, "maximum": 60000}),
    "chat.persistence.batch_size": (1, {"type": "integer", "minimum": 1, "maximum": 1000}),
    "chat.projects.shared_memory_loaded": (True, {"type": "boolean"}),
}

CHAT_CONFIG_KEYS = tuple(CHAT_CONFIG_DEFAULTS.keys())


def register_chat_config_keys() -> None:
    for key, (default, schema) in CHAT_CONFIG_DEFAULTS.items():
        enriched = {
            **schema,
            "category": "chat",
            "title": key.replace("chat.", "").replace("_", " "),
            "x-mission-control": {
                "surface": "chat-foundation",
                "hot_reload": True,
                "visible": True,
            },
        }
        bus.register_default(key, default, schema=enriched)
    _ensure_prefix_subscriber()


async def notify_agent_runtime(key: str, new: Any, old: Any) -> None:
    if not key.startswith("chat."):
        return
    activity_emit(
        kind="chat.config.set",
        summary=f"{key}: {old!r} → {new!r}",
        actor="system",
        subject=key,
        severity="info",
        detail={"key": key, "old": old, "new": new},
        fix=[],
    )
    try:
        async with httpx.AsyncClient(timeout=0.5) as client:
            await client.post(
                f"{AGENT_RUNTIME_URL}/api/internal/config-sync",
                json={"key": key, "value": new, "old": old},
            )
    except Exception as exc:  # noqa: BLE001
        log.debug("AgentRuntime chat config sync skipped for %s: %s", key, exc)


async def _chat_config_changed(key: str, new: Any, old: Any) -> None:
    await notify_agent_runtime(key, new, old)


def _ensure_prefix_subscriber() -> None:
    prefixes = {prefix for prefix, _callback in bus._prefix_subs}  # type: ignore[attr-defined]
    if "chat." not in prefixes:
        bus.on_prefix("chat.")(_chat_config_changed)


register_chat_config_keys()
