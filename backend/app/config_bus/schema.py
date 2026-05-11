"""JSON Schema validation for config values.

Uses jsonschema lib. Wraps validation errors into ConfigValidationError so the
HTTP layer can surface field-level detail per §3.4 of the handoff.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


class ConfigValidationError(Exception):
    """Raised when a value fails its registered JSON Schema."""

    def __init__(self, key: str, errors: List[Dict[str, Any]]):
        self.key = key
        self.errors = errors
        super().__init__(f"validation failed for {key}: {len(errors)} error(s)")

    def to_response(self) -> Dict[str, Any]:
        return {
            "ok": False,
            "error": "validation_failed",
            "code": "VALIDATION_FAILED",
            "detail": {
                "key": self.key,
                "errors": self.errors,
            },
        }


def validate_value(key: str, value: Any, schema: Optional[Dict[str, Any]]) -> None:
    """Raise ConfigValidationError if value doesn't conform to schema.

    No schema → accept anything (caller may have intentionally registered an
    open key). The handoff §3.1 makes schema optional in practice.
    """
    if not schema:
        return
    try:
        Draft202012Validator(schema).validate(value)
    except ValidationError as exc:
        errors: List[Dict[str, Any]] = [{
            "path": list(exc.absolute_path),
            "message": exc.message,
            "validator": exc.validator,
            "validator_value": _safe(exc.validator_value),
        }]
        # Collect siblings if iter_errors yielded more — single .validate() only
        # raises one, so we compose from the validator manually for richer detail.
        all_errors = list(Draft202012Validator(schema).iter_errors(value))
        if len(all_errors) > 1:
            errors = [{
                "path": list(e.absolute_path),
                "message": e.message,
                "validator": e.validator,
                "validator_value": _safe(e.validator_value),
            } for e in all_errors]
        raise ConfigValidationError(key, errors)


def _safe(v: Any) -> Any:
    """Make a JSON-serialisable copy of an arbitrary jsonschema value."""
    try:
        import json
        json.dumps(v)
        return v
    except (TypeError, ValueError):
        return repr(v)


def infer_type(schema: Optional[Dict[str, Any]], value: Any) -> str:
    """Best-effort type tag for the bus document (§3.1 `type` field)."""
    if schema:
        t = schema.get("type")
        if isinstance(t, str):
            return t
        if isinstance(t, list) and t:
            return t[0]
        if "enum" in schema:
            return "enum"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return "object"
