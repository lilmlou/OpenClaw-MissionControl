"""Dispatch lifecycle tests — pure in-memory, no Mongo, no real subprocess for kill.

Covers the F7 §3 paths the supervisor will check:
  - dispatch creates a run with git base ref capture (when in a repo)
  - record_event fans out to WS
  - complete_run flips to claims_done and computes diff fields
  - verify_run runs synthesized commands and flips run status
  - kill_run marks status=killed and emits a `killed` event
"""
from __future__ import annotations

import asyncio
import json
import signal
import subprocess
import sys
from typing import Any, Dict, List

import pytest

from app.agents import dispatch, store
from app.agents import ws as agents_ws


@pytest.fixture(autouse=True)
async def _clean():
    store.reset_for_tests()
    await dispatch._reset_processes_for_tests()
    # capture WS broadcasts via a subscriber list
    received: List[Dict[str, Any]] = []
    orig = agents_ws.broadcast

    async def _capture(msg: Dict[str, Any]) -> None:
        received.append(msg)
        await orig(msg)

    # monkeypatch dispatch's broadcast reference
    dispatch.ws_broadcast = _capture  # type: ignore[assignment]
    yield received
    dispatch.ws_broadcast = orig  # type: ignore[assignment]
    store.reset_for_tests()
    await dispatch._reset_processes_for_tests()


@pytest.mark.asyncio
async def test_dispatch_creates_running_run(_clean, tmp_path):
    received = _clean
    run = await dispatch.dispatch_run(
        agent_id="agent-x",
        handoff_doc="nonexistent.md",
        repo_root=str(tmp_path),  # not a git repo → base_ref None, fine
    )
    assert run["status"] == "running"
    assert run["agent_id"] == "agent-x"
    assert run["id"].startswith("run_")
    fetched = await store.get_run(run["id"])
    assert fetched is not None
    # Activity broadcast happened
    assert any(m.get("type") == "agent.run.status" for m in received)


@pytest.mark.asyncio
async def test_record_event_fans_out_ws(_clean, tmp_path):
    received = _clean
    run = await dispatch.dispatch_run(
        agent_id="a",
        handoff_doc="x.md",
        repo_root=str(tmp_path),
    )
    received.clear()
    ev = await dispatch.record_event(run["id"], kind="file_write", summary="wrote foo.py")
    assert ev["kind"] == "file_write"
    assert any(m.get("type") == "agent.event" for m in received)
    rows = await store.list_events(run["id"])
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_complete_run_flips_to_claims_done(_clean, tmp_path):
    run = await dispatch.dispatch_run(
        agent_id="a",
        handoff_doc="x.md",
        repo_root=str(tmp_path),
    )
    new = await dispatch.complete_run(run["id"])
    assert new is not None
    assert new["status"] == "claims_done"
    # ended_ts set
    assert new["ended_ts"] is not None


@pytest.mark.asyncio
async def test_kill_marks_killed(_clean, tmp_path):
    run = await dispatch.dispatch_run(
        agent_id="a",
        handoff_doc="x.md",
        repo_root=str(tmp_path),
    )
    res = await dispatch.kill_run(run["id"])
    assert res["ok"] is True
    fetched = await store.get_run(run["id"])
    assert fetched is not None
    assert fetched["status"] == "killed"
    events = await store.list_events(run["id"])
    assert any(e["kind"] == "killed" for e in events)

@pytest.mark.asyncio
async def test_kill_escalates_default_sigterm_to_sigkill(_clean, tmp_path):
    proc = subprocess.Popen(
        [
            sys.executable,
            "-c",
            "import signal, time; signal.signal(signal.SIGTERM, lambda *_: None); print('ready', flush=True); time.sleep(30)",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    try:
        assert proc.stdout is not None
        assert proc.stdout.readline().strip() == "ready"
        run = await dispatch.dispatch_run(
            agent_id="a",
            handoff_doc="x.md",
            repo_root=str(tmp_path),
            process=proc,
        )
        started = asyncio.get_running_loop().time()
        res = await dispatch.kill_run(run["id"])
        elapsed = asyncio.get_running_loop().time() - started
        assert res["ok"] is True
        assert res["data"]["signalled"] is True
        assert 4.8 <= elapsed < 7.5
        assert proc.returncode == -signal.SIGKILL
        fetched = await store.get_run(run["id"])
        assert fetched is not None
        assert fetched["status"] == "killed"
        events = await store.list_events(run["id"])
        assert any(e["kind"] == "killed" and e["detail"].get("signalled") for e in events)
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=2)


@pytest.mark.asyncio
async def test_verify_with_passing_check_marks_verified(_clean, tmp_path, monkeypatch):
    run = await dispatch.dispatch_run(
        agent_id="a",
        handoff_doc="x.md",
        repo_root=str(tmp_path),
    )
    # inject a single passing check
    await store.insert_checks(run["id"], [
        {"label": "always passes", "command": "true", "status": "pending"},
    ])
    # mark run already at claims_done so verify can promote
    await dispatch.complete_run(run["id"])
    res = await dispatch.verify_run(run["id"])
    assert res["ok"] is True
    assert res["data"]["passed"] == 1
    assert res["data"]["status"] == "verified"


@pytest.mark.asyncio
async def test_verify_with_failing_check_stays_claims_done(_clean, tmp_path):
    run = await dispatch.dispatch_run(
        agent_id="a",
        handoff_doc="x.md",
        repo_root=str(tmp_path),
    )
    await store.insert_checks(run["id"], [
        {"label": "always fails", "command": "false", "status": "pending"},
    ])
    await dispatch.complete_run(run["id"])
    res = await dispatch.verify_run(run["id"])
    assert res["ok"] is True
    assert res["data"]["passed"] == 0
    # F7 §3.4: failed checks keep an agent self-report at claims_done;
    # they do not promote to verified, and the failing check row carries detail.
    assert res["data"]["status"] == "claims_done"


@pytest.mark.asyncio
async def test_verify_with_pending_bullets_stays_claims_done(_clean, tmp_path):
    """If any bullet has no synthesized command, run cannot reach verified."""
    run = await dispatch.dispatch_run(
        agent_id="a",
        handoff_doc="x.md",
        repo_root=str(tmp_path),
    )
    await store.insert_checks(run["id"], [
        {"label": "passes", "command": "true", "status": "pending"},
        {"label": "manual only — no command", "command": None, "status": "pending"},
    ])
    await dispatch.complete_run(run["id"])
    res = await dispatch.verify_run(run["id"])
    assert res["ok"] is True
    assert res["data"]["status"] == "claims_done"
    assert res["data"]["passed"] == 1
    assert res["data"]["total"] == 2


@pytest.mark.asyncio
async def test_verify_runs_commands_from_repo_root(_clean, tmp_path):
    run = await dispatch.dispatch_run(
        agent_id="a",
        handoff_doc="x.md",
        repo_root=str(tmp_path),
    )
    marker = tmp_path / "repo_marker.txt"
    marker.write_text("ok", encoding="utf-8")
    await store.insert_checks(run["id"], [
        {
            "label": "repo-local command",
            "command": f"'{sys.executable}' -c 'import os; from pathlib import Path; raise SystemExit(0 if Path(os.getcwd(), \"repo_marker.txt\").exists() else 7)'",
            "expected": None,
            "actual": None,
            "ran_ts": None,
            "status": "pending",
        },
    ])
    await dispatch.complete_run(run["id"])
    res = await dispatch.verify_run(run["id"])
    checks = await store.list_checks(run["id"])
    assert res["ok"] is True
    assert checks[0]["actual"] == ""
    assert res["data"] == {
        "run_id": run["id"],
        "status": "verified",
        "passed": 1,
        "total": 1,
        "auto_runnable": 1,
    }

