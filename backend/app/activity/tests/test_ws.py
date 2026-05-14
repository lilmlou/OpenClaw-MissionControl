"""Tests for /api/v2/activities/ws fan-out.

Sprint 4 — Activities Feed backend half. The HTTP route is covered by usage
elsewhere; here we cover the new WS endpoint.
"""
from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.activity import (
    activity_router,
    activity_ws_router,
    activity_ws_broadcast,
    emit,
    set_broadcaster,
    set_db,
)
from app.activity import emitter as activity_emitter


def _build_app() -> FastAPI:
    set_db(None)
    activity_emitter._mem_events.clear()  # type: ignore[attr-defined]
    set_broadcaster(activity_ws_broadcast)
    a = FastAPI()
    a.include_router(activity_router)
    a.include_router(activity_ws_router)

    # Test-only emit endpoint so we can drive emit() from inside the running
    # event loop (TestClient WS blocks the sync thread, so we cannot emit from
    # the test body directly).
    @a.post("/__test__/emit")
    async def _test_emit(payload: dict):
        return emit(
            kind=payload.get("kind", "test"),
            summary=payload.get("summary", ""),
            detail=payload.get("detail") or {},
        )

    return a


@pytest.fixture
def app():
    a = _build_app()
    yield a
    set_broadcaster(None)
    activity_emitter._mem_events.clear()  # type: ignore[attr-defined]


def test_ws_hello_envelope(app):
    client = TestClient(app)
    with client.websocket_connect("/api/v2/activities/ws?replay=0") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "activities.hello"
        assert hello["n_clients"] >= 1
        assert hello["kinds"] == []


def test_ws_replays_recent_events(app):
    client = TestClient(app)
    # Seed via the in-app endpoint so the event is in mem store
    client.post(
        "/__test__/emit",
        json={"kind": "chat.usage", "summary": "seeded", "detail": {"tokens_in": 1}},
    )
    with client.websocket_connect("/api/v2/activities/ws?replay=10") as ws:
        ws.receive_json()  # hello
        replay = ws.receive_json()
        assert replay["type"] == "activities.replay"
        assert isinstance(replay["items"], list)
        assert any(e.get("kind") == "chat.usage" for e in replay["items"])


def test_ws_live_event_after_connect(app):
    client = TestClient(app)
    with client.websocket_connect("/api/v2/activities/ws?replay=0") as ws:
        ws.receive_json()  # hello
        client.post(
            "/__test__/emit",
            json={"kind": "config.set", "summary": "live", "detail": {"key": "x"}},
        )
        frame = ws.receive_json()
        assert frame["type"] == "activities.event"
        assert frame["event"]["kind"] == "config.set"
        assert frame["event"]["summary"] == "live"
        assert "id" in frame["event"]
        assert "ts" in frame["event"]


def test_ws_kind_filter_blocks_other_kinds(app):
    client = TestClient(app)
    with client.websocket_connect("/api/v2/activities/ws?replay=0&kind=chat.usage") as ws:
        hello = ws.receive_json()
        assert hello["kinds"] == ["chat.usage"]
        client.post("/__test__/emit", json={"kind": "config.set", "summary": "skip-me"})
        client.post("/__test__/emit", json={"kind": "chat.usage", "summary": "match"})
        frame = ws.receive_json()
        assert frame["type"] == "activities.event"
        assert frame["event"]["kind"] == "chat.usage"
        assert frame["event"]["summary"] == "match"


def test_ws_two_clients_both_receive(app):
    client = TestClient(app)
    with client.websocket_connect("/api/v2/activities/ws?replay=0") as ws_a, \
         client.websocket_connect("/api/v2/activities/ws?replay=0") as ws_b:
        ws_a.receive_json()  # hello
        ws_b.receive_json()  # hello
        client.post("/__test__/emit", json={"kind": "agent.event", "summary": "shared"})
        a = ws_a.receive_json()
        b = ws_b.receive_json()
        assert a["event"]["kind"] == "agent.event"
        assert b["event"]["kind"] == "agent.event"
        assert a["event"]["id"] == b["event"]["id"]


def test_ws_ping_pong(app):
    client = TestClient(app)
    with client.websocket_connect("/api/v2/activities/ws?replay=0") as ws:
        ws.receive_json()  # hello
        ws.send_text(json.dumps({"type": "ping", "ts": 999}))
        msg = ws.receive_json()
        assert msg["type"] == "pong"
        assert msg["ts"] == 999


def test_http_route_unaffected(app):
    client = TestClient(app)
    client.post("/__test__/emit", json={"kind": "cron.fired", "summary": "http-too"})
    r = client.get("/api/v2/activities")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert any(e.get("kind") == "cron.fired" for e in body["data"])
