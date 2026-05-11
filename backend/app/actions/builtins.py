"""Day-one built-in actions.

These are platform-wide actions any UI can wire to via <BindAction>. Domain
modules register their own actions at their own import time.
"""
from __future__ import annotations

from typing import Any, Dict

from app.config_bus.bus import bus

from .registry import actions


def register_builtins() -> None:
    """Idempotent — re-registering replaces the handler in-place."""

    @actions.register(
        key="config.reset_all",
        title="Reset all config to defaults",
        category="config",
        destructive=True,
        input_schema={"type": "null"},
        result_schema={
            "type": "object",
            "properties": {"deleted": {"type": "integer"}},
        },
        description="Removes every Mongo override; bus reverts to registered defaults.",
    )
    async def _reset_all(args: Any, actor: str) -> Dict[str, Any]:
        from app.config_bus import store as config_store
        deleted = 0
        if config_store._db is not None:  # type: ignore[attr-defined]
            result = await config_store._db.config.delete_many({})  # type: ignore[attr-defined]
            deleted = int(result.deleted_count)
        # Reload bus state from store (now empty → defaults take over)
        await bus.load_from_store()
        return {"deleted": deleted}

    @actions.register(
        key="config.snapshot.export",
        title="Export config snapshot",
        category="config",
        destructive=False,
        input_schema={"type": "null"},
        result_schema={"type": "object"},
        description="Returns the full current config snapshot (secrets redacted).",
    )
    async def _export(args: Any, actor: str) -> Dict[str, Any]:
        return {
            "snapshot": {
                d["_id"]: {
                    "value": d["value"],
                    "version": d.get("version", 0),
                }
                for d in bus.list_docs()
            }
        }

    @actions.register(
        key="health.ping",
        title="Health ping",
        category="system",
        destructive=False,
        input_schema={"type": "null"},
        result_schema={"type": "object", "properties": {"ok": {"type": "boolean"}}},
        description="Round-trip check. Returns {ok: true} when the platform is responsive.",
    )
    async def _ping(args: Any, actor: str) -> Dict[str, Any]:
        return {"ok": True}

    @actions.register(
        key="config.set",
        title="Set a config value",
        category="config",
        destructive=False,
        input_schema={
            "type": "object",
            "properties": {
                "key": {"type": "string"},
                "value": {},
            },
            "required": ["key"],
        },
        result_schema={"type": "object"},
        description="Imperative form of PUT /api/v2/config/{key}. Useful when wiring an action button to a config write.",
    )
    async def _set(args: Any, actor: str) -> Dict[str, Any]:
        if not isinstance(args, dict) or "key" not in args:
            return {"ok": False, "error": "key required"}
        doc = await bus.set(args["key"], args.get("value"), actor=actor)
        return {"ok": True, "doc": doc}

    @actions.register(
        key="config.delete",
        title="Reset a config key to default",
        category="config",
        destructive=False,
        input_schema={
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"],
        },
        result_schema={"type": "object"},
        description="Removes the Mongo override for `key`; bus reverts to the registered default.",
    )
    async def _delete(args: Any, actor: str) -> Dict[str, Any]:
        if not isinstance(args, dict) or "key" not in args:
            return {"ok": False, "error": "key required"}
        deleted = await bus.delete(args["key"], actor=actor)
        return {"ok": True, "deleted": bool(deleted)}
