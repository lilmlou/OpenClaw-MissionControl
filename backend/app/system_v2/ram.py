"""RAM + swap reader."""
from __future__ import annotations

from typing import Any, Dict

import psutil

from ._util import is_darwin, run_cmd


def _vm_pressure() -> str:
    """Return 'normal' | 'warn' | 'critical' based on macOS memory pressure.

    We approximate with `memory_pressure` shell command if present, else fall
    back to `psutil` available memory percentage thresholds.
    """
    if is_darwin():
        out = run_cmd(["memory_pressure"], timeout_s=1.5)
        if out:
            text = out.lower()
            if "critical" in text:
                return "critical"
            if "warn" in text:
                return "warn"
            if "normal" in text:
                return "normal"
    # Fallback: percent free
    vm = psutil.virtual_memory()
    free_pct = vm.available / vm.total if vm.total else 0
    if free_pct < 0.05:
        return "critical"
    if free_pct < 0.15:
        return "warn"
    return "normal"


def read() -> Dict[str, Any]:
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()
    payload: Dict[str, Any] = {
        "total_bytes": int(vm.total),
        "used_bytes": int(vm.used),
        "free_bytes": int(vm.available),
        "active_bytes": int(getattr(vm, "active", 0) or 0),
        "wired_bytes": int(getattr(vm, "wired", 0) or 0),
        "compressed_bytes": 0,  # not exposed by psutil; left at 0 (frontend tolerates)
        "cached_bytes": int(getattr(vm, "inactive", 0) or 0),
        "pressure": _vm_pressure(),
        "swap_used_bytes": int(swap.used or 0),
        "swap_total_bytes": int(swap.total or 0),
    }
    return payload
