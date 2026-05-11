"""Test stubs for /api/v2/qudos/* endpoints.

Status: STUB — all endpoints return {available: false, error: "not_implemented"}
until the Qudos backend bridge is wired.

These tests verify stub response shape so the contract is enforced
even before real implementations land.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from app.qudos.routes import qudos_router

from fastapi import FastAPI

app = FastAPI()
app.include_router(qudos_router)


@pytest.fixture
def transport():
    return ASGITransport(app=app)


@pytest.fixture
async def client(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _assert_stub_shape(data: dict, expect_503: bool = False):
    """Verify stub response matches contract."""
    assert data["available"] is False
    assert data["error"] == "not_implemented"
    assert "fix" in data and isinstance(data["fix"], list)
    assert len(data["fix"]) > 0
    assert data["fix"][0]["label"] == "Backend bridges pending"
    assert "detail" in data
    assert "ts" in data


# ---- App endpoints ----

@pytest.mark.asyncio
async def test_list_apps_returns_stub(client):
    """GET /api/v2/qudos/apps — stub returns {available: false}."""
    resp = await client.get("/api/v2/qudos/apps")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


# ---- Permissions ----

@pytest.mark.asyncio
async def test_list_permissions_returns_stub(client):
    """GET /api/v2/qudos/permissions — stub returns {available: false}."""
    resp = await client.get("/api/v2/qudos/permissions")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


# ---- Sessions ----

@pytest.mark.asyncio
async def test_start_session_returns_stub_503(client):
    """POST /api/v2/qudos/sessions — stub returns 503."""
    resp = await client.post("/api/v2/qudos/sessions", json={"app_id": "safari", "mode": "observe"})
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


@pytest.mark.asyncio
async def test_list_sessions_returns_stub(client):
    """GET /api/v2/qudos/sessions — stub returns {available: false}."""
    resp = await client.get("/api/v2/qudos/sessions")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


@pytest.mark.asyncio
async def test_get_session_returns_stub(client):
    """GET /api/v2/qudos/sessions/{id} — stub returns {available: false}."""
    resp = await client.get("/api/v2/qudos/sessions/sess-123")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


@pytest.mark.asyncio
async def test_stop_session_returns_stub_503(client):
    """POST /api/v2/qudos/sessions/{id}/stop — stub returns 503."""
    resp = await client.post("/api/v2/qudos/sessions/sess-123/stop")
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


# ---- Suggestions ----

@pytest.mark.asyncio
async def test_list_suggestions_returns_stub(client):
    """GET /api/v2/qudos/suggestions — stub returns {available: false}."""
    resp = await client.get("/api/v2/qudos/suggestions")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


@pytest.mark.asyncio
async def test_resolve_suggestion_returns_stub_503(client):
    """POST /api/v2/qudos/suggestions/{id}/resolve — stub returns 503."""
    resp = await client.post("/api/v2/qudos/suggestions/sug-1/resolve", json={"action": "accept"})
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


# TODO: builder scaffold
