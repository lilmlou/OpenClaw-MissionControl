/**
 * Phase E1 — Files Browser (shell, READ-ONLY)
 *
 * Route: /files
 * Replaces "edit .env / MEMORY.md in a text editor" with an in-app
 * allowlisted tree + read-only preview. E2 will add write back.
 *
 * Wiring targets (when FE Wiring lands):
 *   GET /api/v2/files/tree?root=<allowlist-id>
 *   GET /api/v2/files/read?path=<rel>
 *
 * This is SHELL ONLY — chrome, empty states, placeholder tree.
 * No fetch wired yet. Allowlist roots are placeholders that FE Wiring
 * will replace with the live response from /tree.
 *
 * Theme: locked Mietorè tokens (glassmorphism, hairline gold borders).
 */

import React, { useState } from "react";
import {
  FolderTree, FolderOpen, Folder, FileText, FileCode, Settings, Brain,
  Lock, Eye, Search,
} from "lucide-react";

// Placeholder allowlist roots. FE Wiring will pull from /api/v2/files/tree.
const PLACEHOLDER_ROOTS = [
  { id: "config", label: "Config",         Icon: Settings, hint: "Runtime config (.env-equivalents, JSON)" },
  { id: "memory", label: "Memory",         Icon: Brain,    hint: "MEMORY.md and per-project facts" },
  { id: "docs",   label: "Docs",           Icon: FileText, hint: "Handoffs, plans, principles" },
  { id: "skills", label: "Skills",         Icon: FileCode, hint: "Loaded skills + their YAML/JS" },
];

function FileIcon({ name }) {
  const lower = (name || "").toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return <FileText size={13} style={{ color: "var(--mc-accent-2)" }} />;
  }
  if (lower.endsWith(".js") || lower.endsWith(".ts") || lower.endsWith(".py") || lower.endsWith(".json") || lower.endsWith(".yaml")) {
    return <FileCode size={13} style={{ color: "var(--mc-accent)" }} />;
  }
  return <FileText size={13} style={{ color: "var(--mc-fg-3)" }} />;
}

function RootRow({ root, active, onClick }) {
  const Icon = root.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`files-root-${root.id}`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: active ? "var(--mc-accent-soft)" : "transparent",
        border: "none",
        borderLeft: active ? "2px solid var(--mc-accent)" : "2px solid transparent",
        color: active ? "var(--mc-accent)" : "var(--mc-fg-1)",
        textAlign: "left",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon size={14} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 2 }}>{root.label}</div>
        <div
          style={{
            fontSize: 10,
            color: "var(--mc-fg-3)",
            fontWeight: 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {root.hint}
        </div>
      </div>
    </button>
  );
}

export default function FilesPage() {
  const [activeRoot, setActiveRoot] = useState(null);
  const [query, setQuery] = useState("");

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        color: "var(--mc-fg)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 28px 12px",
          borderBottom: "1px solid var(--mc-line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--mc-font-display, inherit)",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.3,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                background:
                  "linear-gradient(135deg, var(--mc-accent) 0%, var(--mc-accent-2) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Files
            </span>
            <FolderTree size={18} style={{ color: "var(--mc-accent)" }} />
          </h1>
          <p style={{ color: "var(--mc-fg-2)", fontSize: 12, marginTop: 4 }}>
            Allowlisted, in-app. Read-only for now — Phase E2 adds editing.
          </p>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 999,
            background: "var(--mc-warn-soft)",
            border: "1px solid var(--mc-line-strong)",
            color: "var(--mc-warn)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          <Eye size={11} /> Read-only
        </span>
      </div>

      {/* Body: split pane */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Left: roots + tree */}
        <aside
          style={{
            width: 280,
            borderRight: "1px solid var(--mc-line)",
            background: "var(--mc-bg-1)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ padding: "12px 12px 8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 10px",
                borderRadius: 8,
                background: "var(--mc-bg-2)",
                border: "1px solid var(--mc-line)",
              }}
            >
              <Search size={12} style={{ color: "var(--mc-fg-3)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter files…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--mc-fg)",
                  fontSize: 12,
                }}
                data-testid="files-search"
              />
            </div>
          </div>
          <div
            style={{
              padding: "4px 0 12px",
              fontSize: 10,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: "var(--mc-fg-3)",
              fontWeight: 700,
              paddingLeft: 14,
              marginTop: 4,
            }}
          >
            Allowlisted roots
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {PLACEHOLDER_ROOTS.map((r) => (
              <RootRow
                key={r.id}
                root={r}
                active={activeRoot === r.id}
                onClick={() => setActiveRoot(r.id)}
              />
            ))}
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--mc-line)",
              fontSize: 10,
              color: "var(--mc-fg-3)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Lock size={11} /> Path-guarded by the backend.
          </div>
        </aside>

        {/* Right: preview */}
        <main
          style={{
            flex: 1,
            background: "var(--mc-bg)",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {!activeRoot ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 32,
                textAlign: "center",
                color: "var(--mc-fg-2)",
              }}
            >
              <FolderOpen
                size={42}
                style={{ color: "var(--mc-accent)", opacity: 0.65, marginBottom: 12 }}
              />
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--mc-fg-1)",
                  marginBottom: 6,
                }}
              >
                Pick a root on the left
              </div>
              <div style={{ fontSize: 12, maxWidth: 360 }}>
                Each root is an allowlist the backend exposes. Phase E1 ships
                read-only browsing; E2 adds inline editing with confirm modals.
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--mc-line)",
                  fontSize: 12,
                  color: "var(--mc-fg-2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Folder size={13} style={{ color: "var(--mc-accent)" }} />
                <span style={{ fontFamily: "var(--mc-font-mono, monospace)" }}>
                  /{activeRoot}/
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: 24,
                  overflowY: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <div style={{ maxWidth: 440 }}>
                  <FileIcon name="placeholder.md" />
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--mc-fg-1)",
                      margin: "10px 0 6px",
                    }}
                  >
                    Tree not loaded yet
                  </div>
                  <div style={{ fontSize: 12, color: "var(--mc-fg-2)" }}>
                    FE Wiring will fetch{" "}
                    <code
                      style={{
                        padding: "1px 6px",
                        background: "var(--mc-bg-2)",
                        border: "1px solid var(--mc-line)",
                        borderRadius: 4,
                        fontFamily: "var(--mc-font-mono, monospace)",
                        color: "var(--mc-accent)",
                      }}
                    >
                      GET /api/v2/files/tree?root={activeRoot}
                    </code>{" "}
                    and render it here. Files render in a read-only Monaco-style preview pane.
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
