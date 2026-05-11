"""Test stubs for /api/v2/design/* endpoints.

Status: STUB — all endpoints return {available: false, error: "no_provider"}
until design.provider.image is set to something other than "none".

These tests verify stub response shape so the contract is enforced
even before a real provider is wired.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from app.design.routes import design_router

from fastapi import FastAPI

app = FastAPI()
app.include_router(design_router)


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
    assert data["error"] == "no_provider"
    assert "fix" in data and isinstance(data["fix"], list)
    assert len(data["fix"]) > 0
    assert data["fix"][0]["label"] == "Configure provider"
    assert "detail" in data
    assert "ts" in data


# ---- Generation endpoints ----

@pytest.mark.asyncio
async def test_list_generations_returns_stub(client):
    """GET /api/v2/design/generations — stub returns {available: false}."""
    resp = await client.get("/api/v2/design/generations")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


@pytest.mark.asyncio
async def test_generate_returns_stub_503(client):
    """POST /api/v2/design/generate — stub returns 503."""
    resp = await client.post("/api/v2/design/generate", json={"prompt": "test"})
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


@pytest.mark.asyncio
async def test_get_generation_returns_stub(client):
    """GET /api/v2/design/generations/{id} — stub returns {available: false}."""
    resp = await client.get("/api/v2/design/generations/gen-123")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


@pytest.mark.asyncio
async def test_delete_generation_returns_stub_503(client):
    """DELETE /api/v2/design/generations/{id} — stub returns 503."""
    resp = await client.delete("/api/v2/design/generations/gen-123")
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


# ---- Project (canvas) endpoints ----

@pytest.mark.asyncio
async def test_list_projects_returns_stub(client):
    """GET /api/v2/design/projects — stub returns {available: false}."""
    resp = await client.get("/api/v2/design/projects")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


@pytest.mark.asyncio
async def test_create_project_returns_stub_503(client):
    """POST /api/v2/design/projects — stub returns 503."""
    resp = await client.post("/api/v2/design/projects", json={"name": "Test"})
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


@pytest.mark.asyncio
async def test_get_project_returns_stub(client):
    """GET /api/v2/design/projects/{id} — stub returns {available: false}."""
    resp = await client.get("/api/v2/design/projects/proj-123")
    assert resp.status_code == 200
    _assert_stub_shape(resp.json())


@pytest.mark.asyncio
async def test_update_project_returns_stub_503(client):
    """PUT /api/v2/design/projects/{id} — stub returns 503."""
    resp = await client.put("/api/v2/design/projects/proj-123", json={"name": "Updated"})
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


@pytest.mark.asyncio
async def test_delete_project_returns_stub_503(client):
    """DELETE /api/v2/design/projects/{id} — stub returns 503."""
    resp = await client.delete("/api/v2/design/projects/proj-123")
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


# ---- Upload & video ----

@pytest.mark.asyncio
async def test_upload_returns_stub_503(client):
    """POST /api/v2/design/upload — stub returns 503."""
    resp = await client.post("/api/v2/design/upload")
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


@pytest.mark.asyncio
async def test_video_returns_stub_503(client):
    """POST /api/v2/design/video — stub returns 503."""
    resp = await client.post("/api/v2/design/video", json={"source_image_id": "img-1"})
    assert resp.status_code == 503
    _assert_stub_shape(resp.json(), expect_503=True)


# TODO: builder scaffold
