"""HTTP route tests via FastAPI TestClient.

No real Mongo. The store falls back to in-memory writes; routes still exercise
validation, version conflict, redaction, bulk atomicity.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config_bus.bus import bus
from app.config_bus import store as config_store
from app.config_bus.routes import config_router


@pytest.fixture
def client():
    bus._reset_for_tests()
    config_store.set_db(None)
    bus.register_default(
        "models.default.provider",
        "ollama",
        schema={"type": "string", "enum": ["ollama", "openai"], "category": "models"},
    )
    bus.register_default(
        "feature.flags.use_ollama_default",
        True,
        schema={"type": "boolean", "category": "features"},
    )
    bus.register_default(
        "auth.token",
        "real-secret",
        schema={"type": "string", "category": "security"},
        secret=True,
    )
    app = FastAPI()
    app.include_router(config_router)
    yield TestClient(app)
    bus._reset_for_tests()


def test_list_keys(client):
    r = client.get("/api/v2/config")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    keys = {it["_id"] for it in body["data"]["items"]}
    assert "models.default.provider" in keys
    assert "auth.token" in keys


def test_list_keys_redacts_secret(client):
    r = client.get("/api/v2/config")
    items = {it["_id"]: it for it in r.json()["data"]["items"]}
    assert items["auth.token"]["value"] == "***"


def test_get_key(client):
    r = client.get("/api/v2/config/models.default.provider")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["data"]["value"] == "ollama"


def test_get_key_404(client):
    r = client.get("/api/v2/config/nope.nope")
    assert r.status_code == 404
    body = r.json()
    assert body["ok"] is False
    assert body["code"] == "KEY_NOT_FOUND"


def test_put_validates(client):
    r = client.put(
        "/api/v2/config/models.default.provider",
        json={"value": "claude"},  # not in enum
    )
    assert r.status_code == 400
    body = r.json()
    assert body["ok"] is False
    assert body["code"] == "VALIDATION_FAILED"


def test_put_accepts_valid(client):
    r = client.put(
        "/api/v2/config/models.default.provider",
        json={"value": "openai"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["value"] == "openai"
    # Subsequent get reflects the new value
    r2 = client.get("/api/v2/config/models.default.provider")
    assert r2.json()["data"]["value"] == "openai"


def test_put_version_conflict(client):
    r1 = client.put(
        "/api/v2/config/models.default.provider",
        json={"value": "openai"},
    )
    assert r1.json()["data"]["version"] == 1

    # stale version
    r2 = client.put(
        "/api/v2/config/models.default.provider",
        json={"value": "ollama", "expected_version": 0},
    )
    assert r2.status_code == 409
    assert r2.json()["code"] == "VERSION_CONFLICT"


def test_delete_reverts_to_default(client):
    client.put("/api/v2/config/feature.flags.use_ollama_default", json={"value": False})
    r = client.delete("/api/v2/config/feature.flags.use_ollama_default")
    assert r.status_code == 200
    assert r.json()["data"]["deleted"] is True
    # back to registered default
    r2 = client.get("/api/v2/config/feature.flags.use_ollama_default")
    assert r2.json()["data"]["value"] is True


def test_categories(client):
    r = client.get("/api/v2/config/categories")
    assert r.status_code == 200
    cats = {c["category"]: c["count"] for c in r.json()["data"]["categories"]}
    assert cats["models"] == 1
    assert cats["features"] == 1


def test_schema_endpoint(client):
    r = client.get("/api/v2/config/schema/models.default.provider")
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["schema"]["type"] == "string"
    assert body["data"]["schema"]["enum"] == ["ollama", "openai"]


def test_bulk_atomic_failure(client):
    r = client.post(
        "/api/v2/config/bulk",
        json={
            "changes": [
                {"key": "models.default.provider", "value": "openai"},
                {"key": "models.default.provider", "value": "INVALID"},  # second invalid
            ]
        },
    )
    assert r.status_code == 400
    # First change must NOT have been applied
    r2 = client.get("/api/v2/config/models.default.provider")
    assert r2.json()["data"]["value"] == "ollama"


def test_bulk_atomic_success(client):
    r = client.post(
        "/api/v2/config/bulk",
        json={
            "changes": [
                {"key": "models.default.provider", "value": "openai"},
                {"key": "feature.flags.use_ollama_default", "value": False},
            ]
        },
    )
    assert r.status_code == 200
    assert r.json()["data"]["count"] == 2


def test_export_redacts_secret(client):
    r = client.get("/api/v2/config/export")
    assert r.status_code == 200
    snap = r.json()["data"]["snapshot"]
    assert snap["auth.token"]["value"] == "***"


def test_import_applies_snapshot(client):
    r = client.post(
        "/api/v2/config/import",
        json={
            "snapshot": {
                "models.default.provider": "openai",
                "feature.flags.use_ollama_default": {"value": False},
            }
        },
    )
    assert r.status_code == 200
    assert r.json()["data"]["count"] == 2
    r2 = client.get("/api/v2/config/models.default.provider")
    assert r2.json()["data"]["value"] == "openai"


def test_filter_by_category(client):
    r = client.get("/api/v2/config?category=models")
    items = r.json()["data"]["items"]
    assert all((d.get("schema") or {}).get("category") == "models" for d in items)
