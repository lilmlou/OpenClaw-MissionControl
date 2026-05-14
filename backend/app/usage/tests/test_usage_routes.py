import pytest
from httpx import ASGITransport, AsyncClient

from app.activity import set_db
from app.activity.emitter import _mem_events
from app.usage import routes
from server import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def reset_usage_bridge():
    set_db(None)
    _mem_events.clear()
    routes._snapshot_emitted = False


class StubResponse:
    status_code = 200

    def json(self):
        return {
            "ok": True,
            "available": True,
            "data": {
                "messages": 2,
                "tokens_in": 100,
                "tokens_out": 50,
                "cost_estimate_usd": 0.0123,
                "start_of_day_ms": 123,
            },
            "fix": [],
            "ts": 456,
        }


class StubAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url):
        self.url = url
        return StubResponse()


@pytest.mark.anyio
async def test_usage_totals_proxies_agent_runtime_and_emits_snapshot(monkeypatch):
    monkeypatch.setattr(routes.httpx, "AsyncClient", StubAsyncClient)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v2/usage/totals")
        activities = await client.get("/api/v2/activities?kind=usage.snapshot&limit=1")

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["available"] is True
    assert data["data"]["messages"] == 2
    assert data["data"]["tokens_in"] == 100
    assert data["data"]["tokens_out"] == 50
    assert data["data"]["cost_estimate_usd"] == 0.0123

    act = activities.json()
    assert act["ok"] is True
    assert act["data"][0]["kind"] == "usage.snapshot"
    assert act["data"][0]["summary"] == "today: 2 messages, 150 tokens, $0.0123"


@pytest.mark.anyio
async def test_usage_proxy_failure_returns_fix_array(monkeypatch):
    class BrokenAsyncClient(StubAsyncClient):
        async def get(self, url):
            raise RuntimeError("gateway down")

    monkeypatch.setattr(routes.httpx, "AsyncClient", BrokenAsyncClient)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v2/usage/totals")

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["available"] is False
    assert data["code"] == "USAGE_PROXY_UNAVAILABLE"
    assert isinstance(data["fix"], list)
    assert data["fix"]


@pytest.mark.anyio
async def test_usage_health_callable_is_exposed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v2/usage/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["available"] is True
    assert data["status"] == "proxied"
    assert data["upstream"].endswith(":7801")
