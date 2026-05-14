"""Personas store — in-memory (with optional Motor/Mongo persistence).

The persona document shape is intentionally small so the frontend shell at
`/personas` can render real data without further migrations:

    {
      "id": "persona-dev",            # stable client id (slug-style)
      "name": "Dev",                  # display name
      "tagline": "...",               # short subtitle
      "icon": "Code2",                # lucide-react icon name (FE maps)
      "accent": "var(--mc-accent)",   # CSS color token
      "system": True,                 # built-in (cannot be deleted)
      "active": False,                # is currently bound
      "defaults": {
        "model": "Auto · code-class",
        "temperature": 0.2,
        "memory_scope": "Project + Global",
        "skills": ["repo.read", ...],
        "personality": "Terse. ..."
      },
      "created_ts": <ms>,
      "updated_ts": <ms>
    }
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Optional


log = logging.getLogger(__name__)

_db: Any = None
_mem: Dict[str, Dict[str, Any]] = {}
_active_id: Optional[str] = None
_lock = asyncio.Lock()

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


# ---- Built-in defaults — mirror PersonasPage.js PLACEHOLDER_PERSONAS ----

DEFAULT_PERSONAS: List[Dict[str, Any]] = [
    {
        "id": "persona-dev",
        "name": "Dev",
        "tagline": "Engineering, code, ship-it mode",
        "icon": "Code2",
        "accent": "var(--mc-accent)",
        "system": True,
        "defaults": {
            "model": "Auto · code-class",
            "temperature": 0.2,
            "memory_scope": "Project + Global",
            "skills": ["repo.read", "repo.write", "shell.exec", "tests.run"],
            "personality": "Terse. Diff-first. No prose padding.",
        },
    },
    {
        "id": "persona-personal",
        "name": "Personal",
        "tagline": "Day-to-day, journal, life admin",
        "icon": "Heart",
        "accent": "var(--mc-accent-2)",
        "system": True,
        "defaults": {
            "model": "Auto · conversational",
            "temperature": 0.7,
            "memory_scope": "Personal only",
            "skills": ["calendar.read", "notes.write", "qudos.observe"],
            "personality": "Warm. Curious. Asks before acting.",
        },
    },
    {
        "id": "persona-research",
        "name": "Research",
        "tagline": "Long-context, citations, deep dives",
        "icon": "FlaskConical",
        "accent": "var(--mc-accent)",
        "system": True,
        "defaults": {
            "model": "Auto · long-context",
            "temperature": 0.4,
            "memory_scope": "Project + Web cache",
            "skills": ["web.search", "web.scrape", "pdf.read", "cite.build"],
            "personality": "Source-cited. Hedged when uncertain.",
        },
    },
]


def _now_ms() -> int:
    return int(time.time() * 1000)


def set_db(db: Any) -> None:
    """Inject the Motor database handle (called once during startup)."""
    global _db
    _db = db


def reset_for_tests() -> None:
    """Clear in-memory state and drop the injected DB handle."""
    global _db, _active_id
    _db = None
    _active_id = None
    _mem.clear()


def _public(doc: Dict[str, Any], *, active_id: Optional[str] = None) -> Dict[str, Any]:
    """Strip Mongo internals and stamp `active` based on the bound id."""
    out = dict(doc)
    out.pop("_id", None)
    out["active"] = out.get("id") == (active_id if active_id is not None else _active_id)
    return out


def _validate_slug(value: str) -> Optional[str]:
    if not isinstance(value, str) or not _SLUG_RE.match(value):
        return (
            "id must be 1-64 chars, lowercase alphanumerics, underscore, or dash; "
            "must start with [a-z0-9]"
        )
    return None


def _validate_defaults(defaults: Any) -> Optional[str]:
    if defaults is None:
        return None
    if not isinstance(defaults, dict):
        return "defaults must be an object"
    skills = defaults.get("skills")
    if skills is not None and (
        not isinstance(skills, list) or not all(isinstance(s, str) for s in skills)
    ):
        return "defaults.skills must be a list of strings"
    temp = defaults.get("temperature")
    if temp is not None:
        try:
            t = float(temp)
        except (TypeError, ValueError):
            return "defaults.temperature must be a number"
        if t < 0 or t > 2:
            return "defaults.temperature must be between 0 and 2"
    return None


async def seed_defaults() -> int:
    """Insert built-in personas if none exist yet. Returns number inserted."""
    async with _lock:
        # Make sure the in-memory copy has the defaults first so tests that
        # never inject Mongo still get the built-ins.
        inserted_mem = 0
        for tpl in DEFAULT_PERSONAS:
            if tpl["id"] not in _mem:
                doc = dict(tpl)
                doc["created_ts"] = _now_ms()
                doc["updated_ts"] = doc["created_ts"]
                _mem[tpl["id"]] = doc
                inserted_mem += 1

        global _active_id
        if _active_id is None and DEFAULT_PERSONAS:
            _active_id = DEFAULT_PERSONAS[0]["id"]

        if _db is None:
            return inserted_mem

        inserted_db = 0
        try:
            for tpl in DEFAULT_PERSONAS:
                existing = await _db.personas.find_one({"id": tpl["id"]}, {"_id": 0})
                if existing:
                    continue
                doc = dict(tpl)
                doc["created_ts"] = _now_ms()
                doc["updated_ts"] = doc["created_ts"]
                await _db.personas.insert_one(doc)
                inserted_db += 1
        except Exception as exc:  # noqa: BLE001
            log.warning("personas seed_defaults DB error: %s", exc)

        return max(inserted_mem, inserted_db)


async def ensure_indexes() -> None:
    if _db is None:
        return
    try:
        await _db.personas.create_index("id", unique=True)
        await _db.personas.create_index("system")
    except Exception as exc:  # noqa: BLE001
        log.warning("personas index ensure failed: %s", exc)


async def list_personas() -> List[Dict[str, Any]]:
    if _db is not None:
        try:
            cursor = _db.personas.find({}, {"_id": 0}).sort("created_ts", 1)
            docs = [doc async for doc in cursor]
            return [_public(d) for d in docs]
        except Exception as exc:  # noqa: BLE001
            log.warning("personas list DB error: %s", exc)

    async with _lock:
        docs = sorted(_mem.values(), key=lambda d: d.get("created_ts", 0))
    return [_public(d) for d in docs]


async def get_one(persona_id: str) -> Optional[Dict[str, Any]]:
    if _db is not None:
        try:
            doc = await _db.personas.find_one({"id": persona_id}, {"_id": 0})
            if doc:
                return _public(doc)
        except Exception as exc:  # noqa: BLE001
            log.warning("personas get DB error: %s", exc)
    async with _lock:
        doc = _mem.get(persona_id)
    return _public(doc) if doc else None


async def get_active() -> Optional[Dict[str, Any]]:
    if _active_id is None:
        return None
    return await get_one(_active_id)


async def create(body: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new (user) persona. Returns the persisted document.

    Raises ValueError with a human-readable message on validation failure.
    """
    if not isinstance(body, dict):
        raise ValueError("body must be an object")

    persona_id = body.get("id") or _slug_from_name(body.get("name") or "")
    err = _validate_slug(persona_id)
    if err:
        raise ValueError(err)

    name = (body.get("name") or "").strip()
    if not name:
        raise ValueError("name is required")
    if len(name) > 64:
        raise ValueError("name must be ≤ 64 chars")

    err = _validate_defaults(body.get("defaults"))
    if err:
        raise ValueError(err)

    async with _lock:
        if persona_id in _mem:
            raise ValueError(f"persona id '{persona_id}' already exists")
    if _db is not None:
        try:
            existing = await _db.personas.find_one({"id": persona_id}, {"_id": 0})
            if existing:
                raise ValueError(f"persona id '{persona_id}' already exists")
        except ValueError:
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("personas duplicate-check DB error: %s", exc)

    now = _now_ms()
    doc: Dict[str, Any] = {
        "id": persona_id,
        "name": name,
        "tagline": (body.get("tagline") or "").strip(),
        "icon": (body.get("icon") or "Users").strip(),
        "accent": (body.get("accent") or "var(--mc-accent)").strip(),
        "system": False,
        "defaults": body.get("defaults") or {},
        "created_ts": now,
        "updated_ts": now,
    }

    async with _lock:
        _mem[persona_id] = doc
    if _db is not None:
        try:
            await _db.personas.insert_one(dict(doc))
        except Exception as exc:  # noqa: BLE001
            log.warning("personas insert DB error: %s", exc)

    return _public(doc)


async def update(persona_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Patch a persona. Only mutable fields are applied.

    Returns the updated public document. Raises ValueError if not found or
    invalid. The patch records which keys changed under detail.changed for the
    activity event.
    """
    if not isinstance(body, dict):
        raise ValueError("body must be an object")

    existing = await get_one(persona_id)
    if existing is None:
        raise ValueError(f"persona '{persona_id}' not found")

    mutable_keys = {"name", "tagline", "icon", "accent", "defaults"}
    changed: List[str] = []
    patch: Dict[str, Any] = {}
    for k in mutable_keys:
        if k not in body:
            continue
        if k == "defaults":
            err = _validate_defaults(body[k])
            if err:
                raise ValueError(err)
        if k == "name":
            new = (body[k] or "").strip()
            if not new:
                raise ValueError("name cannot be empty")
            if len(new) > 64:
                raise ValueError("name must be ≤ 64 chars")
            patch[k] = new
        else:
            patch[k] = body[k]
        if existing.get(k) != patch[k]:
            changed.append(k)

    if not patch:
        return existing  # no-op — return current state, no event emitted

    patch["updated_ts"] = _now_ms()

    async with _lock:
        if persona_id in _mem:
            _mem[persona_id].update(patch)
            doc = dict(_mem[persona_id])
        else:
            doc = dict(existing)
            doc.update(patch)
            _mem[persona_id] = doc

    if _db is not None:
        try:
            await _db.personas.update_one({"id": persona_id}, {"$set": patch})
        except Exception as exc:  # noqa: BLE001
            log.warning("personas update DB error: %s", exc)

    out = _public(doc)
    out["_changed"] = changed  # consumed by router for activity detail
    return out


async def delete(persona_id: str) -> Dict[str, Any]:
    existing = await get_one(persona_id)
    if existing is None:
        raise ValueError(f"persona '{persona_id}' not found")
    if existing.get("system"):
        raise ValueError(f"persona '{persona_id}' is a system persona and cannot be deleted")

    global _active_id
    async with _lock:
        _mem.pop(persona_id, None)
        if _active_id == persona_id:
            # Reactivate the first system persona as a sensible fallback.
            for pid in (p["id"] for p in DEFAULT_PERSONAS):
                if pid in _mem:
                    _active_id = pid
                    break
            else:
                _active_id = None

    if _db is not None:
        try:
            await _db.personas.delete_one({"id": persona_id})
        except Exception as exc:  # noqa: BLE001
            log.warning("personas delete DB error: %s", exc)

    return {"id": persona_id, "deleted": True, "active_id": _active_id}


async def activate(persona_id: str) -> Dict[str, Any]:
    """Mark a persona as the active one. Returns {previous, current}."""
    existing = await get_one(persona_id)
    if existing is None:
        raise ValueError(f"persona '{persona_id}' not found")

    global _active_id
    previous = _active_id
    _active_id = persona_id
    return {"previous": previous, "current": persona_id}


def _slug_from_name(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-_")
    return s or "persona"
