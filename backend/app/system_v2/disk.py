"""Disk reader — primary volume + all mounted volumes + I/O throughput."""
from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional

import psutil


_io_lock = threading.Lock()
_io_state: Dict[str, Any] = {"ts": None, "read": 0, "write": 0}


def _io_rates() -> Dict[str, int]:
    """Compute bytes/sec since last call (delta-based).

    First call returns 0/0; subsequent calls return the rate over the
    interval since the previous call.
    """
    try:
        counters = psutil.disk_io_counters()
    except (RuntimeError, OSError):
        return {"read_bytes_per_sec": 0, "write_bytes_per_sec": 0}
    if counters is None:
        return {"read_bytes_per_sec": 0, "write_bytes_per_sec": 0}
    now = time.time()
    with _io_lock:
        prev_ts = _io_state["ts"]
        prev_r = _io_state["read"]
        prev_w = _io_state["write"]
        _io_state["ts"] = now
        _io_state["read"] = counters.read_bytes
        _io_state["write"] = counters.write_bytes
    if prev_ts is None:
        return {"read_bytes_per_sec": 0, "write_bytes_per_sec": 0}
    dt = max(now - prev_ts, 0.001)
    return {
        "read_bytes_per_sec": int((counters.read_bytes - prev_r) / dt),
        "write_bytes_per_sec": int((counters.write_bytes - prev_w) / dt),
    }


def _safe_usage(mountpoint: str) -> Optional[Any]:
    try:
        return psutil.disk_usage(mountpoint)
    except (PermissionError, FileNotFoundError, OSError):
        return None


def read() -> Dict[str, Any]:
    parts: List[Any] = []
    try:
        parts = psutil.disk_partitions(all=False)
    except (RuntimeError, OSError):
        parts = []

    volumes: List[Dict[str, Any]] = []
    primary: Optional[Dict[str, Any]] = None
    rates = _io_rates()

    for p in parts:
        usage = _safe_usage(p.mountpoint)
        if usage is None:
            continue
        name = (p.device.split("/")[-1] if p.device else p.mountpoint) or p.mountpoint
        if p.mountpoint == "/":
            name = "Macintosh HD"
        vol = {
            "name": name,
            "mount": p.mountpoint,
            "total_bytes": int(usage.total),
            "used_bytes": int(usage.used),
            "free_bytes": int(usage.free),
            "filesystem": p.fstype or "",
        }
        volumes.append(vol)
        if p.mountpoint == "/":
            primary = {
                **vol,
                "read_bytes_per_sec": rates["read_bytes_per_sec"],
                "write_bytes_per_sec": rates["write_bytes_per_sec"],
            }

    if primary is None and volumes:
        primary = {
            **volumes[0],
            "read_bytes_per_sec": rates["read_bytes_per_sec"],
            "write_bytes_per_sec": rates["write_bytes_per_sec"],
        }

    return {
        "primary": primary or {},
        "volumes": volumes,
    }
