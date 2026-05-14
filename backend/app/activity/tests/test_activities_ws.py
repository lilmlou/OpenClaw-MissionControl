from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.activity import activity_router, activity_ws_broadcast, activity_ws_router, emit, set_broadcaster, set_db
from app.activity import emitter as activity_emitter


def _build_app() -> FastAPI:
    set_db(None)
    activity_emitter._mem_events.clear()  # type: ignore[attr-defined]
    set_broadcaster(activity_ws_broadcast)
    app = FastAPI()
    app.include_router(activity_router)
    app.include_router(activity_ws_router)

    @app.post("/__test__/emit")
    async def _emit(payload: dict):
        return emit(
            kind=payload.get("kind", "chat.usage"),
            summary=payload.get("summary", "test"),
            detail=payload.get("data") or {},
        )

    return app


def test_get_returns_kind_envelope_without_category():
    app = _build_app()
    client = TestClient(app)
    client.post("/__test__/emit", json={"kind": "chat.usage", "data": {"tokens_in": 1}})
    body = client.get("/api/v2/activities?limit=1&kind=chat.usage").json()
    assert body["ok"] is True
    assert body["data"][0]["kind"] == "chat.usage"
    assert "category" not in body["data"][0]


def test_ws_connect_emit_receives_top_level_kind_frame():
    app = _build_app()
    client = TestClient(app)
    with client.websocket_connect("/api/v2/activities/ws") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "hello"
        client.post("/__test__/emit", json={"kind": "chat.usage", "data": {"tokens_in": 2}})
        frame = ws.receive_json()
        assert frame["type"] == "activity"
        assert frame["kind"] == "chat.usage"
        assert frame["data"]["tokens_in"] == 2
        assert "category" not in frame


def test_limit_and_kind_filter_honoured():
    app = _build_app()
    client = TestClient(app)
    for idx in range(3):
        client.post("/__test__/emit", json={"kind": "chat.usage", "data": {"idx": idx}})
    client.post("/__test__/emit", json={"kind": "config.set", "data": {"key": "x"}})
    body = client.get("/api/v2/activities?limit=2&kind=chat.usage").json()
    assert len(body["data"]) == 2
    assert all(item["kind"] == "chat.usage" for item in body["data"])
