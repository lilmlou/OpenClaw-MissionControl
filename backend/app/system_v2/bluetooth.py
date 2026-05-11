"""Bluetooth reader — system_profiler SPBluetoothDataType."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ._util import is_darwin, now_ms, omit_none, run_json


_TYPE_HINTS = {
    "headphones": ["airpod", "headphone", "headset", "buds", "beats"],
    "mouse":      ["mouse", "magic mouse"],
    "keyboard":   ["keyboard", "magic keyboard"],
    "controller": ["controller", "gamepad", "xbox", "playstation"],
    "phone":      ["iphone", "phone"],
    "tablet":     ["ipad"],
    "watch":      ["watch"],
    "speaker":    ["speaker", "homepod"],
}


def _classify(name: str) -> str:
    n = (name or "").lower()
    for type_name, hints in _TYPE_HINTS.items():
        if any(h in n for h in hints):
            return type_name
    return "generic"


def _percent(value: Any) -> Optional[float]:
    """Convert '74%' / '0.74' / '74' → 0.74, else None."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        v = float(value)
        return round(v / 100.0, 2) if v > 1 else round(v, 2)
    if isinstance(value, str):
        s = value.strip().rstrip("%")
        try:
            v = float(s)
            return round(v / 100.0, 2) if v > 1 else round(v, 2)
        except ValueError:
            return None
    return None


def _walk_devices(node: Any, out: List[Dict[str, Any]], connected: bool) -> None:
    """Walk the SPBluetoothDataType nested device structure.

    Apple's JSON shape varies between macOS versions. Devices live under
    'device_connected' / 'device_not_connected' (older) or under nested
    'device_title' lists (newer). This walker is tolerant.
    """
    if isinstance(node, list):
        for item in node:
            _walk_devices(item, out, connected)
        return
    if not isinstance(node, dict):
        return
    # If the dict has a single key whose value is a dict containing device fields,
    # treat the key as the device name.
    name_keys = [k for k in node.keys() if not k.startswith("_") and not k.startswith("device_")]
    if len(node) == 1 and name_keys:
        name = name_keys[0]
        info = node[name]
        if isinstance(info, dict) and ("device_address" in info or "device_addr" in info):
            out.append(_build_device(name, info, connected))
            return
    # Otherwise look for any nested device-like shapes
    for k, v in node.items():
        if k == "device_connected":
            _walk_devices(v, out, True)
        elif k == "device_not_connected":
            _walk_devices(v, out, False)
        elif isinstance(v, (list, dict)):
            _walk_devices(v, out, connected)


def _build_device(name: str, info: Dict[str, Any], connected: bool) -> Dict[str, Any]:
    address = info.get("device_address") or info.get("device_addr")
    paired = info.get("device_pairing") or info.get("device_paired")
    paired_b = isinstance(paired, str) and paired.lower() in ("yes", "true")
    rssi_raw = info.get("device_rssi")
    rssi: Optional[int] = None
    if isinstance(rssi_raw, (int, float)):
        rssi = int(rssi_raw)
    elif isinstance(rssi_raw, str):
        try:
            rssi = int(rssi_raw.strip())
        except ValueError:
            pass

    payload: Dict[str, Any] = {
        "name": name,
        "address": address,
        "connected": connected,
        "paired": paired_b or connected,
        "battery_percent": _percent(info.get("device_batteryPercent") or info.get("device_batteryLevel")),
        "battery_left_percent": _percent(info.get("device_batteryLevelLeft")),
        "battery_right_percent": _percent(info.get("device_batteryLevelRight")),
        "battery_case_percent": _percent(info.get("device_batteryLevelCase")),
        "type": _classify(name),
        "vendor_id": _maybe_int(info.get("device_vendorID")),
        "product_id": _maybe_int(info.get("device_productID")),
        "rssi_dbm": rssi,
    }
    return omit_none(payload)


def _maybe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        s = value.strip()
        if s.startswith("0x") or s.startswith("0X"):
            try:
                return int(s, 16)
            except ValueError:
                return None
        try:
            return int(s)
        except ValueError:
            return None
    return None


def read() -> Dict[str, Any]:
    if not is_darwin():
        return {"ts": now_ms(), "available": False, "error": "platform not supported"}

    data = run_json(
        ["system_profiler", "-json", "SPBluetoothDataType"], timeout_s=6.0
    )
    if not data:
        return {"ts": now_ms(), "available": False, "error": "system_profiler failed"}

    items = data.get("SPBluetoothDataType") or []
    powered_on = False
    discoverable = False
    devices: List[Dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        # Power/discoverable state
        ctrl = item.get("controller_properties") or {}
        if isinstance(ctrl, dict):
            state = ctrl.get("controller_state") or item.get("local_device_title", {}).get("controller_state")
            if isinstance(state, str) and state.lower() in ("on", "powered_on", "attrib_on"):
                powered_on = True
            disc = ctrl.get("controller_discoverable")
            if isinstance(disc, str) and disc.lower() in ("on", "yes", "true"):
                discoverable = True
        # Older shape: top-level "general_state" or similar
        if "device_title" in item or "device_connected" in item or "device_not_connected" in item:
            powered_on = powered_on or True
        _walk_devices(item, devices, connected=False)

    return {
        "ts": now_ms(),
        "powered_on": powered_on,
        "discoverable": discoverable,
        "devices": devices,
    }
