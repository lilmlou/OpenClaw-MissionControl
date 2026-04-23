from typing import Any, AsyncIterator, Dict


class RuntimeAdapter:
    runtime_name: str = "base"

    async def send_message(
        self, session_id: str, message: str, context: Dict[str, Any]
    ) -> Dict[str, Any]:
        raise NotImplementedError

    async def stream_message(
        self, session_id: str, message: str, context: Dict[str, Any]
    ) -> AsyncIterator[Dict[str, Any]]:
        raise NotImplementedError
