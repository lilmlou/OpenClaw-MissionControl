# Mission Control — Design System Spec

> **Status:** Imported 2026-05-06. Will be applied during **Phase D polish**
> (after Sprints 2–4 ship). Do not retrofit existing pages until then.

## Decisions baked in (Meg, 2026-05-06)

1. **Palette — hybrid.** One design system, applied globally, with red preserved as brand identity.
   - **Primary CTAs** (Send, Generate, Save, Run, Dispatch): blue `#3b82f6`
   - **Brand accent** (logo, avatar ring, "live" indicators, signature moments): red `#ff304e` *kept*
   - **Status badges**: semantic palette per spec (success/warning/danger/info)

2. **Radius.** Pills (`--radius-full`) for primary CTAs; `--radius-md` (8px) for secondary/functional buttons. Apply globally during Phase D rollout.

3. **Tailwind.** Translate the `.ts` config below to `.js` for our CRA stack.

## Scraped from Grok Imagine + ChatGPT Images 2.0
### Compiled: 5 May 2026

---

## 1. GROK IMAGINE — Authenticated Dark Mode (from screenshot)

### Color Palette (Dark Theme)
```
Surface ground:    #0d0d0d (near-black — body bg)
Surface sidebar:   #131313 (slightly lighter than body)
Surface card:      #1a1a1a (hover states, active items)
Surface input:     #1f1f1f (composer bar)

Text primary:      #f5f5f5 (body, headings)
Text secondary:    #9e9e9e (sidebar labels, metadata)
Text muted:        #636363 (placeholders, timestamps)

Border subtle:     #1f1f1f (dividers, card edges)
Border default:    #2a2a2a (input borders)

Accent (glow):     #3b82f6 (blue, active nav, send button)
Accent (warning):  #f59e0b (gold highlights in artwork)

Danger:            #ef4444
```

### Sidebar Layout (Left, ~240px)
```
┌──────────────────┐
│ [Grok Logo]  [≡] │  ← Logo + collapse toggle
│                  │
│ ● Search         │  ← Navigation items with icons
│ ● Chat           │
│ ● Voice          │
│ ● Imagine  [■]   │  ← Active item highlighted
│                  │
│ + New Project    │  ← CTA button
│                  │
│ ───────────────  │  ← Divider
│                  │
│ History          │
│ • macOS Icon...  │  ← Recent queries, truncated
│ • macOS App...   │
│ • Precise 50%... │
│ • Image Edit...  │
│ • Precise AI...  │
│ • Outpainting... │
│                  │
│            [D]   │  ← User avatar (bottom)
└──────────────────┘
```

### Main Workspace
```
│ [Image canvas — full bleed dark bg]          │
│                                               │
│   [variation   [Main       [♥] [↗] [↻] [↓]  │
│    thumbnails]  Artwork]   [⬆] [⋯]           │
│                                               │
│   [Make video ▸]     ← bottom-right overlay  │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ "Describe your edit, @ to reference..."  │  │
│ │ [🖼] [📹]                         [→]   │  │
│ └─────────────────────────────────────────┘  │
```

### UI Elements (from screenshot)

**Navigation items:**
- Icon + label, 14px, font-weight 500
- Active: background highlight (slightly lighter), left border accent
- Inactive: text-secondary (#9e9e9e)

**Input/Composer bar:**
- Rounded pill, ~48px height
- bg: #1f1f1f, border: #2a2a2a
- Placeholder text: #636363, 14px
- Icons inside: upload, video toggle, send (arrow)
- Send button: solid blue circle (#3b82f6 bg, white arrow)

**Variation thumbnails (left strip):**
- 7 square thumbnails in vertical stack
- ~56px each, rounded corners
- Selected: brighter border/glow

**Image action buttons (right strip):**
- Vertical column of circular icon buttons
- bg: semi-transparent dark (#1a1a1a/80)
- Icons: heart, share (X), refresh, download, upload, more
- ~36px circles, 8px gap

**Make Video button:**
- Bottom-right overlay on image
- Pill shape, camera icon + text
- Semi-transparent dark bg with white text

---

## 2. GROK IMAGINE — Public Light Mode (scraped CSS tokens)

### Colors (Light)
```
Black (#050505)       — primary text, filled buttons
Martini (#9e9e9e)     — secondary text
Athens Gray (#f4f4f5) — page bg
Dove Gray (#636363)   — muted text
Tuna (#3f3f46)        — borders

Surface:  #fcfcfc — body
Cards:    #f2f2f2 — template card bg
Cards:    oklch(99.24% 0 none/.8) — elevated cards
Border:   oklch(90.01% 0 none/.38) — input borders
Filled:   oklch(11.57% 0 none) — primary buttons
```

### Typography
```
Font stack: Universal Sans, Inter, Roboto, Open Sans, Arial, sans-serif

14px / font-weight 550 / line-height 21px  — buttons, nav items
16px / font-weight 400 / line-height 24px  — body text
13px / font-weight 400 / line-height 19.5px — captions
30px / font-weight 700 / line-height 36px  — hero headings
20px / font-weight 550 / line-height 28px  — section headers
```

### Radius System
```
4px, 6px, 8px, 12px — used across components
Pill buttons: 9999px
Cards: 2px (very sharp)
```

### Shadows
```
sm: rgba(56, 87, 199, 0.5) — accent-tinted for focus rings
```

---

## 3. CHATGPT IMAGES 2.0 — Light Mode (scraped CSS tokens)

### Colors
```
White (#ffffff)       — body bg
Gray-75 (#f2f2f2)    — secondary surfaces
Gray-150 (#e8e8e8)   — pressed/sunken states
Gray-975 (#0c0c0c)   — near-black text

Text primary:         #0d0d0d
Text tertiary:        #8f8f8f
Text placeholder:     rgba(0,0,0,0.7)

Primary CTA bg:       #0d0d0d
Primary CTA text:     #ffffff
Outline border:       rgba(0,0,0,0.15)
Blue theme:           #e5f3ff (soft), #0169cc (text)
Orange theme:         #ffe7d9 (soft), #e25507 (text)
Pink theme:           #ba437a
Danger:               #e02e2a, #ba2623 (darker)
Success:              #04b84c
Warning:              #e25507

Sidebar surface:      #ececec (secondary bg)
```

### Typography
```
Font stack: -apple-system-body, ui-sans-serif, -apple-system, system-ui,
            Segoe UI, Helvetica, Apple Color Emoji, Arial, sans-serif

Mono: ui-monospace, SF Mono, Fira Code, JetBrains Mono, monospace

Heading:   1.75rem (28px) / font-weight 600
Base:      16px / line-height calc(1.5 / 1) = 24px
Small reg: line-height 1.125rem (18px)
Footnotes: 0.8125rem (13px)
Monospace: 0.9375rem (15px)
```

### Radius
```
2rem (32px)  — 4xl: large containers, hero cards
8px          — standard buttons
Pill         — CTA buttons (3.355e+07px = effectively infinite)
```

### Shadows
```
Inset ring: 0 0 #0000 (no shadow by default)
```

---

## 4. RECOMMENDED DESIGN TOKENS FOR MISSION CONTROL

### Color Tokens (Dark Mode — Primary)

```css
:root, .theme-dark {
  color-scheme: dark;

  /* Surfaces — depth hierarchy */
  --surface-ground:    #0a0a0a;  /* Deepest bg — page */
  --surface-default:   #0f0f0f;  /* Main content area */
  --surface-raised:    #141414;  /* Sidebar, cards */
  --surface-overlay:   #1a1a1a;  /* Hover, active items */
  --surface-input:     #141414;  /* Input fields */
  --surface-tooltip:   #1f1f1f;  /* Tooltips, popovers */

  /* Text */
  --text-primary:      #ededed;  /* Body, headings */
  --text-secondary:    #9a9a9a;  /* Labels, metadata */
  --text-tertiary:     #6a6a6a;  /* Placeholders, disabled */
  --text-on-accent:    #ffffff;  /* Text on blue CTA */

  /* Borders */
  --border-subtle:     #1f1f1f;  /* Dividers, card edges */
  --border-default:    #2a2a2a;  /* Input borders */
  --border-strong:     #3f3f3f;  /* Focus rings */
  --border-accent:     #3b82f6;  /* Active selection */

  /* Actions */
  --primary:           #3b82f6;  /* Blue CTA, send, active */
  --primary-hover:     #2563eb;  /* Darker blue on hover */
  --primary-soft:      #1e3a5f;  /* Blue bg for selected chips */

  /* Brand (Mietorá heritage) */
  --brand:             #ff304e;  /* Logo, avatar ring, live dots */
  --brand-soft:        rgba(255, 48, 78, 0.18);

  /* Status */
  --success:           #22c55e;  --success-soft: #0f2f1a;
  --warning:           #f59e0b;  --warning-soft: #2f2410;
  --danger:            #ef4444;  --danger-soft:  #2f1010;
  --info:              #3b82f6;  --info-soft:    #1e3a5f;
}
```

### Color Tokens (Light Mode — Alternate)

```css
.theme-light {
  color-scheme: light;

  --surface-ground:    #fcfcfc;
  --surface-default:   #ffffff;
  --surface-raised:    #f7f7f8;
  --surface-overlay:   #f2f2f2;
  --surface-input:     #ffffff;
  --surface-tooltip:   #ffffff;

  --text-primary:      #0d0d0d;
  --text-secondary:    #636363;
  --text-tertiary:     #8a8a8a;
  --text-on-accent:    #ffffff;

  --border-subtle:     #ebebeb;
  --border-default:    #d9d9d9;
  --border-strong:     #bfbfbf;
  --border-accent:     #3b82f6;

  --primary:           #2563eb;
  --primary-hover:     #1d4ed8;
  --primary-soft:      #e5f3ff;

  --brand:             #ff304e;
  --brand-soft:        rgba(255, 48, 78, 0.12);

  --success:           #0f9f6e;  --success-soft: #e8f7f0;
  --warning:           #d97706;  --warning-soft: #fff4e5;
  --danger:            #dc2626;  --danger-soft:  #feecec;
  --info:              #2563eb;  --info-soft:    #e5f3ff;
}
```

---

### Typography Scale

```css
:root {
  --font-sans: 'Inter', 'Universal Sans', ui-sans-serif, system-ui,
               -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace,
               'SF Mono', 'Fira Code', monospace;

  /* Scale anchored at 16px */
  --text-xs:   0.75rem;   /* 12px — captions, badges */
  --text-sm:   0.875rem;  /* 14px — buttons, nav, metadata */
  --text-base: 1rem;      /* 16px — body, inputs */
  --text-lg:   1.125rem;  /* 18px — card titles */
  --text-xl:   1.25rem;   /* 20px — section headers */
  --text-2xl:  1.5rem;    /* 24px — page titles */
  --text-3xl:  1.75rem;   /* 28px — hero headings */

  /* Line heights */
  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Weights */
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;
}
```

### Spacing Scale (4px grid)

```css
--space-0:  0;
--space-1:  0.25rem;  /* 4px */
--space-2:  0.5rem;   /* 8px */
--space-3:  0.75rem;  /* 12px */
--space-4:  1rem;     /* 16px */
--space-5:  1.25rem;  /* 20px */
--space-6:  1.5rem;   /* 24px */
--space-8:  2rem;     /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Radius System

```css
--radius-xs:   4px;    /* Small chips, code */
--radius-sm:   6px;    /* Media thumbnails, tight inputs */
--radius-md:   8px;    /* Buttons, inputs, standard */
--radius-lg:   12px;   /* Cards, panels, dropdowns */
--radius-xl:   16px;   /* Modals, dialogs */
--radius-2xl:  24px;   /* Hero containers */
--radius-full: 9999px; /* Pills, CTAs, chips, toggles */
```

### Shadows

```css
--shadow-xs:     0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-sm:     0 1px 3px rgba(0, 0, 0, 0.4);
--shadow-md:     0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-lg:     0 8px 24px rgba(0, 0, 0, 0.6);
--shadow-command: 0 -4px 16px rgba(0, 0, 0, 0.5);

/* Accent glow (for active/selected states) */
--glow-accent:   0 0 0 2px var(--border-accent);
--glow-primary:  0 0 12px rgba(59, 130, 246, 0.3);
--glow-brand:    0 0 18px rgba(255, 48, 78, 0.35);
```

---

## 5. COMPONENT SPECS

### Sidebar Pattern (from Grok screenshot)

```
Width: 240px (collapsible to 48px icon-only)
BG: var(--surface-raised)
Border: right 1px var(--border-subtle)

┌─────────────────────────┐
│ [Logo]  24px icon       │  ← Logo + toggle
│         16px padding    │
│                         │  ← 12px gap
│ [Icon] Search  14px/500 │  ← Nav items
│ [Icon] Chat    14px/500 │  ← 8px gap between items
│ [Icon] Voice   14px/500 │  ← 4px left padding when active
│ [■] Imagine    14px/500 │  ← Active: bg accent-soft, left border accent
│                         │
│ + New Project  pill CTA │  ← 14px/500, accent/white text
│                         │
│ ─────────────  divider  │  ← 1px border-subtle
│                         │
│ History  12px/400 caps  │  ← Section header
│ • item 1                │  ← Truncated, 12px/400, secondary text
│ • item 2                │  ← max-width fill, ellipsis
│ • item 3                │
│                         │
│              [avatar]   │  ← 28px circle, pinned bottom
└─────────────────────────┘
```

### Input/Composer Bar Pattern

```
Height: ~48px (pill shape)
BG: var(--surface-input)
Border: 1px var(--border-default)
Border-radius: var(--radius-full)

┌──────────────────────────────────────────┐
│ [📎]  "Describe your edit..." [🎥] [→]  │
│  8px    placeholder 14px/400              │
│        text-secondary                     │
└──────────────────────────────────────────┘

Internal spacing:
- Icons: 36px circles, 8px gap
- Input text: 16px, 8px horizontal padding
- Send button: accent bg circle, white icon, 36px, margin-left auto
```

### Variation Thumbnails Pattern (from Grok)

```
Vertical strip, left side of canvas
- 56px × 56px squares
- 6px radius
- 4px gap between thumbnails
- Active: 2px accent border + glow
- Inactive: 1px border-subtle
- 12px offset from image
```

### Image Action Buttons (from Grok)

```
Vertical column, right side of canvas
- 40px circles, semi-transparent bg
- bg: rgba(26, 26, 26, 0.7)
- backdrop-filter: blur(8px)
- 8px gap between buttons
- Icons: 20px, white or secondary text
- Hover: bg opacity increases to 0.9
```

### Make Video Button (from Grok)

```
Position: absolute bottom-right of image
- Pill shape, 36px height
- bg: rgba(26, 26, 26, 0.8)
- text: 14px/500, white
- icon: camera, 16px
- gap: 6px icon-text
- padding: 8px 16px
```

### Results Grid (from ChatGPT)

```
Grid: auto-fill, minmax(220px, 1fr)
Gap: 16px
Padding: 24px

Card:
- bg: var(--surface-raised)
- border: 1px var(--border-subtle)
- border-radius: var(--radius-lg) 12px
- overflow: hidden

Card media:
- aspect-ratio: 1/1
- bg: var(--surface-overlay)
- object-fit: cover

Card meta:
- padding: 12px
- gap: 4px between lines
- Title: 14px/500, primary text, 1 line truncate
- Subtitle: 12px/400, tertiary text
- Status badge: absolute top-right of card
```

### Status Badges

```
Pill shape, 6px-8px padding horizontal, 2px vertical
Font: 12px/500

Queued:   bg surface-input, secondary text
Running:  bg info-soft (#1e3a5f), info text (#3b82f6) + pulsing dot
Complete: bg success-soft (#0f2f1a), success text (#22c55e)
Failed:   bg danger-soft (#2f1010), danger text (#ef4444)
```

### Button Hierarchy

```
PRIMARY (CTAs — use sparingly, one per view max)
  bg: var(--primary) #3b82f6
  text: white, 14px/500
  radius: full (pill)
  height: 36-40px
  padding: 8px 20px
  hover: var(--primary-hover) #2563eb

  Examples: Generate, Run, Send, Save, Dispatch

SECONDARY (tool actions)
  bg: transparent
  border: 1px var(--border-default) #2a2a2a
  text: var(--text-secondary), 14px/500
  radius: var(--radius-md) 8px or full
  height: 36px
  padding: 8px 16px
  hover: bg var(--surface-overlay)

  Examples: Cancel, Reset, Download, Settings

GHOST (low-emphasis, filters, chips)
  bg: transparent
  text: var(--text-secondary), 14px/500
  radius: full
  height: 32px
  padding: 6px 12px
  hover: bg var(--surface-overlay)

  Examples: Filters, tags, nav items

DANGER
  bg: var(--danger-soft) #2f1010
  text: var(--danger) #ef4444
  radius: var(--radius-md)
  height: 36px
  hover: bg darker red

  Examples: Delete, Remove, Destructive actions

ICON ONLY
  width: 36px, height: 36px, center icon
  radius: full
  bg: transparent
  hover: bg var(--surface-overlay)

  Examples: Like, share, refresh, download (image actions)
```

---

## 6. LAYOUT ARCHITECTURE

### Desktop Shell (>=1280px)

```
┌──────────────────────────────────────────────────────────────┐
│  TOP BAR: 48px                                               │
│  [Logo]  Workspace ▼  Model ▼  ·  ·  ·  [Search] [User]    │
│  bg: surface-raised, border-bottom: 1px border-subtle       │
├───────────┬────────────────────────────────────┬─────────────┤
│           │                                     │             │
│  SIDEBAR  │          MAIN CANVAS               │  INSPECTOR  │
│  240px    │                                     │  320px      │
│           │  ┌─ Preset rail (if applicable) ──┐ │             │
│  Nav      │  │  [card] [card] [card] [card]   │ │  • Params   │
│  History  │  └────────────────────────────────┘ │  • Settings │
│  Projects │                                     │  • Details  │
│           │  ┌─ Results grid ─────────────────┐ │  • Logs     │
│           │  │  [  ] [  ] [  ] [  ]           │ │             │
│           │  │  [  ] [  ] [  ] [  ]           │ │             │
│           │  │  [  ] [  ] [  ] [  ]           │ │             │
│           │  └────────────────────────────────┘ │             │
│           │                                     │             │
│           │  ┌─ Command bar (sticky bottom) ───┐│             │
│           │  │  "Describe..."             [→]  ││             │
│           │  └────────────────────────────────┘│             │
└───────────┴────────────────────────────────────┴─────────────┘
```

### Responsive Breakpoints

```
>= 1280px        Full 3-pane layout
1024px - 1279px  Inspector becomes slide-over drawer
768px - 1023px   Sidebar collapses to icon rail (48px)
< 768px          Single column, bottom sheet navigation
```

---

## 7. TAILWIND CONFIG (Copy-Paste — JS for CRA stack)

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          ground:   'var(--surface-ground)',
          DEFAULT:  'var(--surface-default)',
          raised:   'var(--surface-raised)',
          overlay:  'var(--surface-overlay)',
          input:    'var(--surface-input)',
          tooltip:  'var(--surface-tooltip)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          onaccent:  'var(--text-on-accent)',
        },
        border: {
          subtle:  'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong:  'var(--border-strong)',
          accent:  'var(--border-accent)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover:   'var(--primary-hover)',
          soft:    'var(--primary-soft)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          soft:    'var(--brand-soft)',
        },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger:  { DEFAULT: 'var(--danger)',  soft: 'var(--danger-soft)'  },
        info:    { DEFAULT: 'var(--info)',    soft: 'var(--info-soft)'    },
      },
      fontFamily: {
        sans: ['Inter', '"Universal Sans"', 'ui-sans-serif', 'system-ui',
               '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace',
               '"SF Mono"', '"Fira Code"', 'monospace'],
      },
    },
  },
};
```

---

## 8. QUICK IMPLEMENTATION START (Phase D)

### 1. Copy the dark theme CSS variables above into `:root` / `.theme-dark`
### 2. Translate the Tailwind config above into `frontend/tailwind.config.js`
### 3. Build in this order:
   - **AppShell** — top bar + sidebar + main canvas
   - **Sidebar** — nav items, history list, user avatar
   - **CommandBar** — sticky pill input + send button
   - **ResultsGrid** — auto-fill grid of cards
   - **ImageCard** — media + meta + status badge
   - **Button** — primary/secondary/ghost/danger/icon variants
   - **StatusBadge** — pill with colored soft bg
   - **InspectorPanel** — collapsible right panel for settings

### 4. Key design rules:
   - **90% neutral** — surfaces, text, borders stay in the dark palette
   - **One action color** — blue (#3b82f6) for active, focus, CTAs
   - **One brand color** — red (#ff304e) for logo, avatar ring, "live" indicators (Mietorá heritage; do not use as a generic accent)
   - **Pills for CTAs**, rounded-md (8px) for functional buttons
   - **Content provides color** — let generated images pop against the dark shell
   - **Sticky command bar** always visible
   - **Collapsible everything** — sidebar and inspector toggle

---

## Sources
- Grok Imagine (public): web_scrape + CSS variable extraction via browser console
- Grok Imagine (authenticated dark mode): screenshot analysis by Meg
- ChatGPT Images 2.0: web_scrape + CSS variable extraction via browser console
- FontOfWeb token extraction: grok.com design tokens
