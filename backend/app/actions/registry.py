"""Action registry — singleton, in-process.

Per PHASE_0_3_BINDING_LAYER.md §3 + §5.
"""
from __future__ import annotations

import inspect
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from app.config_bus.schema import ConfigValidationError, validate_value


log = logging.getLogger(__name__)


class ActionInputError(Exception):
    """Wraps schema validation failure for action inputs."""
    def __init__(self, key: str, errors: List[Dict[str, Any]]):
        self.key = key
        self.errors = errors
        super().__init__(f"input validation failed for action {key}")

    def to_response(self) -> Dict[str, Any]:
        return {
            "ok": False,
            "error": "validation_failed",
            "code": "VALIDATION_FAILED",
            "detail": {"action": self.key, "errors": self.errors},
        }


Handler = Callable[..., Any]


@dataclass
class ActionDefinition:
    key: str
    title: str
    category: str
    destructive: bool
    requires_confirm: bool
    input_schema: Optional[Dict[str, Any]]
    result_schema: Optional[Dict[str, Any]]
    description: str
    handler: Handler

    def public(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "title": self.title,
            "category": self.category,
            "destructive": self.destructive,
            "requires_confirm": self.requires_confirm,
            "input_schema": self.input_schema,
            "result_schema": self.result_schema,
            "description": self.description,
        }


class ActionsRegistry:
    def __init__(self) -> None:
        self._actions: Dict[str, ActionDefinition] = {}

    def register(
        self,
        *,
        key: str,
        title: Optional[str] = None,
        category: str = "uncategorized",
        destructive: bool = False,
        requires_confirm: Optional[bool] = None,
        input_schema: Optional[Dict[str, Any]] = None,
        result_schema: Optional[Dict[str, Any]] = None,
        description: str = "",
    ) -> Callable[[Handler], Handler]:
        """Decorator. Registers `key` → handler. Re-registering replaces."""
        def decorator(fn: Handler) -> Handler:
            self._actions[key] = ActionDefinition(
                key=key,
                title=title or key,
                category=category,
                destructive=destructive,
                requires_confirm=destructive if requires_confirm is None else requires_confirm,
                input_schema=input_schema,
                result_schema=result_schema,
                description=description,
                handler=fn,
            )
            return fn
        return decorator

    def get(self, key: str) -> Optional[ActionDefinition]:
        return self._actions.get(key)

    def list_actions(self, *, category: Optional[str] = None) -> List[Dict[str, Any]]:
        if category:
            return [a.public() for a in self._actions.values() if a.category == category]
        return [a.public() for a in self._actions.values()]

    async def invoke(
        self,
        key: str,
        args: Any = None,
        *,
        actor: str = "system",
    ) -> Dict[str, Any]:
        defn = self._actions.get(key)
        if defn is None:
            raise KeyError(key)

        if defn.input_schema is not None:
            try:
                validate_value(key, args, defn.input_schema)
            except ConfigValidationError as exc:
                raise ActionInputError(key, exc.errors) from exc

        try:
            result = defn.handler(args, actor)
            if inspect.isawaitable(result):
                result = await result
            return result if isinstance(result, dict) else {"value": result}
        except Exception as exc:
            log.exception("action %s failed: %s", key, exc)
            raise

    def _reset_for_tests(self) -> None:
        self._actions.clear()


# Singleton
actions = ActionsRegistry()
