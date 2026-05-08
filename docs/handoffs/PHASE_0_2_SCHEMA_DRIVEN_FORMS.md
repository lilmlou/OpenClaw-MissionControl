# Phase 0.2 — Schema-Driven Forms

**Audience:** frontend agent (`OpenClaw-MissionControl/frontend/`)
**Owner:** Meg
**Priority:** P0 — enables Principles 1.3 No-text-editing + 1.5 In-UI extensibility
**Sister docs:** `PHASE_0_1_HOT_RELOAD_CONFIG_BUS.md`, `PHASE_0_3_BINDING_LAYER.md`

---

## 0. TL;DR

Any backend object with a JSON Schema must auto-render as a form. No bespoke per-page React. Add a field server-side → it appears in the UI. Edit the form → it updates the backend live. This is how Meg gets buttons/toggles/sliders for every setting without anyone writing UI code per setting.

---

## 0.5 Phase 0 Compliance

- [x] **Visual-first** — form widgets are visual (toggles, sliders, dropdowns) not raw inputs
- [x] **Live config** — form change → debounced PUT → bus → WS → form re-renders with confirmation
- [x] **No-text-editing** — this phase IS no-text-editing
- [x] **Self-healing** — validation errors shown inline with "Reset to default" / "Use suggested" buttons
- [x] **In-UI extensibility** — adding a `additionalProperties: true` to a schema gives the user "Add field" button automatically
- [x] **Real-time** — WS subscription keeps form in sync with bus across tabs
- [x] **Visible** — every save emits an activity event (handled by 0.1 + 0.3)

---

## 1. The problem this fixes

Every settings page today is hand-coded React per setting. To add a single toggle, an agent has to:
1. Add backend code
2. Add API route
3. Add a React component
4. Wire state
5. Add WS handling
6. Test

Meg can't do steps 3–5. The platform must do them automatically.

---

## 2. Library choice

Use **`@rjsf/core`** (React JSON Schema Form) v5 with `@rjsf/validator-ajv8`. Industry-standard, well-maintained, supports custom widgets.

Custom theme: thin wrapper that uses existing MC design tokens (`C.accent`, `C.green`, etc.) so forms look native.

**Why not roll our own:** RJSF handles enum, pattern, `oneOf`/`anyOf`, conditional fields, array items, dependencies, error rendering. Reproducing these correctly is months of work.

---

## 3. Architecture

```
Backend                              Frontend
─────────                            ─────────
GET /api/v2/config/schema/:key   →   useConfigSchema(key)
                                     │
GET /api/v2/config/:key          →   useConfigValue(key)
                                     │
                                     ▼
                                 <SchemaForm
                                   schema={schema}
                                   value={value}
                                   onChange={debounced}
                                   onSubmit={save}
                                 />
                                     │
PUT /api/v2/config/:key          ←   form change
                                     │
WS  config.set                   →   form re-syncs
```

---

## 4. Components

### 4.1 `<SchemaForm>` — the workhorse

Props:
```ts
interface SchemaFormProps {
  schema: JSONSchema7;
  uiSchema?: UiSchema;
  value: any;
  onChange?: (value, errors) => void;       // fires on every keystroke
  onSubmit?: (value) => Promise<void>;      // fires on Save
  autoSave?: boolean | { debounceMs: number }; // default 500ms
  readOnly?: boolean;
  errors?: FieldError[];                    // backend-side errors
  dataTestid?: string;
}
```

Behaviour:
- If `autoSave` is true, debounced PUT on every change. Save indicator inline (●/✓/✗).
- If false, explicit Save button at bottom.
- Inline validation: red border + message under field.
- Backend rejection: scroll to first failing field + focus.

### 4.2 Custom widgets registered with RJSF

| Schema hint | Widget | Notes |
|---|---|---|
| `type: boolean` | Toggle switch | not checkbox |
| `type: number` + `minimum`/`maximum` | Slider with input box | step honoured |
| `type: string` + `enum` ≤ 4 items | Pill group | radio-like |
| `type: string` + `enum` > 4 items | Dropdown | searchable |
| `format: color` | Colour picker | from existing palette + hex input |
| `format: duration` | Duration picker | "30s", "5m", "1h" |
| `format: cron` | Cron expression builder | with human preview |
| `format: file-path` | File picker | uses E1 Files browser |
| `format: model-id` | Model picker | uses provider registry |
| `secret: true` (custom) | Secret input | shows ***, "Reveal" / "Replace" buttons |
| `type: array` + `items.format: tag` | Tag input | comma-or-enter separated |
| `additionalProperties: true` | Key/value editor | "+ Add field" button |

### 4.3 `<SchemaPage>` — auto-generated settings page

Given a category (e.g. `models`, `cron`, `security`), renders all keys in that category as a single page with sections.

```jsx
<SchemaPage category="models" title="Models" />
```

Backend supplies grouping via `schema.category` + optional `schema.section`.

### 4.4 `<InlineSchemaField>` — single-field embed

For embedding a single setting inside an existing card (not a settings page).

```jsx
<InlineSchemaField configKey="models.cost_cap_per_day_usd" />
```

Renders just that one widget, autosaves, shows save state.

---

## 5. Hooks

```ts
useConfigSchema(key: string): { schema, ui, loading, error }
useConfigValue<T>(key: string): { value: T, set: (v) => Promise, version, loading }
useConfigCategory(category: string): { keys: string[], schemas, values }
useConfigBulk(keys: string[]): { values, schemas, bulkSet }
```

All hooks subscribe to the WS topic for the keys they read so changes from other tabs / actors push through automatically. Use the existing gateway WS (do NOT open a second socket).

---

## 6. UI patterns

### 6.1 Save state indicator (per-field for autosave forms)

| State | Visual |
|---|---|
| Idle | nothing |
| Editing | small pencil icon |
| Saving | spinner + "saving…" |
| Saved | green check, fades after 1s |
| Failed | red ! + tooltip with error |
| Conflict (version mismatch) | amber ⚠️ + "Reload" button (re-fetches and resets) |

### 6.2 Reset and defaults

Every field has a context menu (right-click or … button):
- Reset to default
- Copy current value
- View schema (debug)
- Show change history (Phase 0.1 has version, future surface)

### 6.3 Adding custom fields (extensibility)

When schema has `additionalProperties: true`, render an "Add field" button below the form. Click → row with key/value/type inputs → save → field added to backend.

This is the primary mechanism for Principle 1.5.

---

## 7. Settings shell page

Build `/settings` as a 2-pane layout:

```
+----------------------+----------------------------------+
| Categories           | Selected category                |
|                      |                                  |
|  Models      12      |  <SchemaPage category="models"/> |
|  Cron         5      |                                  |
|  Security     3      |                                  |
|  Appearance   8      |                                  |
|  Agents       6      |                                  |
|  Features    14      |                                  |
|  Quota        4      |                                  |
+----------------------+----------------------------------+
```

Categories come from `GET /api/v2/config/categories`. Counts are live.

Search box at top filters across all keys (key + title + description).

URL state: `/settings?category=models&search=ollama`.

---

## 8. Acceptance

- [ ] `<SchemaForm>` renders any valid JSON Schema 7 with appropriate widgets
- [ ] Toggling a boolean field → backend updates within 1s, visual confirmation appears
- [ ] Two tabs open on same field → editing in tab A reflects in tab B within 1s
- [ ] Setting an invalid value → field shows error inline, previous value retained
- [ ] Adding a custom field via "Add field" button → persists, appears on refresh
- [ ] `/settings` page lists all categories with live counts
- [ ] Slider widget for `cost_cap_per_day_usd` (number with min/max) works on touch + mouse
- [ ] Cron format builder shows human preview ("Every weekday at 9am") for cron expressions
- [ ] Secret fields display *** until "Reveal" pressed; saving emits set without leaking previous value to logs
- [ ] All form widgets keyboard-accessible (Tab + Enter + arrow keys)
- [ ] No `<input type="text">` rendered for fields that have a more specific widget
- [ ] `npm run build` clean

---

## 9. Out of scope

- Form layouts more complex than vertical sections (no tabs-within-tabs, no wizards)
- Per-user permission gating per field (every field is editable by Meg for now)
- Localisation / i18n (English only)
- Print / export to PDF
- "Diff against default" view (deferred)
- Conditional show/hide via `dependencies` keyword — RJSF supports it; we do not extend it

---

## 10. Why this phase first

After 0.1 + 0.2 + 0.3 land:
- Every existing settings UI gets simpler
- Every new feature ships its config UI for free (just register schema + default)
- Meg can add fields herself via the UI without bothering an agent

---

End of Phase 0.2 handoff.
