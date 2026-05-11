"""GPU reader — system_profiler SPDisplaysDataType + IOAccelerator stats.

We don't have a clean cross-version Python path to live render/tiler %.
For now we emit static identity (model, cores, vendor) and leave usage at 0
when unreadable — the frontend already handles that.

Stats reads from `IOAccelerator` registry; if/when we want live %, the same
ioreg-based approach can be added here. Doing so requires a SMC- or
ioreg-poll loop similar to sensors.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from ._util import is_darwin, omit_none, run_json, run_cmd


def _profiler() -> Optional[Dict[str, Any]]:
    if not is_darwin():
        return None
    data = run_json(
        ["system_profiler", "-json", "-detailLevel", "mini", "SPDisplaysDataType"],
        timeout_s=4.0,
    )
    if not data:
        return None
    items = data.get("SPDisplaysDataType") or []
    return items[0] if items else None


def _ioreg_accelerator_usage() -> Dict[str, float]:
    """Best-effort live render/tiler % from ioreg AGXAccelerator stats.

    Returns {} if not readable. Some macOS versions don't expose these keys.
    """
    out = run_cmd(["ioreg", "-r", "-c", "IOAccelerator", "-d", "1"], timeout_s=2.0)
    if not out:
        return {}
    result: Dict[str, float] = {}
    # Look for common keys: "Device Utilization %", "Renderer Utilization %",
    # "Tiler Utilization %". On Apple Silicon these can appear under PerfStats.
    for line in out.splitlines():
        line_l = line.strip().lower()
        if "device utilization %" in line_l or "renderer utilization %" in line_l:
            num = _extract_int(line)
            if num is not None:
                result["render_usage"] = round(num / 100.0, 4)
        elif "tiler utilization %" in line_l:
            num = _extract_int(line)
            if num is not None:
                result["tiler_usage"] = round(num / 100.0, 4)
    return result


def _extract_int(s: str) -> Optional[int]:
    # Pull last integer in the line.
    digits = ""
    for ch in s:
        if ch.isdigit():
            digits += ch
        elif digits:
            try:
                return int(digits)
            except ValueError:
                digits = ""
    if digits:
        try:
            return int(digits)
        except ValueError:
            return None
    return None


def read() -> Dict[str, Any]:
    info = _profiler() or {}
    model = info.get("sppci_model") or info.get("_name")
    vendor = info.get("spdisplays_vendor") or "Apple"
    cores_raw = info.get("sppci_cores")
    cores: Optional[int] = None
    if isinstance(cores_raw, (int, float)):
        cores = int(cores_raw)
    elif isinstance(cores_raw, str) and cores_raw.isdigit():
        cores = int(cores_raw)

    vram = info.get("sppci_vram") or info.get("spdisplays_vram_shared")
    vram_mb = _parse_vram_mb(vram) if isinstance(vram, str) else None

    usage = _ioreg_accelerator_usage()
    payload: Dict[str, Any] = {
        "render_usage": usage.get("render_usage", 0.0),
        "tiler_usage": usage.get("tiler_usage", 0.0),
        "model": model,
        "cores": cores,
        "vendor": vendor.replace("sppci_vendor_", "").title() if isinstance(vendor, str) else vendor,
        "vram_total_mb": vram_mb if vram_mb is not None else 0,
        "vram_used_mb": 0,
    }
    return omit_none(payload)


def _parse_vram_mb(s: str) -> Optional[int]:
    """Parse strings like '8 GB', '1536 MB'. Return MB int or None."""
    parts = s.split()
    if not parts:
        return None
    try:
        num = float(parts[0])
    except ValueError:
        return None
    unit = parts[1].lower() if len(parts) > 1 else "mb"
    if unit.startswith("gb"):
        return int(num * 1024)
    if unit.startswith("mb"):
        return int(num)
    return int(num)
