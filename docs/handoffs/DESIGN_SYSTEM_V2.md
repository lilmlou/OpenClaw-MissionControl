# Design System v2

**Owner:** Meg
**Date:** 2026-05-08
**Audience:** every frontend agent + designer + facilitator
**Status:** binding — every page in MC-CLAW frontend composes from this kit

References distilled into this system:
- Grok (Beta Agent / Imagine) — playground / canvas / right-rail action stack / pinned prompt bar
- Hermes Workspace — overview tile cluster + sparkline + recent sessions
- TenacitOS — sessions filter chips + per-row token bars + costs/budget cards
- Claude Desktop (Customise / Files / Settings) — left-rail navigation, two-pane editor, tool-permission rows
- exelban/stats — data display patterns for /system

---

## 0. Why this exists

Every page so far has been bespoke React. That ends here. This doc locks the **kit** that every page composes from. After Phase 0.3 (Binding Layer) ships, building a page = picking widgets from this kit, not inventing.

If a feature needs a widget not in this kit, **add it to this kit first**, then use it. Never invent in-place.

---

## 1. Tokens

All tokens are CSS variables on `:root`. Phase O Theme Engine writes to them live. No hardcoded hex.

### 1.1 Colour (dark default, light variant later)

```css
:root {
  /* surfaces */
  --bg:           #0A0B0D;   /* page background */
  --bg-1:         #101216;   /* card background */
  --bg-2:         #161A1F;   /* nested card / hover */
  --bg-3:         #1D2229;   /* selected / pressed */
  --bg-overlay:   rgba(10,11,13,0.85);  /* modal / popover scrim */

  /* text */
  --fg:           #E8ECF1;   /* primary text */
  --fg-1:         #A8B0BA;   /* secondary */
  --fg-2:         #6B7380;   /* tertiary / metadata */
  --fg-3:         #3D434C;   /* placeholder / disabled */

  /* lines */
  --line:         rgba(232,236,241,0.06);  /* hairline */
  --line-strong:  rgba(232,236,241,0.12);  /* emphasised */

  /* accent — single brand colour, used sparingly */
  --accent:       #5EE2C9;   /* mint-cyan, hero / CTAs / progress */
  --accent-hover: #7AEED9;
  --accent-soft:  rgba(94,226,201,0.12);

  /* status */
  --ok:           #4ADE80;   /* verified / online */
  --warn:         #F5C451;   /* caution / claims_done */
  --err:          #FF6478;   /* failed / critical */
  --info:         #6EA8FE;   /* informational */

  /* graphs (5-step categorical, color-blind safe) */
  --chart-1:      #5EE2C9;
  --chart-2:      #6EA8FE;
  --chart-3:      #C99CFF;
  --chart-4:      #F5C451;
  --chart-5:      #FF8E72;
}
```

**Discipline rules:**
- Accent is **one** colour. Don't introduce a second hue without a system update.
- Status colours map 1:1 to states; no using `--err` for "edit mode" or similar abuse.
- Never use pure black or pure white. The eye reads them as harsh on dark UIs.

### 1.2 Typography

```css
:root {
  --font-sans:  "Inter", "SF Pro Text", system-ui, sans-serif;
  --font-mono:  "JetBrains Mono", "SF Mono", ui-monospace, monospace;
  --font-display: "Inter", system-ui, sans-serif;  /* same as sans, tighter tracking */

  /* scale (modular, ratio 1.2) */
  --text-xs:    11px;   /* metadata, captions */
  --text-sm:    13px;   /* secondary body, table rows */
  --text-base:  14px;   /* primary body */
  --text-md:    16px;   /* card titles */
  --text-lg:    20px;   /* page subtitle */
  --text-xl:    28px;   /* page title / hero number */
  --text-2xl:   40px;   /* dashboard hero metric */
  --text-3xl:   56px;   /* extra-large display */

  --leading-tight:  1.2;
  --leading-normal: 1.45;
  --leading-loose:  1.6;

  --tracking-tight: -0.02em;   /* display */
  --tracking-normal: 0;
  --tracking-wide:   0.02em;   /* small caps / metadata */
}
```

**Rules:**
- Never go below 11px.
- Body copy stays at 14 base, 1.45 leading. Long-form content gets 1.6.
- Display sizes (xl+) get tight tracking + display font weight 600.
- Mono only for: PIDs, paths, IDs, code, log output.

### 1.3 Spacing

8-point base, plus 2 and 4 for tight cases.

```css
:root {
  --space-0:  0;
  --space-1:  2px;
  --space-2:  4px;
  --space-3:  8px;
  --space-4:  12px;
  --space-5:  16px;
  --space-6:  24px;
  --space-7:  32px;
  --space-8:  48px;
  --space-9:  64px;
  --space-10: 96px;
}
```

**Rules:**
- Card inner padding: `--space-5` (16) standard, `--space-6` (24) for hero cards
- Card-to-card gap: `--space-5` (16)
- Section-to-section gap: `--space-7` (32)
- Density modes (Phase O): compact = 0.875×, comfortable = 1×, spacious = 1.125×

### 1.4 Radii

```css
:root {
  --radius-sm: 6px;   /* pills, chips, small buttons */
  --radius-md: 10px;  /* inputs, cards */
  --radius-lg: 14px;  /* hero cards, modals */
  --radius-xl: 20px;  /* full panels */
  --radius-full: 999px;
}
```

### 1.5 Shadows

```css
:root {
  --shadow-1:   0 1px 2px rgba(0,0,0,0.4);
  --shadow-2:   0 4px 12px rgba(0,0,0,0.35);
  --shadow-3:   0 12px 32px rgba(0,0,0,0.45);
  --shadow-glow: 0 0 24px var(--accent-soft);
}
```

Used sparingly — dark UI prefers borders over shadows for elevation. Reserve `--shadow-3` for modals/popovers; `--shadow-glow` for active CTAs.

### 1.6 Motion

```css
:root {
  --ease-out:   cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in:    cubic-bezier(0.4, 0, 1, 1);
  --ease-inout: cubic-bezier(0.4, 0, 0.2, 1);

  --dur-fast:   120ms;
  --dur-base:   200ms;
  --dur-slow:   320ms;
  --dur-page:   480ms;
}
```

**Rules:**
- Hover = `--dur-fast`
- State transitions (open/close, toggle) = `--dur-base`
- Layout shift / page change = `--dur-slow` to `--dur-page`
- `prefers-reduced-motion` collapses all to `--dur-fast` and disables transforms

### 1.7 Density modes (Phase O)

CSS variable multiplier applied to spacing:
- `compact`:      `--density: 0.875`
- `comfortable`:  `--density: 1`     (default)
- `spacious`:     `--density: 1.125`

Components multiply their padding/gap by `var(--density)`.

---

## 2. Layout primitives

### 2.1 App shell

```
┌─────────────────────────────────────────────────┐
│  TopBar (48px, sticky)                          │
├──────┬──────────────────────────────────────────┤
│      │                                          │
│ Side │  Page                                    │
│ Bar  │                                          │
│      │                                          │
│ 240px│  fluid (max 1440 inner)                  │
│      │                                          │
├──────┴──────────────────────────────────────────┤
│  Footer (32px, sticky) — global activity ticker │
└─────────────────────────────────────────────────┘
```

- Sidebar collapsible to 64px (icons only)
- TopBar holds: search (⌘K), session/gateway pill, events live indicator, time, profile
- Footer holds: agent run counter, chat indicator, system health dot, theme toggle

### 2.2 Page grid

Single column for narrow content (<640px).
12-column for desktop.
Card grid: `repeat(auto-fill, minmax(320px, 1fr))` with `gap: var(--space-5)`.

### 2.3 Right drawer (F6 Inspector)

Fixed 360px, slides over content. Reserved for live agent stream / inspector. Z-index sits above page, below modals.

---

## 3. Widget catalogue

These are the building blocks. Phase 0.2 (Schema-Driven Forms) maps JSON Schema types to these.

### 3.1 Display

| Widget | Use | Visual |
|---|---|---|
| **StatCard** | hero number on dashboard | big number + label + sparkline + delta |
| **Pill** | status / category | rounded-full, 11px, coloured fg + soft bg |
| **Tag** | filter chip / removable | pill + ✕ on hover |
| **Donut** | percent of whole | thin ring, 60–80px, centre label |
| **Sparkline** | trend over time | 30–60 data points, no axis, hover tooltip |
| **Bar (horizontal)** | per-item ranking | label + bar + value, 28px row |
| **Bar (per-core)** | CPU per-core, fan RPM | 24px row, label left, % right |
| **Progress** | active load | 4px line, accent fill, optional label |
| **Indicator** | dot | 8px circle, pulse on active |
| **Avatar** | agent / user | 24/32/40px, initials fallback |
| **Code** | log line, ID | mono, syntax highlight optional |
| **Diff** | git diff in F7 | unified, +/- gutter, mono |

### 3.2 Input

| Widget | Use | Notes |
|---|---|---|
| **Toggle** | boolean | not checkbox; 28px wide, snap |
| **Slider** | numeric range | min/max labels, value tooltip |
| **NumberInput** | numeric exact | with stepper |
| **TextInput** | string | hint text, validation icon |
| **Textarea** | long string | autoresize, max-height |
| **Select** | enum (≤4) | pill group |
| **Dropdown** | enum (>4) | searchable, virtualised if >50 |
| **DatePicker** | date | calendar popover |
| **CronBuilder** | cron expression | visual + human preview |
| **DurationInput** | "30s" / "5m" | accepts shorthand |
| **ColorPicker** | colour | palette + hex |
| **FilePicker** | file path | uses E1 Files browser |
| **TagInput** | string array | comma/enter to add |
| **KeyValueEditor** | dict | + Add row button |
| **SecretInput** | secret string | *** + Reveal/Replace |

### 3.3 Action

| Widget | Use | Visual |
|---|---|---|
| **Button (primary)** | main CTA | accent bg, fg dark |
| **Button (secondary)** | alt action | bg-2 + line, fg primary |
| **Button (ghost)** | tertiary | transparent + fg-1, hover bg-2 |
| **Button (danger)** | destructive | err bg-soft + err fg, confirms |
| **IconButton** | toolbar | 32px, no label, tooltip on hover |
| **MenuButton** | overflow | … vertical icon, popover menu |
| **Tabs** | sub-navigation | underline-active style |
| **Segmented** | exclusive choice | pill group with bg sliding to active |

### 3.4 Container

| Widget | Use | Notes |
|---|---|---|
| **Card** | section frame | bg-1, radius-md, border line, padding 5 |
| **HeroCard** | dashboard primary | radius-lg, padding 6 |
| **Panel** | sidebar block | bg-1, radius-md, header + body |
| **Modal** | blocking interaction | overlay + card, max 640px |
| **Popover** | non-blocking | shadow-3, radius-md, arrow optional |
| **Drawer** | side panel | right or bottom |
| **Toast** | transient feedback | top-right stack, 4s default |
| **EmptyState** | "no data yet" | icon + title + description + optional CTA |
| **Skeleton** | loading shimmer | matches eventual content shape |
| **ErrorState** | failure with fix | icon + title + fix buttons (Principle 1.4) |

### 3.5 Feed

| Widget | Use | Notes |
|---|---|---|
| **ActivityRow** | one event in feed | ts + actor + summary + chevron-detail |
| **AgentRunRow** | one F7 run | status pill + name + diff stats + acceptance fraction |
| **LogTail** | live log stream | mono, auto-scroll, pause on hover |
| **EventTimeline** | grouped events | day separators, density-aware |

### 3.6 Composition (the `<Bind*>` family from Phase 0.3)

These wrap the above with live backend connections:

| Component | Wraps | Backend |
|---|---|---|
| `<Bind to="key">` | Toggle / Slider / Dropdown / etc per schema | config bus |
| `<BindList collection="...">` | repeat-row editor | CRUD endpoints |
| `<BindAction to="key">` | Button | actions registry |
| `<BindMetric to="key">` | StatCard | metrics endpoint |
| `<BindStatus to="key">` | Pill | status endpoint |
| `<BindSparkline to="key">` | Sparkline | metric history |
| `<BindFeed topic="...">` | ActivityRow list | WS topic |
| `<BindLog file="...">` | LogTail | log tail endpoint |
| `<BindIndicator to="key">` | Indicator | boolean status |

---

## 4. Iconography

- **Family:** `lucide-react` (already in repo)
- **Size:** 16/20/24 — match text-sm/base/md
- **Stroke:** 1.5
- **Colour:** `currentColor` — inherits from parent text colour
- **Rule:** every action has an icon. Every status pill has an icon. No bare buttons.

---

## 5. Page archetypes

Every page is one of these four:

### 5.1 Dashboard archetype
- Hero card (StatCard cluster, 4-up)
- Activity / chart row (ActivityFeed | Sparkline panel)
- Recent items list (DataTable)
- Examples: `/`, D2 Dashboard v2, /costs, /agents

### 5.2 Detail archetype
- Title bar with breadcrumb
- Two-column: left = navigation/list, right = detail panel
- Examples: /system (Hardware/Sensors/Battery tabs), /customise (Skills/Plugins/Connectors), /settings, E1 Files

### 5.3 Playground archetype
- Left rail: navigation (Search/Chat/Voice/Imagine/Projects/History)
- Centre: canvas with action rail right edge
- Bottom: pinned prompt/input bar with mode chips
- Right rail (optional): chat thread per node, slides in
- Examples: D-Studio (Image/Design/Video), Chat (already exists, retrofit)

### 5.4 Feed archetype
- Filter chips top
- Single scrolling list of rows
- Row click → expands inline or opens drawer
- Examples: D3 Sessions v2, /activities, /audit (F4)

---

## 6. Interaction patterns

### 6.1 Loading
- Initial fetch → Skeleton matching eventual shape (don't show spinner alone)
- Refresh while data exists → keep old data, dim slightly, show progress in corner
- Mutation in flight → optimistic update + small "saving…" near the field

### 6.2 Error
- Field-level validation → inline red message under field
- Endpoint failure → ErrorState card with fix buttons (or retry)
- Toast for transient errors only

### 6.3 Empty
- Always EmptyState with: icon, title, one-line description, optional CTA
- Never just "no data"

### 6.4 Hover / focus
- All interactive elements: 1px outline on `:focus-visible`, accent colour
- Hover on row: bg-2 transition
- Hover on icon button: bg-2, scale unchanged
- Pressed: bg-3

### 6.5 Selection
- Tap → select. Tap again → deselect or open detail.
- Multi-select: long-press / shift-click. Shows action bar at top.
- Selected row: bg-3, accent left border 2px

### 6.6 Saving feedback
Per Phase 0.2 inline indicator:
- Idle → nothing
- Editing → small pencil icon
- Saving → spinner + "saving…"
- Saved → green check, fades 1s
- Failed → red ! + tooltip
- Conflict → amber ⚠️ + Reload button

### 6.7 Confirm-destructive
- Modal with: clear destructive verb in title, what-will-happen body, cancel + danger button
- For non-recoverable: type-to-confirm (e.g. type repository name)

### 6.8 Real-time updates
- New item appears with `--dur-base` slide-in
- Updated value flashes accent for 200ms
- Removed item collapses with fade

---

## 7. The Phase 0 Compliance Pattern

Every page must implement these standard pieces in this order:

```jsx
<PageShell>
  <PageHeader title="..." subtitle="..." actions={...} />
  
  {/* Phase 0 principles enforced in shell */}
  <PageError fallback={<ErrorState fix={...} />}>
    <PageLoading skeleton={<DashboardSkeleton />}>
      <PageContent>
        {/* widgets composed from kit */}
      </PageContent>
    </PageLoading>
  </PageError>

  {/* footer info */}
  <PageMeta lastUpdated={ts} dataSource="..." />
</PageShell>
```

`PageError` includes Fix buttons. `PageLoading` shows kit Skeletons. `PageMeta` shows freshness.

---

## 8. Anti-patterns (auto-bounce)

- ❌ Hex colours in component code (use tokens)
- ❌ Pixel padding hardcoded (use `--space-*`)
- ❌ Spinner alone for initial load (use Skeleton)
- ❌ Toast for things that should be inline
- ❌ Modal for things that should be popover
- ❌ "View logs" as the only error action
- ❌ Decorative animation > 320ms
- ❌ Two accent colours
- ❌ Mono font for body copy
- ❌ Borders + shadows together on the same card (pick one)
- ❌ "Save" button when autosave fits

---

## 9. Reference matrix — what we lifted from where

| Source | What we kept | What we ignored |
|---|---|---|
| Grok Imagine | left rail nav, action rail right of canvas, pinned prompt bar with mode chips, "Saved" tabs + grid | grok branding, watermark, video-only flow |
| Obsidian Canvas | infinite zoomable workspace concept (D-Studio playground), drop-node ergonomics | full PKM linking graph (out of scope) |
| Hermes Workspace | overview tile cluster (4-up), sparkline + recent sessions list | colour palette (we use ours) |
| TenacitOS | sessions filter chips, per-row token bar, costs/budget pacing card | red-heavy palette, settings layout |
| Claude Desktop | Customise left-rail with Skills/Connectors, two-pane editor for Files, tool-permission rows with three-state allow | their exact icon set |
| exelban/stats | per-core CPU bars, fan RPM bars with min/max range, sensor temps grouped by zone | menu-bar widget format, settings panes |

---

## 10. How agents use this doc

- **Doc writer:** new page handoffs reference §3 widget names, not custom React. If a needed widget isn't here, propose adding it to §3 first.
- **Coding agent:** import widgets from `@/components/kit/*`. Never inline new colour/spacing/radius.
- **Reviewer:** bounce work that violates §8 anti-patterns.
- **Designer (me + Meg):** when adding a new pattern, update this doc first, then ship.

---

## 11. What's next

After this doc lands:

1. **Implement the kit** — `frontend/src/components/kit/` populated with the §3 widgets. Phase 0.2 + 0.3 lean on these.
2. **Retrofit existing pages** — incremental, not a big bang. Each PR brings one page closer to compliance.
3. **D-Studio first new page** — playground archetype (§5.3), demonstrates kit working end-to-end.
4. **D2 Dashboard v2 + D3 Sessions v2** — dashboard + feed archetypes, prove the kit handles those.

After those four prove the kit, every other page becomes recipe-following.

---

End of Design System v2.
