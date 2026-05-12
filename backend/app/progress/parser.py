"""Parser for VM-D2 Progress Pulse.

Pure parsing code: no Mongo, no WS, no config reads. Converts PROGRESS.md
level-3 entries under level-2 date headings into stable progress docs for the
visual mirror dashboard surface.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

_DATE_HEADING_RE = re.compile(r"^##\s+(\d{4}-\d{2}-\d{2})\s*$")
_ENTRY_HEADING_RE = re.compile(r"^###\s+(.+?)\s+[—-]\s+(.+?)\s*$")
_REPO_RE = re.compile(r"^\*\*Repo:\*\*\s*(.+?)\s*$", re.MULTILINE)
_CRON_RUN_RE = re.compile(r"^\*\*Cron run:\*\*.*?\b([a-f0-9]{12,})\b", re.IGNORECASE | re.MULTILINE)

DEFAULT_PROGRESS_PATH = "/Volumes/🦋• Drive   1/MC/PROGRESS.md"
_STATUSES = {
    "verified": "verified",
    "claims_done": "claims_done",
    "claimsdone": "claims_done",
    "deceptive": "deceptive",
    "in_flight": "in_flight",
    "in-flight": "in_flight",
    "in flight": "in_flight",
}


def _date_ts(date_str: str) -> int:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except ValueError:
        return 0


def _stable_id(date_str: str, name: str) -> str:
    name_normalized = " ".join(name.lower().split())
    return hashlib.sha256(f"{date_str}:{name_normalized}".encode("utf-8")).hexdigest()[:16]


def _normalise_status(raw_status: str) -> str:
    return _STATUSES.get(raw_status.strip().lower(), "unknown")


def _repo_path(body_md: str) -> Optional[str]:
    match = _REPO_RE.search(body_md)
    return match.group(1).strip() if match else None


def _cron_run_id(body_md: str) -> Optional[str]:
    match = _CRON_RUN_RE.search(body_md)
    return match.group(1) if match else None


def suggested_actions(cron_run_id: Optional[str], source_path: str = DEFAULT_PROGRESS_PATH) -> List[Dict[str, Any]]:
    actions: List[Dict[str, Any]] = []
    if cron_run_id:
        actions.append(
            {
                "label": "View in Agent Live View",
                "action": "agents.open_run",
                "args": {"run_id": cron_run_id},
            }
        )
    actions.append(
        {
            "label": "Open PROGRESS.md",
            "action": "files.open",
            "args": {"path": source_path},
        }
    )
    return actions


def parse_progress_text(text: str, source_path: str = DEFAULT_PROGRESS_PATH) -> List[Dict[str, Any]]:
    """Parse PROGRESS.md text into progress docs."""
    lines = text.splitlines()
    date_str: Optional[str] = None
    entries: List[tuple[int, str, re.Match[str]]] = []

    for idx, line in enumerate(lines):
        date_match = _DATE_HEADING_RE.match(line)
        if date_match:
            date_str = date_match.group(1)
            continue
        entry_match = _ENTRY_HEADING_RE.match(line)
        if entry_match and date_str:
            entries.append((idx, date_str, entry_match))

    docs: List[Dict[str, Any]] = []
    for pos, (line_idx, current_date, match) in enumerate(entries):
        next_entry_line = entries[pos + 1][0] if pos + 1 < len(entries) else len(lines)
        for idx in range(line_idx + 1, next_entry_line):
            if _DATE_HEADING_RE.match(lines[idx]):
                next_entry_line = idx
                break
        name = match.group(1).strip()
        status = _normalise_status(match.group(2))
        body_md = "\n".join(lines[line_idx:next_entry_line]).strip() + "\n"
        cron_run_id = _cron_run_id(body_md)
        docs.append(
            {
                "id": _stable_id(current_date, name),
                "name": name,
                "status": status,
                "date_str": current_date,
                "date_ts": _date_ts(current_date),
                "repo_path": _repo_path(body_md),
                "cron_run_id": cron_run_id,
                "seen": False,
                "body_md": body_md,
                "suggested_actions": suggested_actions(cron_run_id, source_path),
            }
        )
    return docs


def parse_progress_md(path: str) -> List[Dict[str, Any]]:
    p = Path(path)
    if not p.exists():
        return []
    return parse_progress_text(p.read_text(encoding="utf-8"), str(p))
