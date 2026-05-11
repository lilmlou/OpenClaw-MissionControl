"""System V2 — /api/v2/system/services endpoint.

Mentioned in §0 prose (SYSTEM_V2_BACKEND.md §0) but no §3 contract exists yet.
Flagged in PROGRESS.md Watch section for D1 System v2.

This stub returns {available: false} until a contract and implementation land.
The frontend hides panels when available is false per D1 convention.
"""

from __future__ import annotations

from typing import Any, Dict


def read() -> Dict[str, Any]:
    """Read running system services.

    Placeholder — returns {available: false} until implementation is specified.
    """
    return {
        "available": False,
        "error": "services endpoint not yet specified — awaiting §3 contract",
    }


# TODO: builder scaffold
