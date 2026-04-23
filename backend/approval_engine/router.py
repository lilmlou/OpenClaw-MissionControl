import logging
import asyncio
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, List, Optional, Any
from .models import (
    PermissionMode,
    ToolRule,
    PermissionRequest,
    SessionPermissionState,
    ToolDecision,
    RespondInput,
    SetModeInput,
    AddRulesInput,
)
from .engine import ApprovalEngine
from .events import (
    tool_permission_request_event,
    tool_permission_resolved_event,
    mode_changed_event,
    rule_added_event,
)
from .websocket import broadcast_approval_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/approvals")

_db_ref: Optional[Any] = None
_engine: Optional[ApprovalEngine] = None


def set_db(db):
    global _db_ref, _engine
    _db_ref = db
    _engine = ApprovalEngine(db=db)


def get_db():
    return _db_ref


def get_engine() -> ApprovalEngine:
    global _engine
    if _engine is None:
        _engine = ApprovalEngine(db=_db_ref)
    return _engine


@router.get("/pending")
async def list_pending_requests(db=Depends(get_db)):
    engine = get_engine()
    from .state import get_all_sessions

    all_sessions = get_all_sessions()
    pending = []
    for session_id, state in all_sessions.items():
        for req in state.pending_requests.values():
            if req.status == "pending":
                pending.append(req.model_dump())
    return {"pending_requests": pending}


@router.post("/{request_id}/respond")
async def respond_to_request(request_id: str, body: RespondInput, db=Depends(get_db)):
    engine = get_engine()
    try:
        resolved = await engine.respond(
            request_id=request_id,
            decision=body.decision,
            updated_input=body.updated_input,
            db=db,
        )
        await broadcast_approval_event(
            tool_permission_resolved_event(request_id, body.decision)
        )
        return resolved.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/sessions/{session_id}/state")
async def get_session_state_route(session_id: str):
    from .state import get_session_state

    state = get_session_state(session_id)
    return state.model_dump()


@router.put("/sessions/{session_id}/mode")
async def set_session_mode(session_id: str, body: SetModeInput, db=Depends(get_db)):
    engine = get_engine()
    state = await engine.set_mode(session_id, body.mode, db=db)
    await broadcast_approval_event(mode_changed_event(session_id, body.mode.value))
    return state.model_dump()


@router.post("/sessions/{session_id}/rules")
async def add_session_rules(session_id: str, body: AddRulesInput, db=Depends(get_db)):
    engine = get_engine()
    for rule in body.rules:
        state = await engine.add_rule(session_id, rule, db=db)
        await broadcast_approval_event(
            rule_added_event(session_id, rule.id, rule.tool_name, rule.behavior)
        )
    return state.model_dump()


@router.delete("/sessions/{session_id}/rules/{rule_id}")
async def delete_session_rule(session_id: str, rule_id: str, db=Depends(get_db)):
    engine = get_engine()
    state = await engine.remove_rule(session_id, rule_id, db=db)
    return state.model_dump()


@router.get("/history")
async def get_approval_history(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db=Depends(get_db),
):
    cursor = (
        db.approval_history.find({}, {"_id": 0})
        .sort("resolved_at", -1)
        .skip(offset)
        .limit(limit)
    )
    history = await cursor.to_list(length=limit)
    total = await db.approval_history.count_documents({})
    return {"history": history, "total": total}


approval_v2_router = router
