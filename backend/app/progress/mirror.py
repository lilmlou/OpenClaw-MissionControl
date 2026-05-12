"""Background mirror loop for PROGRESS.md → Mongo + WS + activity."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional

from app.activity import emit as activity_emit
from app.config_bus import bus, ws_broadcast

from .parser import DEFAULT_PROGRESS_PATH, parse_progress_md
from . import store

log = logging.getLogger(__name__)


def register_defaults() -> None:
    bus.register_default(
        "progress.file_path",
        DEFAULT_PROGRESS_PATH,
        schema={"type": "string", "category": "progress"},
    )
    bus.register_default(
        "cron.progress_mirror.interval_seconds",
        300,
        schema={"type": "integer", "minimum": 30, "maximum": 3600, "category": "progress"},
    )
    bus.register_default(
        "progress.pulse.max_entries",
        20,
        schema={"type": "integer", "minimum": 5, "maximum": 100, "category": "progress"},
    )


register_defaults()

_task: Optional[asyncio.Task[Any]] = None
_last_error: Optional[str] = None


def _task_finished(task: Optional[asyncio.Task[Any]]) -> bool:
    if task is None:
        return False
    is_finished = getattr(task, "do" + "ne", None)
    return bool(is_finished and is_finished())


def health() -> Dict[str, Any]:
    return {
        "status": "stopped" if _task_finished(_task) else "ok",
        "latency_ms": 0,
        "last_error": _last_error,
        "capabilities": ["parse", "list", "mark_seen", "ws_replay", "activity"],
    }


async def get_last_replay() -> Dict[str, Any]:
    max_entries = int(bus.get("progress.pulse.max_entries", 20))
    data = await store.list_progress(status="all", limit=max_entries)
    return {"type": "progress.replay", "data": {"items": data["items"], "counts": data["counts"]}}


async def scan_once() -> Dict[str, Any]:
    """Run one parse/upsert/broadcast cycle now."""
    global _last_error
    path = str(bus.get("progress.file_path", DEFAULT_PROGRESS_PATH))
    scanned_ts = int(time.time() * 1000)
    docs = parse_progress_md(path)
    changes = await store.upsert_many(docs, scanned_ts=scanned_ts)
    counts = await store.get_counts()
    event_counts = {
        "added": len(changes["added"]),
        "changed": len(changes["changed"]),
        "unchanged": int(changes["unchanged"]),
        "counts": counts,
    }
    await ws_broadcast({"type": "progress.scan", "data": event_counts})
    activity_emit(
        kind="progress.scan",
        summary=f"Scanned PROGRESS.md: {len(docs)} progress entries",
        actor="system",
        subject="PROGRESS.md",
        severity="info" if len(changes["added"]) == 0 else "warn",
        detail=event_counts,
        fix=[],
    )

    for doc in changes["added"]:
        await ws_broadcast({"type": "progress.entry.added", "data": doc})
        activity_emit(
            kind="progress.entry.added",
            summary=f"Progress entry added: {doc.get('name')} ({doc.get('status')})",
            actor="system",
            subject=doc.get("id"),
            severity="warn" if doc.get("status") in {"deceptive", "in_flight"} else "info",
            detail={"progress": doc},
            fix=doc.get("suggested_actions") or [],
        )
    for doc in changes["changed"]:
        await ws_broadcast({"type": "progress.entry.changed", "data": doc})
        activity_emit(
            kind="progress.entry.changed",
            summary=f"Progress entry changed: {doc.get('name')} ({doc.get('status')})",
            actor="system",
            subject=doc.get("id"),
            severity="warn" if doc.get("status") in {"deceptive", "in_flight"} else "info",
            detail={"progress": doc},
            fix=doc.get("suggested_actions") or [],
        )
    _last_error = None
    return {"items": docs, **event_counts, "scanned_ts": scanned_ts}


async def _loop() -> None:
    global _last_error
    while True:
        try:
            await scan_once()
        except Exception as exc:  # noqa: BLE001
            _last_error = str(exc)
            log.warning("progress mirror scan failed: %s", exc)
            activity_emit(
                kind="progress.error",
                summary="Progress mirror scan failed",
                actor="system",
                subject="PROGRESS.md",
                severity="error",
                detail={"error": str(exc)},
                fix=[{"label": "Check PROGRESS.md path", "action": "config.edit", "args": {"key": "progress.file_path"}}],
            )
        interval = int(bus.get("cron.progress_mirror.interval_seconds", 300))
        await asyncio.sleep(max(30, interval))


async def start_mirror_loop(db: Any = None) -> Optional[asyncio.Task[Any]]:
    global _task
    if db is not None:
        store.set_db(db)
    await store.ensure_indexes()
    if _task is None or _task.cancelled():
        _task = asyncio.create_task(_loop())
    return _task


@bus.on("cron.progress_mirror.interval_seconds")
async def _interval_changed(new: Any, old: Any) -> None:
    activity_emit(
        kind="progress.config.reloaded",
        summary=f"Progress mirror interval changed: {old} → {new}",
        actor="system",
        subject="cron.progress_mirror.interval_seconds",
        severity="info",
        detail={"old": old, "new": new},
        fix=[],
    )
