"""ConfigBus — the singleton at the heart of Phase 0.1.

Resolution order (handoff §2):
  1. Mongo `config.<key>.value`        ← UI / API mutations live here
  2. ENV `<KEY_AS_UPPER_UNDERSCORE>`   ← read-only fallback
  3. Default registered with `bus.register_default(...)`
  4. KeyError if none

Subscribers (`@bus.on(key)`, `@bus.on_prefix(prefix)`) are invoked synchronously
inside `set()` / `delete()` *before* the HTTP response returns, per §4.2 +
§6 acceptance ("In-process subscribers receive callbacks before HTTP response
returns").
"""
from __future__ import annotations

import asyncio
import inspect
import logging
import os
import threading
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from . import store
from .schema import (
    ConfigValidationError,
    infer_type,
    validate_value,
)
from .store import ConfigVersionConflict


log = logging.getLogger(__name__)


class ConfigBusError(Exception):
    pass


CallbackKey = Callable[[Any, Any], Awaitable[None]]
CallbackPrefix = Callable[[str, Any, Any], Awaitable[None]]


class ConfigBus:
    """Singleton. Don't instantiate twice — import `bus`."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        # registered defaults: key → (value, schema, secret)
        self._defaults: Dict[str, Tuple[Any, Optional[Dict[str, Any]], bool]] = {}
        # in-mem cache of effective values (mongo overrides applied)
        self._cache: Dict[str, Any] = {}
        # mongo-stored docs cache (for version + metadata)
        self._docs: Dict[str, Dict[str, Any]] = {}
        # subscribers
        self._key_subs: Dict[str, List[CallbackKey]] = {}
        self._prefix_subs: List[Tuple[str, CallbackPrefix]] = []
        self._loaded = False

    # ── Defaults registration ──────────────────────────────────────────

    def register_default(
        self,
        key: str,
        value: Any,
        *,
        schema: Optional[Dict[str, Any]] = None,
        secret: bool = False,
    ) -> None:
        """Called at import time by every module to declare its keys.

        Idempotent — re-registering the same default is a no-op. Re-registering
        with a different default emits a warning but keeps the first.
        """
        with self._lock:
            if key in self._defaults:
                prev, _, _ = self._defaults[key]
                if prev != value:
                    log.warning(
                        "config: re-register default for %s with different value (%r vs %r); keeping first",
                        key,
                        prev,
                        value,
                    )
                return
            self._defaults[key] = (value, schema, bool(secret))
            # NOTE: _cache holds only Mongo overrides — never defaults.
            # That preserves the §2 resolution order (Mongo → ENV → default).

    # ── Loaders ───────────────────────────────────────────────────────

    async def load_from_store(self) -> int:
        """Pull every config doc from Mongo into the cache.

        Called once at startup. Returns the number of overrides loaded.
        """
        await store.ensure_indexes()
        docs = await store.get_all()
        loaded = 0
        with self._lock:
            for doc in docs:
                key = doc["_id"]
                self._docs[key] = doc
                self._cache[key] = doc.get("value")
                loaded += 1
            self._loaded = True
        return loaded

    # ── Reads ─────────────────────────────────────────────────────────

    def get(self, key: str, default: Any = ...) -> Any:
        """Resolve in order: mongo override → ENV → registered default → default arg → KeyError."""
        with self._lock:
            if key in self._cache:
                return self._cache[key]
            env_val = self._read_env(key)
            if env_val is not None:
                return env_val
            if key in self._defaults:
                return self._defaults[key][0]
        if default is not ...:
            return default
        raise KeyError(key)

    def has(self, key: str) -> bool:
        with self._lock:
            if key in self._docs or key in self._defaults:
                return True
        return self._read_env(key) is not None

    def get_doc(self, key: str) -> Dict[str, Any]:
        """Return the full schema/value/version metadata for `key`.

        Used by the HTTP route. Synthesises a doc from defaults if no mongo
        override exists yet.
        """
        with self._lock:
            doc = self._docs.get(key)
            if doc is not None:
                return self._public_doc(doc)
            if key in self._defaults:
                value, schema, secret = self._defaults[key]
                return {
                    "_id": key,
                    "value": "***" if secret else value,
                    "type": infer_type(schema, value),
                    "schema": schema,
                    "secret": secret,
                    "updated_ts": None,
                    "updated_by": None,
                    "version": 0,
                }
        raise KeyError(key)

    def list_docs(self, *, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return every known key (defaults ∪ mongo overrides), redacted."""
        seen: Dict[str, Dict[str, Any]] = {}
        with self._lock:
            for k in self._defaults:
                seen[k] = self.get_doc(k)
            for k, doc in self._docs.items():
                seen[k] = self._public_doc(doc)
        if category:
            return [d for d in seen.values() if (d.get("schema") or {}).get("category") == category]
        return list(seen.values())

    def list_categories(self) -> List[Dict[str, Any]]:
        counts: Dict[str, int] = {}
        for d in self.list_docs():
            cat = (d.get("schema") or {}).get("category", "uncategorized")
            counts[cat] = counts.get(cat, 0) + 1
        return [{"category": c, "count": n} for c, n in sorted(counts.items())]

    # ── Writes ────────────────────────────────────────────────────────

    async def set(
        self,
        key: str,
        value: Any,
        *,
        actor: str = "system",
        expected_version: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Validate, persist to mongo, update cache, fire subscribers.

        Raises:
          ConfigValidationError on schema mismatch
          ConfigVersionConflict on version mismatch
        """
        with self._lock:
            schema, secret = self._schema_for(key)

        validate_value(key, value, schema)

        # Optimistic concurrency check (works even with no Mongo —
        # we track version in the local docs cache).
        if expected_version is not None:
            with self._lock:
                current_version = int(
                    self._docs.get(key, {}).get("version", 0)
                )
            if current_version != expected_version:
                raise ConfigVersionConflict(key, current_version, expected_version)

        type_tag = infer_type(schema, value)

        # If Mongo is wired, persist there. Otherwise synthesise a doc with
        # a real incrementing version so the in-memory bus is still
        # version-correct for tests + offline operation.
        new_doc = await store.upsert(
            key,
            value=value,
            type_tag=type_tag,
            schema=schema,
            secret=secret,
            actor=actor,
            expected_version=expected_version,
        )
        # When store has no DB, force version increment from local docs.
        if store._db is None:  # type: ignore[attr-defined]
            with self._lock:
                cur = int(self._docs.get(key, {}).get("version", 0))
            new_doc = dict(new_doc)
            new_doc["version"] = cur + 1

        # Capture effective old value BEFORE mutating the override cache.
        old_value = self.get(key, None)
        with self._lock:
            self._cache[key] = value
            self._docs[key] = new_doc

        await self._fire_subscribers(key, value, old_value)
        return self._public_doc(new_doc)

    async def delete(self, key: str, *, actor: str = "system") -> bool:
        """Remove the mongo override; effective value reverts to default/ENV.

        Returns True if there was an override to delete (regardless of whether
        Mongo was wired). Returns False only if no override existed.
        """
        old_value = self.get(key, None)
        with self._lock:
            had_override = key in self._docs or key in self._cache

        await store.delete_one(key, actor=actor)

        with self._lock:
            self._docs.pop(key, None)
            self._cache.pop(key, None)
        new_value = self.get(key, None)
        await self._fire_subscribers(key, new_value, old_value)
        return had_override

    async def bulk_set(
        self,
        changes: List[Dict[str, Any]],
        *,
        actor: str = "system",
    ) -> List[Dict[str, Any]]:
        """Atomic multi-set. Validates each change first, then applies all.

        Each change: {"key": str, "value": any, "expected_version"?: int}
        """
        # Phase 1: validate all
        prepared: List[Dict[str, Any]] = []
        for c in changes:
            key = c["key"]
            with self._lock:
                schema, secret = self._schema_for(key)
            validate_value(key, c["value"], schema)
            prepared.append({
                "key": key,
                "value": c["value"],
                "type": infer_type(schema, c["value"]),
                "schema": schema,
                "secret": secret,
                "expected_version": c.get("expected_version"),
            })

        # Phase 2: apply
        applied = await store.bulk_upsert(prepared, actor=actor)

        # Phase 3: cache update + subscriber fanout
        results: List[Dict[str, Any]] = []
        for new_doc in applied:
            key = new_doc["_id"]
            old_value = self.get(key, None)
            with self._lock:
                self._cache[key] = new_doc["value"]
                self._docs[key] = new_doc
            await self._fire_subscribers(key, new_doc["value"], old_value)
            results.append(self._public_doc(new_doc))
        return results

    # ── Subscriptions ─────────────────────────────────────────────────

    def on(self, key: str) -> Callable[[CallbackKey], CallbackKey]:
        def decorator(fn: CallbackKey) -> CallbackKey:
            with self._lock:
                self._key_subs.setdefault(key, []).append(fn)
            return fn
        return decorator

    def on_prefix(self, prefix: str) -> Callable[[CallbackPrefix], CallbackPrefix]:
        def decorator(fn: CallbackPrefix) -> CallbackPrefix:
            with self._lock:
                self._prefix_subs.append((prefix, fn))
            return fn
        return decorator

    async def _fire_subscribers(self, key: str, new_value: Any, old_value: Any) -> None:
        """Invoke key + matching prefix subscribers. Awaited synchronously."""
        with self._lock:
            key_callbacks = list(self._key_subs.get(key, []))
            prefix_callbacks = [(p, fn) for (p, fn) in self._prefix_subs if key.startswith(p)]
        for fn in key_callbacks:
            await self._safe_call(fn, new_value, old_value, fn_label=f"on:{key}")
        for prefix, fn in prefix_callbacks:
            await self._safe_call_prefix(fn, key, new_value, old_value, prefix=prefix)

    async def _safe_call(self, fn: CallbackKey, *args: Any, fn_label: str) -> None:
        try:
            result = fn(*args)
            if inspect.isawaitable(result):
                await result
        except Exception as exc:  # noqa: BLE001
            log.exception("config bus subscriber %s failed: %s", fn_label, exc)

    async def _safe_call_prefix(
        self, fn: CallbackPrefix, key: str, new_v: Any, old_v: Any, *, prefix: str
    ) -> None:
        try:
            result = fn(key, new_v, old_v)
            if inspect.isawaitable(result):
                await result
        except Exception as exc:  # noqa: BLE001
            log.exception("config bus prefix subscriber %s failed: %s", prefix, exc)

    # ── Internal helpers ──────────────────────────────────────────────

    def _schema_for(self, key: str) -> Tuple[Optional[Dict[str, Any]], bool]:
        """Return (schema, secret) for `key`. Falls back to docs cache."""
        if key in self._defaults:
            _, schema, secret = self._defaults[key]
            return schema, secret
        if key in self._docs:
            doc = self._docs[key]
            return doc.get("schema"), bool(doc.get("secret", False))
        return None, False

    def _public_doc(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Redact secrets before returning to UI / API consumers."""
        out = dict(doc)
        if doc.get("secret"):
            out["value"] = "***"
        return out

    def _read_env(self, key: str) -> Optional[str]:
        """ENV fallback: dotted key → upper-snake.

        e.g. `models.default.provider` → `MODELS_DEFAULT_PROVIDER`.
        Type-cast is best-effort: bool/int/float when matching the registered
        default's type, otherwise str.
        """
        env_name = key.upper().replace(".", "_").replace("-", "_")
        raw = os.environ.get(env_name)
        if raw is None:
            return None
        # If we have a registered default, try to coerce to its type.
        if key in self._defaults:
            default_value = self._defaults[key][0]
            if isinstance(default_value, bool):
                return raw.strip().lower() in ("1", "true", "yes", "on")
            if isinstance(default_value, int) and not isinstance(default_value, bool):
                try:
                    return int(raw)
                except ValueError:
                    return raw
            if isinstance(default_value, float):
                try:
                    return float(raw)
                except ValueError:
                    return raw
        return raw

    # ── Reset (test-only helper) ──────────────────────────────────────

    def _reset_for_tests(self) -> None:
        with self._lock:
            self._defaults.clear()
            self._cache.clear()
            self._docs.clear()
            self._key_subs.clear()
            self._prefix_subs.clear()
            self._loaded = False


# Singleton
bus = ConfigBus()


__all__ = [
    "bus",
    "ConfigBus",
    "ConfigBusError",
    "ConfigValidationError",
    "ConfigVersionConflict",
]
