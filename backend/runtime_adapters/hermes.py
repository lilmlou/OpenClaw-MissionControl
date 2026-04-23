from typing import Any, AsyncIterator, Dict

from .base import RuntimeAdapter


class HermesRuntimeAdapter(RuntimeAdapter):
    runtime_name = "hermes"

    async def send_message(
        self, session_id: str, message: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        return {
            "runtime": self.runtime_name,
            "session_id": session_id,
            "content": f"Hermes runtime adapter received: '{message}'. The Hermes backend path is scaffolded but not fully wired yet.",
            "context": context,
        }

    async def stream_message(
        self, session_id: str, message: str, context: Dict[str, Any]
    ) -> AsyncIterator[Dict[str, Any]]:
        yield {
            "type": "message.delta",
            "runtime": self.runtime_name,
            "session_id": session_id,
            "content": f"Hermes runtime adapter received: '{message}'. The Hermes backend path is scaffolded but not fully wired yet.",
            "context": context,
        }
