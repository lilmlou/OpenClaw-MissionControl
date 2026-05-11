"""Smoke tests for /api/v2/system/* — Phase D1.

These tests exercise the readers and the router in-process. They do NOT
require a running gateway, do NOT require Mongo, and are tolerant of the
local platform — on non-darwin they assert {available: false}.
"""
from __future__ import annotations

import sys

import pytest

from app.system_v2 import battery, bluetooth, processes, sensors
from app.system_v2 import router as r


DARWIN_ONLY = pytest.mark.skipif(
    sys.platform != "darwin", reason="darwin-only path"
)


def test_router_routes_registered():
    paths = {route.path for route in r.system_v2_router.routes}
    assert "/api/v2/system/stats" in paths
    assert "/api/v2/system/sensors" in paths
    assert "/api/v2/system/battery" in paths
    assert "/api/v2/system/bluetooth" in paths
    assert "/api/v2/system/processes" in paths


@DARWIN_ONLY
def test_stats_shape_has_required_keys():
    payload = r._build_stats()
    assert "ts" in payload and isinstance(payload["ts"], int)
    assert "cpu" in payload and isinstance(payload["cpu"], dict)
    assert "ram" in payload and isinstance(payload["ram"], dict)
    assert "disk" in payload and isinstance(payload["disk"], dict)
    assert "net" in payload and isinstance(payload["net"], dict)
    assert "gpu" in payload and isinstance(payload["gpu"], dict)


@DARWIN_ONLY
def test_stats_cpu_extended_fields():
    payload = r._build_stats()
    cpu = payload["cpu"]
    assert isinstance(cpu.get("per_core"), list) and len(cpu["per_core"]) > 0
    assert "load_avg" in cpu
    # frequency_mhz may be omitted on some hardware — that's allowed
    if "frequency_mhz" in cpu:
        assert isinstance(cpu["frequency_mhz"], int) and cpu["frequency_mhz"] > 0
    if "cores" in cpu:
        assert "performance" in cpu["cores"]
        assert "efficiency" in cpu["cores"]


@DARWIN_ONLY
def test_stats_ram_swap_present():
    payload = r._build_stats()
    ram = payload["ram"]
    assert "swap_used_bytes" in ram
    assert "swap_total_bytes" in ram
    assert ram.get("pressure") in ("normal", "warn", "critical")


@DARWIN_ONLY
def test_stats_net_includes_ip_fields():
    payload = r._build_stats()
    net = payload["net"]
    assert "interface" in net
    assert "private_ip" in net
    assert "public_ip" in net  # may be None on offline systems
    assert "upload_bps" in net
    assert "download_bps" in net


def test_sensors_returns_200_shape():
    """Always returns a dict with ts; either has temps or is unavailable."""
    payload = sensors.read()
    assert "ts" in payload
    if payload.get("available") is False:
        assert "error" in payload
    else:
        assert "temps" in payload and isinstance(payload["temps"], list)
        assert "fans" in payload and isinstance(payload["fans"], list)


@DARWIN_ONLY
def test_battery_present_or_absent():
    payload = battery.read()
    assert "ts" in payload
    # Must have either present:true with fields, present:false, or available:false
    if payload.get("available") is False:
        return
    assert "present" in payload
    if payload["present"]:
        # Required fields when battery is present
        assert "level" in payload
        assert isinstance(payload.get("cycle_count"), (int, type(None)))
        # amperage must be a real signed int (not uint64 wraparound)
        if "amperage_ma" in payload:
            assert payload["amperage_ma"] < 2**40


@DARWIN_ONLY
def test_bluetooth_shape():
    payload = bluetooth.read()
    assert "ts" in payload
    assert "powered_on" in payload or payload.get("available") is False
    if payload.get("powered_on") is True:
        assert isinstance(payload.get("devices", []), list)


@DARWIN_ONLY
@pytest.mark.parametrize("sort", ["cpu", "mem", "gpu", "disk", "net"])
def test_processes_each_sort(sort):
    payload = processes.read(sort=sort, limit=5)
    assert payload["sort"] == sort
    assert payload["limit"] == 5
    assert "processes" in payload
    assert isinstance(payload["processes"], list)
    if sort in ("gpu", "net"):
        assert payload["processes"] == []
    else:
        # cpu/mem/disk should yield rows on a live machine
        assert len(payload["processes"]) > 0
        for row in payload["processes"]:
            assert "pid" in row and "name" in row
            assert "cpu_percent" in row
            assert "memory_bytes" in row


def test_processes_invalid_sort_falls_back_to_cpu():
    payload = processes.read(sort="garbage", limit=3)
    assert payload["sort"] == "cpu"


def test_processes_limit_clamped():
    payload = processes.read(sort="cpu", limit=10000)
    assert payload["limit"] == 200
    payload = processes.read(sort="cpu", limit=0)
    assert payload["limit"] == 1


def test_safe_helper_swallows_exceptions():
    def bad():
        raise RuntimeError("boom")
    assert r._safe(bad, "test") == {}


def test_signed_amperage_unwrap():
    # ioreg returns -1146 as 18446744073709550470 — verify our unwrap fixes it
    from app.system_v2.battery import _signed_i
    assert _signed_i("18446744073709550470") == -1146
    assert _signed_i("100") == 100
    assert _signed_i(None) is None
