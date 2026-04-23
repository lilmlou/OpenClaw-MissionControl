from typing import Any, AsyncIterator, Dict

from .base import RuntimeAdapter


class OpenClawRuntimeAdapter(RuntimeAdapter):
    runtime_name = "openclaw"

    async def send_message(
        self, session_id: str, message: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        return {
            "runtime": self.runtime_name,
            "session_id": session_id,
            "content": f"I received your message: '{message}'. This is a placeholder response from the OpenClaw Mission Control system.",
            "context": context,
        }

    async def stream_message(
        self, session_id: str, message: str, context: Dict[str, Any]
    ) -> AsyncIterator[Dict[str, Any]]:
        yield {
            "type": "message.delta",
            "runtime": self.runtime_name,
            "session_id": session_id,
            "content": f"I received your message: '{message}'. This is a placeholder response from the OpenClaw Mission Control system.",
            "context": context,
        }
