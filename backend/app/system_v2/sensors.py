"""Sensors reader — SMC temps + fans.

We attempt readings via:
1. Optional `apple_smc` Python module if installed.
2. Fallback: powermetrics-style ioreg parse (works without sudo for some keys).

If neither path produces readings on this machine (common on Apple Silicon
without a helper binary), we return {available: false} per §3.6.

SMC key reference (read-only, do not port line-by-line — Stats has its own
extensive list at _Reference/stats-master/Modules/Sensors/values.swift):
- TC0P: CPU Proximity     (cpu)
- TG0P: GPU Proximity     (gpu)
- TM0P: Memory            (memory)
- TPCD: PCH Die           (system)
- Ts0S, Ts1S, TB0T: Battery temperature paths (battery)
- F0Ac/F1Ac: Fan 0/1 actual RPM
- F0Mn/F0Mx: Fan 0 min/max RPM
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ._util import is_darwin, run_cmd, now_ms


# Keys we attempt to read. Label + group come straight from §3.2.
_TEMP_KEYS: List[Dict[str, str]] = [
    {"key": "TC0P", "label": "CPU Proximity", "group": "cpu"},
    {"key": "TC0E", "label": "CPU Die",       "group": "cpu"},
    {"key": "TG0P", "label": "GPU Proximity", "group": "gpu"},
    {"key": "TG0D", "label": "GPU Die",       "group": "gpu"},
    {"key": "TM0P", "label": "Memory",        "group": "memory"},
    {"key": "TPCD", "label": "PCH Die",       "group": "system"},
    {"key": "Ts0S", "label": "Battery",       "group": "battery"},
    {"key": "TB0T", "label": "Battery",       "group": "battery"},
]


def _try_apple_smc() -> Optional["object"]:
    """Return an open apple_smc handle if the package is installed, else None."""
    try:
        import apple_smc  # type: ignore
    except ImportError:
        return None
    try:
        return apple_smc.SMC()
    except Exception:
        return None


def _read_temps_via_smc(smc: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for entry in _TEMP_KEYS:
        try:
            val = smc.read_key(entry["key"])
        except Exception:
            continue
        if val is None:
            continue
        try:
            celsius = float(val)
        except (TypeError, ValueError):
            continue
        # Filter obvious junk (some keys return 0 or huge values when absent).
        if celsius <= 0 or celsius > 150:
            continue
        out.append({
            "key": entry["key"],
            "label": entry["label"],
            "celsius": round(celsius, 1),
            "group": entry["group"],
        })
    return out


def _read_fans_via_smc(smc: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    try:
        num_raw = smc.read_key("FNum")
        n = int(num_raw) if num_raw is not None else 0
    except Exception:
        n = 0
    for i in range(n):
        try:
            rpm = float(smc.read_key(f"F{i}Ac") or 0)
            mn = float(smc.read_key(f"F{i}Mn") or 0)
            mx = float(smc.read_key(f"F{i}Mx") or 0)
        except Exception:
            continue
        out.append({
            "id": i,
            "label": ("Left" if i == 0 else "Right" if i == 1 else f"Fan {i}"),
            "rpm": int(rpm),
            "min_rpm": int(mn),
            "max_rpm": int(mx),
        })
    return out


def _thermal_pressure() -> str:
    """Read pmset thermalstate → map to {nominal, fair, serious, critical}."""
    out = run_cmd(["pmset", "-g", "therm"], timeout_s=1.5)
    if not out:
        return "nominal"
    text = out.lower()
    if "scheduler" in text and "0" not in text:
        # Some level of throttling is in play; map roughly.
        if "100" in text:
            return "critical"
        return "serious"
    return "nominal"


def read() -> Dict[str, Any]:
    if not is_darwin():
        return {"ts": now_ms(), "available": False, "error": "platform not supported"}

    smc = _try_apple_smc()
    if smc is None:
        # No SMC backend available on this machine. Return available:false
        # rather than fabricating values.
        return {
            "ts": now_ms(),
            "available": False,
            "error": "SMC reader unavailable (install apple_smc or ship helper binary)",
        }
    try:
        temps = _read_temps_via_smc(smc)
        fans = _read_fans_via_smc(smc)
    finally:
        try:
            smc.close()
        except Exception:
            pass

    return {
        "ts": now_ms(),
        "temps": temps,
        "fans": fans,
        "thermal_pressure": _thermal_pressure(),
    }
