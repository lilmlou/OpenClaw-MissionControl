"""Network reader — interface, throughput, IPs, SSID."""
from __future__ import annotations

import socket
import threading
import time
from typing import Any, Dict, Optional

import psutil

from ._util import is_darwin, run_cmd


_io_lock = threading.Lock()
_io_state: Dict[str, Any] = {"ts": None, "up": 0, "down": 0}


def _default_iface() -> str:
    """Best-effort active interface — prefer en0, else any with traffic."""
    try:
        addrs = psutil.net_if_addrs()
        if "en0" in addrs:
            return "en0"
        # Fall through: return first non-loopback iface
        for name in addrs:
            if name.startswith("lo"):
                continue
            return name
    except (RuntimeError, OSError):
        pass
    return "en0"


def _ip_addrs(iface: str) -> Dict[str, Optional[str]]:
    private_ip: Optional[str] = None
    ipv6: Optional[str] = None
    try:
        for addr in psutil.net_if_addrs().get(iface, []):
            if addr.family == socket.AF_INET and addr.address and not addr.address.startswith("127."):
                private_ip = addr.address
            elif addr.family == socket.AF_INET6 and addr.address and not addr.address.startswith("::1"):
                # Strip zone id
                ipv6 = addr.address.split("%")[0]
    except (RuntimeError, OSError):
        pass
    return {"private_ip": private_ip, "ipv6": ipv6}


_public_ip_cache: Dict[str, Any] = {"ts": 0.0, "value": None}
_PUBLIC_IP_TTL_S = 300.0  # 5 min — public IP changes rarely


def _public_ip() -> Optional[str]:
    """Public IP via api.ipify.org. Cached 5 min — does NOT block /stats poll.

    Returns last known value if lookup fails or is on cooldown.
    """
    now = time.time()
    if now - _public_ip_cache["ts"] < _PUBLIC_IP_TTL_S:
        return _public_ip_cache["value"]
    try:
        import urllib.request
        with urllib.request.urlopen("https://api.ipify.org", timeout=1.0) as r:
            ip = r.read().decode("utf-8").strip()
            _public_ip_cache["ts"] = now
            _public_ip_cache["value"] = ip if ip else None
            return _public_ip_cache["value"]
    except Exception:
        # Cooldown to avoid hammering on persistent failures.
        _public_ip_cache["ts"] = now
        return _public_ip_cache["value"]


def _ssid(iface: str) -> Optional[str]:
    """Wi-Fi SSID via wdutil/networksetup. Returns None on Ethernet or off."""
    if not is_darwin():
        return None
    out = run_cmd(["networksetup", "-getairportnetwork", iface], timeout_s=1.5)
    if not out:
        return None
    text = out.strip()
    # Format: "Current Wi-Fi Network: MyNetwork"
    if "Current Wi-Fi Network:" in text:
        return text.split(":", 1)[1].strip() or None
    return None


def _io_rates() -> Dict[str, int]:
    try:
        c = psutil.net_io_counters()
    except (RuntimeError, OSError):
        return {"upload_bps": 0, "download_bps": 0, "upload_total_bytes": 0, "download_total_bytes": 0}
    now = time.time()
    with _io_lock:
        prev_ts = _io_state["ts"]
        prev_up = _io_state["up"]
        prev_down = _io_state["down"]
        _io_state["ts"] = now
        _io_state["up"] = c.bytes_sent
        _io_state["down"] = c.bytes_recv
    if prev_ts is None:
        up_bps = 0
        down_bps = 0
    else:
        dt = max(now - prev_ts, 0.001)
        up_bps = int((c.bytes_sent - prev_up) / dt)
        down_bps = int((c.bytes_recv - prev_down) / dt)
    return {
        "upload_bps": up_bps,
        "download_bps": down_bps,
        "upload_total_bytes": int(c.bytes_sent),
        "download_total_bytes": int(c.bytes_recv),
    }


def read() -> Dict[str, Any]:
    iface = _default_iface()
    ip = _ip_addrs(iface)
    rates = _io_rates()
    payload: Dict[str, Any] = {
        "interface": iface,
        **rates,
        "private_ip": ip["private_ip"],
        "public_ip": _public_ip(),
        "ipv6": ip["ipv6"],
        "ssid": _ssid(iface),
    }
    return payload
