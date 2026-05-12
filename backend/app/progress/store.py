"""Mongo/in-memory store for VM-D2 Progress Pulse."""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)
_db: Any = None
_mem: Dict[str, Dict[str, Any]] = {}
_mem_scanned_ts: int = 0
_lock = asyncio.Lock()
_STATUSES = ("verified", "claims_done", "deceptive", "in_flight")


def set_db(db: Any) -> None:
    global _db
    _db = db


def reset_for_tests() -> None:
    global _db, _mem_scanned_ts
    _db = None
    _mem.clear()
    _mem_scanned_ts = 0


async def ensure_indexes() -> None:
    if _db is None:
        return
    try:
        await _db.progress_entries.create_index("id", unique=True)
        await _db.progress_entries.create_index("status")
        await _db.progress_entries.create_index("date_ts")
        await _db.progress_entries.create_index("seen")
    except Exception as exc:  # noqa: BLE001
        log.warning("progress index ensure failed: %s", exc)


def _public(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if doc is None:
        return None
    out = dict(doc)
    out.pop("_id", None)
    return out


def _counts_from_rows(rows: List[Dict[str, Any]], scanned_ts: int) -> Dict[str, Any]:
    counts = {status: 0 for status in _STATUSES}
    unseen_total = 0
    for row in rows:
        status = row.get("status")
        if status in counts:
            counts[status] += 1
        if not row.get("seen", False):
            unseen_total += 1
    counts["unseen_total"] = unseen_total
    counts["scanned_ts"] = int(scanned_ts or 0)
    return counts


async def get_one(progress_id: str) -> Optional[Dict[str, Any]]:
    async with _lock:
        if progress_id in _mem:
            return dict(_mem[progress_id])
    if _db is not None:
        try:
            doc = await _db.progress_entries.find_one({"id": progress_id}, {"_id": 0})
            return _public(doc)
        except Exception as exc:  # noqa: BLE001
            log.warning("progress get failed: %s", exc)
    return None


async def list_progress(
    *,
    status: str = "all",
    since: Optional[int] = None,
    limit: int = 20,
    unseen_only: bool = False,
) -> Dict[str, Any]:
    global _mem_scanned_ts
    limit = max(1, min(int(limit), 100))
    query: Dict[str, Any] = {}
    if status != "all":
        query["status"] = status
    if since is not None:
        query["date_ts"] = {"$gte": int(since)}
    if unseen_only:
        query["seen"] = {"$ne": True}

    if _db is not None:
        try:
            cursor = _db.progress_entries.find(query, {"_id": 0}).sort("date_ts", -1).limit(limit)
            items = [_public(i) for i in await cursor.to_list(limit)]
            rows = await _db.progress_entries.find({}, {"_id": 0}).to_list(10000)
            total = await _db.progress_entries.count_documents(query)
            meta = await _db.progress_meta.find_one({"_id": "scan"}, {"_id": 0}) or {}
            scanned_ts = int(meta.get("scanned_ts") or _mem_scanned_ts or 0)
            return {
                "items": items,
                "counts": _counts_from_rows([_public(r) for r in rows if r], scanned_ts),
                "total": int(total),
                "scanned_ts": scanned_ts,
            }
        except Exception as exc:  # noqa: BLE001
            log.warning("progress list failed: %s", exc)

    async with _lock:
        all_rows = [dict(v) for v in _mem.values()]
        rows = list(all_rows)
        if status != "all":
            rows = [r for r in rows if r.get("status") == status]
        if since is not None:
            rows = [r for r in rows if int(r.get("date_ts", 0)) >= int(since)]
        if unseen_only:
            rows = [r for r in rows if not r.get("seen", False)]
        rows.sort(key=lambda r: int(r.get("date_ts", 0)), reverse=True)
        return {
            "items": rows[:limit],
            "counts": _counts_from_rows(all_rows, _mem_scanned_ts),
            "total": len(rows),
            "scanned_ts": _mem_scanned_ts,
        }


async def get_counts() -> Dict[str, Any]:
    data = await list_progress(status="all", limit=1)
    return dict(data["counts"])


async def upsert_many(docs: List[Dict[str, Any]], *, scanned_ts: int) -> Dict[str, Any]:
    """Upsert parsed docs and return changed docs by WS type."""
    global _mem_scanned_ts
    changes = {"added": [], "changed": [], "unchanged": 0}

    async with _lock:
        for doc in docs:
            incoming = dict(doc)
            prev = _mem.get(incoming["id"])
            if prev is not None and prev.get("seen") is True:
                incoming["seen"] = True
            if prev is None:
                changes["added"].append(dict(incoming))
            elif any(prev.get(k) != incoming.get(k) for k in ("name", "status", "date_str", "date_ts", "repo_path", "cron_run_id", "body_md", "suggested_actions", "seen")):
                changes["changed"].append(dict(incoming))
            else:
                changes["unchanged"] += 1
            _mem[incoming["id"]] = incoming
        _mem_scanned_ts = scanned_ts

    if _db is not None:
        try:
            for doc in docs:
                incoming = dict(doc)
                existing = await _db.progress_entries.find_one({"id": incoming["id"]}, {"_id": 0})
                if existing and existing.get("seen") is True:
                    incoming["seen"] = True
                await _db.progress_entries.replace_one({"id": incoming["id"]}, incoming, upsert=True)
            await _db.progress_meta.replace_one({"_id": "scan"}, {"_id": "scan", "scanned_ts": scanned_ts}, upsert=True)
        except Exception as exc:  # noqa: BLE001
            log.warning("progress upsert failed: %s", exc)
    return changes


async def mark_seen(progress_id: str) -> Optional[Dict[str, Any]]:
    async with _lock:
        if progress_id in _mem:
            _mem[progress_id]["seen"] = True
            doc = dict(_mem[progress_id])
        else:
            doc = None
    if _db is not None:
        try:
            await _db.progress_entries.update_one({"id": progress_id}, {"$set": {"seen": True}})
            doc = await _db.progress_entries.find_one({"id": progress_id}, {"_id": 0})
        except Exception as exc:  # noqa: BLE001
            log.warning("progress seen failed: %s", exc)
    return _public(doc) if doc else None
