# /system v2 — Backend Handoff

**Audience:** backend coding agent
**Owner:** Meg
**Repo root:** `/Volumes/🦋• Drive   1/MC-CLAW/OpenClaw-MissionControl/backend/`
**Reference source (read-only):** `/Volumes/🦋• Drive   1/MC-CLAW/_Reference/stats-master/`
**Sister doc:** `SYSTEM_V2_FRONTEND.md` (do NOT modify — they share §3 verbatim)

---

## 0. TL;DR

The `/system` page already has Hardware / Services / Apps tabs wired to:
- `GET /api/v2/system/stats`
- `GET /api/v2/system/services`
- `GET /api/v2/system/apps?device=mac`

We are adding the data Meg can see in [exelban/stats](https://github.com/exelban/stats) — **information only**, no menu-bar or preference UI. The frontend will render Battery, Sensors, Bluetooth, plus Top Processes per resource. You ship the endpoints + JSON. The frontend is being handed `SYSTEM_V2_FRONTEND.md` in parallel; §3 of both docs is identical.

**Hard rules:**
- Do not break existing `/api/v2/system/*` endpoints.
- Do not change shape of fields the frontend already consumes — only ADD.
- Sensors / processes are expensive — respect the cache TTLs in §4.
- Endpoints must work on Apple Silicon (M1/M2/M3) and Intel Macs. If a field cannot be read, omit it (don't return null/0); the frontend hides missing fields.

---

## 1. Reference: how Stats reads each value

Stats is a Swift app. The relevant readers, by module:

| Module | File in `_Reference/stats-master/` | Notes |
|---|---|---|
| CPU | `Modules/CPU/readers.swift` | uses `host_processor_info`, `sysctl` |
| GPU | `Modules/GPU/readers.swift` | uses `IOServiceGetMatchingServices` for `IOAccelerator` |
| RAM | `Modules/RAM/readers.swift` | `host_statistics64(HOST_VM_INFO64)` |
| Disk | `Modules/Disk/readers.swift` | `DASessionCreate`, `IOPSCopyPowerSourcesInfo` |
| Net | `Modules/Net/readers.swift` | `getifaddrs`, `SCDynamicStoreCopyValue` |
| Battery | `Modules/Battery/readers.swift` | `IOPSCopyPowerSourcesInfo`, `IORegistryEntry` |
| Sensors | `Modules/Sensors/readers.swift` + `SMC/smc.swift` | SMC keys (TC0P, TG0P, TM0P, F0Ac, etc.) |
| Bluetooth | `Modules/Bluetooth/readers.swift` | `IOBluetoothDevice` framework |
| Top procs | `Modules/*/processReader.swift` per module | runs `ps`/`top`-style sampling |

You don't need to port any Swift — Python equivalents below. Stats source is grep-able when a metric is unclear.

---

## 2. Implementation strategy on Python backend

| Library | Use for |
|---|---|
| `psutil` | CPU %, per-core %, load avg, memory, swap, disk usage, disk I/O, net I/O, processes, battery basic |
| `pyobjc-framework-IOKit` (or shell out to `ioreg`) | Battery cycles/condition, GPU info, Bluetooth devices |
| `apple_smc` Python lib OR shell out to a small bundled binary OR call Stats' SMC helper | Temperatures, fan RPM |
| `subprocess` to `system_profiler SPDisplaysDataType -json` | GPU model + cores + VRAM |
| `subprocess` to `system_profiler SPBluetoothDataType -json` | Bluetooth devices + battery |
| `subprocess` to `powermetrics` (root) — AVOID | Don't require sudo. If a metric needs sudo, omit it. |

Keep all macOS-specific code behind a guard `if sys.platform == "darwin"` so non-Mac dev environments don't crash.

**Never** spawn `top`, `ps`, or `powermetrics` on every poll. Sample at the cache TTL listed in §4.

---

## 3. Endpoint contracts (shared with frontend — DO NOT EDIT)

> §3 is the contract. Both docs contain the same §3. If you need to change a field, update both files in the same commit.

### 3.1 `GET /api/v2/system/stats` (extend, do not break)

Existing fields stay. Add the bolded ones.

```json
{
  "ts": 1714900000000,
  "cpu": {
    "usage": 0.45,
    "user": 0.31,
    "system": 0.14,
    "idle": 0.55,
    "per_core": [0.80, 0.81, 0.73, 0.69, 0.30, 0.12, 0.09, 0.05],
    "load_avg": [5.61, 8.67, 11.13],
    "frequency_mhz": 3200,
    "model": "Apple M2",
    "cores": { "performance": 4, "efficiency": 4 }
  },
  "gpu": {
    "render_usage": 0.25,
    "tiler_usage": 0.27,
    "model": "Apple M2",
    "cores": 10,
    "vendor": "Apple",
    "vram_total_mb": 0,
    "vram_used_mb": 0
  },
  "ram": {
    "total_bytes": 17179869184,
    "used_bytes": 14306262220,
    "free_bytes": 2864967680,
    "active_bytes": 0,
    "wired_bytes": 0,
    "compressed_bytes": 0,
    "cached_bytes": 0,
    "pressure": "normal",
    "swap_used_bytes": 787480576,
    "swap_total_bytes": 0
  },
  "disk": {
    "primary": {
      "name": "Macintosh HD",
      "mount": "/",
      "total_bytes": 1099511627776,
      "used_bytes": 157637754880,
      "free_bytes": 941873872896,
      "read_bytes_per_sec": 0,
      "write_bytes_per_sec": 0,
      "filesystem": "APFS"
    },
    "volumes": [
      { "name": "Macintosh HD", "mount": "/", "total_bytes": 0, "used_bytes": 0, "free_bytes": 0, "filesystem": "APFS" }
    ]
  },
  "net": {
    "interface": "en0",
    "upload_bps": 2099,
    "download_bps": 9441,
    "upload_total_bytes": 0,
    "download_total_bytes": 0,
    "private_ip": "192.168.5.42",
    "public_ip": "121.200.6.249",
    "ipv6": "fd62:bb26:6ab3:47ec:4155::",
    "ssid": null
  }
}
```

**Poll target from frontend:** every 3s (existing). Don't slow this down.

### 3.2 `GET /api/v2/system/sensors` (NEW)

```json
{
  "ts": 1714900000000,
  "temps": [
    { "key": "TC0P", "label": "CPU Proximity", "celsius": 52.3, "group": "cpu" },
    { "key": "TG0P", "label": "GPU Proximity", "celsius": 48.1, "group": "gpu" },
    { "key": "TM0P", "label": "Memory",        "celsius": 41.2, "group": "memory" },
    { "key": "TPCD", "label": "PCH Die",       "celsius": 55.0, "group": "system" },
    { "key": "Ts0S", "label": "Battery",       "celsius": 33.4, "group": "battery" }
  ],
  "fans": [
    { "id": 0, "label": "Left", "rpm": 1820, "min_rpm": 1200, "max_rpm": 5800 },
    { "id": 1, "label": "Right", "rpm": 1810, "min_rpm": 1200, "max_rpm": 5800 }
  ],
  "thermal_pressure": "nominal"
}
```

Apple Silicon fanless models (MacBook Air M1/M2/M3) → return `"fans": []`. Don't fabricate.
If SMC read fails for any key, omit that entry.

**Poll target:** 5s. Cache server-side at 2s — multiple frontends asking shouldn't hammer SMC.

### 3.3 `GET /api/v2/system/battery` (NEW)

```json
{
  "ts": 1714900000000,
  "present": true,
  "level": 0.87,
  "is_charging": false,
  "is_charged": false,
  "power_source": "Battery Power",
  "time_to_empty_minutes": 412,
  "time_to_full_minutes": null,
  "cycle_count": 184,
  "condition": "Normal",
  "design_capacity_mah": 4382,
  "max_capacity_mah": 4250,
  "max_capacity_percent": 0.97,
  "voltage_mv": 12480,
  "amperage_ma": -1840,
  "temperature_c": 33.4,
  "manufacturer": "SMP",
  "serial": null
}
```

If no battery (Mac mini, Mac Studio, Mac Pro) → `{"present": false, "ts": ...}` only.

**Poll target:** 30s. Cache 15s.

### 3.4 `GET /api/v2/system/bluetooth` (NEW)

```json
{
  "ts": 1714900000000,
  "powered_on": true,
  "discoverable": false,
  "devices": [
    {
      "name": "AirPods Pro",
      "address": "A4:83:E7:XX:XX:XX",
      "connected": true,
      "paired": true,
      "battery_percent": 0.74,
      "battery_left_percent": 0.72,
      "battery_right_percent": 0.76,
      "battery_case_percent": 0.91,
      "type": "headphones",
      "vendor_id": 76,
      "product_id": 8203,
      "rssi_dbm": -42
    }
  ]
}
```

Use `system_profiler SPBluetoothDataType -json` and parse. Field omission OK if a value isn't present.

**Poll target:** 10s. Cache 5s.

### 3.5 `GET /api/v2/system/processes?sort=cpu|mem|gpu|disk|net&limit=10` (NEW)

```json
{
  "ts": 1714900000000,
  "sort": "cpu",
  "limit": 10,
  "processes": [
    {
      "pid": 1432,
      "name": "WindowServer",
      "user": "_windowserver",
      "cpu_percent": 18.4,
      "memory_bytes": 524288000,
      "memory_percent": 3.1,
      "gpu_percent": 0,
      "disk_read_bytes_per_sec": 0,
      "disk_write_bytes_per_sec": 0,
      "net_bytes_per_sec": 0,
      "threads": 12,
      "started_ts": 1714898400000
    }
  ]
}
```

Sort orders:
- `cpu` → by `cpu_percent` desc
- `mem` → by `memory_bytes` desc
- `gpu` → by `gpu_percent` desc (omit list if GPU per-process not available; return empty array)
- `disk` → by `disk_read_bytes_per_sec + disk_write_bytes_per_sec` desc
- `net` → by `net_bytes_per_sec` desc (likely empty on macOS without root; return empty array)

**Poll target:** 3s for the active panel only (frontend will only request the sort it's currently showing).
**Cache server-side:** 2s per sort key.

### 3.6 Error shape (all endpoints)

On uncaught failure, return HTTP 200 with:
```json
{ "ts": 1714900000000, "error": "human readable message", "available": false }
```
Do not 500. The frontend hides panels with `available: false`.

---

## 4. Polling / cost rules

| Endpoint | Frontend poll | Server cache TTL | Why |
|---|---|---|---|
| `/system/stats` | 3s | 1s | Cheap psutil reads |
| `/system/sensors` | 5s | 2s | SMC reads are slow |
| `/system/battery` | 30s | 15s | Battery state changes slowly |
| `/system/bluetooth` | 10s | 5s | `system_profiler` is slow (~0.5s) |
| `/system/processes` | 3s (active sort only) | 2s per sort | psutil iteration over all PIDs is heavy |

Cache key for sensors / battery / bluetooth is just the endpoint. For processes it's `(sort, limit)`.

---

## 5. Implementation tasks

1. **Add module:** `backend/app/system_v2/` (or wherever existing `/api/v2/system/*` lives — match style).
   - `cpu.py`, `gpu.py`, `ram.py`, `disk.py`, `net.py` (extend existing)
   - `sensors.py` (new)
   - `battery.py` (new)
   - `bluetooth.py` (new)
   - `processes.py` (new)
   - `cache.py` (small TTL cache, no Redis dep)

2. **Wire routes** under `/api/v2/system/` namespace:
   - extend `GET /stats` (add per-core, load_avg, frequency_mhz, gpu cores, ram swap, net public_ip if missing)
   - new `GET /sensors`
   - new `GET /battery`
   - new `GET /bluetooth`
   - new `GET /processes`

3. **SMC access:** prefer a pure-Python implementation (e.g. `apple_smc` or port the small subset of SMC keys you need). If unavailable, ship a tiny Swift helper from the Stats reference and call it via subprocess — but document the dependency in `backend/README.md`.

4. **Tests:**
   - `tests/test_system_v2.py`
   - For each endpoint, assert keys present and types correct.
   - On non-darwin CI, endpoints must return `{ "available": false, "error": "platform not supported" }` and HTTP 200.

5. **OpenAPI / docs:** if `backend/` already exposes `/docs` (FastAPI auto), the new routes pick up automatically. No manual schema work.

---

## 6. Acceptance

- [ ] `curl localhost:PORT/api/v2/system/stats` returns `cpu.per_core` array with length matching physical cores
- [ ] `curl .../api/v2/system/sensors` returns at least 1 temp on M2 Air
- [ ] `curl .../api/v2/system/battery` returns `cycle_count` matching `system_profiler SPPowerDataType` cycle count
- [ ] `curl .../api/v2/system/bluetooth` lists currently connected devices
- [ ] `curl .../api/v2/system/processes?sort=cpu&limit=5` lists 5 processes, sorted desc by cpu_percent
- [ ] All endpoints return in < 200ms when warm-cached
- [ ] Non-Mac platform → all return `{ available: false }` with 200
- [ ] Existing `/system` page (Hardware/Services/Apps) still works unchanged

---

## 7. Out of scope

- Menu-bar widgets / Stats preferences UI / colour customisation — frontend is only mirroring the **information**, not the UI patterns of the Stats app.
- Historical graphs storage. Only return current values; the frontend keeps its own short rolling buffer for sparklines.
- Alert thresholds, notifications.
- iPad / iOS device data. This handoff is Mac-only. Multi-device is a separate scope.
- Any sudo / elevated calls. If a metric needs root, omit it.

---

End of backend handoff.
