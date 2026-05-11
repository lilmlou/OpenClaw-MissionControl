"""Store tests — in-memory fallback (no Mongo required)."""
from __future__ import annotations

import pytest

from app.agents import store


@pytest.fixture(autouse=True)
def _clean_store():
    store.reset_for_tests()
    yield
    store.reset_for_tests()


@pytest.mark.asyncio
async def test_insert_and_get_run():
    rid = store.new_run_id()
    run = await store.insert_run({
        "id": rid,
        "agent_id": "test",
        "handoff_doc": "X.md",
        "dispatched_ts": store.now_ms(),
        "status": "running",
    })
    fetched = await store.get_run(rid)
    assert fetched is not None
    assert fetched["agent_id"] == "test"


@pytest.mark.asyncio
async def test_update_run_merges_fields():
    rid = store.new_run_id()
    await store.insert_run({"id": rid, "status": "running", "dispatched_ts": 1})
    new = await store.update_run(rid, {"status": "claims_done", "diff_added": 12})
    assert new is not None
    assert new["status"] == "claims_done"
    assert new["diff_added"] == 12


@pytest.mark.asyncio
async def test_list_runs_filters_by_status():
    await store.insert_run({"id": "r1", "status": "running", "dispatched_ts": 1})
    await store.insert_run({"id": "r2", "status": "verified", "dispatched_ts": 2})
    await store.insert_run({"id": "r3", "status": "running", "dispatched_ts": 3})
    runs = await store.list_runs(status="running")
    ids = [r["id"] for r in runs]
    assert "r1" in ids and "r3" in ids
    assert "r2" not in ids


@pytest.mark.asyncio
async def test_events_round_trip_and_since_filter():
    await store.insert_event({"id": "e1", "run_id": "r", "ts": 100, "kind": "log", "summary": "a"})
    await store.insert_event({"id": "e2", "run_id": "r", "ts": 200, "kind": "log", "summary": "b"})
    await store.insert_event({"id": "e3", "run_id": "r", "ts": 300, "kind": "log", "summary": "c"})
    later = await store.list_events("r", since_ts=150)
    assert [e["id"] for e in later] == ["e2", "e3"]


@pytest.mark.asyncio
async def test_checks_insert_and_update():
    inserted = await store.insert_checks("r", [
        {"label": "x", "command": "true", "status": "pending"},
        {"label": "y", "command": None, "status": "pending"},
    ])
    assert len(inserted) == 2
    assert all("id" in c for c in inserted)

    chk_id = inserted[0]["id"]
    updated = await store.update_check(chk_id, {"status": "pass", "actual": "ok"})
    assert updated is not None
    assert updated["status"] == "pass"

    rows = await store.list_checks("r")
    assert len(rows) == 2
