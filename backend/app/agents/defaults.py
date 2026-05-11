"""Phase 0.1 bus keys owned by F7 / agents.

Loaded at app startup from server.py via `register_agent_bus_keys()`.
"""
from __future__ import annotations

from app.config_bus.bus import bus


def register_agent_bus_keys() -> None:
    """Idempotent. Registers F7-relevant config keys."""
    bus.register_default(
        "agents.acceptance.timeout_seconds",
        60,
        schema={
            "type": "integer",
            "minimum": 5,
            "maximum": 3600,
            "title": "Acceptance command timeout (s)",
            "description": "Per-command timeout for §6 acceptance checks.",
            "category": "agents",
        },
    )
    bus.register_default(
        "agents.kill.escalation_seconds",
        5,
        schema={
            "type": "integer",
            "minimum": 1,
            "maximum": 300,
            "title": "SIGKILL escalation (s)",
            "description": "Wait this long after SIGTERM before SIGKILL.",
            "category": "agents",
        },
    )
    bus.register_default(
        "agents.events.retain_per_run",
        2000,
        schema={
            "type": "integer",
            "minimum": 100,
            "maximum": 100_000,
            "title": "Events retained per run",
            "category": "agents",
        },
    )
    bus.register_default(
        "agents.handoffs.search_root",
        "/Volumes/🦋• Drive   1/MC",
        schema={
            "type": "string",
            "title": "Handoff doc root",
            "description": "Directory where handoff *.md docs live.",
            "category": "agents",
        },
    )
    bus.register_default(
        "agents.repo.fastapi_root",
        "",
        schema={
            "type": "string",
            "title": "FastAPI repo root for git diff",
            "description": "Empty = autodetect (current working directory of run).",
            "category": "agents",
        },
    )


def list_agent_bus_keys() -> list[str]:
    return [
        "agents.acceptance.timeout_seconds",
        "agents.kill.escalation_seconds",
        "agents.events.retain_per_run",
        "agents.handoffs.search_root",
        "agents.repo.fastapi_root",
    ]
