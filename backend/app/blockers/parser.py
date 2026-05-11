"""Parser for VM-D1 Blockers Mirror.

Pure parsing code: no Mongo, no WS, no config reads. Converts BLOCKERS.md
level-2 headings into stable blocker docs for the visual mirror surface.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

_HEADING_RE = re.compile(r"^##\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+[—-]\s+(.+?)\s*$")
_CLOSURE_RE = re.compile(r"^###\s+Closure\s+(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)", re.IGNORECASE | re.MULTILINE)
_SEVERITY_RE = re.compile(r"\*\*Severity:\*\*\s*(high|medium|low)|\bSeverity:\s*(high|medium|low)", re.IGNORECASE)
_RUN_ID_RE = re.compile(r"\b[a-f0-9]{12,}\b", re.IGNORECASE)


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _parse_ts(value: str) -> int:
    value = value.strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    return now_ms()


def _stable_id(date_str: str, title: str) -> str:
    normalized_title = " ".join(title.lower().split())
    raw = f"{date_str}:{normalized_title}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def _severity(body: str) -> str:
    match = _SEVERITY_RE.search(body)
    if not match:
        return "high"
    return (match.group(1) or match.group(2) or "high").lower()


def _related_run_id(body: str) -> Optional[str]:
    match = _RUN_ID_RE.search(body)
    return match.group(0) if match else None


def suggested_actions(source_path: str, source_lineno: int, related_run_id: Optional[str]) -> List[Dict[str, Any]]:
    actions: List[Dict[str, Any]] = [
        {
            "label": "View blocker source",
            "action": "files.open",
            "args": {"path": source_path, "lineno": source_lineno},
        }
    ]
    if related_run_id:
        actions.insert(
            0,
            {
                "label": "Re-dispatch agent run",
                "action": "agent_runs.redispatch",
                "args": {"run_id": related_run_id},
            },
        )
    return actions


def parse_blockers_text(text: str, source_path: str) -> List[Dict[str, Any]]:
    """Parse BLOCKERS.md text into blocker docs.

    Entries begin at `## YYYY-MM-DD HH:MM — TITLE` headings. The returned docs
    intentionally contain no Mongo `_id` so they are HTTP-safe as-is.
    """
    lines = text.splitlines()
    starts: List[tuple[int, re.Match[str]]] = []
    for idx, line in enumerate(lines):
        match = _HEADING_RE.match(line)
        if match:
            starts.append((idx, match))

    docs: List[Dict[str, Any]] = []
    for pos, (line_idx, match) in enumerate(starts):
        next_line_idx = starts[pos + 1][0] if pos + 1 < len(starts) else len(lines)
        body_lines = lines[line_idx:next_line_idx]
        body_md = "\n".join(body_lines).strip() + "\n"
        date_str, title = match.group(1), match.group(2).strip()
        closure = _CLOSURE_RE.search(body_md)
        closed_ts = _parse_ts(closure.group(1)) if closure else None
        related_run_id = _related_run_id(body_md)
        source_lineno = line_idx + 1
        docs.append(
            {
                "id": _stable_id(date_str, title),
                "title": title,
                "severity": _severity(body_md),
                "status": "closed" if closure else "open",
                "source_path": source_path,
                "source_lineno": source_lineno,
                "opened_ts": _parse_ts(date_str),
                "closed_ts": closed_ts,
                "body_md": body_md,
                "related_run_id": related_run_id,
                "suggested_actions": suggested_actions(source_path, source_lineno, related_run_id),
            }
        )
    return docs


def parse_blockers_md(path: str) -> List[Dict[str, Any]]:
    p = Path(path)
    if not p.exists():
        return []
    return parse_blockers_text(p.read_text(encoding="utf-8"), str(p))
