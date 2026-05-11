"""CPU reader — psutil + sysctl for Apple Silicon P/E core split."""
from __future__ import annotations

import os
import re
from typing import Any, Dict, Optional

import psutil

from ._util import is_darwin, omit_none, run_cmd


def _sysctl(name: str) -> Optional[str]:
    out = run_cmd(["sysctl", "-n", name], timeout_s=1.0)
    return out.strip() if out else None


def _cpu_model() -> Optional[str]:
    if not is_darwin():
        return None
    return _sysctl("machdep.cpu.brand_string")


def _cores_split() -> Optional[Dict[str, int]]:
    """Apple Silicon performance / efficiency core count via sysctl.

    Returns None on non-Apple-Silicon (or if sysctl keys absent).
    """
    if not is_darwin():
        return None
    perf = _sysctl("hw.perflevel0.physicalcpu")
    eff = _sysctl("hw.perflevel1.physicalcpu")
    if perf is None or eff is None:
        return None
    try:
        return {"performance": int(perf), "efficiency": int(eff)}
    except ValueError:
        return None


def _frequency_mhz() -> Optional[int]:
    """Best-effort CPU frequency in MHz.

    Apple Silicon doesn't expose this via sysctl in the usual way; psutil
    returns 0 on M-series. Try sysctl first, fall back to psutil.cpu_freq().
    Return None rather than 0 (omit field).
    """
    if is_darwin():
        for key in ("hw.cpufrequency", "hw.cpufrequency_max"):
            raw = _sysctl(key)
            if raw and raw.isdigit():
                hz = int(raw)
                if hz > 0:
                    return hz // 1_000_000
    try:
        freq = psutil.cpu_freq()
        if freq and freq.current and freq.current > 0:
            return int(freq.current)
    except (NotImplementedError, OSError):
        pass
    return None


def read() -> Dict[str, Any]:
    times = psutil.cpu_times_percent(interval=None)
    overall = psutil.cpu_percent(interval=None) / 100.0
    per_core = [v / 100.0 for v in psutil.cpu_percent(interval=None, percpu=True)]
    try:
        load_1, load_5, load_15 = os.getloadavg()
        load_avg = [round(load_1, 2), round(load_5, 2), round(load_15, 2)]
    except (OSError, AttributeError):
        load_avg = []

    payload: Dict[str, Any] = {
        "usage": round(overall, 4),
        "user": round(getattr(times, "user", 0.0) / 100.0, 4),
        "system": round(getattr(times, "system", 0.0) / 100.0, 4),
        "idle": round(getattr(times, "idle", 0.0) / 100.0, 4),
        "per_core": [round(v, 4) for v in per_core],
        "load_avg": load_avg,
        "frequency_mhz": _frequency_mhz(),
        "model": _cpu_model(),
        "cores": _cores_split(),
    }
    return omit_none(payload)
