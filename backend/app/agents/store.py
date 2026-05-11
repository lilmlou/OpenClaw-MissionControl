"""Mongo persistence for F7 — `agent_runs`, `agent_events`, `acceptance_checks`.

Per F7_AGENT_LIVE_VIEW.md §2.1 and BACKEND_PRINCIPLES_UPDATE.md §3 (no
os.environ.get in business logic — db handle is injected at startup).

Falls back to in-memory dicts when no DB is set, so unit tests run without
Mongo.
"""
from __future__ import annotations

import asyncio
import logging
import secrets
import time
from typing import Any, Dict, List, Optional


log = logging.getLogger(__name__)

_db: Any = None  # Motor database, injected at startup

# In-memory fallbacks (used by tests when no Mongo is available)
_mem_runs: Dict[str, Dict[str, Any]] = {}
_mem_events: List[Dict[str, Any]] = []
_mem_checks: Dict[str, List[Dict[str, Any]]] = {}
_mem_lock = asyncio.Lock()


def set_db(db: Any) -> None:
    global _db
    _db = db


def reset_for_tests() -> None:
    global _db
    _db = None
    _mem_runs.clear()
    _mem_events.clear()
    _mem_checks.clear()


def _now_ms() -> int:
    return int(time.time() * 1000)


def _ulid(prefix: str) -> str:
    ms = int(time.time() * 1000)
    rand = secrets.token_hex(5)
    return f"{prefix}_{ms:013x}{rand}"


# ── agent_runs ────────────────────────────────────────────────────────────


async def insert_run(run: Dict[str, Any]) -> Dict[str, Any]:
    if _db is not None:
        try:
            await _db.agent_runs.insert_one(dict(run))
        except Exception as exc:  # noqa: BLE001
            log.warning("agent_runs insert failed: %s", exc)
    async with _mem_lock:
        _mem_runs[run["id"]] = dict(run)
    return run


async def update_run(run_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if _db is not None:
        try:
            await _db.agent_runs.update_one({"id": run_id}, {"$set": fields})
        except Exception as exc:  # noqa: BLE001
            log.warning("agent_runs update failed: %s", exc)
    async with _mem_lock:
        if run_id in _mem_runs:
            _mem_runs[run_id].update(fields)
            return dict(_mem_runs[run_id])
    if _db is not None:
        try:
            doc = await _db.agent_runs.find_one({"id": run_id}, {"_id": 0})
            return doc
        except Exception as exc:  # noqa: BLE001
            log.warning("agent_runs find failed: %s", exc)
    return None


async def get_run(run_id: str) -> Optional[Dict[str, Any]]:
    async with _mem_lock:
        if run_id in _mem_runs:
            return dict(_mem_runs[run_id])
    if _db is not None:
        try:
            return await _db.agent_runs.find_one({"id": run_id}, {"_id": 0})
        except Exception as exc:  # noqa: BLE001
            log.warning("agent_runs get failed: %s", exc)
    return None


async def list_runs(
    *,
    status: Optional[str] = None,
    since: Optional[int] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    async with _mem_lock:
        for r in _mem_runs.values():
            if status and r.get("status") != status:
                continue
            if since and int(r.get("dispatched_ts", 0)) < int(since):
                continue
            rows.append(dict(r))
    if _db is not None:
        try:
            query: Dict[str, Any] = {}
            if status:
                query["status"] = status
            if since:
                query["dispatched_ts"] = {"$gte": int(since)}
            cursor = _db.agent_runs.find(query, {"_id": 0}).sort("dispatched_ts", -1).limit(int(limit))
            mongo_rows = await cursor.to_list(int(limit))
            # Merge — Mongo wins on duplicate ids
            seen = {r["id"] for r in mongo_rows}
            mongo_rows.extend(r for r in rows if r["id"] not in seen)
            rows = mongo_rows
        except Exception as exc:  # noqa: BLE001
            log.warning("agent_runs list failed: %s", exc)
    rows.sort(key=lambda r: int(r.get("dispatched_ts", 0)), reverse=True)
    return rows[:limit]


# ── agent_events ──────────────────────────────────────────────────────────


async def insert_event(event: Dict[str, Any]) -> Dict[str, Any]:
    if _db is not None:
        try:
            await _db.agent_events.insert_one(dict(event))
        except Exception as exc:  # noqa: BLE001
            log.warning("agent_events insert failed: %s", exc)
    async with _mem_lock:
        _mem_events.append(dict(event))
    return event


async def list_events(
    run_id: str,
    *,
    since_ts: Optional[int] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    async with _mem_lock:
        for e in _mem_events:
            if e.get("run_id") != run_id:
                continue
            if since_ts is not None and int(e.get("ts", 0)) <= int(since_ts):
                continue
            out.append(dict(e))
    if _db is not None:
        try:
            query: Dict[str, Any] = {"run_id": run_id}
            if since_ts is not None:
                query["ts"] = {"$gt": int(since_ts)}
            cursor = _db.agent_events.find(query, {"_id": 0}).sort("ts", 1).limit(int(limit))
            mongo_rows = await cursor.to_list(int(limit))
            seen = {e["id"] for e in mongo_rows}
            mongo_rows.extend(e for e in out if e["id"] not in seen)
            out = mongo_rows
        except Exception as exc:  # noqa: BLE001
            log.warning("agent_events list failed: %s", exc)
    out.sort(key=lambda e: int(e.get("ts", 0)))
    return out[:limit]


# ── acceptance_checks ─────────────────────────────────────────────────────


async def insert_checks(run_id: str, checks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for chk in checks:
        chk = dict(chk)
        chk.setdefault("id", _ulid("chk"))
        chk["run_id"] = run_id
        if _db is not None:
            try:
                await _db.acceptance_checks.insert_one(dict(chk))
            except Exception as exc:  # noqa: BLE001
                log.warning("acceptance_checks insert failed: %s", exc)
        out.append(chk)
    async with _mem_lock:
        _mem_checks.setdefault(run_id, []).extend(out)
    return out


async def list_checks(run_id: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    async with _mem_lock:
        rows = [dict(c) for c in _mem_checks.get(run_id, [])]
    if _db is not None:
        try:
            cursor = _db.acceptance_checks.find({"run_id": run_id}, {"_id": 0})
            mongo_rows = await cursor.to_list(length=10_000)
            seen = {c["id"] for c in mongo_rows}
            mongo_rows.extend(c for c in rows if c["id"] not in seen)
            rows = mongo_rows
        except Exception as exc:  # noqa: BLE001
            log.warning("acceptance_checks list failed: %s", exc)
    return rows


async def update_check(check_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if _db is not None:
        try:
            await _db.acceptance_checks.update_one({"id": check_id}, {"$set": fields})
        except Exception as exc:  # noqa: BLE001
            log.warning("acceptance_checks update failed: %s", exc)
    async with _mem_lock:
        for run_id, lst in _mem_checks.items():
            for c in lst:
                if c["id"] == check_id:
                    c.update(fields)
                    return dict(c)
    if _db is not None:
        try:
            return await _db.acceptance_checks.find_one({"id": check_id}, {"_id": 0})
        except Exception as exc:  # noqa: BLE001
            log.warning("acceptance_checks fetch failed: %s", exc)
    return None


# ── helpers ───────────────────────────────────────────────────────────────


def new_run_id() -> str:
    return _ulid("run")


def new_event_id() -> str:
    return _ulid("evt")


def now_ms() -> int:
    return _now_ms()
