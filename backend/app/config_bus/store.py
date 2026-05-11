"""Mongo persistence for the config bus.

Collection: `config`
Document shape: per PHASE_0_1_HOT_RELOAD_CONFIG_BUS.md §3.1

Optimistic concurrency: `version` increments on every write. Callers may pass
`expected_version`; if it doesn't match the stored doc, ConfigVersionConflict
is raised.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional


log = logging.getLogger(__name__)

_db: Any = None  # Motor database, injected on startup


class ConfigVersionConflict(Exception):
    def __init__(self, key: str, current: int, expected: int):
        self.key = key
        self.current = current
        self.expected = expected
        super().__init__(f"{key} version conflict: expected {expected}, found {current}")


def set_db(db: Any) -> None:
    global _db
    _db = db


def _now_ms() -> int:
    return int(time.time() * 1000)


async def ensure_indexes() -> None:
    if _db is None:
        return
    try:
        await _db.config.create_index("_id", unique=True)
        await _db.config.create_index("schema.category")
    except Exception as exc:  # noqa: BLE001
        log.warning("config index ensure failed: %s", exc)


async def get_one(key: str) -> Optional[Dict[str, Any]]:
    if _db is None:
        return None
    return await _db.config.find_one({"_id": key}, {})


async def get_all() -> List[Dict[str, Any]]:
    if _db is None:
        return []
    cursor = _db.config.find({}, {})
    return await cursor.to_list(length=10_000)


async def upsert(
    key: str,
    *,
    value: Any,
    type_tag: str,
    schema: Optional[Dict[str, Any]],
    secret: bool,
    actor: str,
    expected_version: Optional[int] = None,
) -> Dict[str, Any]:
    """Create or update a config doc. Returns the new doc.

    If `expected_version` is provided, raises ConfigVersionConflict on mismatch.
    """
    if _db is None:
        # No DB — return a synthetic record so in-memory bus still works.
        return {
            "_id": key,
            "value": value,
            "type": type_tag,
            "schema": schema,
            "secret": secret,
            "updated_ts": _now_ms(),
            "updated_by": actor,
            "version": 1,
        }

    existing = await _db.config.find_one({"_id": key}, {"version": 1})
    current_version = int(existing["version"]) if existing else 0

    if expected_version is not None and expected_version != current_version:
        raise ConfigVersionConflict(key, current_version, expected_version)

    new_doc = {
        "_id": key,
        "value": value,
        "type": type_tag,
        "schema": schema,
        "secret": bool(secret),
        "updated_ts": _now_ms(),
        "updated_by": actor,
        "version": current_version + 1,
    }
    await _db.config.replace_one({"_id": key}, new_doc, upsert=True)
    return new_doc


async def delete_one(key: str, actor: str) -> bool:
    if _db is None:
        return False
    result = await _db.config.delete_one({"_id": key})
    return result.deleted_count > 0


async def bulk_upsert(
    changes: List[Dict[str, Any]],
    *,
    actor: str,
) -> List[Dict[str, Any]]:
    """Atomic-ish multi-set. Mongo standalone has no multi-doc tx, but we use
    a 2-phase compare-and-swap: pre-check all expected_versions, then apply.
    On any failure we revert any already-applied writes.
    """
    if _db is None:
        return [
            {
                "_id": c["key"],
                "value": c["value"],
                "type": c.get("type", "object"),
                "schema": c.get("schema"),
                "secret": bool(c.get("secret", False)),
                "updated_ts": _now_ms(),
                "updated_by": actor,
                "version": 1,
            }
            for c in changes
        ]

    # Phase 1: collect current versions, validate expectations
    keys = [c["key"] for c in changes]
    current = {
        d["_id"]: d
        async for d in _db.config.find({"_id": {"$in": keys}}, {"version": 1, "value": 1})
    }
    for c in changes:
        expected = c.get("expected_version")
        if expected is not None:
            cur_v = int(current.get(c["key"], {}).get("version", 0))
            if expected != cur_v:
                raise ConfigVersionConflict(c["key"], cur_v, expected)

    # Phase 2: apply, remembering originals for rollback
    applied: List[Dict[str, Any]] = []
    rollback: List[Dict[str, Any]] = []
    try:
        for c in changes:
            prev = current.get(c["key"])
            new_doc = await upsert(
                c["key"],
                value=c["value"],
                type_tag=c.get("type", "object"),
                schema=c.get("schema"),
                secret=bool(c.get("secret", False)),
                actor=actor,
            )
            applied.append(new_doc)
            rollback.append({"key": c["key"], "prev": prev})
    except Exception:
        # Best-effort rollback
        for r in reversed(rollback):
            try:
                if r["prev"] is None:
                    await _db.config.delete_one({"_id": r["key"]})
                else:
                    await _db.config.replace_one({"_id": r["key"]}, r["prev"])
            except Exception as rollback_exc:  # noqa: BLE001
                log.warning("rollback step failed: %s", rollback_exc)
        raise
    return applied
