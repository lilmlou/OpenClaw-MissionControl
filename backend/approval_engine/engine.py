import logging
from typing import Any, Dict, List, Optional
from .models import (
    PermissionMode,
    ToolDecision,
    ToolRule,
    PermissionRequest,
    SessionPermissionState,
)
from .rules import (
    WRITE_TOOLS,
    COMMAND_TOOLS,
    READ_ONLY_TOOLS,
    evaluate_rules,
    is_write_operation,
    is_command_operation,
    is_trusted_path,
)
from .state import (
    get_session_state,
    set_session_state,
    save_session_to_db,
    add_pending_request,
    resolve_pending_request,
)

logger = logging.getLogger(__name__)


class ApprovalEngine:
    def __init__(self, db=None):
        self.db = db

    async def can_use_tool(
        self, session_id: str, tool_name: str, tool_input: dict
    ) -> ToolDecision:
        state = get_session_state(session_id)

        mode = state.mode

        if mode == PermissionMode.BYPASS:
            return ToolDecision(
                behavior="allow", reason="Bypass permissions mode active"
            )

        if mode == PermissionMode.PLAN:
            if is_write_operation(tool_name) or is_command_operation(tool_name):
                return ToolDecision(
                    behavior="deny",
                    reason="Plan mode: write/command operations are blocked",
                )
            return ToolDecision(
                behavior="allow", reason="Plan mode: read-only operation allowed"
            )

        if mode == PermissionMode.ACCEPT_EDITS:
            if is_write_operation(tool_name):
                file_path = tool_input.get("file_path") or tool_input.get("path", "")
                if file_path and is_trusted_path(file_path, state.trusted_folders):
                    return ToolDecision(
                        behavior="allow",
                        reason="Accept edits mode: write to trusted folder",
                    )
                return ToolDecision(
                    behavior="allow",
                    reason="Accept edits mode: auto-approving file edit",
                )
            if is_command_operation(tool_name):
                pass

        if mode == PermissionMode.AUTO:
            risk = self._assess_risk(tool_name, tool_input)
            if risk == "low":
                return ToolDecision(
                    behavior="allow",
                    reason=f"Auto mode: low-risk tool ({tool_name}) auto-approved",
                )
            elif risk == "high":
                return ToolDecision(
                    behavior="ask",
                    reason=f"Auto mode: high-risk tool ({tool_name}) requires approval",
                )

        rule_result = evaluate_rules(tool_name, tool_input, state.rules)
        if rule_result:
            return rule_result

        if tool_name in READ_ONLY_TOOLS:
            return ToolDecision(behavior="allow", reason="Read-only tool auto-approved")

        return ToolDecision(
            behavior="ask",
            reason=f"No matching rule for {tool_name}, requires user approval",
        )

    async def respond(
        self,
        request_id: str,
        decision: str,
        updated_input: dict = None,
        db=None,
    ) -> PermissionRequest:
        _db = db or self.db
        state = None
        for sid, s in (
            __import__("approval_engine.state", fromlist=["get_all_sessions"])
            .get_all_sessions()
            .items()
        ):
            if request_id in s.pending_requests:
                state = s
                break
        if not state:
            raise ValueError(f"Request {request_id} not found in any session")

        if decision == "always":
            req = state.pending_requests[request_id]
            new_rule = ToolRule(
                tool_name=req.tool_name,
                behavior="allow",
                pattern=None,
                scope="session",
            )
            state.rules.append(new_rule)
            set_session_state(state.session_id, state)
            if _db:
                await save_session_to_db(_db, state)

        resolved = await resolve_pending_request(
            _db, state.session_id, request_id, decision
        )
        if not resolved:
            raise ValueError(f"Failed to resolve request {request_id}")
        return resolved

    async def set_mode(
        self, session_id: str, mode: PermissionMode, db=None
    ) -> SessionPermissionState:
        _db = db or self.db
        state = get_session_state(session_id)
        state.mode = mode
        set_session_state(session_id, state)
        if _db:
            await save_session_to_db(_db, state)
        return state

    async def add_rule(
        self, session_id: str, rule: ToolRule, db=None
    ) -> SessionPermissionState:
        _db = db or self.db
        state = get_session_state(session_id)
        state.rules.append(rule)
        set_session_state(session_id, state)
        if _db:
            await save_session_to_db(_db, state)
        return state

    async def remove_rule(
        self, session_id: str, rule_id: str, db=None
    ) -> SessionPermissionState:
        _db = db or self.db
        state = get_session_state(session_id)
        state.rules = [r for r in state.rules if r.id != rule_id]
        set_session_state(session_id, state)
        if _db:
            await save_session_to_db(_db, state)
        return state

    async def create_permission_request(
        self,
        session_id: str,
        tool_name: str,
        tool_input: dict,
        description: str,
        db=None,
    ) -> PermissionRequest:
        _db = db or self.db
        req = PermissionRequest(
            session_id=session_id,
            tool_name=tool_name,
            tool_input=tool_input,
            description=description,
        )
        if _db:
            await add_pending_request(_db, session_id, req)
        else:
            state = get_session_state(session_id)
            state.pending_requests[req.id] = req
            set_session_state(session_id, state)
        return req

    def _assess_risk(self, tool_name: str, tool_input: dict) -> str:
        dangerous_patterns = [
            "rm -rf",
            "sudo",
            "mkfs",
            "dd if=",
            "> /dev/",
            "curl.*\\|.*sh",
            "wget.*\\|.*sh",
            "chmod 777",
            ":(){ :|:& };:",
        ]
        if tool_name == "Bash":
            cmd = tool_input.get("command", "")
            for pattern in dangerous_patterns:
                if pattern in cmd:
                    return "high"
            if any(cmd.startswith(p) for p in ("npm ", "pip ", "cargo ", "git push")):
                return "medium"
            return "low"
        if tool_name in ("Write", "Edit"):
            path = tool_input.get("file_path", "") or tool_input.get("path", "")
            if any(x in path for x in (".env", "credentials", "secret", ".ssh")):
                return "high"
            return "low"
        if tool_name in READ_ONLY_TOOLS:
            return "low"
        return "medium"
