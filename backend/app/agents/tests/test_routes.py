"""Route tests using FastAPI TestClient.

Mounts only the agents router (and required deps) on a fresh FastAPI app so
we don't need Mongo or the full server.py wiring.
"""
from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agents import agents_router, agents_ws_router, store, dispatch
from app.agents.defaults import register_agent_bus_keys


@pytest.fixture
def client():
    register_agent_bus_keys()
    store.reset_for_tests()
    app = FastAPI()
    app.include_router(agents_router)
    app.include_router(agents_ws_router)
    with TestClient(app) as c:
        yield c
    store.reset_for_tests()


def test_list_runs_empty(client):
    r = client.get("/api/v2/agents/runs")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["available"] is True
    assert body["data"]["items"] == []


def test_dispatch_then_get(client, tmp_path):
    r = client.post(
        "/api/v2/agents/runs",
        json={"agent_id": "ag", "handoff_doc": "x.md", "repo_root": str(tmp_path)},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    rid = body["data"]["run"]["id"]
    detail = client.get(f"/api/v2/agents/runs/{rid}").json()
    assert detail["ok"] is True
    assert detail["data"]["run"]["status"] == "running"


def test_get_unknown_run_returns_fix_array(client):
    body = client.get("/api/v2/agents/runs/bogus").json()
    assert body["ok"] is False
    assert body["available"] is False
    assert isinstance(body["fix"], list)
    assert body["code"] == "RUN_NOT_FOUND"


def test_response_shape_has_available_and_ts(client):
    body = client.get("/api/v2/agents/runs").json()
    assert "available" in body
    assert "ts" in body
    assert "ok" in body


def test_event_lifecycle(client, tmp_path):
    rid = client.post(
        "/api/v2/agents/runs",
        json={"agent_id": "ag", "handoff_doc": "x.md", "repo_root": str(tmp_path)},
    ).json()["data"]["run"]["id"]

    e = client.post(
        f"/api/v2/agents/runs/{rid}/event",
        json={"kind": "file_write", "summary": "wrote foo.py"},
    ).json()
    assert e["ok"] is True

    events = client.get(f"/api/v2/agents/runs/{rid}/events").json()
    assert events["data"]["total"] >= 1


def test_complete_then_verify_with_passing_check(client, tmp_path):
    rid = client.post(
        "/api/v2/agents/runs",
        json={"agent_id": "ag", "handoff_doc": "x.md", "repo_root": str(tmp_path)},
    ).json()["data"]["run"]["id"]

    # Inject a passing check directly via store (the parser path is tested elsewhere)
    import asyncio
    asyncio.get_event_loop().run_until_complete(
        store.insert_checks(rid, [{"label": "always", "command": "true", "status": "pending"}])
    )

    client.post(f"/api/v2/agents/runs/{rid}/complete", json={})
    v = client.post(f"/api/v2/agents/runs/{rid}/verify", json={}).json()
    assert v["ok"] is True
    assert v["data"]["status"] == "verified"


def test_kill_marks_killed(client, tmp_path):
    rid = client.post(
        "/api/v2/agents/runs",
        json={"agent_id": "ag", "handoff_doc": "x.md", "repo_root": str(tmp_path)},
    ).json()["data"]["run"]["id"]

    k = client.post(f"/api/v2/agents/runs/{rid}/kill", json={}).json()
    assert k["ok"] is True
    detail = client.get(f"/api/v2/agents/runs/{rid}").json()
    assert detail["data"]["run"]["status"] == "killed"
