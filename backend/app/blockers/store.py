"""Mongo/in-memory store for VM-D1 Blockers Mirror."""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)
_db: Any = None
_mem: Dict[str, Dict[str, Any]] = {}
_mem_scanned_ts: int = 0
_lock = asyncio.Lock()


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
        await _db.blockers.create_index("id", unique=True)
        await _db.blockers.create_index("status")
        await _db.blockers.create_index("severity")
        await _db.blockers.create_index("opened_ts")
    except Exception as exc:  # noqa: BLE001
        log.warning("blockers index ensure failed: %s", exc)


def _public(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(doc)
    out.pop("_id", None)
    return out


async def get_one(blocker_id: str) -> Optional[Dict[str, Any]]:
    async with _lock:
        if blocker_id in _mem:
            return dict(_mem[blocker_id])
    if _db is not None:
        try:
            doc = await _db.blockers.find_one({"id": blocker_id}, {"_id": 0})
            return _public(doc) if doc else None
        except Exception as exc:  # noqa: BLE001
            log.warning("blockers get failed: %s", exc)
    return None


async def list_blockers(
    *,
    status: str = "open",
    since: Optional[int] = None,
    severity: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    global _mem_scanned_ts
    query: Dict[str, Any] = {}
    if status != "all":
        query["status"] = status
    if severity:
        query["severity"] = severity
    if since is not None:
        query["opened_ts"] = {"$gte": int(since)}

    items: List[Dict[str, Any]] = []
    if _db is not None:
        try:
            cursor = _db.blockers.find(query, {"_id": 0}).sort("opened_ts", -1).limit(int(limit))
            items = await cursor.to_list(int(limit))
            count_open = await _db.blockers.count_documents({"status": "open"})
            count_closed = await _db.blockers.count_documents({"status": "closed"})
            meta = await _db.blockers_meta.find_one({"_id": "scan"}, {"_id": 0}) or {}
            return {
                "items": [_public(i) for i in items],
                "count_open": int(count_open),
                "count_closed": int(count_closed),
                "total": int(count_open) + int(count_closed),
                "scanned_ts": int(meta.get("scanned_ts") or _mem_scanned_ts or 0),
            }
        except Exception as exc:  # noqa: BLE001
            log.warning("blockers list failed: %s", exc)

    async with _lock:
        rows = [dict(v) for v in _mem.values()]
        if status != "all":
            rows = [r for r in rows if r.get("status") == status]
        if severity:
            rows = [r for r in rows if r.get("severity") == severity]
        if since is not None:
            rows = [r for r in rows if int(r.get("opened_ts", 0)) >= int(since)]
        rows.sort(key=lambda r: int(r.get("opened_ts", 0)), reverse=True)
        all_rows = list(_mem.values())
        return {
            "items": rows[:limit],
            "count_open": sum(1 for r in all_rows if r.get("status") == "open"),
            "count_closed": sum(1 for r in all_rows if r.get("status") == "closed"),
            "total": len(all_rows),
            "scanned_ts": _mem_scanned_ts,
        }


async def count_open() -> int:
    if _db is not None:
        try:
            return int(await _db.blockers.count_documents({"status": "open"}))
        except Exception as exc:  # noqa: BLE001
            log.warning("blockers count failed: %s", exc)
    async with _lock:
        return sum(1 for r in _mem.values() if r.get("status") == "open")


async def upsert_many(docs: List[Dict[str, Any]], *, scanned_ts: int) -> Dict[str, Any]:
    """Upsert parsed docs and return changed docs by WS type."""
    global _mem_scanned_ts
    changes = {"opened": [], "closed": [], "changed": [], "unchanged": 0}
    async with _lock:
        for doc in docs:
            prev = _mem.get(doc["id"])
            if prev is None:
                changes["opened"].append(dict(doc))
            elif prev.get("status") != doc.get("status") and doc.get("status") == "closed":
                changes["closed"].append(dict(doc))
            elif any(prev.get(k) != doc.get(k) for k in ("title", "severity", "body_md", "suggested_actions", "source_lineno")):
                changes["changed"].append(dict(doc))
            else:
                changes["unchanged"] += 1
            _mem[doc["id"]] = dict(doc)
        _mem_scanned_ts = scanned_ts

    parsed_ids = [doc["id"] for doc in docs]
    if _db is not None:
        try:
            if parsed_ids:
                await _db.blockers.delete_many({"id": {"$nin": parsed_ids}})
            else:
                await _db.blockers.delete_many({})
            for doc in docs:
                await _db.blockers.replace_one({"id": doc["id"]}, dict(doc), upsert=True)
            await _db.blockers_meta.replace_one({"_id": "scan"}, {"_id": "scan", "scanned_ts": scanned_ts}, upsert=True)
        except Exception as exc:  # noqa: BLE001
            log.warning("blockers upsert failed: %s", exc)
    return changes


async def close_one(blocker_id: str, *, closed_ts: int, body_md: Optional[str] = None) -> Optional[Dict[str, Any]]:
    fields: Dict[str, Any] = {"status": "closed", "closed_ts": closed_ts}
    if body_md is not None:
        fields["body_md"] = body_md
    async with _lock:
        if blocker_id in _mem:
            _mem[blocker_id].update(fields)
            doc = dict(_mem[blocker_id])
        else:
            doc = None
    if _db is not None:
        try:
            await _db.blockers.update_one({"id": blocker_id}, {"$set": fields})
            doc = await _db.blockers.find_one({"id": blocker_id}, {"_id": 0})
        except Exception as exc:  # noqa: BLE001
            log.warning("blockers close failed: %s", exc)
    return _public(doc) if doc else None
