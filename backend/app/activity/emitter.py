"""Activity event emitter.

Canonical event shape (BACKEND_PRINCIPLES_UPDATE.md §2.4):

    {
      "id": "evt_<ulid>",
      "ts": <ms>,
      "kind": "config.set" | "config.deleted" | "agent.event" | "cron.fired" | "error" | ...,
      "summary": "models.default.provider: ollama-cloud → openai",
      "actor": "user:meg" | "system" | "agent:<id>" | "cron:<id>",
      "subject": "<resource id, optional>",
      "severity": "info" | "warn" | "error" | "critical",
      "detail": { ... },
      "fix": [ { "label": "...", "action": "...", "args": {...} } ]
    }

Events persist to Mongo (`activity_events`) and fan out via an optional
broadcaster callback, set by whichever WS hub wants to relay them. Designed so
the bus and other modules can call `emit()` without knowing about Mongo or WS.
"""
from __future__ import annotations

import asyncio
import logging
import secrets
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional


log = logging.getLogger(__name__)

# Module-level injection points (set during app startup)
_db: Any = None
_broadcaster: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None
_mem_events: List[Dict[str, Any]] = []


def set_db(db: Any) -> None:
    """Inject the Motor database handle (called once during startup)."""
    global _db
    _db = db


def set_broadcaster(fn: Optional[Callable[[Dict[str, Any]], Awaitable[None]]]) -> None:
    """Register a callback invoked once per emitted event.

    The WS hub passes its broadcast method here. None disables fanout.
    """
    global _broadcaster
    _broadcaster = fn


def _ulid() -> str:
    """Compact monotonic-ish event ID. Not strict ULID — close enough for ordering."""
    ms = int(time.time() * 1000)
    rand = secrets.token_hex(5)
    return f"evt_{ms:013x}{rand}"


def _now_ms() -> int:
    return int(time.time() * 1000)


def emit(
    *,
    kind: str,
    summary: str,
    actor: str = "system",
    subject: Optional[str] = None,
    severity: str = "info",
    detail: Optional[Dict[str, Any]] = None,
    fix: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Synchronously emit an event. Returns the event dict.

    Mongo write + WS broadcast are scheduled async; emit() never blocks.
    """
    event: Dict[str, Any] = {
        "id": _ulid(),
        "ts": _now_ms(),
        "kind": kind,
        "summary": summary,
        "actor": actor,
        "subject": subject,
        "severity": severity,
        "detail": detail or {},
        "fix": fix or [],
    }

    _mem_events.append(dict(event))
    if len(_mem_events) > 1000:
        del _mem_events[:-1000]

    if _db is not None:
        try:
            asyncio.get_event_loop().create_task(_persist(event))
        except RuntimeError:
            # No running loop (e.g. from a sync test). Skip persist.
            pass

    if _broadcaster is not None:
        try:
            asyncio.get_event_loop().create_task(_broadcast(event))
        except RuntimeError:
            pass

    return event


async def _persist(event: Dict[str, Any]) -> None:
    try:
        await _db.activity_events.insert_one(dict(event))
    except Exception as exc:  # noqa: BLE001
        log.warning("activity persist failed: %s", exc)


async def _broadcast(event: Dict[str, Any]) -> None:
    try:
        if _broadcaster is not None:
            await _broadcaster(event)
    except Exception as exc:  # noqa: BLE001
        log.warning("activity broadcast failed: %s", exc)


async def get_recent(limit: int = 100, kind: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch recent events from Mongo plus in-memory fallback events."""
    rows: List[Dict[str, Any]] = []
    if _db is not None:
        try:
            query: Dict[str, Any] = {}
            if kind:
                query["kind"] = kind
            cursor = _db.activity_events.find(query, {"_id": 0}).sort("ts", -1).limit(int(limit))
            rows = await cursor.to_list(int(limit))
        except Exception as exc:  # noqa: BLE001
            log.warning("activity query failed: %s", exc)
    mem = [dict(e) for e in _mem_events if kind is None or e.get("kind") == kind]
    seen = {r.get("id") for r in rows}
    rows.extend(e for e in mem if e.get("id") not in seen)
    rows.sort(key=lambda e: int(e.get("ts", 0)), reverse=True)
    return rows[: int(limit)]
