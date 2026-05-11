from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.blockers import store
from app.blockers.parser import parse_blockers_md, parse_blockers_text
from app.blockers.routes import blockers_router
from app.config_bus.bus import bus
from app.config_bus import store as config_store


def sample(path: str = "/tmp/BLOCKERS.md") -> str:
    return """# Blockers

## 2026-05-11 09:00 — TEST BLOCKER ACCEPTANCE

**Severity:** medium
Run ae450dfc3174 hit a fake issue.

## 2026-05-11 09:05 — CLOSED SAMPLE

Severity: low
Already fixed.
### Closure 2026-05-11 09:10 — dismissed via UI
"""


def test_parse_empty_file(tmp_path):
    p = tmp_path / "BLOCKERS.md"
    p.write_text("# none\n", encoding="utf-8")
    assert parse_blockers_md(str(p)) == []


def test_parse_single_open_entry():
    docs = parse_blockers_text(sample(), "/tmp/BLOCKERS.md")
    doc = docs[0]
    assert doc["title"] == "TEST BLOCKER ACCEPTANCE"
    assert doc["severity"] == "medium"
    assert doc["status"] == "open"
    assert len(doc["id"]) == 16


def test_parse_closed_entry():
    docs = parse_blockers_text(sample(), "/tmp/BLOCKERS.md")
    assert docs[1]["status"] == "closed"
    assert docs[1]["closed_ts"] is not None


def test_parse_severity_extraction_defaults_high():
    docs = parse_blockers_text("## 2026-05-11 09:00 — NO SEV\nbody\n", "/tmp/BLOCKERS.md")
    assert docs[0]["severity"] == "high"
    assert parse_blockers_text(sample(), "/tmp/BLOCKERS.md")[1]["severity"] == "low"


def test_parse_stable_id():
    a = parse_blockers_text(sample(), "/tmp/BLOCKERS.md")[0]["id"]
    b = parse_blockers_text(sample() + "\nextra typo\n", "/tmp/BLOCKERS.md")[0]["id"]
    assert a == b


def test_parse_related_run_id_and_suggested_actions():
    doc = parse_blockers_text(sample(), "/tmp/BLOCKERS.md")[0]
    assert doc["related_run_id"] == "ae450dfc3174"
    assert len(doc["suggested_actions"]) >= 1


def test_upsert_idempotent():
    store.reset_for_tests()
    docs = parse_blockers_text(sample(), "/tmp/BLOCKERS.md")
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=1))
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=2))
    out = asyncio.get_event_loop().run_until_complete(store.list_blockers(status="all"))
    assert out["total"] == 2


def test_dismiss_flips_status():
    store.reset_for_tests()
    docs = parse_blockers_text(sample(), "/tmp/BLOCKERS.md")
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=1))
    updated = asyncio.get_event_loop().run_until_complete(store.close_one(docs[0]["id"], closed_ts=123))
    assert updated["status"] == "closed"
    assert updated["closed_ts"] == 123


def test_routes_list_get_count_and_dismiss(tmp_path):
    store.reset_for_tests()
    bus._reset_for_tests()
    config_store.set_db(None)
    p = tmp_path / "BLOCKERS.md"
    p.write_text(sample(str(p)), encoding="utf-8")
    docs = parse_blockers_md(str(p))
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=1))

    app = FastAPI()
    app.include_router(blockers_router)
    with TestClient(app) as client:
        listed = client.get("/api/v2/blockers?status=all").json()
        assert listed["ok"] is True
        assert listed["available"] is True
        assert listed["data"]["total"] == 2
        bid = docs[0]["id"]
        assert client.get(f"/api/v2/blockers/{bid}").json()["data"]["status"] == "open"
        assert client.get("/api/v2/blockers/count").json()["data"]["count_open"] >= 1
        dismissed = client.post(f"/api/v2/blockers/{bid}/dismiss", json={"note": "test cleanup"}).json()
        assert dismissed["data"]["status"] == "closed"
        assert "Closure" in p.read_text(encoding="utf-8")


def test_unknown_blocker_returns_fix_array():
    store.reset_for_tests()
    app = FastAPI()
    app.include_router(blockers_router)
    with TestClient(app) as client:
        body = client.get("/api/v2/blockers/nope").json()
        assert body["ok"] is False
        assert body["available"] is False
        assert isinstance(body["fix"], list)


def test_config_bus_defaults_registered():
    from app.blockers import mirror
    bus._reset_for_tests()
    mirror.register_defaults()
    assert bus.get("blockers.file_path").endswith("BLOCKERS.md")
    assert bus.get("cron.blockers_mirror.interval_seconds") == 300


def test_activity_route_lists_events():
    from app.activity import emit, set_db
    from app.activity.routes import activity_router

    set_db(None)
    emit(kind="blockers.scan", summary="test scan", severity="info")
    app = FastAPI()
    app.include_router(activity_router)
    with TestClient(app) as client:
        body = client.get("/api/v2/activities?kind=blockers.scan&limit=1").json()
        assert body["ok"] is True
        assert body["available"] is True
        assert body["data"][0]["kind"] == "blockers.scan"
