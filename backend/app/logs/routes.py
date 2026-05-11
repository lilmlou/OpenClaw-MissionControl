"""FastAPI router for /api/v2/logs/* — Phase 0.3 BindLog backend.

Contract: PHASE_0_3_BINDING_LAYER.md §3.

Endpoints:
  GET /api/v2/logs/tail?file={path}&lines={N}
    — returns last N lines of a log file (placeholder until log-shipper ships).
    — returns {available: false} when endpoint is not fully implemented.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

log = logging.getLogger(__name__)

logs_router = APIRouter(prefix="/api/v2/logs", tags=["logs"])


@logs_router.get("/tail")
async def tail_log(
    file: str = Query(..., description="Log file path to tail"),
    lines: int = Query(100, ge=1, le=1000, description="Number of lines to return"),
) -> JSONResponse:
    """Return the last N lines of a log file.

    Placeholder — returns {available: false} until the log-shipper is shipped.
    The BindLog frontend component renders an EmptyState when available is false,
    per Phase 0.3 §3 spec.
    """
    log.info("logs/tail called: file=%s lines=%d (stub — not yet implemented)", file, lines)
    return JSONResponse(
        {
            "available": False,
            "file": file,
            "lines": lines,
            "error": "log-shipper not yet shipped — endpoint is a stub",
            "ts": __import__("time").time() * 1000,
        },
        status_code=200,
    )


# TODO: builder scaffold
