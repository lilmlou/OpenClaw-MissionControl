import logging
from typing import Dict, List, Optional
from .models import (
    PermissionMode,
    SessionPermissionState,
    ToolRule,
    PermissionRequest,
)

logger = logging.getLogger(__name__)

_sessions: Dict[str, SessionPermissionState] = {}


def get_session_state(session_id: str) -> SessionPermissionState:
    if session_id not in _sessions:
        _sessions[session_id] = SessionPermissionState(session_id=session_id)
    return _sessions[session_id]


def set_session_state(session_id: str, state: SessionPermissionState) -> None:
    _sessions[session_id] = state


def get_all_sessions() -> Dict[str, SessionPermissionState]:
    return dict(_sessions)


def remove_session(session_id: str) -> None:
    _sessions.pop(session_id, None)


async def load_session_from_db(db, session_id: str) -> Optional[SessionPermissionState]:
    doc = await db.approval_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not doc:
        return None
    return SessionPermissionState(**doc)


async def save_session_to_db(db, state: SessionPermissionState) -> None:
    doc = state.model_dump()
    doc["mode"] = (
        state.mode.value if isinstance(state.mode, PermissionMode) else state.mode
    )
    doc["rules"] = [r.model_dump() for r in state.rules]
    doc["pending_requests"] = {
        k: v.model_dump() for k, v in state.pending_requests.items()
    }
    await db.approval_sessions.update_one(
        {"session_id": state.session_id},
        {"$set": doc},
        upsert=True,
    )


async def add_pending_request(db, session_id: str, request: PermissionRequest) -> None:
    state = get_session_state(session_id)
    state.pending_requests[request.id] = request
    await save_session_to_db(db, state)
    doc = request.model_dump()
    doc["status"] = (
        request.status.value if hasattr(request.status, "value") else request.status
    )
    doc["created_at"] = request.created_at.isoformat()
    if request.resolved_at:
        doc["resolved_at"] = request.resolved_at.isoformat()
    await db.approval_requests.insert_one(doc)


async def resolve_pending_request(
    db, session_id: str, request_id: str, decision: str
) -> Optional[PermissionRequest]:
    state = get_session_state(session_id)
    req = state.pending_requests.get(request_id)
    if not req:
        return None
    from datetime import datetime, timezone

    req.status = "approved" if decision != "deny" else "denied"
    req.decision = decision
    req.resolved_at = datetime.now(timezone.utc)
    history_doc = req.model_dump()
    history_doc["status"] = req.status
    history_doc["created_at"] = req.created_at.isoformat()
    history_doc["resolved_at"] = req.resolved_at.isoformat()
    await db.approval_history.insert_one(history_doc)
    await db.approval_requests.update_one(
        {"id": request_id},
        {
            "$set": {
                "status": req.status,
                "decision": decision,
                "resolved_at": req.resolved_at.isoformat(),
            }
        },
    )
    del state.pending_requests[request_id]
    await save_session_to_db(db, state)
    return req
