"""Acceptance parser tests."""
from __future__ import annotations

from app.agents.parser import (
    extract_acceptance_bullets,
    parse_handoff,
    synthesize_command,
)


SAMPLE = """\
# Handoff

Some intro.

## 5. Acceptance

These are the §6 items but in §5 here:

- [ ] curl -fsS http://localhost:8000/api/v2/system/sensors returns at least 1 temp
- [ ] endpoint /api/v2/health returns ok
- [ ] build passes
- [ ] typecheck passes
- [ ] tests pass
- [ ] No "done" string appears anywhere in the agent UI

## 6. Out of scope

Nothing here.
"""


F7_LIKE = """\
## 6. Acceptance (for this phase itself)

- [ ] Dispatch a known-failing agent → UI shows `claims_done` not `verified`
- [ ] Diff pane matches `git diff` output exactly
"""


def test_extract_bullets_section_5():
    bullets = extract_acceptance_bullets(SAMPLE)
    assert len(bullets) == 6
    assert all(b["state"] == "unchecked" for b in bullets)


def test_extract_bullets_section_6():
    bullets = extract_acceptance_bullets(F7_LIKE)
    assert len(bullets) == 2
    assert "Diff pane" in bullets[1]["label"]


def test_synth_curl_literal():
    cmd = synthesize_command("curl -fsS http://localhost:8000/x")
    assert cmd == "curl -fsS http://localhost:8000/x"


def test_synth_curl_literal_preserves_piped_assertion():
    cmd = synthesize_command("curl -fsS http://localhost:8000/x | grep expected")
    assert cmd == "curl -fsS http://localhost:8000/x | grep expected"


def test_synth_endpoint_pattern():
    cmd = synthesize_command("endpoint /api/v2/health returns ok")
    assert cmd is not None
    assert "/api/v2/health" in cmd
    assert "curl" in cmd


def test_synth_build():
    assert synthesize_command("build passes") == "npm run build"


def test_synth_typecheck():
    assert synthesize_command("typecheck passes") == "npm run typecheck"


def test_synth_tests():
    assert synthesize_command("pytest tests pass") == "pytest -x -q"


def test_synth_unknown():
    assert synthesize_command("No \"done\" string appears anywhere") is None


def test_synth_prose_mentions_curl_without_command_is_pending():
    assert synthesize_command("Manual-only browser visual check cannot run from curl") is None


def test_parse_handoff_full():
    rows = parse_handoff(SAMPLE)
    assert len(rows) == 6
    # First curl → command kept
    assert "curl" in (rows[0]["command"] or "")
    # endpoint synthesized
    assert "curl" in (rows[1]["command"] or "")
    # build
    assert rows[2]["command"] == "npm run build"
    # typecheck
    assert rows[3]["command"] == "npm run typecheck"
    # tests
    assert rows[4]["command"] == "pytest -x -q"
    # unknown — pending
    assert rows[5]["command"] is None
    # All start pending
    assert all(r["status"] == "pending" for r in rows)
