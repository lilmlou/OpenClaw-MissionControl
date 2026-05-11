"""Bus core tests — no Mongo required (store falls back to in-memory).

Covers register_default, get/set/delete, validation, version conflict,
subscribers (key + prefix), bulk_set atomicity, ENV fallback.
"""
from __future__ import annotations

import os

import pytest

from app.config_bus.bus import bus, ConfigValidationError, ConfigVersionConflict
from app.config_bus import store as config_store


@pytest.fixture(autouse=True)
def _clean_bus():
    bus._reset_for_tests()
    config_store.set_db(None)
    yield
    bus._reset_for_tests()


def test_register_default_and_get():
    bus.register_default("foo.bar", 42, schema={"type": "integer"})
    assert bus.get("foo.bar") == 42


def test_register_default_idempotent():
    bus.register_default("foo.bar", 42, schema={"type": "integer"})
    bus.register_default("foo.bar", 42, schema={"type": "integer"})  # no-op
    assert bus.get("foo.bar") == 42


def test_get_missing_raises_keyerror():
    with pytest.raises(KeyError):
        bus.get("nope")


def test_get_with_default_returns_default():
    assert bus.get("nope", "fallback") == "fallback"


def test_env_fallback():
    bus.register_default("models.default.provider", "ollama", schema={"type": "string"})
    os.environ["MODELS_DEFAULT_PROVIDER"] = "openai"
    try:
        assert bus.get("models.default.provider") == "openai"
    finally:
        del os.environ["MODELS_DEFAULT_PROVIDER"]
    # back to default
    assert bus.get("models.default.provider") == "ollama"


def test_env_coerces_bool():
    bus.register_default("flag.x", False, schema={"type": "boolean"})
    os.environ["FLAG_X"] = "true"
    try:
        assert bus.get("flag.x") is True
    finally:
        del os.environ["FLAG_X"]


@pytest.mark.asyncio
async def test_set_validates_value():
    bus.register_default(
        "n",
        1,
        schema={"type": "integer", "minimum": 0, "maximum": 10},
    )
    with pytest.raises(ConfigValidationError) as ei:
        await bus.set("n", 999)
    assert "n" == ei.value.key


@pytest.mark.asyncio
async def test_set_accepts_valid_and_updates_cache():
    bus.register_default("n", 1, schema={"type": "integer"})
    doc = await bus.set("n", 5)
    assert bus.get("n") == 5
    assert doc["value"] == 5
    assert doc["version"] >= 1


@pytest.mark.asyncio
async def test_subscriber_fires_with_old_and_new():
    seen = {}

    bus.register_default("k", "a", schema={"type": "string"})

    @bus.on("k")
    async def _changed(new, old):
        seen["new"] = new
        seen["old"] = old

    await bus.set("k", "b")
    assert seen == {"new": "b", "old": "a"}


@pytest.mark.asyncio
async def test_prefix_subscriber():
    seen = []

    bus.register_default("ui.theme", "dark", schema={"type": "string"})
    bus.register_default("ui.density", "comfy", schema={"type": "string"})

    @bus.on_prefix("ui.")
    async def _changed(key, new, old):
        seen.append((key, new, old))

    await bus.set("ui.theme", "light")
    await bus.set("ui.density", "compact")
    assert ("ui.theme", "light", "dark") in seen
    assert ("ui.density", "compact", "comfy") in seen


@pytest.mark.asyncio
async def test_subscribers_dont_block_on_exception():
    bus.register_default("k", "a", schema={"type": "string"})

    @bus.on("k")
    async def _broken(new, old):
        raise RuntimeError("boom")

    # Should not raise to caller
    doc = await bus.set("k", "b")
    assert doc["value"] == "b"


@pytest.mark.asyncio
async def test_delete_reverts_to_default():
    bus.register_default("k", "default", schema={"type": "string"})
    await bus.set("k", "override")
    assert bus.get("k") == "override"
    await bus.delete("k")
    assert bus.get("k") == "default"


@pytest.mark.asyncio
async def test_bulk_set_validates_all_first():
    bus.register_default("a", 1, schema={"type": "integer", "minimum": 0})
    bus.register_default("b", 2, schema={"type": "integer", "minimum": 0})
    # Second change is invalid; first should NOT be applied
    with pytest.raises(ConfigValidationError):
        await bus.bulk_set([
            {"key": "a", "value": 10},
            {"key": "b", "value": -1},
        ])
    # 'a' must remain at default (validation phase failed before any write)
    assert bus.get("a") == 1


@pytest.mark.asyncio
async def test_bulk_set_applies_all_when_valid():
    bus.register_default("a", 1, schema={"type": "integer"})
    bus.register_default("b", 2, schema={"type": "integer"})
    res = await bus.bulk_set([
        {"key": "a", "value": 10},
        {"key": "b", "value": 20},
    ])
    assert len(res) == 2
    assert bus.get("a") == 10
    assert bus.get("b") == 20


def test_secret_redacted_in_doc():
    bus.register_default("auth.token", "supersecret", schema={"type": "string"}, secret=True)
    doc = bus.get_doc("auth.token")
    assert doc["value"] == "***"
    # But internal get returns the real value (modules need it)
    assert bus.get("auth.token") == "supersecret"


def test_list_categories_counts():
    bus.register_default("a.x", 1, schema={"type": "integer", "category": "a"})
    bus.register_default("a.y", 2, schema={"type": "integer", "category": "a"})
    bus.register_default("b.x", 3, schema={"type": "integer", "category": "b"})
    cats = bus.list_categories()
    by_cat = {c["category"]: c["count"] for c in cats}
    assert by_cat["a"] == 2
    assert by_cat["b"] == 1


def test_list_docs_filtered_by_category():
    bus.register_default("a.x", 1, schema={"type": "integer", "category": "a"})
    bus.register_default("b.x", 2, schema={"type": "integer", "category": "b"})
    docs = bus.list_docs(category="a")
    assert len(docs) == 1
    assert docs[0]["_id"] == "a.x"


def test_get_doc_missing_raises():
    with pytest.raises(KeyError):
        bus.get_doc("nope")


def test_get_doc_for_default_returns_synth():
    bus.register_default("k", 7, schema={"type": "integer", "title": "T"})
    doc = bus.get_doc("k")
    assert doc["_id"] == "k"
    assert doc["value"] == 7
    assert doc["version"] == 0
    assert doc["schema"]["title"] == "T"


@pytest.mark.asyncio
async def test_resolution_order_mongo_overrides_default():
    bus.register_default("k", "default", schema={"type": "string"})
    await bus.set("k", "override")
    assert bus.get("k") == "override"
