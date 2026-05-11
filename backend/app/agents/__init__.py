"""F7 Agent Live View — backend.

Implements the data layer (Mongo collections `agent_runs`, `agent_events`,
`acceptance_checks`) plus REST + WebSocket surfaces required by
`F7_AGENT_LIVE_VIEW.md` §2–§3.

Public surface:

  from app.agents import dispatch, agents_router, agents_ws_router, ws_broadcast
  from app.agents.defaults import register_agent_bus_keys

Module wiring follows BACKEND_PRINCIPLES_UPDATE.md §3:
  - register_default to bus at import time (defaults.py)
  - emit activity events on every mutation (dispatch.py)
  - WS fan-out per mutation (ws.py)
  - health() callable (health.py)
  - no os.environ.get() in business logic (everything through bus)
"""
from __future__ import annotations

from .routes import agents_router
from .ws import agents_ws_router, broadcast as ws_broadcast
from . import dispatch
from . import store as agents_store
from . import defaults as agents_defaults
from . import parser as agents_parser

__all__ = [
    "agents_router",
    "agents_ws_router",
    "ws_broadcast",
    "dispatch",
    "agents_store",
    "agents_defaults",
    "agents_parser",
]
