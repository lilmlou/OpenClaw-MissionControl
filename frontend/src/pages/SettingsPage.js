import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Settings, Users, Database, ShieldCheck,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { Toggle } from "@/components/shared";

export default function SettingsPage() {
  const { writingStyle, setWritingStyle, webSearchEnabled, setWebSearchEnabled, userProfile, setUserProfile, activeModel, models, theme, setTheme, dataControls, setDataControl, security, setSecurity, clearAllThreads, threads } = useGateway();
  const [tab, setTab] = useState("general");
  const settingsLocation = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(settingsLocation.search);
    const urlTab = params.get("tab");
    if (urlTab && ["general", "profile", "data", "security"].includes(urlTab)) setTab(urlTab);
  }, [settingsLocation.search]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessions] = useState([{ id: 1, device: "This device", browser: "Chrome", lastActive: "Now", current: true }, { id: 2, device: "iPhone 16", browser: "Safari", lastActive: "2 hours ago", current: false }]);
  const [showSessions, setShowSessions] = useState(false);

  const TABS = [
    { id: "general", label: "General", icon: Settings },
    { id: "profile", label: "Profile", icon: Users },
    { id: "data", label: "Data Controls", icon: Database },
    { id: "security", label: "Security", icon: ShieldCheck },
  ];

  return (
    <div className="h-full flex" style={{ color: C.text }}>
      <div className="shrink-0 overflow-auto" style={{ width: 200, borderRight: `1px solid ${C.border}`, background: "#0b0b0b" }}>
        <div className="p-4 pb-2"><h1 className="text-lg font-bold">Settings</h1></div>
        <div className="px-2 pb-4">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors"
                style={{ background: active ? "rgba(29,140,248,0.1)" : "transparent", color: active ? C.accent : "#999" }}
                data-testid={`settings-tab-${t.id}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl">
          {tab === "general" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">General</h2>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between"><span className="text-sm">Theme</span>
                  <div className="flex gap-1">{["Dark", "Light", "System"].map(t => (
                    <button key={t} onClick={() => setTheme(t.toLowerCase())} className="px-3 py-1 rounded text-xs transition-colors"
                      style={{ background: theme === t.toLowerCase() ? C.accent : C.surface2, color: theme === t.toLowerCase() ? "#fff" : C.muted }}
                      data-testid={`theme-${t.toLowerCase()}`}>{t}</button>
                  ))}</div>
                </div>
                <div className="flex items-center justify-between"><span className="text-sm">Language</span><span className="text-sm" style={{ color: C.muted }}>English</span></div>
                <div className="flex items-center justify-between"><span className="text-sm">Web Search</span><Toggle on={webSearchEnabled} onToggle={() => setWebSearchEnabled(!webSearchEnabled)} /></div>
                <div>
                  <label className="block text-sm mb-2">Writing Style</label>
                  <div className="flex gap-2">{["Normal", "Concise", "Formal", "Explanatory"].map(s => (
                    <button key={s} onClick={() => setWritingStyle(s)} className="px-3 py-1.5 rounded text-xs transition-colors" style={{ background: writingStyle === s ? C.accent : C.surface2, color: writingStyle === s ? "#fff" : C.muted }}>{s}</button>
                  ))}</div>
                </div>
                <div>
                  <label className="block text-sm mb-2">Default Model</label>
                  <span className="text-xs" style={{ color: C.muted }}>{activeModel ? models.find(m => m.id === activeModel)?.name || activeModel : "None selected"}</span>
                </div>
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Profile</h2>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div>
                  <label className="block text-sm mb-1.5">Display Name</label>
                  <input type="text" value={userProfile.name} onChange={e => setUserProfile({ name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} data-testid="profile-name-input" />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Email</label>
                  <input type="email" value={userProfile.email} onChange={e => setUserProfile({ email: e.target.value })} placeholder="meg@example.com"
                    className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Custom Instructions</label>
                  <p className="text-xs mb-2" style={{ color: C.muted }}>Tell OpenClaw about yourself, your preferences, or how you'd like it to respond.</p>
                  <textarea value={userProfile.customInstructions} onChange={e => setUserProfile({ customInstructions: e.target.value })} rows={4} placeholder="e.g., I'm a frontend developer who prefers TypeScript and React..."
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} data-testid="custom-instructions-input" />
                </div>
              </div>
            </div>
          )}

          {tab === "data" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Data Controls</h2>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between"><span className="text-sm">Save conversation history</span><Toggle on={dataControls.saveHistory} onToggle={() => setDataControl("saveHistory", !dataControls.saveHistory)} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">Allow usage for improvement</span><Toggle on={dataControls.usageData} onToggle={() => setDataControl("usageData", !dataControls.usageData)} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">Memory across conversations</span><Toggle on={dataControls.memoryEnabled} onToggle={() => setDataControl("memoryEnabled", !dataControls.memoryEnabled)} /></div>
              </div>
              {showDeleteConfirm ? (
                <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <p className="text-sm" style={{ color: C.red }}>Delete all {threads.length} conversations? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => { clearAllThreads(); setShowDeleteConfirm(false); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: C.red, color: "#fff" }} data-testid="confirm-delete-btn">Delete all</button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.muted }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-red-500/10" style={{ background: "rgba(239,68,68,0.1)", color: C.red, border: "1px solid rgba(239,68,68,0.3)" }} data-testid="delete-conversations-btn">
                  Delete all conversations
                </button>
              )}
            </div>
          )}

          {tab === "security" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Security</h2>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between"><span className="text-sm">Two-factor authentication</span><Toggle on={security.twoFactor} onToggle={() => setSecurity("twoFactor", !security.twoFactor)} /></div>
                <div className="flex items-center justify-between">
                  <div><span className="text-sm block">Active sessions</span><span className="text-xs" style={{ color: C.muted }}>{sessions.length} active session{sessions.length !== 1 ? "s" : ""}</span></div>
                  <button onClick={() => setShowSessions(!showSessions)} className="text-xs px-3 py-1 rounded transition-colors" style={{ background: C.surface2, color: C.muted }} data-testid="manage-sessions-btn">{showSessions ? "Hide" : "Manage"}</button>
                </div>
                {showSessions && (
                  <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                    {sessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: C.surface2 }}>
                        <div>
                          <div className="text-sm flex items-center gap-2">{s.device}{s.current && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.15)", color: C.green }}>Current</span>}</div>
                          <div className="text-[11px]" style={{ color: C.muted }}>{s.browser} &middot; {s.lastActive}</div>
                        </div>
                        {!s.current && <button className="text-xs px-2 py-1 rounded" style={{ color: C.red }}>Revoke</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
