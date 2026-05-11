"""Phase 0.3 backend — Action registry.

Modules register actions:

    from app.actions import actions

    @actions.register(
        key="agents.kill_all",
        title="Kill all agents",
        category="agents",
        destructive=True,
        input_schema={"type": "null"},
        result_schema={"type": "object", "properties": {"killed": {"type": "integer"}}},
    )
    async def kill_all(args, actor):
        return {"killed": await agent_manager.kill_all()}

The frontend `<BindAction>` component talks to /api/v2/actions endpoints.
"""
from .registry import actions, ActionsRegistry, ActionDefinition, ActionInputError
from .routes import actions_router

__all__ = [
    "actions",
    "ActionsRegistry",
    "ActionDefinition",
    "ActionInputError",
    "actions_router",
]
