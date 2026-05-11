"""Phase 0.1 — Hot-Reload Config Bus.

Singleton `bus` object. Modules call:

    from app.config_bus import bus

    bus.register_default("foo.bar", "value", schema={...})
    value = bus.get("foo.bar")
    await bus.set("foo.bar", "new", actor="user:meg")

    @bus.on("foo.bar")
    async def _changed(new, old): ...
"""
from .bus import bus, ConfigBus, ConfigBusError, ConfigValidationError, ConfigVersionConflict
from .routes import config_router
from .ws import config_ws_router, broadcast as ws_broadcast

__all__ = [
    "bus",
    "ConfigBus",
    "ConfigBusError",
    "ConfigValidationError",
    "ConfigVersionConflict",
    "config_router",
    "config_ws_router",
    "ws_broadcast",
]
