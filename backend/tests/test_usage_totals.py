from httpx import ASGITransport, AsyncClient
import pytest

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
                "messages": 1,
                "tokens_in": 312,
                "tokens_out": 187,
                "cost_estimate_usd": 0.0008,
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
        return StubResponse()


@pytest.mark.anyio
async def test_usage_totals_shape_and_snapshot(monkeypatch):
    monkeypatch.setattr(routes.httpx, "AsyncClient", StubAsyncClient)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v2/usage/totals")
        activities = await client.get("/api/v2/activities?kind=usage.snapshot&limit=1")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["available"] is True
    assert payload["data"] == {
        "messages": 1,
        "tokens_in": 312,
        "tokens_out": 187,
        "cost_estimate_usd": 0.0008,
        "start_of_day_ms": 123,
    }
    assert isinstance(payload["fix"], list)
    assert activities.json()["data"][0]["kind"] == "usage.snapshot"
