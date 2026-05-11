"""Activity feed — minimal local emitter for the FastAPI stack.

Per BACKEND_PRINCIPLES_UPDATE.md §2.4 and §1.7 (Visible) every state-changing
backend operation must emit an event. The Express backend has its own Sprint 4
activity feed; this is the FastAPI counterpart, persisting to Mongo collection
`activity_events`.
"""
from .emitter import emit, get_recent, set_db, set_broadcaster
from .routes import activity_router

__all__ = ["emit", "get_recent", "set_db", "set_broadcaster", "activity_router"]
