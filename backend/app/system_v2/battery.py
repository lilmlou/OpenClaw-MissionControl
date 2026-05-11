"""Battery reader — IOKit via ioreg + system_profiler SPPowerDataType.

Avoids sudo. Mac mini / Studio / Pro return {present: false}.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

import psutil

from ._util import is_darwin, now_ms, omit_none, run_cmd, run_json


def _ioreg_battery() -> Optional[Dict[str, Any]]:
    """Parse `ioreg -rn AppleSmartBattery` into a key→value dict.

    Returns None on machines without a battery (no AppleSmartBattery node).
    """
    out = run_cmd(["ioreg", "-rn", "AppleSmartBattery"], timeout_s=2.0)
    if not out or "AppleSmartBattery" not in out:
        return None
    result: Dict[str, Any] = {}
    # Lines look like:  "FullyCharged" = Yes  /  "CycleCount" = 184
    pattern = re.compile(r'"([^"]+)"\s*=\s*(.+)$')
    for line in out.splitlines():
        m = pattern.search(line.strip())
        if not m:
            continue
        key, raw = m.group(1), m.group(2).strip()
        # Strip trailing braces/comma noise
        raw = raw.rstrip(",")
        result[key] = raw
    return result


def _b(value: Optional[str]) -> Optional[bool]:
    if value is None:
        return None
    v = value.strip().lower()
    if v in ("yes", "true"):
        return True
    if v in ("no", "false"):
        return False
    return None


def _i(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value.strip())
    except (ValueError, TypeError):
        return None


def _signed_i(value: Optional[str]) -> Optional[int]:
    """ioreg returns negative integers as uint64 wraparound. Wrap back to signed."""
    raw = _i(value)
    if raw is None:
        return None
    # 64-bit signed wrap
    if raw >= (1 << 63):
        raw -= 1 << 64
    return raw


def _condition() -> Optional[str]:
    """system_profiler SPPowerDataType lists 'Condition' for battery health."""
    if not is_darwin():
        return None
    data = run_json(
        ["system_profiler", "-json", "SPPowerDataType"], timeout_s=4.0
    )
    if not data:
        return None
    items = data.get("SPPowerDataType") or []
    for item in items:
        health = item.get("sppower_battery_health_info")
        if isinstance(health, dict):
            cond = health.get("sppower_battery_health")
            if isinstance(cond, str) and cond:
                return cond
        # Some macOS versions:
        cond = item.get("sppower_battery_health")
        if isinstance(cond, str) and cond:
            return cond
    return None


def read() -> Dict[str, Any]:
    if not is_darwin():
        return {"ts": now_ms(), "available": False, "error": "platform not supported"}

    raw = _ioreg_battery()
    if raw is None:
        # Desktop Mac (no battery)
        return {"ts": now_ms(), "present": False}

    # Capacity fields
    current = _i(raw.get("CurrentCapacity"))
    max_cap = _i(raw.get("MaxCapacity"))
    design_cap = _i(raw.get("DesignCapacity"))
    nominal = _i(raw.get("NominalChargeCapacity")) or max_cap

    level: Optional[float] = None
    if current is not None and max_cap and max_cap > 0:
        level = round(current / max_cap, 4)

    is_charging = _b(raw.get("IsCharging"))
    is_charged = _b(raw.get("FullyCharged"))
    external = _b(raw.get("ExternalConnected"))
    power_source = "AC Power" if external else "Battery Power"

    time_to_empty = _i(raw.get("TimeRemaining")) if not is_charging else None
    time_to_full = _i(raw.get("TimeRemaining")) if is_charging else None
    # ioreg uses 65535/0 for "calculating"; treat as None
    if time_to_empty in (0, 65535):
        time_to_empty = None
    if time_to_full in (0, 65535):
        time_to_full = None

    voltage = _i(raw.get("Voltage"))
    amperage = _signed_i(raw.get("Amperage"))
    cycle = _i(raw.get("CycleCount"))
    temp_raw = _i(raw.get("Temperature"))
    temp_c = round(temp_raw / 100.0, 1) if temp_raw else None

    max_capacity_percent: Optional[float] = None
    if nominal and design_cap and design_cap > 0:
        # Cap at 1.0 — new batteries can briefly exceed design capacity.
        max_capacity_percent = round(min(1.0, nominal / design_cap), 4)

    payload: Dict[str, Any] = {
        "ts": now_ms(),
        "present": True,
        "level": level,
        "is_charging": bool(is_charging) if is_charging is not None else False,
        "is_charged": bool(is_charged) if is_charged is not None else False,
        "power_source": power_source,
        "time_to_empty_minutes": time_to_empty,
        "time_to_full_minutes": time_to_full,
        "cycle_count": cycle,
        "condition": _condition() or "Normal",
        "design_capacity_mah": design_cap,
        "max_capacity_mah": nominal,
        "max_capacity_percent": max_capacity_percent,
        "voltage_mv": voltage,
        "amperage_ma": amperage,
        "temperature_c": temp_c,
        "manufacturer": (raw.get("Manufacturer") or "").strip('"') or None,
        "serial": (raw.get("Serial") or "").strip('"') or None,
    }
    return omit_none(payload)
