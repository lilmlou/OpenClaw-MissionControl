"""Bridge config bus changes to the activity feed and the WS broadcaster.

Wired into the bus via a prefix subscription on `""` (matches everything).
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from app.activity import emit as activity_emit

from . import ws as ws_module
from .bus import bus


log = logging.getLogger(__name__)


def _redact(key: str, value: Any) -> Any:
    """Redact secrets by checking the bus's registered metadata."""
    try:
        doc = bus.get_doc(key)
        if doc.get("secret"):
            return "***"
    except KeyError:
        pass
    return value


def install() -> None:
    """Install the bridge subscriber. Idempotent."""

    @bus.on_prefix("")
    async def _bridge(key: str, new: Any, old: Any) -> None:
        # 1. Activity feed
        try:
            activity_emit(
                kind="config.set" if new is not None else "config.deleted",
                summary=f"{key}: {_short(_redact(key, old))} → {_short(_redact(key, new))}",
                actor="system",
                subject=key,
                severity="info",
                detail={
                    "key": key,
                    "old": _redact(key, old),
                    "new": _redact(key, new),
                },
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("activity emit failed for %s: %s", key, exc)

        # 2. WS broadcast (live form sync)
        try:
            doc = bus.get_doc(key)
            event_type = "config.set" if doc.get("version", 0) > 0 or new is not None else "config.deleted"
            await ws_module.broadcast({
                "type": event_type,
                "key": key,
                "value": _redact(key, new),
                "version": doc.get("version", 0),
                "actor": doc.get("updated_by", "system"),
                "ts": doc.get("updated_ts"),
            })
        except KeyError:
            # Key was fully deleted (no default registered). Still announce.
            await ws_module.broadcast({
                "type": "config.deleted",
                "key": key,
                "ts": None,
            })
        except Exception as exc:  # noqa: BLE001
            log.warning("ws broadcast failed for %s: %s", key, exc)


def _short(v: Any) -> str:
    s = repr(v)
    if len(s) > 60:
        return s[:57] + "..."
    return s
