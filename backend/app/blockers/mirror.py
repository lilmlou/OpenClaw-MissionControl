"""Background mirror loop for BLOCKERS.md → Mongo + WS + activity."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

from app.activity import emit as activity_emit
from app.config_bus import bus, ws_broadcast

from .parser import parse_blockers_md
from . import store

log = logging.getLogger(__name__)
DEFAULT_BLOCKERS_PATH = "/Volumes/🦋• Drive   1/MC/BLOCKERS.md"

def register_defaults() -> None:
    bus.register_default(
        "blockers.file_path",
        DEFAULT_BLOCKERS_PATH,
        schema={"type": "string", "category": "blockers"},
    )
    bus.register_default(
        "cron.blockers_mirror.interval_seconds",
        300,
        schema={"type": "integer", "minimum": 30, "maximum": 3600, "category": "blockers"},
    )


register_defaults()

_task: Optional[asyncio.Task[Any]] = None
_last_scan: Dict[str, Any] = {"scanned_ts": 0, "count_open": 0, "items": []}


def health() -> Dict[str, Any]:
    return {
        "status": "ok" if _task is None or not _task.done() else "stopped",
        "latency_ms": 0,
        "last_error": None,
        "capabilities": ["parse", "list", "dismiss", "ws_replay", "activity"],
        "last_scan": dict(_last_scan),
    }


def get_last_replay() -> Dict[str, Any]:
    return {"type": "blockers.replay", "data": dict(_last_scan)}


async def scan_once() -> Dict[str, Any]:
    """Run one parse/upsert/broadcast cycle now."""
    path = bus.get("blockers.file_path")
    scanned_ts = int(time.time() * 1000)
    docs = parse_blockers_md(str(path))
    changes = await store.upsert_many(docs, scanned_ts=scanned_ts)
    open_items = [doc for doc in docs if doc.get("status") == "open"]
    _last_scan.update({"scanned_ts": scanned_ts, "count_open": len(open_items), "items": open_items})

    event_counts = {
        "added": len(changes["opened"]),
        "closed": len(changes["closed"]),
        "changed": len(changes["changed"]),
        "unchanged": int(changes["unchanged"]),
        "count_open": len(open_items),
    }
    await ws_broadcast({"type": "blockers.scan", "data": event_counts})
    activity_emit(
        kind="blockers.scan",
        summary=f"Scanned BLOCKERS.md: {len(open_items)} open blockers",
        actor="system",
        subject="BLOCKERS.md",
        severity="warn" if open_items else "info",
        detail=event_counts,
        fix=[],
    )

    for key, ws_type in (("opened", "blocker.opened"), ("closed", "blocker.closed"), ("changed", "blocker.changed")):
        for doc in changes[key]:
            await ws_broadcast({"type": ws_type, "data": doc})
            activity_emit(
                kind=ws_type,
                summary=f"{doc.get('title', 'Blocker')} is {doc.get('status')}",
                actor="system",
                subject=doc.get("id"),
                severity="warn" if doc.get("severity") == "medium" else doc.get("severity", "info"),
                detail={"blocker": doc},
                fix=doc.get("suggested_actions") or [],
            )
    return {"items": docs, **event_counts, "scanned_ts": scanned_ts}


async def _loop() -> None:
    while True:
        try:
            await scan_once()
        except Exception as exc:  # noqa: BLE001
            log.warning("blockers mirror scan failed: %s", exc)
            activity_emit(
                kind="blockers.error",
                summary="Blockers mirror scan failed",
                actor="system",
                subject="BLOCKERS.md",
                severity="error",
                detail={"error": str(exc)},
                fix=[{"label": "Check BLOCKERS.md path", "action": "config.edit", "args": {"key": "blockers.file_path"}}],
            )
        interval = int(bus.get("cron.blockers_mirror.interval_seconds", 300))
        await asyncio.sleep(max(30, interval))


async def start_mirror_loop(db: Any = None) -> Optional[asyncio.Task[Any]]:
    global _task
    if db is not None:
        store.set_db(db)
    await store.ensure_indexes()
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())
    return _task


@bus.on("cron.blockers_mirror.interval_seconds")
async def _interval_changed(new: Any, old: Any) -> None:
    activity_emit(
        kind="blockers.config.reloaded",
        summary=f"Blockers mirror interval changed: {old} → {new}",
        actor="system",
        subject="cron.blockers_mirror.interval_seconds",
        severity="info",
        detail={"old": old, "new": new},
        fix=[],
    )
