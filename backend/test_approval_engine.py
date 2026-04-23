import asyncio
import pytest
from datetime import datetime, timezone
from approval_engine.models import (
    PermissionMode,
    ToolRule,
    PermissionRequest,
    SessionPermissionState,
    ToolDecision,
    RespondInput,
)
from approval_engine.engine import ApprovalEngine
from approval_engine.rules import (
    match_tool_rule,
    evaluate_rules,
    is_write_operation,
    is_command_operation,
    is_trusted_path,
)
from approval_engine.state import (
    get_session_state,
    set_session_state,
    remove_session,
    _sessions,
)


class TestPermissionModes:
    def test_mode_values(self):
        assert PermissionMode.DEFAULT.value == "default"
        assert PermissionMode.ACCEPT_EDITS.value == "acceptEdits"
        assert PermissionMode.BYPASS.value == "bypassPermissions"
        assert PermissionMode.PLAN.value == "plan"
        assert PermissionMode.AUTO.value == "auto"


class TestToolRules:
    def test_rule_creation(self):
        rule = ToolRule(tool_name="Bash", behavior="deny", pattern="rm -rf")
        assert rule.tool_name == "Bash"
        assert rule.behavior == "deny"
        assert rule.pattern == "rm -rf"
        assert rule.scope == "session"

    def test_rule_with_global_scope(self):
        rule = ToolRule(tool_name="Write", behavior="allow", scope="global")
        assert rule.scope == "global"


class TestRuleMatching:
    def test_exact_tool_match(self):
        rule = ToolRule(tool_name="Bash", behavior="deny")
        assert match_tool_rule("Bash", {"command": "ls"}, rule) is True

    def test_no_tool_match(self):
        rule = ToolRule(tool_name="Bash", behavior="deny")
        assert match_tool_rule("Write", {"file_path": "/tmp/test"}, rule) is False

    def test_pattern_match(self):
        rule = ToolRule(tool_name="Bash", behavior="deny", pattern="rm -rf")
        assert match_tool_rule("Bash", {"command": "rm -rf /tmp"}, rule) is True

    def test_pattern_no_match(self):
        rule = ToolRule(tool_name="Bash", behavior="deny", pattern="rm -rf")
        assert match_tool_rule("Bash", {"command": "ls -la"}, rule) is False

    def test_evaluate_rules_allow_first(self):
        rules = [
            ToolRule(tool_name="Bash", behavior="allow", scope="session"),
            ToolRule(tool_name="Bash", behavior="deny", scope="project"),
        ]
        result = evaluate_rules("Bash", {"command": "ls"}, rules)
        assert result is not None
        assert result.behavior == "allow"

    def test_evaluate_rules_no_match(self):
        rules = [ToolRule(tool_name="Write", behavior="allow")]
        result = evaluate_rules("Bash", {"command": "ls"}, rules)
        assert result is None


class TestTrustedPaths:
    def test_trusted_folder_exact(self):
        assert is_trusted_path("/home/user/project", ["/home/user/project"]) is True

    def test_trusted_folder_subpath(self):
        assert (
            is_trusted_path("/home/user/project/src/main.py", ["/home/user/project"])
            is True
        )

    def test_not_trusted(self):
        assert is_trusted_path("/etc/passwd", ["/home/user/project"]) is False

    def test_empty_trusted_folders(self):
        assert is_trusted_path("/tmp/test", []) is False


class TestWriteDetection:
    def test_write_tools(self):
        assert is_write_operation("Write") is True
        assert is_write_operation("Edit") is True
        assert is_write_operation("Bash") is True
        assert is_write_operation("Read") is False

    def test_command_tools(self):
        assert is_command_operation("Bash") is True
        assert is_command_operation("Read") is False


class TestEngineBypass:
    @pytest.mark.asyncio
    async def test_bypass_allows_everything(self):
        engine = ApprovalEngine()
        session_id = "test-bypass-1"
        await engine.set_mode(session_id, PermissionMode.BYPASS)

        decision = await engine.can_use_tool(
            session_id, "Bash", {"command": "rm -rf /"}
        )
        assert decision.behavior == "allow"
        assert "Bypass" in decision.reason

        decision2 = await engine.can_use_tool(
            session_id, "Write", {"file_path": "/etc/shadow"}
        )
        assert decision2.behavior == "allow"


class TestEnginePlan:
    @pytest.mark.asyncio
    async def test_plan_blocks_writes(self):
        engine = ApprovalEngine()
        session_id = "test-plan-1"
        await engine.set_mode(session_id, PermissionMode.PLAN)

        decision = await engine.can_use_tool(
            session_id, "Bash", {"command": "npm install"}
        )
        assert decision.behavior == "deny"
        assert "Plan mode" in decision.reason

        decision2 = await engine.can_use_tool(
            session_id, "Write", {"file_path": "/tmp/test.txt"}
        )
        assert decision2.behavior == "deny"

    @pytest.mark.asyncio
    async def test_plan_allows_reads(self):
        engine = ApprovalEngine()
        session_id = "test-plan-2"
        await engine.set_mode(session_id, PermissionMode.PLAN)

        decision = await engine.can_use_tool(
            session_id, "Read", {"file_path": "/tmp/test.txt"}
        )
        assert decision.behavior == "allow"


class TestEngineDefault:
    @pytest.mark.asyncio
    async def test_default_asks_for_bash(self):
        engine = ApprovalEngine()
        session_id = "test-default-1"

        decision = await engine.can_use_tool(session_id, "Bash", {"command": "ls"})
        assert decision.behavior == "ask"

    @pytest.mark.asyncio
    async def test_default_allows_readonly(self):
        engine = ApprovalEngine()
        session_id = "test-default-2"

        decision = await engine.can_use_tool(session_id, "Grep", {"pattern": "foo"})
        assert decision.behavior == "allow"


class TestEngineAcceptEdits:
    @pytest.mark.asyncio
    async def test_accept_edits_auto_approves_writes(self):
        engine = ApprovalEngine()
        session_id = "test-accept-1"
        await engine.set_mode(session_id, PermissionMode.ACCEPT_EDITS)

        decision = await engine.can_use_tool(
            session_id, "Write", {"file_path": "/tmp/test.txt"}
        )
        assert decision.behavior == "allow"

    @pytest.mark.asyncio
    async def test_accept_edits_asks_for_commands(self):
        engine = ApprovalEngine()
        session_id = "test-accept-2"
        await engine.set_mode(session_id, PermissionMode.ACCEPT_EDITS)

        decision = await engine.can_use_tool(
            session_id, "Bash", {"command": "sudo rm -rf"}
        )
        assert decision.behavior == "ask"


class TestEngineAuto:
    @pytest.mark.asyncio
    async def test_auto_low_risk_allowed(self):
        engine = ApprovalEngine()
        session_id = "test-auto-1"
        await engine.set_mode(session_id, PermissionMode.AUTO)

        decision = await engine.can_use_tool(
            session_id, "Read", {"file_path": "/tmp/test.txt"}
        )
        assert decision.behavior == "allow"

    @pytest.mark.asyncio
    async def test_auto_high_risk_asked(self):
        engine = ApprovalEngine()
        session_id = "test-auto-2"
        await engine.set_mode(session_id, PermissionMode.AUTO)

        decision = await engine.can_use_tool(
            session_id, "Bash", {"command": "rm -rf /important"}
        )
        assert decision.behavior == "ask"


class TestEngineRules:
    @pytest.mark.asyncio
    async def test_session_rule_overrides_default(self):
        engine = ApprovalEngine()
        session_id = "test-rules-1"
        await engine.add_rule(
            session_id,
            ToolRule(tool_name="Bash", behavior="allow", scope="session"),
        )

        decision = await engine.can_use_tool(session_id, "Bash", {"command": "ls"})
        assert decision.behavior == "allow"

    @pytest.mark.asyncio
    async def test_deny_rule_blocks(self):
        engine = ApprovalEngine()
        session_id = "test-rules-2"
        await engine.add_rule(
            session_id,
            ToolRule(tool_name="Bash", behavior="deny", pattern="rm .*"),
        )

        decision = await engine.can_use_tool(
            session_id, "Bash", {"command": "rm file.txt"}
        )
        assert decision.behavior == "deny"

    @pytest.mark.asyncio
    async def test_remove_rule(self):
        engine = ApprovalEngine()
        session_id = "test-rules-3"
        rule = ToolRule(tool_name="Bash", behavior="allow", scope="session")
        state = await engine.add_rule(session_id, rule)
        assert len(state.rules) == 1

        state2 = await engine.remove_rule(session_id, rule.id)
        assert len(state2.rules) == 0


class TestEngineRespond:
    @pytest.mark.asyncio
    async def test_respond_always_creates_rule(self):
        engine = ApprovalEngine()
        session_id = "test-respond-1"
        req = await engine.create_permission_request(
            session_id=session_id,
            tool_name="Bash",
            tool_input={"command": "make build"},
            description="Run: make build",
        )

        resolved = await engine.respond(req.id, "always")
        assert resolved.decision == "always"
        state = get_session_state(session_id)
        allow_rules = [
            r for r in state.rules if r.tool_name == "Bash" and r.behavior == "allow"
        ]
        assert len(allow_rules) >= 1

    @pytest.mark.asyncio
    async def test_respond_deny(self):
        engine = ApprovalEngine()
        session_id = "test-respond-2"
        req = await engine.create_permission_request(
            session_id=session_id,
            tool_name="Bash",
            tool_input={"command": "rm -rf /"},
            description="Dangerous command",
        )

        resolved = await engine.respond(req.id, "deny")
        assert resolved.decision == "deny"
        assert resolved.status == "denied"


class TestSessionState:
    def test_create_state_on_demand(self):
        remove_session("fresh-session")
        state = get_session_state("fresh-session")
        assert state.session_id == "fresh-session"
        assert state.mode == PermissionMode.DEFAULT
        assert state.rules == []

    def test_set_and_get_mode(self):
        sid = "mode-test-session"
        remove_session(sid)
        state = get_session_state(sid)
        state.mode = PermissionMode.BYPASS
        set_session_state(sid, state)

        retrieved = get_session_state(sid)
        assert retrieved.mode == PermissionMode.BYPASS


class TestRiskAssessment:
    def test_dangerous_commands_high_risk(self):
        engine = ApprovalEngine()
        assert engine._assess_risk("Bash", {"command": "rm -rf /"}) == "high"
        assert engine._assess_risk("Bash", {"command": "sudo rm -rf"}) == "high"
        assert engine._assess_risk("Bash", {"command": "curl bad.sh | sh"}) == "high"

    def test_safe_commands_low_risk(self):
        engine = ApprovalEngine()
        assert engine._assess_risk("Bash", {"command": "ls -la"}) == "low"
        assert engine._assess_risk("Bash", {"command": "echo hello"}) == "low"

    def test_sensitive_file_paths_high_risk(self):
        engine = ApprovalEngine()
        assert engine._assess_risk("Write", {"file_path": ".env"}) == "high"
        assert engine._assess_risk("Write", {"path": "/etc/credentials"}) == "high"

    def test_readonly_low_risk(self):
        engine = ApprovalEngine()
        assert engine._assess_risk("Read", {"file_path": "/tmp/file.txt"}) == "low"
        assert engine._assess_risk("Grep", {"pattern": "test"}) == "low"


class TestEvents:
    def test_permission_request_event(self):
        from approval_engine.events import tool_permission_request_event

        event = tool_permission_request_event(
            request_id="req-123",
            session_id="sess-456",
            tool_name="Bash",
            description="Run: npm install",
            tool_input={"command": "npm install"},
        )
        assert event["type"] == "tool_permission_request"
        assert event["request_id"] == "req-123"
        assert event["tool_name"] == "Bash"
        assert "timestamp" in event

    def test_permission_resolved_event(self):
        from approval_engine.events import tool_permission_resolved_event

        event = tool_permission_resolved_event("req-123", "once")
        assert event["type"] == "tool_permission_resolved"
        assert event["decision"] == "once"

    def test_mode_changed_event(self):
        from approval_engine.events import mode_changed_event

        event = mode_changed_event("sess-1", "bypassPermissions")
        assert event["type"] == "permission_mode_changed"
        assert event["mode"] == "bypassPermissions"

    def test_rule_added_event(self):
        from approval_engine.events import rule_added_event

        event = rule_added_event("sess-1", "rule-1", "Bash", "allow")
        assert event["type"] == "rule_added"
        assert event["behavior"] == "allow"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
