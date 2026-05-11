"""Top processes — psutil-based, sortable.

§3.5 sort orders:
  cpu  → cpu_percent desc
  mem  → memory_bytes desc
  gpu  → empty list (per-process GPU not available without root)
  disk → (read+write)/sec desc — requires delta sampling
  net  → empty list (per-process net needs root on macOS)
"""
from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import psutil

from ._util import is_darwin, now_ms, omit_none


# Per-PID I/O counter snapshots for delta computation (disk/net rates).
_io_lock = threading.Lock()
_io_state: Dict[int, Dict[str, Any]] = {}  # pid -> {ts, read, write, sent, recv}


def _proc_to_row(proc: psutil.Process) -> Optional[Dict[str, Any]]:
    """Snapshot a process. Returns None if it died mid-read."""
    try:
        with proc.oneshot():
            info = proc.as_dict(
                attrs=[
                    "pid",
                    "name",
                    "username",
                    "cpu_percent",
                    "memory_info",
                    "memory_percent",
                    "num_threads",
                    "create_time",
                ]
            )
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None

    mem = info.get("memory_info")
    mem_bytes = int(getattr(mem, "rss", 0) or 0) if mem else 0

    row: Dict[str, Any] = {
        "pid": int(info.get("pid") or 0),
        "name": info.get("name") or "",
        "user": info.get("username") or "",
        "cpu_percent": round(float(info.get("cpu_percent") or 0.0), 1),
        "memory_bytes": mem_bytes,
        "memory_percent": round(float(info.get("memory_percent") or 0.0), 2),
        "gpu_percent": 0,
        "disk_read_bytes_per_sec": 0,
        "disk_write_bytes_per_sec": 0,
        "net_bytes_per_sec": 0,
        "threads": int(info.get("num_threads") or 0),
        "started_ts": int((info.get("create_time") or 0) * 1000),
    }
    return row


def _disk_rates(pid: int, proc: psutil.Process) -> Tuple[int, int]:
    """Best-effort per-process disk rates. macOS often denies io_counters() —
    in that case we return (0, 0) and the frontend will show 0.
    """
    try:
        c = proc.io_counters()
    except (psutil.AccessDenied, AttributeError, NotImplementedError, psutil.NoSuchProcess):
        return (0, 0)
    now = time.time()
    with _io_lock:
        prev = _io_state.get(pid)
        _io_state[pid] = {
            "ts": now,
            "read": c.read_bytes,
            "write": c.write_bytes,
        }
    if prev is None:
        return (0, 0)
    dt = max(now - prev["ts"], 0.001)
    return (
        int((c.read_bytes - prev["read"]) / dt),
        int((c.write_bytes - prev["write"]) / dt),
    )


# How many seconds to keep io_state entries — prune dead PIDs occasionally.
_LAST_PRUNE = [0.0]


def _prune_io_state() -> None:
    now = time.time()
    if now - _LAST_PRUNE[0] < 30:
        return
    _LAST_PRUNE[0] = now
    with _io_lock:
        live = {p.pid for p in psutil.process_iter(attrs=[])}
        for pid in list(_io_state.keys()):
            if pid not in live:
                _io_state.pop(pid, None)


def read(sort: str = "cpu", limit: int = 10) -> Dict[str, Any]:
    sort = (sort or "cpu").lower()
    if sort not in ("cpu", "mem", "gpu", "disk", "net"):
        sort = "cpu"
    try:
        limit = max(1, min(int(limit), 200))
    except (TypeError, ValueError):
        limit = 10

    if not is_darwin():
        return {
            "ts": now_ms(),
            "sort": sort,
            "limit": limit,
            "available": False,
            "error": "platform not supported",
        }

    # GPU and net per-process not available without root → empty list.
    if sort in ("gpu", "net"):
        return {
            "ts": now_ms(),
            "sort": sort,
            "limit": limit,
            "processes": [],
        }

    _prune_io_state()

    rows: List[Dict[str, Any]] = []
    procs = list(psutil.process_iter(attrs=[]))
    # Prime CPU percent (psutil needs two samples for accurate %).
    for p in procs:
        try:
            p.cpu_percent(interval=None)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    # Small sleep so cpu_percent sampling is meaningful. 0.1s keeps poll
    # well under the 3s frontend cadence and well under the 2s cache.
    time.sleep(0.1)

    for p in procs:
        row = _proc_to_row(p)
        if row is None:
            continue
        if sort == "disk":
            r, w = _disk_rates(row["pid"], p)
            row["disk_read_bytes_per_sec"] = r
            row["disk_write_bytes_per_sec"] = w
        rows.append(row)

    if sort == "cpu":
        rows.sort(key=lambda r: r["cpu_percent"], reverse=True)
    elif sort == "mem":
        rows.sort(key=lambda r: r["memory_bytes"], reverse=True)
    elif sort == "disk":
        rows.sort(
            key=lambda r: r["disk_read_bytes_per_sec"] + r["disk_write_bytes_per_sec"],
            reverse=True,
        )

    return {
        "ts": now_ms(),
        "sort": sort,
        "limit": limit,
        "processes": rows[:limit],
    }
