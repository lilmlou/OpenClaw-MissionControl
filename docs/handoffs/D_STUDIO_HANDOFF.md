# D-Studio — Creative Playground Page

**Audience:** combined backend + frontend agents
**Owner:** Meg
**Repo root:** `/Volumes/🦋• Drive   1/MC-CLAW/OpenClaw-MissionControl/`
**Required reading:** `DESIGN_SYSTEM_V2.md`, `PHASE_0_PRINCIPLES.md`, `BACKEND_PRINCIPLES_UPDATE.md`
**Reference:** Grok Imagine + Agent Beta, Obsidian Canvas
**Sister:** uses existing `/api/v2/design/*` route stubs

---

## 0. TL;DR

Replace the current `/design` page (stub) with a creative playground combining Grok Imagine's flow and Obsidian Canvas's freedom. Drop images / prompts / references onto a canvas, generate variations, edit per-node, chat-thread per node, all live. Backend wires through the existing `/api/v2/design/*` routes (currently returning `provider_unconfigured`).

This is the first **playground archetype** page (Design System §5.3). It proves the kit handles canvas-style UIs.

---

## 0.5 Phase 0 Compliance

- [ ] Visual-first — entire page is canvas + thumbnails, zero raw text logs
- [ ] Live config — generation params (model, aspect, quality) bound via `<Bind>`
- [ ] No-text-editing — all settings via the prompt bar / mode chips, not files
- [ ] Self-healing — provider unconfigured → ErrorState with "Configure provider" Fix button
- [ ] In-UI extensibility — "Add reference" button accepts image upload / URL / paste
- [ ] Real-time — generation progress streams via WS; multi-tab synced
- [ ] Visible — every generation logged to activity feed

---

## 1. Page anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar (existing)                                                     │
├────┬─────────────────────────────────────────────────────────────────┤
│    │  Canvas toolbar: Zoom / Fit / Add / Export    [Project ▾]   ⋯  │
│ N  ├─────────────────────────────────────────────────────────────────┤
│ a  │                                                                 │
│ v  │     ┌──────┐                                                    │
│    │     │ Ref  │     ┌─────────────┐                                │
│ R  │     └──────┘     │             │       ┌──────┐                 │
│ a  │                  │   Active    │ ⚪ ❤  │ Var  │                 │
│ i  │                  │  Generation │ ⚪ ↻  └──────┘                 │
│ l  │                  │             │ ⚪ ⬇                           │
│    │                  └─────────────┘ ⚪ ⤴                           │
│    │                                  ⚪ 🎬                           │
│    │                                                                 │
│    │                                                                 │
│    │                                                                 │
│    ├─────────────────────────────────────────────────────────────────┤
│    │  ┌─ Prompt bar ────────────────────────────────────────────┐    │
│    │  │  +  Type to imagine…                              ↑     │    │
│    │  │  [Agent] [Image] [Video] · Speed · Quality · 16:9      │    │
│    │  └────────────────────────────────────────────────────────┘    │
└────┴─────────────────────────────────────────────────────────────────┘
                                                          ┌──────────┐
                                                          │ Chat per │
                                                          │ selected │
                                                          │  node    │
                                                          │ (drawer) │
                                                          └──────────┘
```

### 1.1 Left rail (240px, existing app sidebar collapsed)

Reuses app sidebar. No special D-Studio nav.

### 1.2 Canvas toolbar (top of page content)

- **Zoom** — slider 25–400%, fit, 100%
- **Fit** — fit all nodes
- **Add** — popover: image upload, URL paste, text note, link node
- **Export** — current selection or whole canvas as PNG/PDF
- **Project** — dropdown of saved canvases, "+ New Project"
- **⋯** — overflow: rename, duplicate, delete, share, settings

### 1.3 Canvas area

Infinite, zoomable, pannable. Uses an existing library — propose **`reactflow`** (already common in similar tools) or **`tldraw`** (more freeform). Default to `reactflow` for predictable node-edge model.

**Node types:**
| Type | Source | Visual |
|---|---|---|
| `image` | uploaded / generated | thumbnail + caption + status pill |
| `prompt` | typed text | small text card with "→ Generate" action |
| `reference` | image URL / pasted | thumbnail with link icon |
| `note` | markdown | small markdown card, edit-in-place |
| `result` | generation output | image + variations strip + actions |
| `video` | generated video | thumbnail + ▶ overlay |

**Node interactions:**
- Click → select (highlight border accent)
- Click again → open in centre stage (zoomed)
- Drag → reposition (snap to 8px grid optional)
- Right-click / `⋯` → menu: duplicate, delete, send to chat, regenerate, download
- Double-click empty canvas → drop a prompt node at cursor

**Connections:**
- Drag from node edge → another node = parent/child relationship
- Used to mean "this generation came from this prompt" or "this variation came from this image"
- Visual: thin line, accent on hover

### 1.4 Action rail (right of selected node)

Stacked vertically when a node is selected, fades when nothing selected:

| Icon | Action |
|---|---|
| ❤ | Favourite |
| ✕ / 🐦 | Share |
| ↻ | Regenerate |
| ⬇ | Download |
| ⤴ | Send to chat (opens right drawer) |
| 🎬 | Make video (image → video flow) |
| ⋯ | Overflow |

### 1.5 Prompt bar (pinned bottom)

```
┌────────────────────────────────────────────────────────────┐
│ ＋  Type to imagine…                                    ↑ │
│ [Agent ▾] [Image] [Video]   Speed | Quality   16:9 ▾       │
└────────────────────────────────────────────────────────────┘
```

- **`+`** button — add reference image to the prompt (up to 4)
- **Mode chips:** Agent / Image / Video (mutually exclusive)
- **Speed | Quality** — segmented control
- **Aspect ratio** — dropdown: 1:1, 4:3, 3:4, 16:9, 9:16, 21:9
- **`↑`** submit
- **Voice button** (mic icon) — optional later

Mode chips are `<Bind to="design.mode">`. Speed/Quality and aspect are `<Bind>` too — **all settings live, no restart**.

### 1.6 Right drawer — chat per node

Slides in 360px when "Send to chat" or `⤴` clicked on a node, OR when user double-clicks chat icon on a node.

- Header: node thumbnail + title + ✕ close
- Body: chat thread tied to that node's generation
- Bottom: prompt input scoped to node (e.g. "make this brighter")
- Closes restore canvas to full width

### 1.7 Saved view (mode toggle in canvas toolbar)

A second view: grid of all canvases / saved generations. Tabs at top: **Full / Compact / All / + New tag**. Same prompt bar bottom (creates new generation, drops into current canvas).

This mirrors Grok Imagine's "Saved" page. It's a different canvas mode, not a different route.

---

## 2. Backend

### 2.1 Existing routes (status: stubs)

```
POST /api/v2/design/generate            currently provider_unconfigured
GET  /api/v2/design/generations         currently provider_unconfigured
```

Keep these. Extend.

### 2.2 New routes

```
GET    /api/v2/design/projects                    list saved canvases
POST   /api/v2/design/projects                    create canvas
GET    /api/v2/design/projects/:id                load canvas (nodes + edges)
PUT    /api/v2/design/projects/:id                save canvas state
DELETE /api/v2/design/projects/:id

POST   /api/v2/design/generate                    EXISTING — extend
       body: {prompt, mode, aspect, quality, refs[], project_id?, parent_node_id?}
       → returns: {generation_id, status: 'queued', node_id}
       → WS streams progress + final URL

GET    /api/v2/design/generations/:id             status + result
DELETE /api/v2/design/generations/:id             delete output

POST   /api/v2/design/upload                      upload reference
       multipart, returns {ref_id, url, dims}

POST   /api/v2/design/video                       image → video
       body: {source_image_id, motion_prompt?, duration_s}

WS     /api/ws/design                             live progress + canvas updates
```

### 2.3 Provider config (via Phase 0.1 bus)

Register as bus keys so Meg can configure providers from /settings without files:

| Key | Schema |
|---|---|
| `design.provider.image` | enum: `openai-dalle3`, `stability`, `fal`, `replicate`, `none` |
| `design.provider.video` | enum: `runway`, `pika`, `fal-video`, `none` |
| `design.providers.openai.api_key` | secret string |
| `design.providers.stability.api_key` | secret string |
| `design.providers.fal.api_key` | secret string |
| `design.default_model.image` | string (model id depends on provider) |
| `design.default_model.video` | string |
| `design.default_aspect` | enum: 1:1, 4:3, 3:4, 16:9, 9:16, 21:9 |
| `design.default_quality` | enum: speed, balanced, quality |
| `design.cost_cap_per_day_usd` | number |

When `design.provider.image == "none"` → endpoints return `{available: false, error: "no_provider", fix: [{label: "Configure provider", action: "open_settings", args: {category: "design"}}]}`.

### 2.4 Storage

Mongo collections:
- `design_projects` — `{id, name, owner, nodes: [], edges: [], created_ts, updated_ts}`
- `design_generations` — `{id, project_id, parent_node_id, prompt, mode, params, status, output_url, cost_estimate_usd, ts}`
- `design_references` — uploaded ref images metadata

Files: store generated images on local disk under `backend/data/design/<project_id>/<gen_id>.<ext>`. Serve via `/api/v2/design/files/:path`.

### 2.5 WS events

```
design.generation.queued     {gen_id, project_id, node_id}
design.generation.progress   {gen_id, percent}
design.generation.complete   {gen_id, url, cost}
design.generation.failed     {gen_id, error, fix[]}
design.canvas.changed        {project_id, change_type, payload}  for multi-tab sync
```

---

## 3. Frontend tasks

### 3.1 New components in kit (extend `DESIGN_SYSTEM_V2.md` §3)

- `<CanvasNode kind="image|prompt|reference|note|result|video" />`
- `<CanvasToolbar>`
- `<CanvasActionRail>`
- `<PromptBar modes={...} aspect={...} />`
- `<NodeChatDrawer node={...} />`

### 3.2 Page assembly

`frontend/src/pages/DStudioPage.js`:
- Wraps `<PageShell>` with `<PageError>` showing "Configure provider" if `design.provider.image == "none"`
- Loads project from URL `?project=<id>` (default: most-recent or "+ New")
- Renders `<Canvas>` (`reactflow` instance) with project nodes/edges
- Subscribes to `/api/ws/design` for live generation progress

### 3.3 Hooks

- `useDesignProject(id)` — load + autosave canvas state
- `useDesignGeneration(genId)` — track one generation
- `useDesignProviders()` — read provider status from bus

### 3.4 Settings page section

Add a category "Design" to /settings using `<BindCategory category="design" />`. Auto-renders all keys in §2.3. Zero hand-coded React per setting.

---

## 4. Acceptance

- [ ] `/design` loads with empty canvas + prompt bar; no errors when provider unconfigured (shows fix CTA instead)
- [ ] Configure a provider via /settings → /design's error state clears within 1s (WS-driven)
- [ ] Type prompt in bar → submit → node appears on canvas with "queued" status
- [ ] Generation progress streams to node within 1s of backend updates
- [ ] Completed image appears as image node, click → opens detail
- [ ] Action rail right of selected node — Regenerate creates new node connected to source
- [ ] Send to chat opens right drawer with thread scoped to that node
- [ ] Drag node → position persists after refresh
- [ ] Two browser tabs on same project → adding node in tab A appears in tab B within 1s
- [ ] Switch between projects via dropdown — state preserved
- [ ] Saved view tab shows grid of all generations across projects
- [ ] Aspect ratio change persists across sessions (it's a bus setting)
- [ ] Provider failure → node shows ErrorState with fix buttons (e.g. "Switch provider")
- [ ] No `<input type="text">` for any field that has a more specific widget (per Design System §3.2)
- [ ] Activity feed shows entry per generation start/complete/fail
- [ ] All hard-coded hex / px in this page = zero (only tokens)
- [ ] `npm run build` clean

---

## 5. Out of scope

- Real-time collaboration (multiple users on same canvas) — single-user for now
- Video editing beyond image-to-video — no timeline editor
- Inpainting / outpainting UI — backend may support, frontend doesn't expose yet
- Style transfer fine-tuning
- LoRA training (Phase M)
- Public sharing of canvases — local only

---

## 6. Implementation order

Phased so it's usable at each step:

1. **Stage 1** — page shell, canvas with empty state, prompt bar, mode chips. No backend wired. (~2 h frontend)
2. **Stage 2** — backend bus keys + provider config + ErrorState rendering. (~2 h backend)
3. **Stage 3** — single-image generation flow, no project persistence. (~3 h combined)
4. **Stage 4** — projects + canvas state save/load. (~3 h combined)
5. **Stage 5** — WS live progress + multi-tab sync. (~2 h combined)
6. **Stage 6** — action rail, regen, send-to-chat drawer, saved view. (~3 h combined)
7. **Stage 7** — image-to-video flow. (~2 h combined)

Total ~17 hours combined effort. Stages 1–3 ship the trialable MVP.

---

End of D-Studio handoff.
