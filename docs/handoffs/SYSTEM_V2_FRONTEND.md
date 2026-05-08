# /system v2 — Frontend Handoff

**Audience:** frontend coding agent
**Owner:** Meg
**Repo root:** `/Volumes/🦋• Drive   1/MC-CLAW/OpenClaw-MissionControl/frontend/`
**Reference UI source (read-only):** `/Volumes/🦋• Drive   1/MC-CLAW/_Reference/stats-master/`
**Sister doc:** `SYSTEM_V2_BACKEND.md` (do NOT modify — they share §3 verbatim)

---

## 0. TL;DR

The `/system` page exists (Hardware / Services / Apps tabs). We are extending Hardware and adding two new tabs to mirror what [exelban/stats](https://github.com/exelban/stats) shows on its web README.

**Information only — no Stats menu-bar / settings patterns.** Render values in the existing card style.

You are wiring against new endpoints listed in §3. The backend agent is shipping those in parallel; treat §3 as the contract.

**Hard rules:**
- Do not redesign existing Hardware / Services / Apps tabs.
- Keep the existing colour tokens, card layout, spacing.
- Preserve all existing `data-testid` attributes.
- If an endpoint returns `{ available: false }`, hide the panel — no error spam, no fake data.
- Stats reference is for **what to display**, not **how to lay out preferences**.

---

## 1. Page structure changes

Existing tab strip on `/system`:
```
Hardware | Services | Apps
```

New tab strip:
```
Hardware | Sensors | Battery | Bluetooth | Processes | Services | Apps
```

Hide `Battery` tab if `/api/v2/system/battery` returns `{ present: false }`.
Hide `Bluetooth` tab if `/api/v2/system/bluetooth` returns `{ powered_on: false }` AND `devices: []`.
Hide `Sensors` tab if `/api/v2/system/sensors` returns `{ available: false }`.

Keep tab persistence in URL: `?tab=hardware|sensors|battery|bluetooth|processes|services|apps`.

---

## 2. Per-tab spec

### 2.1 Hardware (extend existing)

Keep existing CPU / GPU / RAM / Disk / Network cards. Add to each:

**CPU card additions:**
- Per-core bar list (one row per core, label `0`..`N-1`, percent text right-aligned)
- Load average row: `5.61  8.67  11.13` (1m / 5m / 15m, dim secondary text)
- Frequency: `3.20 GHz` next to model name
- Performance/efficiency core split: small subtitle `4P + 4E cores`

**GPU card additions:**
- Render % and Tiler % as twin progress bars (existing behaviour — verify it's wired to `gpu.render_usage` and `gpu.tiler_usage`)
- Cores subtitle: `Apple · 10 cores`

**RAM card additions:**
- Swap row at bottom: `Swap  750.81 MB` (only if `swap_used_bytes > 0`)
- Pressure pill (top right of card): `normal` (green) / `warn` (amber) / `critical` (red)

**Disk card additions:**
- Below the primary volume, list other mounted volumes from `disk.volumes[]` if length > 1 (otherwise omit)
- Read / Write throughput row: `↑ 12 MB/s   ↓ 4 MB/s` (only when > 0)

**Network card additions:**
- Already shows up/down + IPs in the screenshot. Add SSID line if `net.ssid` present.

Polling: keep existing 3s on `/system/stats`.

### 2.2 Sensors (new)

Layout: two columns (Temps left, Fans right) on desktop; stacked on narrow.

**Temps column:**
- Group by `group` field (`cpu`, `gpu`, `memory`, `system`, `battery`)
- Each row: `Label   42.1°C` with a thin colour-coded bar (cool < 50, warm 50–70, hot 70–90, critical > 90)
- Header per group; subtle divider

**Fans column:**
- One card per fan: `Left  1820 RPM` plus a horizontal bar showing RPM as % of `(rpm - min) / (max - min)`
- Empty state when `fans: []`: small dim text `Fanless system` (no card border)

**Top of tab:** thermal pressure pill (`nominal` / `fair` / `serious` / `critical`).

Polling: 5s on `/system/sensors`.

### 2.3 Battery (new)

Layout: one large hero card on top, two small cards below.

**Hero (battery state):**
- Big percentage `87%`
- Status line: `Discharging · 6h 52m remaining` (or `Charging · 1h 14m to full` or `Charged`)
- Battery icon with fill matching level; charging bolt overlay when `is_charging`
- Power source pill: `Battery` / `AC Adapter`

**Health card:**
- `Cycle count`, `Condition`, `Max capacity` (% of design)
- Bar showing current capacity vs design

**Live card:**
- `Voltage`, `Amperage`, `Temperature`

If `present: false` the tab itself is hidden — no empty state needed.

Polling: 30s on `/system/battery`.

### 2.4 Bluetooth (new)

Layout: simple list.

**Header:**
- Power state pill: `Bluetooth: On` / `Off`
- Discoverable indicator if true

**Device rows:**
- Icon by `type` (headphones, mouse, keyboard, controller, phone, generic)
- Name + connection state (`Connected` / `Paired`)
- Battery cluster (if device reports it):
  - Single battery: `74%` with tiny battery icon
  - AirPods: three pills `L 72%  R 76%  Case 91%`
- RSSI dim text if `connected` and `rssi_dbm` present

Empty state: `No paired devices`.

Polling: 10s on `/system/bluetooth`.

### 2.5 Processes (new)

Layout: tabbed sub-strip + table.

**Sub-strip:** `By CPU | By Memory | By GPU | By Disk | By Network`
- Active selection drives the `?sort=` query param sent to backend
- Only the active sort polls — switching tabs cancels the previous interval

**Table columns:**
- PID
- Name (mono font)
- User
- The sort metric (CPU% / Memory / GPU% / Disk I/O / Net I/O) — bold, primary metric
- A secondary metric for context (e.g. memory% always visible alongside cpu%)

**Row count:** 10 by default. Bottom button `Show 25` / `Show 50`.

**Empty state for GPU / Net** when backend returns `processes: []`: dim text `Per-process not available on macOS without elevated privileges.`

Polling: 3s on the active sort.

### 2.6 Services / Apps

No changes. Leave existing implementation alone.

---

## 3. Endpoint contracts (shared with backend — DO NOT EDIT)

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

## 4. Implementation tasks (frontend)

1. **Hooks** — add to `frontend/src/lib/useGateway.js` (or new `useSystemV2.js` if cleaner):
   - `useSystemSensors()` — polls 5s, returns `{ data, error, available }`
   - `useSystemBattery()` — polls 30s
   - `useSystemBluetooth()` — polls 10s
   - `useSystemProcesses(sort)` — polls 3s, only when sort is active
   - All hooks must `clearInterval` on unmount and on dependency change.

2. **Pages** — under `frontend/src/pages/system/`:
   - Extend existing `HardwareTab.jsx` (or wherever Hardware lives)
   - New `SensorsTab.jsx`
   - New `BatteryTab.jsx`
   - New `BluetoothTab.jsx`
   - New `ProcessesTab.jsx`

3. **Tab strip** — update the existing system tabs component to include the new tabs and wire `?tab=` URL persistence.

4. **Conditional hide:** before rendering Sensors/Battery/Bluetooth tabs, the parent must read each endpoint once on mount and set `tabAvailability: { sensors, battery, bluetooth }`. Hide tabs that come back unavailable.

5. **Tests:**
   - `pages/system/__tests__/SensorsTab.test.jsx` — mock fetch, assert temp rows render
   - Same for Battery, Bluetooth, Processes
   - Snapshot existing Hardware tab to confirm no regression

6. **No new design tokens.** Use the existing `C.accent`, `C.green`, `C.red`, `C.muted`, plus a new `C.warn` only if it doesn't already exist.

---

## 5. Acceptance

- [ ] `/system?tab=sensors` shows live temps that change over 5s polling
- [ ] `/system?tab=battery` shows current battery state on a MacBook; tab hidden on a Mac mini
- [ ] `/system?tab=bluetooth` lists currently connected AirPods/devices with battery
- [ ] `/system?tab=processes&sort=cpu` shows a live top-10 by CPU; switching to `sort=mem` re-sorts
- [ ] Existing Hardware/Services/Apps tabs unchanged in appearance and still poll correctly
- [ ] No regressions in existing `data-testid` selectors
- [ ] `npm run build` passes; `npm run typecheck` passes if TS is configured
- [ ] All polling stops when navigating away from `/system`

---

## 6. Out of scope

- Settings popups (theme/wallpaper/font/layout) — separate handoff
- Files page — separate handoff
- Customise tab wiring — see `CUSTOMISE_HANDOFF_OPENCODE.md`
- Multi-device (iPad/iPhone) — separate handoff
- Historical charts beyond a short rolling buffer for sparklines (optional, ≤ 60 points in memory)

---

End of frontend handoff.
