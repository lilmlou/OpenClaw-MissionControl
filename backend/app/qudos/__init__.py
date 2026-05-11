"""Qudos module — co-pilot / assistance backend.

Contract: INTEGRATION_REVIEW_NEXT.md §2, FRONTEND_VERIFICATION_AFTER_BACKEND.md §4.

Status: STUB — endpoints return {available: false, error: "not_implemented"}
until the Qudos backend bridge is wired. The frontend (QudosPage.js) currently
mutates Zustand only; qudosApi.js is a TODO-only shim.

Endpoints:
  GET    /api/v2/qudos/apps            — list available apps
  GET    /api/v2/qudos/permissions     — list/request permissions
  POST   /api/v2/qudos/sessions        — start a session
  GET    /api/v2/qudos/sessions        — list sessions
  GET    /api/v2/qudos/sessions/{id}   — get session detail
  POST   /api/v2/qudos/sessions/{id}/stop  — stop a session
  GET    /api/v2/qudos/suggestions     — list suggestions
  POST   /api/v2/qudos/suggestions/{id}/resolve  — resolve a suggestion
"""

from .routes import qudos_router

__all__ = ["qudos_router"]

# TODO: builder scaffold
