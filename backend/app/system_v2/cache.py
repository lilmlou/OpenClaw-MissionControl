"""Tiny TTL cache. No Redis. Keyed by string (endpoint + optional suffix).

Per SYSTEM_V2_BACKEND.md §4:
- stats: 1s
- sensors: 2s
- battery: 15s
- bluetooth: 5s
- processes: 2s per (sort, limit)
"""
from __future__ import annotations

import threading
import time
from typing import Any, Callable, Dict, Tuple


_lock = threading.Lock()
_store: Dict[str, Tuple[float, Any]] = {}


def get_or_set(key: str, ttl_s: float, producer: Callable[[], Any]) -> Any:
    """Return cached value if fresh, otherwise call producer() and cache.

    Producer must be cheap to call once, idempotent. Errors propagate.
    """
    now = time.time()
    with _lock:
        entry = _store.get(key)
        if entry is not None:
            expires_at, value = entry
            if expires_at > now:
                return value
    # Compute outside the lock to avoid blocking other keys.
    value = producer()
    with _lock:
        _store[key] = (now + ttl_s, value)
    return value


def invalidate(key: str) -> None:
    with _lock:
        _store.pop(key, None)


def clear() -> None:
    with _lock:
        _store.clear()
