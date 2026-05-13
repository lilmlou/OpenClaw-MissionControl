from app.config_bus.bus import bus
from app.brain_config import ROUTER_CONFIG_KEYS, register_brain_config_keys


def test_router_config_defaults_registered_with_schema():
    bus._reset_for_tests()
    register_brain_config_keys()
    docs = [doc for doc in bus.list_docs() if doc["_id"].startswith("router.")]
    keys = sorted(doc["_id"] for doc in docs)
    assert keys == sorted(ROUTER_CONFIG_KEYS)
    assert len(keys) == 12
    assert all(doc["schema"] for doc in docs)
    assert all(doc["schema"].get("category") == "router" for doc in docs)
    assert bus.get("router.score.weight_performance") == 0.40
    assert bus.get("router.feedback.enabled") is True


def test_router_config_set_emits_activity(monkeypatch):
    bus._reset_for_tests()
    register_brain_config_keys()
    emitted = []

    async def fake_notify(key, new, old):
        emitted.append((key, new, old))

    import app.brain_config as brain_config
    monkeypatch.setattr(brain_config, "notify_agent_runtime", fake_notify)

    import asyncio
    asyncio.get_event_loop().run_until_complete(
        bus.set("router.score.weight_cost", 0, actor="test")
    )
    assert emitted == [("router.score.weight_cost", 0, 0.25)]
