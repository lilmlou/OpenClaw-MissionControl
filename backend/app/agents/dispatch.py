"""F7 dispatch — agent run lifecycle + git diff + verify + kill.

Per F7_AGENT_LIVE_VIEW.md §3.1–§3.6.

Public surface:

    dispatch_run(...)        → register a new agent_run (status=running)
    record_event(...)        → append agent_events row + WS fan-out
    complete_run(...)        → transition running → claims_done + diff
    fail_run(...)            → mark failed
    kill_run(...)            → SIGTERM/SIGKILL the registered process
    verify_run(...)          → run acceptance commands, flip to verified

Process tracking is in-memory (`_processes`). Restarting the backend loses
ability to kill in-flight runs (F7 is single-host, §6 out-of-scope), but
already-persisted run + event rows survive.

No `os.environ.get(...)` reads — all tuneables go through the bus.
"""
from __future__ import annotations

import asyncio
import logging
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.activity import emitter as activity
from app.config_bus.bus import bus
from app.config_bus.ws import broadcast as config_ws_broadcast

from . import parser as parser_mod
from . import store
from .ws import broadcast as ws_broadcast


log = logging.getLogger(__name__)

# run_id → (process handle | None, repo_root)
_processes: Dict[str, Tuple[Optional[subprocess.Popen], Optional[str]]] = {}
_proc_lock = asyncio.Lock()


# ── helpers ───────────────────────────────────────────────────────────────


def _now_ms() -> int:
    return int(time.time() * 1000)


def _git_head_sha(repo_root: Optional[str]) -> Optional[str]:
    """Capture HEAD SHA at dispatch. Returns None if not a git repo."""
    cwd = repo_root or os.getcwd()
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if out.returncode == 0:
            return out.stdout.strip() or None
    except Exception as exc:  # noqa: BLE001
        log.debug("git head failed: %s", exc)
    return None


def _git_diff(repo_root: str, base: str) -> Tuple[List[str], int, int]:
    """Compute file list + add/remove counts vs `base`.

    Per §3.2: if repo dirty, diff base..working_tree.
    Returns ([files], added, removed). On failure → ([], 0, 0).
    """
    files: List[str] = []
    added = 0
    removed = 0
    try:
        # files (commit + worktree); `git diff --name-only $base` covers both
        out = subprocess.run(
            ["git", "diff", "--name-only", base],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if out.returncode == 0:
            files = [ln.strip() for ln in out.stdout.splitlines() if ln.strip()]
        out2 = subprocess.run(
            ["git", "diff", "--shortstat", base],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if out2.returncode == 0:
            # e.g. " 4 files changed, 47 insertions(+), 3 deletions(-)"
            import re
            m = re.search(r"(\d+) insertion", out2.stdout)
            if m:
                added = int(m.group(1))
            m = re.search(r"(\d+) deletion", out2.stdout)
            if m:
                removed = int(m.group(1))
    except Exception as exc:  # noqa: BLE001
        log.warning("git diff failed: %s", exc)
    return files, added, removed


def _diff_text(repo_root: str, base: str) -> str:
    try:
        out = subprocess.run(
            ["git", "diff", base],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if out.returncode == 0:
            return out.stdout
    except Exception as exc:  # noqa: BLE001
        log.warning("git diff text failed: %s", exc)
    return ""


# ── lifecycle ─────────────────────────────────────────────────────────────


async def dispatch_run(
    *,
    agent_id: str,
    handoff_doc: str,
    wave: Optional[str] = None,
    phase_id: Optional[str] = None,
    repo_root: Optional[str] = None,
    process: Optional[subprocess.Popen] = None,
    actor: str = "system",
    base_url: str = "http://127.0.0.1:8765",
) -> Dict[str, Any]:
    """Register a new run, parse acceptance, emit activity event.

    Caller is responsible for spawning `process`; if provided, kill_run can
    SIGTERM it. Without a process handle, kill_run will mark status=killed but
    can't actually signal anything.
    """
    run_id = store.new_run_id()
    head = _git_head_sha(repo_root)
    run = {
        "id": run_id,
        "agent_id": agent_id,
        "handoff_doc": handoff_doc,
        "wave": wave,
        "phase_id": phase_id,
        "dispatched_ts": _now_ms(),
        "started_ts": _now_ms(),
        "ended_ts": None,
        "status": "running",
        "git_base_ref": head,
        "files_touched": [],
        "diff_added": 0,
        "diff_removed": 0,
        "acceptance_total": 0,
        "acceptance_passed": 0,
        "kill_switch_url": f"/api/v2/agents/runs/{run_id}/kill",
        "repo_root": repo_root,
    }
    await store.insert_run(run)

    # Track process for kill switch
    async with _proc_lock:
        _processes[run_id] = (process, repo_root)

    # Parse acceptance bullets from handoff doc
    search_root = bus.get("agents.handoffs.search_root", "")
    text = parser_mod.load_handoff(handoff_doc, search_root) if search_root else None
    if text:
        parsed = parser_mod.parse_handoff(text, base_url=base_url)
        await store.insert_checks(run_id, parsed)
        run["acceptance_total"] = len(parsed)
        await store.update_run(run_id, {"acceptance_total": len(parsed)})

    # Activity event (Principle 1.7)
    activity.emit(
        kind="agent.run.started",
        actor=actor,
        subject=run_id,
        summary=f"agent {agent_id} started ({handoff_doc})",
        detail={
            "run_id": run_id,
            "agent_id": agent_id,
            "handoff_doc": handoff_doc,
            "git_base_ref": head,
        },
    )
    # WS broadcast (Principle 1.6)
    await ws_broadcast({
        "type": "agent.run.status",
        "run_id": run_id,
        "status": "running",
        "diff": {"files": 0, "added": 0, "removed": 0},
        "acceptance": {"passed": 0, "total": run["acceptance_total"]},
    })
    await _broadcast_config_update(
        run_id,
        status="running",
        diff={"files": 0, "added": 0, "removed": 0},
        acceptance={"passed": 0, "total": run["acceptance_total"]},
        reason="started",
    )
    return run


async def _broadcast_config_update(
    run_id: str,
    *,
    status: Optional[str] = None,
    event: Optional[Dict[str, Any]] = None,
    acceptance: Optional[Dict[str, Any]] = None,
    diff: Optional[Dict[str, Any]] = None,
    reason: str = "updated",
) -> None:
    """Fan out F7 updates on the shared Phase 0.1 config WS bus.

    Keep `/api/ws/agents` for compatibility, but every agent mutation also
    emits `agent.run.updated` on `/api/ws/config` so the Phase 0 singleton bus
    remains the one realtime channel frontend consumers must subscribe to.
    """
    payload: Dict[str, Any] = {"type": "agent.run.updated", "run_id": run_id, "reason": reason, "ts": _now_ms()}
    if status is not None:
        payload["status"] = status
    if event is not None:
        payload["event"] = event
    if acceptance is not None:
        payload["acceptance"] = acceptance
    if diff is not None:
        payload["diff"] = diff
    await config_ws_broadcast(payload)


async def record_event(
    run_id: str,
    *,
    kind: str,
    summary: str,
    detail: Optional[Dict[str, Any]] = None,
    duration_ms: Optional[int] = None,
) -> Dict[str, Any]:
    """Append an event and fan out to WS.

    `kind` ∈ {tool_call, file_write, shell, http, log, error, complete, killed}
    """
    event = {
        "id": store.new_event_id(),
        "run_id": run_id,
        "ts": _now_ms(),
        "kind": kind,
        "summary": summary,
        "detail": detail or {},
        "duration_ms": duration_ms,
    }
    await store.insert_event(event)
    await ws_broadcast({"type": "agent.event", "run_id": run_id, "event": event})
    await _broadcast_config_update(run_id, event=event, reason="event")
    run = await store.get_run(run_id)
    activity.emit(
        kind="agent.event.recorded",
        actor=f"agent:{run.get('agent_id')}" if run and run.get("agent_id") else "system",
        subject=run_id,
        summary=f"{kind}: {summary[:160]}",
        severity="error" if kind == "error" else "info",
        detail={"run_id": run_id, "event_kind": kind, "event_id": event["id"]},
        fix=([{"label": "Open run detail", "action": "agents.open_run", "args": {"run_id": run_id}}] if kind == "error" else []),
    )
    return event


async def _emit_status(run_id: str, status: str) -> None:
    run = await store.get_run(run_id) or {}
    checks = await store.list_checks(run_id)
    passed = sum(1 for c in checks if c.get("status") == "pass")
    diff = {
        "files": len(run.get("files_touched") or []),
        "added": int(run.get("diff_added", 0)),
        "removed": int(run.get("diff_removed", 0)),
    }
    acceptance = {"passed": passed, "total": len(checks)}
    await ws_broadcast({
        "type": "agent.run.status",
        "run_id": run_id,
        "status": status,
        "diff": diff,
        "acceptance": acceptance,
    })
    await _broadcast_config_update(run_id, status=status, diff=diff, acceptance=acceptance, reason="status")


async def complete_run(run_id: str, *, actor: str = "system") -> Optional[Dict[str, Any]]:
    """Agent self-reported done. Compute diff, flip to claims_done."""
    run = await store.get_run(run_id)
    if not run:
        return None
    repo = run.get("repo_root") or os.getcwd()
    base = run.get("git_base_ref")
    files, added, removed = ([], 0, 0)
    if base:
        files, added, removed = _git_diff(repo, base)
    fields = {
        "status": "claims_done",
        "ended_ts": _now_ms(),
        "files_touched": files,
        "diff_added": added,
        "diff_removed": removed,
    }
    new_run = await store.update_run(run_id, fields)
    await record_event(run_id, kind="complete", summary="agent reported task.complete")
    activity.emit(
        kind="agent.run.claims_done",
        actor=actor,
        subject=run_id,
        summary=f"run {run_id} claims_done — {len(files)} files +{added}/-{removed}",
        detail={"run_id": run_id, "files": len(files), "added": added, "removed": removed},
    )
    await _emit_status(run_id, "claims_done")
    return new_run


async def fail_run(
    run_id: str,
    *,
    error: str,
    actor: str = "system",
) -> Optional[Dict[str, Any]]:
    fields = {"status": "failed", "ended_ts": _now_ms()}
    new_run = await store.update_run(run_id, fields)
    await record_event(run_id, kind="error", summary=error[:200], detail={"error": error})
    activity.emit(
        kind="agent.run.failed",
        actor=actor,
        subject=run_id,
        summary=f"run {run_id} failed: {error[:120]}",
        severity="error",
        fix=[
            {
                "label": "Re-dispatch agent",
                "action": "agents.redispatch",
                "args": {"run_id": run_id},
            },
            {
                "label": "View run detail",
                "action": "agents.open_run",
                "args": {"run_id": run_id},
            },
        ],
    )
    await _emit_status(run_id, "failed")
    return new_run


async def kill_run(run_id: str, *, actor: str = "user:meg") -> Dict[str, Any]:
    """SIGTERM the agent process. After bus-configured seconds, SIGKILL."""
    run = await store.get_run(run_id)
    if not run:
        return {"ok": False, "error": "run_not_found", "code": "RUN_NOT_FOUND"}

    async with _proc_lock:
        proc, _repo = _processes.get(run_id, (None, None))

    escalate_s = int(bus.get("agents.kill.escalation_seconds", 5))
    killed = False
    if proc is not None:
        try:
            proc.terminate()
            try:
                proc.wait(timeout=escalate_s)
                killed = True
            except subprocess.TimeoutExpired:
                proc.kill()
                try:
                    proc.wait(timeout=2)
                except Exception:  # noqa: BLE001
                    pass
                killed = True
        except Exception as exc:  # noqa: BLE001
            log.warning("kill failed: %s", exc)

    fields = {"status": "killed", "ended_ts": _now_ms()}
    await store.update_run(run_id, fields)
    await record_event(
        run_id,
        kind="killed",
        summary=f"kill switch ({'signalled' if killed else 'no proc handle'})",
        detail={"signalled": killed},
    )
    activity.emit(
        kind="agent.run.killed",
        actor=actor,
        subject=run_id,
        summary=f"run {run_id} killed by {actor}",
        severity="warn",
    )
    await _emit_status(run_id, "killed")
    return {"ok": True, "data": {"run_id": run_id, "signalled": killed}}


async def _run_command(cmd: str, *, timeout: int, cwd: Optional[str] = None) -> Dict[str, Any]:
    """Run a shell command, capture output. Bounded by timeout."""
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            text = (stdout or b"").decode("utf-8", errors="replace")
            return {"rc": proc.returncode, "output": text[-4000:]}
        except asyncio.TimeoutError:
            try:
                proc.kill()
                await proc.communicate()
            except Exception:  # noqa: BLE001
                pass
            return {"rc": -1, "output": "TIMEOUT"}
    except Exception as exc:  # noqa: BLE001
        return {"rc": -1, "output": f"EXEC_ERROR: {exc}"}


async def verify_run(run_id: str, *, actor: str = "user:meg") -> Dict[str, Any]:
    """Run every acceptance command, update each check, flip run status."""
    run = await store.get_run(run_id)
    if not run:
        return {"ok": False, "error": "run_not_found", "code": "RUN_NOT_FOUND"}

    timeout = int(bus.get("agents.acceptance.timeout_seconds", 60))
    repo_root = run.get("repo_root")
    cwd = str(repo_root) if repo_root and Path(str(repo_root)).exists() else None
    checks = await store.list_checks(run_id)
    passed = 0
    total = len(checks)
    auto_runnable = 0

    for chk in checks:
        cmd = chk.get("command")
        if not cmd:
            # leave as pending — manual mark required
            continue
        auto_runnable += 1
        res = await _run_command(cmd, timeout=timeout, cwd=cwd)
        status = "pass" if res["rc"] == 0 else "fail"
        if status == "pass":
            passed += 1
        await store.update_check(
            chk["id"],
            {
                "actual": res["output"],
                "status": status,
                "ran_ts": _now_ms(),
            },
        )
        await record_event(
            run_id,
            kind="acceptance",
            summary=f"{status}: {chk['label'][:80]}",
            detail={"check_id": chk["id"], "rc": res["rc"]},
        )
        activity.emit(
            kind="agent.acceptance.checked",
            actor=actor,
            subject=run_id,
            summary=f"{status}: {chk['label'][:120]}",
            severity="info" if status == "pass" else "warn",
            detail={"run_id": run_id, "check_id": chk["id"], "rc": res["rc"], "actual": res["output"][-1000:]},
            fix=([] if status == "pass" else [{"label": "Re-run verify", "action": "agents.verify", "args": {"run_id": run_id}}]),
        )

    # Decide overall run status
    new_status = run.get("status", "claims_done")
    failed = auto_runnable - passed
    if total > 0 and auto_runnable > 0 and passed == auto_runnable and passed == total:
        # all-pass requires every check to be pass (no pending bullets)
        new_status = "verified"
    else:
        # F7 §3.4 / planner acceptance: a failed or pending acceptance check
        # proves only that the agent *claimed* done. Keep the run in
        # claims_done (never auto-promote to verified); the individual
        # acceptance_checks rows and activity events carry pass/fail detail.
        new_status = run.get("status") if run.get("status") in ("claims_done", "verified") else "claims_done"
        if new_status == "verified" and not (total > 0 and passed == total):
            new_status = "claims_done"

    await store.update_run(
        run_id,
        {"status": new_status, "acceptance_passed": passed, "acceptance_total": total},
    )
    activity_kind = "agent.run.verified" if new_status == "verified" else "agent.run.verify_attempted"
    activity.emit(
        kind=activity_kind,
        actor=actor,
        subject=run_id,
        summary=f"run {run_id} verify: {passed}/{total} passing → {new_status}",
        severity="info" if new_status == "verified" else "error" if new_status == "failed" else "warn",
        fix=([] if new_status == "verified" else [
            {
                "label": "Re-run verify",
                "action": "agents.verify",
                "args": {"run_id": run_id},
            }
        ]),
    )
    await _emit_status(run_id, new_status)
    return {
        "ok": True,
        "data": {
            "run_id": run_id,
            "status": new_status,
            "passed": passed,
            "total": total,
            "auto_runnable": auto_runnable,
        },
    }


async def get_run_diff(run_id: str) -> Dict[str, Any]:
    run = await store.get_run(run_id)
    if not run:
        return {"available": False, "files": [], "added": 0, "removed": 0, "diff_text": ""}
    repo = run.get("repo_root") or os.getcwd()
    base = run.get("git_base_ref")
    if not base or not Path(repo).exists():
        return {
            "available": False,
            "files": run.get("files_touched") or [],
            "added": int(run.get("diff_added", 0)),
            "removed": int(run.get("diff_removed", 0)),
            "diff_text": "",
        }
    files, added, removed = _git_diff(repo, base)
    text = _diff_text(repo, base)
    return {
        "available": True,
        "files": files,
        "added": added,
        "removed": removed,
        "diff_text": text,
    }


def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "tracked_processes": len(_processes),
        "capabilities": [
            "dispatch_run",
            "record_event",
            "complete_run",
            "kill_run",
            "verify_run",
        ],
    }


# Test helper — clears process registry without touching DB
async def _reset_processes_for_tests() -> None:
    async with _proc_lock:
        _processes.clear()
