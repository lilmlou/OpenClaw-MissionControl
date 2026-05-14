"""Personas module — Phase I personas backend.

Pairs with the frontend shell at `/personas` (`frontend/src/pages/PersonasPage.js`).

Endpoints (canonical Phase 0.1 envelope `{ok, data, ts, available, fix[]}`):
  GET    /api/v2/personas              — list personas (+ which is active)
  GET    /api/v2/personas/active       — return the currently active persona
  GET    /api/v2/personas/{id}         — get persona detail
  POST   /api/v2/personas              — create a persona
  PUT    /api/v2/personas/{id}         — update a persona
  DELETE /api/v2/personas/{id}         — delete a persona (non-system only)
  POST   /api/v2/personas/{id}/activate — bind as active persona

Activity emits (broadcast over `/api/v2/activities/ws` and `/api/ws/config`):
  personas.created     — actor=user, subject=<persona_id>
  personas.updated     — subject=<persona_id>, detail.changed=<keys>
  personas.deleted     — subject=<persona_id>
  personas.activated   — subject=<persona_id>, detail.previous=<id|null>
  personas.changed     — umbrella event the FE subscribes to (always emitted after mutations)
"""
from .routes import personas_router
from .store import seed_defaults, set_db, reset_for_tests

__all__ = ["personas_router", "seed_defaults", "set_db", "reset_for_tests"]
