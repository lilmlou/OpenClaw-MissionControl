import pytest
from httpx import ASGITransport, AsyncClient

from server import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
@pytest.mark.parametrize("path", ["/refresh", "/groups", "/resolve"])
async def test_models_stubs_return_self_healing_available_false(path):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(f"/api/v2/models{path}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["available"] is False
    assert data["error"] == "not_implemented"
    assert data["code"] == "NOT_IMPLEMENTED"
    assert data["models"] == []
    assert isinstance(data["fix"], list)
    assert data["fix"]


@pytest.mark.anyio
async def test_models_health_callable_is_exposed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v2/models/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["available"] is True
    assert data["status"] == "degraded"
    assert isinstance(data["fix"], list)
