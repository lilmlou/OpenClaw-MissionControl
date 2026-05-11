"""Internal helpers shared across system_v2 modules."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional


def now_ms() -> int:
    return int(time.time() * 1000)


def is_darwin() -> bool:
    return sys.platform == "darwin"


def unavailable(reason: str) -> Dict[str, Any]:
    """Standard error envelope per §3.6 — HTTP 200 with available:false."""
    return {"ts": now_ms(), "available": False, "error": reason}


def run_cmd(
    args: List[str], timeout_s: float = 5.0
) -> Optional[str]:
    """Run a subprocess and return stdout, or None on failure.

    Failures (non-zero exit, timeout, missing binary) all become None — caller
    must treat None as "data unavailable" and omit fields rather than crash.
    """
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
        if result.returncode != 0:
            return None
        return result.stdout
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def run_json(args: List[str], timeout_s: float = 5.0) -> Optional[Any]:
    """Run a subprocess that emits JSON. Returns parsed object or None."""
    out = run_cmd(args, timeout_s=timeout_s)
    if not out:
        return None
    try:
        return json.loads(out)
    except (json.JSONDecodeError, ValueError):
        return None


def omit_none(d: Dict[str, Any]) -> Dict[str, Any]:
    """Drop keys whose value is None (per spec: omit, don't return null)."""
    return {k: v for k, v in d.items() if v is not None}
