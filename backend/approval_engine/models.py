from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid


class PermissionMode(str, Enum):
    DEFAULT = "default"
    ACCEPT_EDITS = "acceptEdits"
    BYPASS = "bypassPermissions"
    PLAN = "plan"
    AUTO = "auto"


class ToolRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tool_name: str
    behavior: Literal["allow", "deny", "ask"]
    pattern: Optional[str] = None
    scope: Literal["session", "project", "global"] = "session"


class ToolDecision(BaseModel):
    behavior: Literal["allow", "deny", "ask"]
    reason: str
    request_id: Optional[str] = None


class PermissionRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    tool_name: str
    tool_input: Dict[str, Any]
    description: str
    status: Literal["pending", "approved", "denied", "expired"] = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    decision: Optional[Literal["once", "always", "deny"]] = None


class SessionPermissionState(BaseModel):
    session_id: str
    mode: PermissionMode = PermissionMode.DEFAULT
    rules: List[ToolRule] = []
    trusted_folders: List[str] = []
    pending_requests: Dict[str, PermissionRequest] = {}


class RespondInput(BaseModel):
    decision: Literal["once", "always", "deny"]
    updated_input: Optional[Dict[str, Any]] = None


class SetModeInput(BaseModel):
    mode: PermissionMode


class AddRulesInput(BaseModel):
    rules: List[ToolRule]
