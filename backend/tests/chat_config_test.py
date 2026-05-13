import asyncio

from app.config_bus.bus import bus
from app.chat_config import CHAT_CONFIG_KEYS, register_chat_config_keys


def test_chat_config_defaults_registered_with_schema():
    bus._reset_for_tests()
    register_chat_config_keys()
    docs = [doc for doc in bus.list_docs() if doc["_id"].startswith("chat.")]
    keys = sorted(doc["_id"] for doc in docs)
    assert keys == sorted(CHAT_CONFIG_KEYS)
    assert len(keys) == 12
    assert all(doc["schema"] for doc in docs)
    assert all(doc["schema"].get("category") == "chat" for doc in docs)
    assert bus.get("chat.history.token_budget") == 6000
    assert bus.get("chat.history.max_turns_hard_cap") == 30
    assert bus.get("chat.input.disabled_on_error") is False
    assert bus.get("chat.projects.shared_memory_loaded") is True


def test_chat_config_set_notifies_agent_runtime(monkeypatch):
    bus._reset_for_tests()
    register_chat_config_keys()
    emitted = []

    async def fake_notify(key, new, old):
        emitted.append((key, new, old))

    import app.chat_config as chat_config
    monkeypatch.setattr(chat_config, "notify_agent_runtime", fake_notify)

    asyncio.get_event_loop().run_until_complete(
        bus.set("chat.history.token_budget", 42, actor="test")
    )
    assert emitted == [("chat.history.token_budget", 42, 6000)]
