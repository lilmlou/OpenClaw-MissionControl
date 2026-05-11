"""Logs module — /api/v2/logs/* endpoints.

Contract: PHASE_0_3_BINDING_LAYER.md §3 (BindLog component).

Phase 0.3 frontend ships BindLog which polls /api/v2/logs/tail.
This module provides the backend endpoint until a full log-shipper lands.
"""
from .routes import logs_router

__all__ = ["logs_router"]

# TODO: builder scaffold
