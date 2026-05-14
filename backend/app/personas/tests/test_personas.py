"""Tests for /api/v2/personas routes + store.

Covers:
  - Seed defaults (3 system personas + active fallback)
  - GET list / GET active / GET by id (incl. 404 envelope)
  - POST create — happy + duplicate + invalid + bad temperature
  - PUT update — patch fields, name validation, 404
  - DELETE — non-system OK, system protected (403), 404
  - POST /{id}/activate — flips active, returns previous
  - Activity events: personas.created/updated/deleted/activated/changed
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from app.personas import personas_router, seed_defaults, reset_for_tests
from app.activity import emitter as activity_emitter


@pytest.fixture(autouse=True)
async def _reset_state():
    reset_for_tests()
    # Capture emitted activity events for assertion.
    events = []

    def _grab(event):
        events.append(event)
        return None

    activity_emitter._mem_events.clear()
    yield events
    reset_for_tests()


@pytest.fixture
def app(_reset_state):
    captured = _reset_state

    # Patch _broadcaster so emit records but doesn't try to fan out.
    activity_emitter.set_broadcaster(None)

    app = FastAPI()
    app.include_router(personas_router)
    return app


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def recorded_events():
    """Return the running list of activity events emitted during the test."""
    return activity_emitter._mem_events


# ---- Seed --------------------------------------------------------------------


@pytest.mark.asyncio
async def test_seed_defaults_inserts_three(client):
    n = await seed_defaults()
    assert n == 3
    resp = await client.get("/api/v2/personas")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    data = body["data"]
    assert len(data["personas"]) == 3
    assert data["active_id"] == "persona-dev"
    # All defaults should be flagged system:True
    assert all(p["system"] is True for p in data["personas"])
    # Exactly one is active (matches active_id)
    actives = [p for p in data["personas"] if p["active"]]
    assert len(actives) == 1
    assert actives[0]["id"] == "persona-dev"


@pytest.mark.asyncio
async def test_seed_idempotent(client):
    await seed_defaults()
    n2 = await seed_defaults()
    assert n2 == 0
    resp = await client.get("/api/v2/personas")
    assert len(resp.json()["data"]["personas"]) == 3


# ---- Reads -------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_active(client):
    await seed_defaults()
    resp = await client.get("/api/v2/personas/active")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["data"]["active"]["id"] == "persona-dev"


@pytest.mark.asyncio
async def test_get_by_id(client):
    await seed_defaults()
    resp = await client.get("/api/v2/personas/persona-research")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["name"] == "Research"
    assert body["data"]["active"] is False


@pytest.mark.asyncio
async def test_get_by_id_404(client):
    resp = await client.get("/api/v2/personas/does-not-exist")
    assert resp.status_code == 404
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "PERSONA_NOT_FOUND"
    assert isinstance(body["fix"], list) and len(body["fix"]) >= 1
    assert body["available"] is False
    assert "ts" in body


# ---- Create ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_persona_ok(client, recorded_events):
    await seed_defaults()
    resp = await client.post(
        "/api/v2/personas",
        json={
            "name": "Editor",
            "tagline": "Wordsmith",
            "icon": "PenTool",
            "defaults": {"model": "Auto · long-context", "temperature": 0.5},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    p = body["data"]
    assert p["id"] == "editor"  # slug-from-name
    assert p["system"] is False
    assert p["active"] is False
    # Activity events: personas.created + personas.changed
    kinds = [e["kind"] for e in recorded_events]
    assert "personas.created" in kinds
    assert "personas.changed" in kinds


@pytest.mark.asyncio
async def test_create_explicit_id(client):
    resp = await client.post(
        "/api/v2/personas",
        json={"id": "my-custom", "name": "Custom"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == "my-custom"


@pytest.mark.asyncio
async def test_create_duplicate_rejected(client):
    await client.post("/api/v2/personas", json={"id": "dup", "name": "Dup"})
    resp = await client.post("/api/v2/personas", json={"id": "dup", "name": "Dup2"})
    assert resp.status_code == 400
    body = resp.json()
    assert body["code"] == "PERSONA_INVALID"
    assert "already exists" in body["error"]


@pytest.mark.asyncio
async def test_create_invalid_temperature(client):
    resp = await client.post(
        "/api/v2/personas",
        json={"name": "BadTemp", "defaults": {"temperature": 9.0}},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "PERSONA_INVALID"


@pytest.mark.asyncio
async def test_create_requires_name(client):
    resp = await client.post("/api/v2/personas", json={"id": "nameless"})
    # FastAPI's Pydantic enforcement → 422
    assert resp.status_code in (400, 422)


# ---- Update ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_persona_ok(client, recorded_events):
    await seed_defaults()
    resp = await client.put(
        "/api/v2/personas/persona-dev",
        json={"tagline": "Engineering and ship-it"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["tagline"] == "Engineering and ship-it"
    kinds = [e["kind"] for e in recorded_events]
    assert "personas.updated" in kinds
    assert "personas.changed" in kinds
    # detail.changed should list "tagline"
    updated = [e for e in recorded_events if e["kind"] == "personas.updated"][-1]
    assert "tagline" in updated["detail"]["changed"]


@pytest.mark.asyncio
async def test_update_noop_emits_nothing(client, recorded_events):
    await seed_defaults()
    # send empty patch → no event
    resp = await client.put("/api/v2/personas/persona-dev", json={})
    assert resp.status_code == 200
    kinds = [e["kind"] for e in recorded_events]
    assert "personas.updated" not in kinds


@pytest.mark.asyncio
async def test_update_404(client):
    resp = await client.put("/api/v2/personas/no-such", json={"tagline": "x"})
    assert resp.status_code == 404
    assert resp.json()["code"] == "PERSONA_NOT_FOUND"


# ---- Delete ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_user_persona_ok(client, recorded_events):
    await seed_defaults()
    await client.post("/api/v2/personas", json={"id": "tmp", "name": "Tmp"})
    resp = await client.delete("/api/v2/personas/tmp")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["deleted"] is True
    kinds = [e["kind"] for e in recorded_events]
    assert "personas.deleted" in kinds
    assert "personas.changed" in kinds


@pytest.mark.asyncio
async def test_delete_system_persona_forbidden(client):
    await seed_defaults()
    resp = await client.delete("/api/v2/personas/persona-dev")
    assert resp.status_code == 403
    body = resp.json()
    assert body["code"] == "PERSONA_SYSTEM_PROTECTED"
    assert body["available"] is False


@pytest.mark.asyncio
async def test_delete_404(client):
    resp = await client.delete("/api/v2/personas/no-such")
    assert resp.status_code == 404
    assert resp.json()["code"] == "PERSONA_NOT_FOUND"


# ---- Activate ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_activate_flips_active(client, recorded_events):
    await seed_defaults()
    resp = await client.post("/api/v2/personas/persona-research/activate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["active_id"] == "persona-research"
    assert body["data"]["previous"] == "persona-dev"
    # Active reflects in list
    listing = await client.get("/api/v2/personas")
    actives = [p for p in listing.json()["data"]["personas"] if p["active"]]
    assert len(actives) == 1
    assert actives[0]["id"] == "persona-research"
    kinds = [e["kind"] for e in recorded_events]
    assert "personas.activated" in kinds
    assert "personas.changed" in kinds


@pytest.mark.asyncio
async def test_activate_404(client):
    resp = await client.post("/api/v2/personas/no-such/activate")
    assert resp.status_code == 404
    assert resp.json()["code"] == "PERSONA_NOT_FOUND"


# ---- Envelope sanity --------------------------------------------------------


@pytest.mark.asyncio
async def test_envelope_shape_success(client):
    await seed_defaults()
    body = (await client.get("/api/v2/personas")).json()
    for key in ("ok", "data", "ts", "available"):
        assert key in body
    assert body["ok"] is True
    assert body["available"] is True
    assert isinstance(body["ts"], int)
