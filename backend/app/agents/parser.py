"""Parse handoff §6 acceptance bullets into runnable check commands.

Per F7_AGENT_LIVE_VIEW.md §3.3:
- Each `- [ ]` bullet becomes one acceptance_checks row.
- Recognise patterns:
    `curl ...`                         → run literally
    "endpoint X returns Y"             → curl localhost:PORT/X | jq ...
    "build passes"                     → npm run build
    "typecheck passes"                 → npm run typecheck
    "tests pass"                       → pytest or npm test
- Unrecognised → status: "pending" (manual mark).

The parser is conservative: when in doubt, leave `command` empty and status
pending. The §6 text is the source of truth; we never invent expectations the
doc didn't make.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Optional


# Match `- [ ]` or `- [x]` / `- [X]` checkbox bullets
_BULLET_RX = re.compile(r"^\s*[-*]\s*\[(?P<state>[ xX])\]\s*(?P<text>.+?)\s*$")


def _find_section(text: str, header_rx: str) -> Optional[str]:
    """Return the body of the first section matching `header_rx`."""
    lines = text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if re.match(header_rx, line, re.IGNORECASE):
            start = i + 1
            break
    if start is None:
        return None
    # Stop at next `## ` header (any level-2 heading) or horizontal rule
    end = len(lines)
    for j in range(start, len(lines)):
        if re.match(r"^##\s", lines[j]) or re.match(r"^---\s*$", lines[j]):
            end = j
            break
    return "\n".join(lines[start:end])


def extract_acceptance_bullets(handoff_text: str) -> List[Dict[str, Any]]:
    """Return list of `{label, state}` for §6 (Acceptance) bullets.

    Strategy: pick the first section whose header contains the word
    "acceptance" (case-insensitive). If no such header, fall back to
    a `## 6.` numbered section. Bullets already marked `[x]` keep
    state="checked".
    """
    body = (
        _find_section(handoff_text, r"^##\s*\d+[.\s].*acceptance")
        or _find_section(handoff_text, r"^##\s*acceptance")
        or _find_section(handoff_text, r"^##\s*6[.\s]")
    )
    if body is None:
        return []
    out: List[Dict[str, Any]] = []
    for line in body.splitlines():
        m = _BULLET_RX.match(line)
        if not m:
            continue
        state = "checked" if m.group("state").lower() == "x" else "unchecked"
        out.append({"label": m.group("text"), "state": state})
    return out


# ── command synthesis ────────────────────────────────────────────────────


_CURL_RX = re.compile(r"\bcurl\b[^|`\n]*")
# "endpoint /foo returns ..."  / "GET /foo returns ..."
_ENDPOINT_RX = re.compile(
    r"(?:endpoint|GET|POST|PUT|DELETE)\s+(?P<path>/\S+)\s+returns?\s+(?P<expected>.+?)$",
    re.IGNORECASE,
)


def synthesize_command(label: str, *, base_url: str = "http://127.0.0.1:8765") -> Optional[str]:
    """Return shell command string, or None if we can't auto-derive."""
    txt = label.strip()
    low = txt.lower()

    # 1. literal curl in the bullet — extract and use as-is. Preserve shell
    # pipes when the handoff supplied them (`curl ... | grep ...` is a real
    # acceptance command); for prose bullets like "curl ... returns ...", keep
    # only the curl invocation so the check still runs.
    curl_pos = txt.find("curl")
    if curl_pos >= 0:
        candidate = txt[curl_pos:].strip().strip("`")
        # Only literal shell curl commands are runnable. Prose such as
        # "visual check cannot run from curl" must remain pending rather than
        # becoming the bare command `curl` and failing for the wrong reason.
        if candidate == "curl":
            return None
        if "|" in candidate:
            return candidate
    m = _CURL_RX.search(txt)
    if m:
        cmd = m.group(0).strip().strip("`")
        return cmd

    # 2. endpoint pattern
    m = _ENDPOINT_RX.search(txt)
    if m:
        path = m.group("path").rstrip(".,;)")
        return f"curl -fsS {base_url}{path}"

    # 3. build / typecheck / tests
    if "build passes" in low or "build succeeds" in low:
        return "npm run build"
    if "typecheck passes" in low or "typecheck succeeds" in low or "tsc passes" in low:
        return "npm run typecheck"
    if re.search(r"\b(pytest|tests?\s+pass(?:es)?)\b", low):
        # prefer pytest for FastAPI repos; fallback npm test
        return "pytest -x -q"

    # 4. unrecognised
    return None


def parse_handoff(
    handoff_text: str,
    *,
    base_url: str = "http://127.0.0.1:8765",
) -> List[Dict[str, Any]]:
    """High-level entry point used by dispatch.

    Returns rows ready for `agent_store.insert_checks` (no `id`/`run_id` yet).
    """
    bullets = extract_acceptance_bullets(handoff_text)
    out: List[Dict[str, Any]] = []
    for b in bullets:
        cmd = synthesize_command(b["label"], base_url=base_url)
        out.append({
            "label": b["label"],
            "command": cmd,
            "expected": None,
            "actual": None,
            "status": "pending",  # always start pending; F7 §3.4 verify flips it
            "ran_ts": None,
            "auto_synthesized": cmd is not None,
        })
    return out


def load_handoff(handoff_doc: str, search_root: str) -> Optional[str]:
    """Locate and read the handoff doc text. Returns None if not found."""
    p = Path(handoff_doc)
    candidates: List[Path] = []
    if p.is_absolute():
        candidates.append(p)
    else:
        try:
            root = Path(search_root)
        except Exception:
            root = None  # type: ignore[assignment]
        if root is not None:
            candidates.append(root / handoff_doc)
            # Conservative recursive search: only one level deep to avoid
            # walking the entire filesystem when search_root is "/".
            try:
                if root.is_dir() and len(root.parts) > 2:
                    for sub in root.glob(f"*/{p.name}"):
                        candidates.append(sub)
            except OSError:
                pass
    for c in candidates:
        try:
            if c.is_file():
                return c.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
    return None
