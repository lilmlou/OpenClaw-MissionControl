from __future__ import annotations

import asyncio
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config_bus.bus import bus
from app.config_bus import store as config_store
from app.progress import store
from app.progress.parser import parse_progress_md, parse_progress_text
from app.progress.routes import progress_router


def sample() -> str:
    return """# Progress

## 2026-05-11

### F7 Agent Live View — VERIFIED

**Repo:** /Volumes/🦋• Drive   1/MC/AgentRuntime
**Cron run:** dc8edb86bad1 / 2026-05-11 10:00

Backend acceptance passed.

### Frontend Banner — claims_done

**Repo:** /tmp/frontend
**Cron run:** aabbccddeeff

Needs supervisor promotion.

## 2026-05-12

### Bad Report — DECEPTIVE

**Repo:** /tmp/backend
**Cron run:** 112233445566

Claimed verified without proof.

### Active Work — in_flight

**Repo:** /tmp/backend

Currently running.
"""


def test_parse_empty_file(tmp_path):
    p = tmp_path / "PROGRESS.md"
    p.write_text("# no entries\n", encoding="utf-8")
    assert parse_progress_md(str(p)) == []


def test_parse_single_verified_entry():
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    doc = docs[0]
    assert doc["name"] == "F7 Agent Live View"
    assert doc["status"] == "verified"
    assert doc["date_str"] == "2026-05-11"
    assert doc["date_ts"] == 1778457600000
    assert len(doc["id"]) == 16


def test_parse_claims_done_entry():
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    assert docs[1]["status"] == "claims_done"


def test_parse_deceptive_entry():
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    assert docs[2]["status"] == "deceptive"
    assert docs[2]["suggested_actions"]


def test_parse_status_unknown_fallback():
    text = """## 2026-05-11\n\n### Weird Thing — DONEISH\n\nbody\n"""
    docs = parse_progress_text(text, "/tmp/PROGRESS.md")
    assert docs[0]["status"] == "unknown"


def test_parse_stable_id():
    first = parse_progress_text(sample(), "/tmp/PROGRESS.md")[0]["id"]
    second = parse_progress_text(sample().replace("Backend acceptance passed.", "Changed body."), "/tmp/PROGRESS.md")[0]["id"]
    assert first == second


def test_parse_cron_run_id():
    doc = parse_progress_text(sample(), "/tmp/PROGRESS.md")[0]
    assert doc["cron_run_id"] == "dc8edb86bad1"
    assert doc["repo_path"].endswith("AgentRuntime")


def test_upsert_idempotent():
    store.reset_for_tests()
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=1))
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=2))
    out = asyncio.get_event_loop().run_until_complete(store.list_progress(status="all"))
    assert out["total"] == 4
    assert out["counts"]["verified"] == 1


def test_seen_flips_field():
    store.reset_for_tests()
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=1))
    updated = asyncio.get_event_loop().run_until_complete(store.mark_seen(docs[0]["id"]))
    assert updated["seen"] is True


def test_ws_broadcast_on_new_entry(monkeypatch, tmp_path):
    from app.progress import mirror

    store.reset_for_tests()
    bus._reset_for_tests()
    config_store.set_db(None)
    mirror.register_defaults()
    p = tmp_path / "PROGRESS.md"
    p.write_text(sample(), encoding="utf-8")
    asyncio.get_event_loop().run_until_complete(bus.set("progress.file_path", str(p), actor="test"))

    sent = []

    async def fake_broadcast(event):
        sent.append(event)

    monkeypatch.setattr(mirror, "ws_broadcast", fake_broadcast)
    asyncio.get_event_loop().run_until_complete(mirror.scan_once())
    assert any(event["type"] == "progress.entry.added" for event in sent)
    assert any(event["type"] == "progress.scan" for event in sent)


def test_config_bus_interval_reload(monkeypatch):
    from app.progress import mirror

    bus._reset_for_tests()
    config_store.set_db(None)
    mirror.register_defaults()
    bus.on("cron.progress_mirror.interval_seconds")(mirror._interval_changed)
    emitted = []
    monkeypatch.setattr(mirror, "activity_emit", lambda **kwargs: emitted.append(kwargs))
    asyncio.get_event_loop().run_until_complete(bus.set("cron.progress_mirror.interval_seconds", 60, actor="test"))
    assert any(e["kind"] == "progress.config.reloaded" for e in emitted)


def test_counts_endpoint_aggregates_correctly():
    store.reset_for_tests()
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=123))
    app = FastAPI()
    app.include_router(progress_router)
    with TestClient(app) as client:
        body = client.get("/api/v2/progress/counts").json()
        assert body["ok"] is True
        assert body["available"] is True
        assert body["data"]["verified"] == 1
        assert body["data"]["claims_done"] == 1
        assert body["data"]["deceptive"] == 1
        assert body["data"]["in_flight"] == 1
        assert body["data"]["unseen_total"] == 4


def test_routes_list_get_and_seen():
    store.reset_for_tests()
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=123))
    app = FastAPI()
    app.include_router(progress_router)
    with TestClient(app) as client:
        listed = client.get("/api/v2/progress?limit=2").json()
        assert listed["ok"] is True
        assert len(listed["data"]["items"]) == 2
        pid = docs[0]["id"]
        assert client.get(f"/api/v2/progress/{pid}").json()["data"]["id"] == pid
        seen = client.post(f"/api/v2/progress/{pid}/seen").json()
        assert seen["ok"] is True
        assert seen["data"]["seen"] is True


def test_unknown_entry_returns_fix_array():
    store.reset_for_tests()
    app = FastAPI()
    app.include_router(progress_router)
    with TestClient(app) as client:
        body = client.get("/api/v2/progress/nope").json()
        assert body["ok"] is False
        assert body["available"] is False
        assert isinstance(body["fix"], list)


def test_replay_provider_nonempty_after_scan():
    from app.progress import mirror

    store.reset_for_tests()
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    asyncio.get_event_loop().run_until_complete(store.upsert_many(docs, scanned_ts=123))
    replay = asyncio.get_event_loop().run_until_complete(mirror.get_last_replay())
    assert replay["type"] == "progress.replay"
    assert replay["data"]["items"]
    assert replay["data"]["counts"]["verified"] == 1


def test_payloads_do_not_emit_done_status_literal():
    docs = parse_progress_text(sample(), "/tmp/PROGRESS.md")
    assert "\"done\"" not in json.dumps(docs)


def test_progress_health_reports_stopped_when_loop_task_is_done():
    from app.progress import mirror

    class FinishedTask:
        def done(self):
            return True

        def cancelled(self):
            return False

    old_task = mirror._task
    mirror._task = FinishedTask()
    try:
        assert mirror.health()["status"] == "stopped"
    finally:
        mirror._task = old_task
