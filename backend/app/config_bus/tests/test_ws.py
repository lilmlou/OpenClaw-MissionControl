"""WebSocket fan-out tests.

Two clients subscribe to /api/ws/config; one mutation in another client should
push events to both within the same event loop turn.
"""
from __future__ import annotations

import asyncio
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config_bus.bus import bus
from app.config_bus import store as config_store
from app.config_bus import events as config_events
from app.config_bus.routes import config_router
from app.config_bus.ws import clear_replay_providers, config_ws_router


@pytest.fixture
def app():
    bus._reset_for_tests()
    clear_replay_providers()
    config_store.set_db(None)
    bus.register_default("k", "a", schema={"type": "string"})
    config_events.install()
    a = FastAPI()
    a.include_router(config_router)
    a.include_router(config_ws_router)
    yield a
    bus._reset_for_tests()
    clear_replay_providers()


def test_ws_receives_config_set(app):
    client = TestClient(app)
    with client.websocket_connect("/api/ws/config") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "config.hello"
        # Trigger a mutation via HTTP route in the same client
        r = client.put("/api/v2/config/k", json={"value": "b"})
        assert r.status_code == 200
        # Drain WS events until we see config.set
        evt = ws.receive_json()
        # Event content
        assert evt["type"] in ("config.set", "config.deleted")
        if evt["type"] == "config.set":
            assert evt["key"] == "k"
            assert evt["value"] == "b"


def test_two_ws_clients_both_receive(app):
    client = TestClient(app)
    with client.websocket_connect("/api/ws/config") as ws_a, \
         client.websocket_connect("/api/ws/config") as ws_b:
        ws_a.receive_json()  # hello
        ws_b.receive_json()  # hello
        client.put("/api/v2/config/k", json={"value": "two-tab"})
        # Each connection sees the same event
        evt_a = ws_a.receive_json()
        evt_b = ws_b.receive_json()
        assert evt_a["type"] in ("config.set", "config.deleted")
        assert evt_b["type"] in ("config.set", "config.deleted")
        if evt_a["type"] == "config.set":
            assert evt_a["value"] == "two-tab"
            assert evt_b["value"] == "two-tab"


def test_ws_ping_pong(app):
    client = TestClient(app)
    with client.websocket_connect("/api/ws/config") as ws:
        ws.receive_json()  # hello
        ws.send_text(json.dumps({"type": "ping", "ts": 12345}))
        msg = ws.receive_json()
        assert msg["type"] == "pong"
        assert msg["ts"] == 12345
