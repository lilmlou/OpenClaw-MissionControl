"""Brain gateway config bus registration and cross-stack sync.

P0-A Brain Gateway backend handoff §3.2 / §5 BE-5. Importing this module
registers all brain.* keys on the FastAPI config bus. Updates are visible via
/api/ws/config and /api/ws/activities through the existing config bridge, and
also notify AgentRuntime's internal config-sync endpoint when it is reachable.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from app.activity import emit as activity_emit
from app.config_bus.bus import bus

log = logging.getLogger(__name__)

AGENT_RUNTIME_URL = "http://127.0.0.1:7801"

BRAIN_CONFIG_DEFAULTS: Dict[str, tuple[Any, Dict[str, Any]]] = {
    "brain.context_window_cap_tokens": (32000, {"type": "integer", "minimum": 1024}),
    "brain.memory.global_token_budget": (2000, {"type": "integer", "minimum": 0}),
    "brain.memory.thread_token_budget": (4000, {"type": "integer", "minimum": 0}),
    "brain.memory.project_token_budget": (2000, {"type": "integer", "minimum": 0}),
    "brain.memory.skill_token_budget": (1000, {"type": "integer", "minimum": 0}),
    "brain.classify.confidence_threshold": (0.6, {"type": "number", "minimum": 0, "maximum": 1}),
    "brain.router.fallback_model_id": ("qwen/qwen3-235b-a22b", {"type": "string", "minLength": 1}),
    "brain.router.fallback_provider_id": ("venice", {"type": "string", "minLength": 1}),
    "brain.router.allowed_providers": (["venice", "openrouter", "ollama"], {"type": "array", "items": {"type": "string"}}),
    "brain.picker.outcome_feedback_enabled": (False, {"type": "boolean"}),
    "brain.picker.learning_rate": (0.05, {"type": "number", "minimum": 0, "maximum": 1}),
    "brain.web_search.default": (False, {"type": "boolean"}),
    "brain.agent_mode.default": (False, {"type": "boolean"}),
    "brain.approval_mode.default": ("ask", {"type": "string", "enum": ["ask", "auto", "off"]}),
    "brain.stream.max_chunk_delay_ms": (50, {"type": "integer", "minimum": 0, "maximum": 1000}),
    "brain.log.retention_events": (500, {"type": "integer", "minimum": 1, "maximum": 10000}),
}

BRAIN_CONFIG_KEYS = tuple(BRAIN_CONFIG_DEFAULTS.keys())

ROUTER_CONFIG_DEFAULTS: Dict[str, tuple[Any, Dict[str, Any]]] = {
    "router.classify.model": ("heuristic", {"type": "string", "enum": ["heuristic", "llm"]}),
    "router.classify.confidence_threshold": (0.6, {"type": "number", "minimum": 0, "maximum": 1}),
    "router.score.weight_performance": (0.40, {"type": "number", "minimum": 0, "maximum": 1}),
    "router.score.weight_cost": (0.25, {"type": "number", "minimum": 0, "maximum": 1}),
    "router.score.weight_latency": (0.20, {"type": "number", "minimum": 0, "maximum": 1}),
    "router.score.weight_quota": (0.15, {"type": "number", "minimum": 0, "maximum": 1}),
    "router.score.ema_alpha": (0.10, {"type": "number", "minimum": 0, "maximum": 1}),
    "router.candidates.allowed_providers": (["venice", "openrouter", "ollama"], {"type": "array", "items": {"type": "string"}}),
    "router.candidates.allowed_models_per_context": ({}, {"type": "object", "additionalProperties": {"type": "array", "items": {"type": "string"}}}),
    "router.feedback.enabled": (True, {"type": "boolean"}),
    "router.reason_chip.enabled": (True, {"type": "boolean"}),
    "router.insights.window_hours": (168, {"type": "integer", "minimum": 1, "maximum": 8760}),
}

ROUTER_CONFIG_KEYS = tuple(ROUTER_CONFIG_DEFAULTS.keys())


def _register_config_defaults(defaults: Dict[str, tuple[Any, Dict[str, Any]]], category: str, surface: str) -> None:
    for key, (default, schema) in defaults.items():
        enriched = {
            **schema,
            "category": category,
            "title": key.replace(f"{category}.", "").replace("_", " "),
            "x-mission-control": {
                "surface": surface,
                "hot_reload": True,
                "visible": True,
            },
        }
        bus.register_default(key, default, schema=enriched)


def register_brain_config_keys() -> None:
    _register_config_defaults(BRAIN_CONFIG_DEFAULTS, "brain", "brain-gateway")
    _register_config_defaults(ROUTER_CONFIG_DEFAULTS, "router", "model-router")
    _ensure_prefix_subscribers()


async def notify_agent_runtime(key: str, new: Any, old: Any) -> None:
    if not (key.startswith("brain.") or key.startswith("router.")):
        return
    kind = "router.config.set" if key.startswith("router.") else "brain.config.set"
    activity_emit(
        kind=kind,
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
        log.debug("AgentRuntime brain config sync skipped for %s: %s", key, exc)


async def _brain_config_changed(key: str, new: Any, old: Any) -> None:
    await notify_agent_runtime(key, new, old)


async def _router_config_changed(key: str, new: Any, old: Any) -> None:
    await notify_agent_runtime(key, new, old)


def _ensure_prefix_subscribers() -> None:
    prefixes = {prefix for prefix, _callback in bus._prefix_subs}  # type: ignore[attr-defined]
    if "brain." not in prefixes:
        bus.on_prefix("brain.")(_brain_config_changed)
    if "router." not in prefixes:
        bus.on_prefix("router.")(_router_config_changed)


register_brain_config_keys()
