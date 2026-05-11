"""Tests for /api/v2/logs/tail endpoint.

Contract: PHASE_0_3_BINDING_LAYER.md §3.

These are placeholder tests that verify the stub returns the expected
{available: false} payload until the log-shipper ships.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from server import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_tail_returns_available_false():
    """Stub endpoint should return {available: false} per Phase 0.3 §3."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v2/logs/tail", params={"file": "/tmp/test.log", "lines": 50})
    assert resp.status_code == 200
    data = resp.json()
    assert data["available"] is False
    assert "error" in data


@pytest.mark.anyio
async def test_tail_requires_file_param():
    """Endpoint requires the file query parameter."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v2/logs/tail")
    # FastAPI returns 422 for missing required query param
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_tail_respects_lines_param():
    """Lines parameter is echoed back in response."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v2/logs/tail", params={"file": "/tmp/test.log", "lines": 200})
    assert resp.status_code == 200
    data = resp.json()
    assert data["lines"] == 200
    assert data["file"] == "/tmp/test.log"


# TODO: builder scaffold
