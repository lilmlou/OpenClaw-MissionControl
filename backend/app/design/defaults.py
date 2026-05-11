"""Design module bus key defaults — D_STUDIO_HANDOFF.md §2.3.

Registers config bus keys so the Design category auto-appears in /settings
via <BindCategory category="design" />. Until a provider is configured,
design.provider.image defaults to "none" and all endpoints return
{available: false, error: "no_provider"}.
"""

from __future__ import annotations

import logging

log = logging.getLogger(__name__)

# Bus keys for the Design module per D_STUDIO_HANDOFF.md §2.3.
# Each tuple: (key, default, schema)
DESIGN_BUS_KEYS: list[tuple[str, object, dict]] = [
    ("design.provider.image", "none", {
        "type": "string",
        "enum": ["openai-dalle3", "stability", "fal", "replicate", "none"],
        "description": "Image generation provider",
    }),
    ("design.provider.video", "none", {
        "type": "string",
        "enum": ["runway", "pika", "fal-video", "none"],
        "description": "Video generation provider",
    }),
    ("design.providers.openai.api_key", "", {
        "type": "string",
        "secret": True,
        "description": "OpenAI API key for DALL-E",
    }),
    ("design.providers.stability.api_key", "", {
        "type": "string",
        "secret": True,
        "description": "Stability AI API key",
    }),
    ("design.providers.fal.api_key", "", {
        "type": "string",
        "secret": True,
        "description": "fal.ai API key",
    }),
    ("design.default_model.image", "", {
        "type": "string",
        "description": "Default image model id (provider-dependent)",
    }),
    ("design.default_model.video", "", {
        "type": "string",
        "description": "Default video model id (provider-dependent)",
    }),
    ("design.default_aspect", "1:1", {
        "type": "string",
        "enum": ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"],
        "description": "Default aspect ratio for new generations",
    }),
    ("design.default_quality", "balanced", {
        "type": "string",
        "enum": ["speed", "balanced", "quality"],
        "description": "Default generation quality",
    }),
    ("design.cost_cap_per_day_usd", 5.0, {
        "type": "number",
        "minimum": 0,
        "description": "Daily spend cap for design generations (USD)",
    }),
]


def register_design_bus_keys() -> None:
    """Register design bus keys with the config bus singleton.

    Safe to call multiple times — bus.register is idempotent.
    """
    try:
        from app.config_bus.bus import bus
    except ImportError:
        log.warning("config_bus not available — design bus keys not registered")
        return

    for key, default, schema in DESIGN_BUS_KEYS:
        bus.register(key, default=default, schema=schema, category="design")
    log.info("registered %d design bus keys", len(DESIGN_BUS_KEYS))


# TODO: builder scaffold
