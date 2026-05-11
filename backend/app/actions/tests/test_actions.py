"""Action registry + HTTP route tests."""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.actions.registry import actions, ActionInputError
from app.actions.routes import actions_router
from app.config_bus.bus import bus
from app.config_bus import store as config_store


@pytest.fixture
def client():
    actions._reset_for_tests()
    bus._reset_for_tests()
    config_store.set_db(None)

    @actions.register(
        key="echo",
        title="Echo",
        category="test",
        input_schema={"type": "object", "properties": {"msg": {"type": "string"}}, "required": ["msg"]},
        result_schema={"type": "object"},
    )
    async def _echo(args, actor):
        return {"echoed": args["msg"], "actor": actor}

    @actions.register(
        key="count",
        title="Count",
        category="test",
    )
    def _count(args, actor):
        return {"n": 42}

    @actions.register(
        key="kaboom",
        title="Boom",
        category="test",
        destructive=True,
    )
    async def _boom(args, actor):
        raise RuntimeError("on fire")

    app = FastAPI()
    app.include_router(actions_router)
    yield TestClient(app)

    actions._reset_for_tests()
    bus._reset_for_tests()


def test_list(client):
    r = client.get("/api/v2/actions")
    assert r.status_code == 200
    keys = [a["key"] for a in r.json()["data"]["items"]]
    assert "echo" in keys and "count" in keys


def test_invoke_with_valid_input(client):
    r = client.post("/api/v2/actions/echo", json={"args": {"msg": "hi"}, "actor": "user:test"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["data"]["result"]["echoed"] == "hi"
    assert body["data"]["result"]["actor"] == "user:test"


def test_invoke_validates_input(client):
    # Missing required `msg` field
    r = client.post("/api/v2/actions/echo", json={"args": {}})
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION_FAILED"


def test_invoke_404(client):
    r = client.post("/api/v2/actions/no.such.thing", json={"args": None})
    assert r.status_code == 404
    assert r.json()["code"] == "ACTION_NOT_FOUND"


def test_invoke_handler_exception_returns_500(client):
    r = client.post("/api/v2/actions/kaboom", json={"args": None})
    assert r.status_code == 500
    assert r.json()["code"] == "ACTION_FAILED"


def test_sync_handler_supported(client):
    r = client.post("/api/v2/actions/count", json={"args": None})
    assert r.status_code == 200
    assert r.json()["data"]["result"]["n"] == 42


def test_destructive_flag(client):
    r = client.get("/api/v2/actions")
    actions_by_key = {a["key"]: a for a in r.json()["data"]["items"]}
    assert actions_by_key["kaboom"]["destructive"] is True
    # auto-set requires_confirm to True for destructive
    assert actions_by_key["kaboom"]["requires_confirm"] is True
    # Non-destructive defaults to False
    assert actions_by_key["echo"]["destructive"] is False


def test_get_one_action(client):
    r = client.get("/api/v2/actions/echo")
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["key"] == "echo"
    assert body["input_schema"]["required"] == ["msg"]


def test_filter_by_category(client):
    r = client.get("/api/v2/actions", params={"category": "test"})
    items = r.json()["data"]["items"]
    assert len(items) == 3
    r2 = client.get("/api/v2/actions", params={"category": "nope"})
    assert r2.json()["data"]["total"] == 0
