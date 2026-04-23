import re
from typing import Dict, List, Optional
from .models import ToolRule, ToolDecision


WRITE_TOOLS = {"Write", "Edit", "Bash"}
COMMAND_TOOLS = {"Bash"}
READ_ONLY_TOOLS = {"Read", "Glob", "Grep", "WebFetch"}


def match_tool_rule(tool_name: str, tool_input: dict, rule: ToolRule) -> bool:
    if rule.tool_name != tool_name:
        return False
    if rule.pattern:
        input_str = _flatten_input(tool_input)
        if not re.search(rule.pattern, input_str):
            return False
    return True


def _flatten_input(tool_input: dict) -> str:
    parts = []
    for v in tool_input.values():
        if isinstance(v, str):
            parts.append(v)
        elif isinstance(v, (list, dict)):
            parts.append(str(v))
        elif v is not None:
            parts.append(str(v))
    return " ".join(parts)


def evaluate_rules(
    tool_name: str,
    tool_input: dict,
    rules: List[ToolRule],
) -> Optional[ToolDecision]:
    scoped_order = ["session", "project", "global"]
    for scope in scoped_order:
        for rule in rules:
            if rule.scope != scope:
                continue
            if match_tool_rule(tool_name, tool_input, rule):
                return ToolDecision(
                    behavior=rule.behavior,
                    reason=f"Rule matched: {rule.tool_name} -> {rule.behavior}"
                    + (f" (pattern: {rule.pattern})" if rule.pattern else ""),
                )
    return None


def is_write_operation(tool_name: str) -> bool:
    return tool_name in WRITE_TOOLS


def is_command_operation(tool_name: str) -> bool:
    return tool_name in COMMAND_TOOLS


def is_trusted_path(file_path: str, trusted_folders: List[str]) -> bool:
    if not trusted_folders:
        return False
    normalized = file_path.replace("\\", "/")
    for folder in trusted_folders:
        norm_folder = folder.replace("\\", "/")
        if normalized.startswith(norm_folder) or normalized.startswith(
            norm_folder.rstrip("/") + "/"
        ):
            return True
    return False
