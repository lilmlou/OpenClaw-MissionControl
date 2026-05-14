"""Day-one bus key catalog (Phase 0.1 §5).

Modules will register their own defaults at import time; this file declares the
minimum platform-wide set up front so the UI has something to render before any
domain module is touched.

Add new keys here freely — the only rule is each must carry a JSON Schema with
title + category, so Phase 0.2 can auto-render the form.
"""
from __future__ import annotations

from typing import List, Tuple

from .bus import bus


def register_day_one() -> None:
    """Register the §5 catalog. Idempotent."""

    # ─── models ────────────────────────────────────────────────────────
    bus.register_default(
        "models.default.provider",
        "ollama-cloud",
        schema={
            "type": "string",
            "enum": ["ollama-cloud", "openai", "anthropic", "venice", "openrouter"],
            "title": "Default provider",
            "description": "Provider used when a session doesn't specify one.",
            "category": "models",
        },
    )
    bus.register_default(
        "models.default.id",
        "qwen3-coder:480b",
        schema={
            "type": "string",
            "title": "Default model id",
            "description": "Specific model id within the default provider.",
            "category": "models",
        },
    )
    bus.register_default(
        "models.cost_cap_per_day_usd",
        5.0,
        schema={
            "type": "number",
            "minimum": 0,
            "maximum": 1000,
            "title": "Daily cost cap (USD)",
            "description": "Soft daily ceiling for paid model spend.",
            "category": "models",
        },
    )

    # ─── feature flags ─────────────────────────────────────────────────
    for key, default, title in [
        ("feature.flags.auto_pick", False, "Auto-pick model from context classifier"),
        ("feature.flags.watcher_auto_spawn", True, "Auto-spawn watcher cron"),
        ("feature.flags.qudos_enabled", False, "Enable Qudos capture pane"),
    ]:
        bus.register_default(
            key,
            default,
            schema={
                "type": "boolean",
                "title": title,
                "category": "features",
            },
        )

    # ─── cron ─────────────────────────────────────────────────────────
    for key, default, title in [
        ("cron.watcher.interval_seconds", 30, "Watcher cron interval"),
        ("cron.auditor.interval_seconds", 300, "Auditor cron interval"),
        ("cron.supervisor.interval_seconds", 600, "Supervisor cron interval"),
    ]:
        bus.register_default(
            key,
            default,
            schema={
                "type": "integer",
                "minimum": 1,
                "maximum": 86_400,
                "title": title,
                "category": "cron",
            },
        )

    # ─── security ─────────────────────────────────────────────────────
    bus.register_default(
        "security.tailscale.required",
        True,
        schema={
            "type": "boolean",
            "title": "Require Tailscale",
            "category": "security",
        },
    )
    bus.register_default(
        "security.cors.allowlist",
        [],
        schema={
            "type": "array",
            "items": {"type": "string", "format": "uri"},
            "title": "CORS allowed origins",
            "category": "security",
        },
    )

    # ─── ui / appearance ──────────────────────────────────────────────
    bus.register_default(
        "ui.theme.default",
        "dark",
        schema={
            "type": "string",
            "enum": ["dark", "light"],
            "title": "Theme",
            "category": "appearance",
        },
    )
    bus.register_default(
        "ui.appearance.font_scale",
        1.0,
        schema={
            "type": "number",
            "minimum": 0.5,
            "maximum": 2.0,
            "title": "Font scale",
            "description": "Global font scale multiplier.",
            "category": "appearance",
        },
    )
    bus.register_default(
        "ui.appearance.density",
        "comfortable",
        schema={
            "type": "string",
            "enum": ["compact", "comfortable", "spacious"],
            "title": "Density",
            "category": "appearance",
        },
    )
    bus.register_default(
        "ui.wallpaper.url",
        None,
        schema={
            "type": ["string", "null"],
            "title": "Wallpaper URL",
            "category": "appearance",
        },
    )
    bus.register_default(
        "activities.feed.max_items",
        50,
        schema={
            "type": "integer",
            "minimum": 10,
            "maximum": 500,
            "title": "Activity feed items to display",
            "description": "Maximum number of rows shown in the global Activity Feed drawer.",
            "category": "activities",
        },
    )

    # ─── agents ───────────────────────────────────────────────────────
    bus.register_default(
        "agents.kill_after_minutes",
        15,
        schema={
            "type": "integer",
            "minimum": 1,
            "maximum": 1440,
            "title": "Kill stuck agents after (minutes)",
            "category": "agents",
        },
    )
    bus.register_default(
        "agents.acceptance_timeout_seconds",
        60,
        schema={
            "type": "integer",
            "minimum": 5,
            "maximum": 3600,
            "title": "Agent acceptance check timeout (s)",
            "category": "agents",
        },
    )


def list_day_one_keys() -> List[str]:
    return [
        "models.default.provider",
        "models.default.id",
        "models.cost_cap_per_day_usd",
        "feature.flags.auto_pick",
        "feature.flags.watcher_auto_spawn",
        "feature.flags.qudos_enabled",
        "cron.watcher.interval_seconds",
        "cron.auditor.interval_seconds",
        "cron.supervisor.interval_seconds",
        "security.tailscale.required",
        "security.cors.allowlist",
        "ui.theme.default",
        "ui.appearance.font_scale",
        "ui.appearance.density",
        "ui.wallpaper.url",
        "activities.feed.max_items",
        "agents.kill_after_minutes",
        "agents.acceptance_timeout_seconds",
    ]
