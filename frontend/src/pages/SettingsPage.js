import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Settings, Users, Database, ShieldCheck, Sliders, Search, AlertCircle,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { Toggle } from "@/components/shared";
import { SchemaPage } from "@/components/schema-form/SchemaPage";
import { InlineSchemaField } from "@/components/schema-form/InlineSchemaField";
import { useConfigCategories } from "@/hooks/useConfigBus";

// ─── Config Bus 2-pane panel ──────────────────────────────────────────────────
function ConfigBusPanel({ initialCategory, initialSearch, onUrlChange }) {
  const { categories, loading: catsLoading, error: catsError } = useConfigCategories();
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || null);
  const [search, setSearch] = useState(initialSearch || "");

  // Auto-select first category when they load
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]?.id || categories[0]?.name || categories[0]);
    }
  }, [categories, selectedCategory]);

  // Sync URL
  useEffect(() => {
    onUrlChange?.(selectedCategory, search);
  }, [selectedCategory, search, onUrlChange]);

  const categoryId = (cat) => cat?.id || cat?.name || cat;
  const categoryLabel = (cat) => cat?.label || cat?.name || cat?.id || cat;
  const categoryCount = (cat) => cat?.count ?? null;

  // §7 — search filters across category labels, key names, titles, and descriptions.
  // Backend categories may include `keys: [{ key, title, description }]`; if absent we fall back to label match.
  const matchesQuery = (cat, q) => {
    if (!q) return true;
    const lq = q.toLowerCase();
    if (categoryLabel(cat).toLowerCase().includes(lq)) return true;
    const keys = cat?.keys || cat?.items;
    if (Array.isArray(keys)) {
      return keys.some(k => {
        const key = (k.key || k.id || k._id || "").toString().toLowerCase();
        const title = (k.title || k.schema?.title || "").toString().toLowerCase();
        const desc = (k.description || k.schema?.description || "").toString().toLowerCase();
        return key.includes(lq) || title.includes(lq) || desc.includes(lq);
      });
    }
    return false;
  };

  const filteredCategories = categories.filter(cat => matchesQuery(cat, search));

  return (
    <div className="h-full flex" data-testid="config-bus-panel">
      {/* Left pane — category list */}
      <div
        className="shrink-0 overflow-auto flex flex-col"
        style={{ width: 220, borderRight: `1px solid ${C.border}`, background: C.surface }}
      >
        {/* Search */}
        <div className="p-3 pb-2">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: C.muted }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search settings…"
              className="w-full pl-8 pr-3 py-1.5 rounded-[var(--mc-radius-md)] text-[12px]"
              style={{
                background: C.surface2,
                border: `1px solid ${C.border}`,
                color: C.text,
                outline: "none",
              }}
              data-testid="config-search-input"
            />
          </div>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-auto px-2 pb-3">
          {catsLoading && categories.length === 0 ? (
            <div className="space-y-1.5 mt-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-8 rounded-[var(--mc-radius-sm)] mc-skeleton" />
              ))}
            </div>
          ) : catsError ? (
            <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] rounded-[var(--mc-radius-sm)]"
              style={{ color: C.red, background: C.errSoft }}>
              <AlertCircle className="w-3 h-3 shrink-0" />
              {catsError}
            </div>
          ) : filteredCategories.length === 0 ? (
            <p className="px-2 py-2 text-[12px]" style={{ color: C.muted }}>No categories found</p>
          ) : (
            filteredCategories.map(cat => {
              const id = categoryId(cat);
              const active = selectedCategory === id;
              const count = categoryCount(cat);
              return (
                <button
                  key={id}
                  onClick={() => setSelectedCategory(id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--mc-radius-sm)] text-[13px] transition-colors mb-0.5"
                  style={{
                    background: active ? C.accentSoft : "transparent",
                    color: active ? C.accent : C.fg1 || C.muted,
                  }}
                  data-testid={`config-category-${id}`}
                >
                  <span className="truncate">{categoryLabel(cat)}</span>
                  {count !== null && (
                    <span
                      className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ml-2"
                      style={{ background: active ? C.accent + "33" : C.surface2, color: active ? C.accent : C.muted }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right pane — SchemaPage for selected category */}
      <div className="flex-1 overflow-auto p-5">
        {selectedCategory ? (
          <SchemaPage
            category={selectedCategory}
            title={
              categoryLabel(categories.find(c => categoryId(c) === selectedCategory) || selectedCategory)
            }
            dataTestid={`schema-page-active`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Sliders className="w-8 h-8 mb-3" style={{ color: C.muted }} />
            <p className="text-[14px]" style={{ color: C.muted }}>
              {catsLoading ? "Loading categories…" : "Select a category to edit settings"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main SettingsPage ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const {
    writingStyle, setWritingStyle,
    webSearchEnabled, setWebSearchEnabled,
    userProfile, setUserProfile,
    activeModel, models,
    theme, setTheme,
    dataControls, setDataControl,
    security, setSecurity,
    clearAllThreads, threads,
  } = useGateway();

  const [tab, setTab] = useState("general");
  const settingsLocation = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(settingsLocation.search);
    const urlTab = params.get("tab");
    const validTabs = ["general", "profile", "data", "security", "platform"];
    if (urlTab && validTabs.includes(urlTab)) setTab(urlTab);
  }, [settingsLocation.search]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessions] = useState([
    { id: 1, device: "This device", browser: "Chrome", lastActive: "Now", current: true },
    { id: 2, device: "iPhone 16", browser: "Safari", lastActive: "2 hours ago", current: false },
  ]);
  const [showSessions, setShowSessions] = useState(false);

  // Pull config category + search from URL when on Platform tab
  const configCategory = new URLSearchParams(settingsLocation.search).get("category");
  const configSearch = new URLSearchParams(settingsLocation.search).get("search");

  const handleConfigUrlChange = (category, search) => {
    const params = new URLSearchParams(settingsLocation.search);
    params.set("tab", "platform");
    if (category) params.set("category", category); else params.delete("category");
    if (search) params.set("search", search); else params.delete("search");
    navigate({ search: params.toString() }, { replace: true });
  };

  const TABS = [
    { id: "general",  label: "General",  icon: Settings },
    { id: "profile",  label: "Profile",  icon: Users },
    { id: "data",     label: "Data",     icon: Database },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "platform", label: "Platform", icon: Sliders },
  ];

  // Platform tab uses full-height layout without the outer scroll wrapper
  const isPlatform = tab === "platform";

  return (
    <div
      className="h-full flex"
      style={{ color: C.text }}
      data-testid="settings-page"
    >
      {/* Left sidebar — tab navigation */}
      <div
        className="shrink-0 overflow-auto"
        style={{ width: 200, borderRight: `1px solid ${C.border}`, background: "#0b0b0b" }}
      >
        <div className="p-4 pb-2">
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
        <div className="px-2 pb-4">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors"
                style={{
                  background: active ? "rgba(29,140,248,0.1)" : "transparent",
                  color: active ? C.accent : "#999",
                }}
                data-testid={`settings-tab-${t.id}`}
              >
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right content */}
      {isPlatform ? (
        <div className="flex-1 overflow-hidden">
          <ConfigBusPanel
            initialCategory={configCategory}
            initialSearch={configSearch}
            onUrlChange={handleConfigUrlChange}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-xl">

            {tab === "general" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold mb-4">General</h2>
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Theme</span>
                    <div className="flex gap-1">
                      {["Dark", "Light", "System"].map(t => (
                        <button
                          key={t}
                          onClick={() => setTheme(t.toLowerCase())}
                          className="px-3 py-1 rounded text-xs transition-colors"
                          style={{
                            background: theme === t.toLowerCase() ? C.accent : C.surface2,
                            color: theme === t.toLowerCase() ? "#fff" : C.muted,
                          }}
                          data-testid={`theme-${t.toLowerCase()}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Language</span>
                    <span className="text-sm" style={{ color: C.muted }}>English</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Web Search</span>
                    <Toggle on={webSearchEnabled} onToggle={() => setWebSearchEnabled(!webSearchEnabled)} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Writing Style</label>
                    <div className="flex gap-2">
                      {["Normal", "Concise", "Formal", "Explanatory"].map(s => (
                        <button
                          key={s}
                          onClick={() => setWritingStyle(s)}
                          className="px-3 py-1.5 rounded text-xs transition-colors"
                          style={{
                            background: writingStyle === s ? C.accent : C.surface2,
                            color: writingStyle === s ? "#fff" : C.muted,
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Default Model</label>
                    <span className="text-xs" style={{ color: C.muted }}>
                      {activeModel ? models.find(m => m.id === activeModel)?.name || activeModel : "None selected"}
                    </span>
                  </div>
                </div>

                {/* Pilot: Phase 0.2 live config bus fields */}
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: C.muted }}>
                    Platform settings (live)
                  </p>
                  <InlineSchemaField
                    configKey="feature.flags.auto_pick"
                    label="Auto-pick model"
                    dataTestid="inline-field-auto-pick"
                  />
                  <InlineSchemaField
                    configKey="ui.theme.default"
                    label="Theme (config bus)"
                    dataTestid="inline-field-ui-theme"
                  />
                </div>
              </div>
            )}

            {tab === "profile" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold mb-4">Profile</h2>
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <div>
                    <label className="block text-sm mb-1.5">Display Name</label>
                    <input
                      type="text"
                      value={userProfile.name}
                      onChange={e => setUserProfile({ name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
                      data-testid="profile-name-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5">Email</label>
                    <input
                      type="email"
                      value={userProfile.email}
                      onChange={e => setUserProfile({ email: e.target.value })}
                      placeholder="meg@example.com"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5">Custom Instructions</label>
                    <p className="text-xs mb-2" style={{ color: C.muted }}>
                      Tell OpenClaw about yourself, your preferences, or how you'd like it to respond.
                    </p>
                    <textarea
                      value={userProfile.customInstructions}
                      onChange={e => setUserProfile({ customInstructions: e.target.value })}
                      rows={4}
                      placeholder="e.g., I'm a frontend developer who prefers TypeScript and React..."
                      className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                      style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
                      data-testid="custom-instructions-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {tab === "data" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold mb-4">Data Controls</h2>
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Save conversation history</span>
                    <Toggle on={dataControls.saveHistory} onToggle={() => setDataControl("saveHistory", !dataControls.saveHistory)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Allow usage for improvement</span>
                    <Toggle on={dataControls.usageData} onToggle={() => setDataControl("usageData", !dataControls.usageData)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Memory across conversations</span>
                    <Toggle on={dataControls.memoryEnabled} onToggle={() => setDataControl("memoryEnabled", !dataControls.memoryEnabled)} />
                  </div>
                </div>
                {showDeleteConfirm ? (
                  <div
                    className="p-4 rounded-xl space-y-3"
                    style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}
                  >
                    <p className="text-sm" style={{ color: C.red }}>
                      Delete all {threads.length} conversations? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { clearAllThreads(); setShowDeleteConfirm(false); }}
                        className="px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: C.red, color: "#fff" }}
                        data-testid="confirm-delete-btn"
                      >
                        Delete all
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 rounded-lg text-sm"
                        style={{ color: C.muted }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-red-500/10"
                    style={{ background: "rgba(239,68,68,0.1)", color: C.red, border: "1px solid rgba(239,68,68,0.3)" }}
                    data-testid="delete-conversations-btn"
                  >
                    Delete all conversations
                  </button>
                )}
              </div>
            )}

            {tab === "security" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold mb-4">Security</h2>
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Two-factor authentication</span>
                    <Toggle on={security.twoFactor} onToggle={() => setSecurity("twoFactor", !security.twoFactor)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm block">Active sessions</span>
                      <span className="text-xs" style={{ color: C.muted }}>
                        {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowSessions(!showSessions)}
                      className="text-xs px-3 py-1 rounded transition-colors"
                      style={{ background: C.surface2, color: C.muted }}
                      data-testid="manage-sessions-btn"
                    >
                      {showSessions ? "Hide" : "Manage"}
                    </button>
                  </div>
                  {showSessions && (
                    <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                      {sessions.map(s => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg"
                          style={{ background: C.surface2 }}
                        >
                          <div>
                            <div className="text-sm flex items-center gap-2">
                              {s.device}
                              {s.current && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ background: "rgba(34,197,94,0.15)", color: C.green }}
                                >
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-[11px]" style={{ color: C.muted }}>
                              {s.browser} &middot; {s.lastActive}
                            </div>
                          </div>
                          {!s.current && (
                            <button className="text-xs px-2 py-1 rounded" style={{ color: C.red }}>
                              Revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
