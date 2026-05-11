"""HTTP surface for visible FastAPI activity feed events."""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from .emitter import get_recent

activity_router = APIRouter(prefix="/api/v2/activities", tags=["activities"])


def _now_ms() -> int:
    return int(time.time() * 1000)


@activity_router.get("")
async def list_activities(kind: Optional[str] = Query(None), limit: int = Query(100, ge=1, le=500)) -> JSONResponse:
    items = await get_recent(limit=limit, kind=kind)
    return JSONResponse({"ok": True, "data": items, "available": True, "ts": _now_ms()})
