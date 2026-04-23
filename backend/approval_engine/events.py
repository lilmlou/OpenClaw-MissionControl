from typing import Any, Dict, Optional
from datetime import datetime, timezone


def tool_permission_request_event(
    request_id: str,
    session_id: str,
    tool_name: str,
    description: str,
    tool_input: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "type": "tool_permission_request",
        "request_id": request_id,
        "session_id": session_id,
        "tool_name": tool_name,
        "description": description,
        "tool_input": tool_input,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def tool_permission_resolved_event(
    request_id: str,
    decision: str,
) -> Dict[str, Any]:
    return {
        "type": "tool_permission_resolved",
        "request_id": request_id,
        "decision": decision,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def mode_changed_event(
    session_id: str,
    mode: str,
) -> Dict[str, Any]:
    return {
        "type": "permission_mode_changed",
        "session_id": session_id,
        "mode": mode,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def rule_added_event(
    session_id: str,
    rule_id: str,
    tool_name: str,
    behavior: str,
) -> Dict[str, Any]:
    return {
        "type": "rule_added",
        "session_id": session_id,
        "rule_id": rule_id,
        "tool_name": tool_name,
        "behavior": behavior,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
