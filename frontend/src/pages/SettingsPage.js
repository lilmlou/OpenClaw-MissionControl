import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Settings, Users, Link2, Database, ShieldCheck, Monitor, Terminal, Plus, Check,
  ExternalLink, FolderOpen,
} from "lucide-react";
import { C, CONNECTORS } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { Toggle } from "@/components/shared";

export default function SettingsPage() {
  const { connectors, toggleConnector, writingStyle, setWritingStyle, webSearchEnabled, setWebSearchEnabled, userProfile, setUserProfile, activeModel, models, theme, setTheme, dataControls, setDataControl, security, setSecurity, mcpServers, addMcpServer, removeMcpServer, apiKeys, addApiKey, removeApiKey, clearAllThreads, threads } = useGateway();
  const [tab, setTab] = useState("general");
  const settingsLocation = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(settingsLocation.search);
    const urlTab = params.get("tab");
    if (urlTab && ["general", "profile", "apps", "data", "security"].includes(urlTab)) setTab(urlTab);
  }, [settingsLocation.search]);
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpName, setMcpName] = useState("");
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessions] = useState([{ id: 1, device: "This device", browser: "Chrome", lastActive: "Now", current: true }, { id: 2, device: "iPhone 16", browser: "Safari", lastActive: "2 hours ago", current: false }]);
  const [showSessions, setShowSessions] = useState(false);

  const TABS = [
    { id: "general", label: "General", icon: Settings },
    { id: "profile", label: "Profile", icon: Users },
    { id: "apps", label: "Connected Apps", icon: Link2 },
    { id: "data", label: "Data Controls", icon: Database },
    { id: "security", label: "Security", icon: ShieldCheck },
  ];

  const handleAddMcp = () => { if (mcpUrl.trim()) { addMcpServer(mcpUrl.trim(), mcpName.trim()); setMcpUrl(""); setMcpName(""); setShowMcpForm(false); } };
  const handleAddKey = () => { if (keyName.trim() && keyValue.trim()) { addApiKey(keyName.trim(), keyValue.trim()); setKeyName(""); setKeyValue(""); setShowKeyForm(false); } };

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

          {tab === "apps" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Connected Apps</h2>
              <p className="text-sm" style={{ color: C.muted }}>Manage integrations and connectors. Enable only the services you need.</p>
              <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${connectors.mac && connectors.desktop && connectors.files ? C.accent + "40" : C.border}` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${C.accent}20` }}><Monitor className="w-5 h-5" style={{ color: C.accent }} /></div>
                    <div>
                      <h3 className="text-sm font-medium">Desktop Integration</h3>
                      <p className="text-xs" style={{ color: C.muted }}>Control desktop, access files, and run commands</p>
                    </div>
                  </div>
                  <Toggle on={connectors.mac && connectors.desktop && connectors.files} onToggle={() => {
                    const on = !(connectors.mac && connectors.desktop && connectors.files);
                    useGateway.getState().setConnectorBatch(["mac", "desktop", "files"], on);
                  }} />
                </div>
                <div className="flex gap-1.5 mt-3 ml-[52px]">
                  {[{id:"mac",l:"Mac Control"},{id:"desktop",l:"Commands"},{id:"files",l:"File Access"}].map(d => (
                    <span key={d.id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: connectors[d.id] ? `${C.accent}15` : C.surface2, color: connectors[d.id] ? C.accent : C.muted, border: `1px solid ${connectors[d.id] ? C.accent + "30" : C.border}` }}>{d.l}</span>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <h3 className="text-sm font-medium">Connectors</h3>
                <div className="space-y-3">
                  {CONNECTORS.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3"><c.icon className="w-4 h-4" style={{ color: connectors[c.id] ? C.green : C.muted }} /><span className="text-sm">{c.label}</span></div>
                      <Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                    </div>
                  ))}
                </div>
                <Link to="/customize?tab=connectors" className="flex items-center gap-2 text-sm pt-3 mt-1" style={{ color: C.accent, borderTop: `1px solid ${C.border}` }} data-testid="browse-directory-link">
                  Browse all connectors in Directory <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <h3 className="text-sm font-medium">MCP Servers</h3>
                <p className="text-xs" style={{ color: C.muted }}>Connect remote MCP servers for additional tool access.</p>
                {mcpServers.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: C.surface2 }}>
                    <div><div className="text-sm">{s.name}</div><div className="text-[10px]" style={{ color: C.muted }}>{s.url}</div></div>
                    <button onClick={() => removeMcpServer(s.id)} className="text-xs px-2 py-1 rounded" style={{ color: C.red }}>Remove</button>
                  </div>
                ))}
                {showMcpForm ? (
                  <div className="space-y-2 p-3 rounded-lg" style={{ background: C.surface2 }}>
                    <input type="text" value={mcpName} onChange={e => setMcpName(e.target.value)} placeholder="Server name" className="w-full px-2 py-1.5 rounded text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                    <input type="text" value={mcpUrl} onChange={e => setMcpUrl(e.target.value)} placeholder="wss://mcp-server.example.com" className="w-full px-2 py-1.5 rounded text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
                      onKeyDown={e => { if (e.key === "Enter") handleAddMcp(); }} data-testid="mcp-url-input" />
                    <div className="flex gap-2">
                      <button onClick={handleAddMcp} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: C.accent, color: "#fff" }}>Add</button>
                      <button onClick={() => setShowMcpForm(false)} className="text-xs px-3 py-1.5 rounded" style={{ color: C.muted }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowMcpForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }} data-testid="add-mcp-btn">
                    <Plus className="w-4 h-4" /> Add MCP Server
                  </button>
                )}
              </div>
              <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <h3 className="text-sm font-medium">API Keys</h3>
                <p className="text-xs" style={{ color: C.muted }}>Manage API keys for external services.</p>
                {apiKeys.map(k => (
                  <div key={k.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: C.surface2 }}>
                    <div><div className="text-sm">{k.name}</div><div className="text-[10px] font-mono" style={{ color: C.muted }}>{k.key}</div></div>
                    <button onClick={() => removeApiKey(k.id)} className="text-xs px-2 py-1 rounded" style={{ color: C.red }}>Remove</button>
                  </div>
                ))}
                {showKeyForm ? (
                  <div className="space-y-2 p-3 rounded-lg" style={{ background: C.surface2 }}>
                    <input type="text" value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="Key name (e.g., OpenAI)" className="w-full px-2 py-1.5 rounded text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                    <input type="password" value={keyValue} onChange={e => setKeyValue(e.target.value)} placeholder="sk-..." className="w-full px-2 py-1.5 rounded text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
                      onKeyDown={e => { if (e.key === "Enter") handleAddKey(); }} data-testid="api-key-input" />
                    <div className="flex gap-2">
                      <button onClick={handleAddKey} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: C.accent, color: "#fff" }}>Add</button>
                      <button onClick={() => setShowKeyForm(false)} className="text-xs px-3 py-1.5 rounded" style={{ color: C.muted }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowKeyForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }} data-testid="add-key-btn">
                    <Plus className="w-4 h-4" /> Add API Key
                  </button>
                )}
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
