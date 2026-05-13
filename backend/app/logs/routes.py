"""FastAPI router for /api/v2/logs/* — Phase 0.3 BindLog backend.

Contract: PHASE_0_3_BINDING_LAYER.md §3.

Endpoints:
  GET /api/v2/logs/tail?file={path}&lines={N}
    — returns last N lines of a log file (placeholder until log-shipper ships).
    — returns {available: false} when endpoint is not fully implemented.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)
logs_router = APIRouter(prefix="/api/v2/logs", tags=["logs"])


def _now_ms() -> int:
    return int(time.time() * 1000)


def _unavailable(file: str, lines: int, detail: str) -> dict[str, Any]:
    """Canonical self-healing failure envelope for the log tail stub."""
    return {
        "ok": False,
        "available": False,
        "error": "log_shipper_unavailable",
        "code": "LOG_SHIPPER_UNAVAILABLE",
        "detail": {"file": file, "lines": lines, "reason": detail},
        # Compatibility fields for existing BindLog consumers.
        "file": file,
        "lines": lines,
        "fix": [
            {
                "label": "Open log shipper handoff",
                "action": "files.open",
                "args": {"path": "/Volumes/🦋• Drive   1/MC/PHASE_0_3_BINDING_LAYER.md"},
            },
            {
                "label": "Check backend service health",
                "action": "system.open_health",
                "args": {"service": "fastapi", "port": 8765},
            },
        ],
        "ts": _now_ms(),
    }


@logs_router.get("/tail")
async def tail_log(
    file: str = Query(..., description="Log file path to tail"),
    lines: int = Query(100, ge=1, le=1000, description="Number of lines to return"),
) -> JSONResponse:
    """Return the last N lines of a log file.

    Placeholder — returns the canonical {ok:false, available:false, fix[]} envelope
    until the log-shipper is shipped. BindLog renders an EmptyState/Fix action from
    this envelope per Phase 0.3 §3 and BACKEND_PRINCIPLES_UPDATE.md §5.
    """
    log.info("logs/tail called: file=%s lines=%d (stub — not yet implemented)", file, lines)
    return JSONResponse(
        _unavailable(file, lines, "log-shipper not yet shipped — endpoint is a stub"),
        status_code=200,
    )


# TODO: builder scaffold
