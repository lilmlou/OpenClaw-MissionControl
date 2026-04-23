import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Wrench, Link2, Puzzle, Search, Download, Plus, ChevronLeft, Trash2,
  Settings, Check, MonitorSmartphone, ShieldCheck, ArrowRight,
} from "lucide-react";
import { C, DIRECTORY_SKILLS, DIRECTORY_CONNECTORS, DIRECTORY_PLUGINS,
  SKILL_CATEGORIES, CONNECTOR_CATEGORIES, PLUGIN_CATEGORIES } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

export default function CustomizePage() {
  const [activeTab, setActiveTab] = useState("skills");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const { enabledSkills, toggleSkill, plugins, togglePlugin, connectors, toggleConnector, customSkills, customConnectors, customPlugins, addCustomSkill, addCustomConnector, addCustomPlugin, removeCustomSkill, removeCustomConnector, removeCustomPlugin } = useGateway();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTab = params.get("tab");
    if (urlTab && ["desktop", "skills", "connectors", "plugins"].includes(urlTab)) { setActiveTab(urlTab); setSearch(""); setFilterCat("All"); }
  }, [location.search]);

  const TABS = [
    { id: "desktop", label: "Desktop", icon: MonitorSmartphone },
    { id: "skills", label: "Skills", icon: Wrench },
    { id: "connectors", label: "Connectors", icon: Link2 },
    { id: "plugins", label: "Plugins", icon: Puzzle },
  ];

  const matchSearch = (item) => !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
  const matchCat = (item) => filterCat === "All" || item.category === filterCat;

  const allSkills = [...DIRECTORY_SKILLS, ...customSkills.map(s => ({ ...s, icon: Wrench }))];
  const allConnectors = [...DIRECTORY_CONNECTORS, ...customConnectors.map(c => ({ ...c, icon: Link2 }))];
  const allPlugins = [...DIRECTORY_PLUGINS, ...customPlugins.map(p => ({ ...p, icon: Puzzle }))];

  const allCategories = activeTab === "desktop" ? ["All"]
    : activeTab === "skills" ? [...SKILL_CATEGORIES, ...(customSkills.length ? ["Custom"] : [])]
    : activeTab === "connectors" ? [...CONNECTOR_CATEGORIES, ...(customConnectors.length ? ["Custom"] : [])]
    : [...PLUGIN_CATEGORIES, ...(customPlugins.length ? ["Custom"] : [])];
  const categories = [...new Set(allCategories)];

  const fSkills = allSkills.filter(s => matchSearch(s) && matchCat(s));
  const fConnectors = allConnectors.filter(c => matchSearch(c) && matchCat(c));
  const fPlugins = allPlugins.filter(p => matchSearch(p) && matchCat(p));

  const handleAdd = () => {
    if (!addName.trim()) return;
    if (activeTab === "skills") addCustomSkill(addName.trim(), addDesc.trim());
    else if (activeTab === "connectors") addCustomConnector(addName.trim(), addDesc.trim());
    else addCustomPlugin(addName.trim(), addDesc.trim());
    setAddName(""); setAddDesc(""); setShowAddForm(false);
  };

  const handleRemoveCustom = (id) => {
    if (activeTab === "skills") removeCustomSkill(id);
    else if (activeTab === "connectors") removeCustomConnector(id);
    else removeCustomPlugin(id);
  };

  const CardEmpty = () => <div className="col-span-2 text-center py-12 text-sm" style={{ color: C.muted }}>No results matching "{search}"</div>;

  const SkillCard = ({ skill }) => {
    const Icon = skill.icon;
    const installed = enabledSkills.includes(skill.id);
    const isCustom = skill.id.startsWith("custom-");
    return (
      <div className="p-4 rounded-xl transition-all hover:border-[#444]"
        style={{ background: C.surface, border: `1px solid ${installed ? C.accent + "40" : C.border}` }}
        data-testid={`skill-card-${skill.id}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <Icon className="w-4 h-4" style={{ color: installed ? C.accent : C.muted }} />
            </div>
            <div>
              <div className="text-sm font-medium">{skill.name}</div>
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                <span>{skill.provider}</span><span style={{ color: "#444" }}>&bull;</span>
                <span className="flex items-center gap-0.5"><Download className="w-3 h-3" />{skill.downloads}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isCustom && <button onClick={() => handleRemoveCustom(skill.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0" style={{ color: C.red }}><Trash2 className="w-3.5 h-3.5" /></button>}
            <button onClick={() => toggleSkill(skill.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
              style={{ background: installed ? "rgba(29,140,248,0.1)" : C.surface2, border: `1px solid ${installed ? C.accent + "40" : C.border}`, color: installed ? C.accent : C.muted }}
              data-testid={`skill-toggle-${skill.id}`}>
              {installed ? <Settings className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#777" }}>{skill.desc}</p>
      </div>
    );
  };

  const ConnectorCard = ({ conn }) => {
    const Icon = conn.icon;
    const active = !!connectors[conn.id];
    const isCustom = conn.id.startsWith("custom-");
    return (
      <div className="p-4 rounded-xl transition-all hover:border-[#444]"
        style={{ background: C.surface, border: `1px solid ${active ? C.green + "40" : C.border}` }}
        data-testid={`connector-card-${conn.id}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <Icon className="w-4 h-4" style={{ color: active ? C.green : C.muted }} />
            </div>
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                {conn.name}
                {conn.badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>{conn.badge}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isCustom && <button onClick={() => handleRemoveCustom(conn.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0" style={{ color: C.red }}><Trash2 className="w-3.5 h-3.5" /></button>}
            <button onClick={() => toggleConnector(conn.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
              style={{ background: active ? "rgba(34,197,94,0.1)" : C.surface2, border: `1px solid ${active ? C.green + "40" : C.border}`, color: active ? C.green : C.muted }}
              data-testid={`connector-toggle-${conn.id}`}>
              {active ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#777" }}>{conn.desc}</p>
      </div>
    );
  };

  const PluginCard = ({ plugin }) => {
    const Icon = plugin.icon;
    const installed = plugins.find(p => p.id === plugin.id)?.installed || false;
    const isCustom = plugin.id.startsWith("custom-");
    return (
      <div className="p-4 rounded-xl transition-all hover:border-[#444]"
        style={{ background: C.surface, border: `1px solid ${installed ? C.accent + "40" : C.border}` }}
        data-testid={`plugin-card-${plugin.id}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <Icon className="w-4 h-4" style={{ color: installed ? C.accent : C.muted }} />
            </div>
            <div>
              <div className="text-sm font-medium">{plugin.name}</div>
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                <span>{plugin.provider}</span><span style={{ color: "#444" }}>&bull;</span>
                <span className="flex items-center gap-0.5"><Download className="w-3 h-3" />{plugin.downloads}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isCustom && <button onClick={() => handleRemoveCustom(plugin.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0" style={{ color: C.red }}><Trash2 className="w-3.5 h-3.5" /></button>}
            <button onClick={() => togglePlugin(plugin.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
              style={{ background: installed ? "rgba(29,140,248,0.1)" : C.surface2, border: `1px solid ${installed ? C.accent + "40" : C.border}`, color: installed ? C.accent : C.muted }}
              data-testid={`plugin-toggle-${plugin.id}`}>
              {installed ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#777" }}>{plugin.desc}</p>
      </div>
    );
  };

  const renderAddForm = () => (
    <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.accent}40` }}>
      <div className="text-sm font-medium">New custom {activeTab.slice(0, -1)}</div>
      <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder={`${activeTab.slice(0, -1)} name`}
        className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} data-testid={`custom-${activeTab.slice(0, -1)}-name`} />
      <textarea value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Description..." rows={2}
        className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={!addName.trim()} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: addName.trim() ? C.accent : C.surface2, color: addName.trim() ? "#fff" : "#555" }} data-testid={`create-custom-${activeTab.slice(0, -1)}-btn`}>Create</button>
        <button onClick={() => { setShowAddForm(false); setAddName(""); setAddDesc(""); }} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }}>Cancel</button>
      </div>
    </div>
  );

  const renderAddBtn = () => (
    <button onClick={() => setShowAddForm(true)} className="p-4 rounded-xl flex flex-col items-center justify-center transition-colors hover:border-[#444]"
      style={{ border: `2px dashed ${C.border}`, color: C.muted, minHeight: 100 }} data-testid={`add-custom-${activeTab.slice(0, -1)}-btn`}>
      <Plus className="w-5 h-5 mb-1" /><span className="text-xs">Add custom {activeTab.slice(0, -1)}</span>
    </button>
  );

  return (
    <div className="h-full flex" style={{ color: C.text }}>
      <div className="shrink-0 overflow-auto" style={{ width: 180, borderRight: `1px solid ${C.border}`, background: "#0b0b0b" }}>
        <div className="p-4 pb-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm" style={{ color: C.muted }} data-testid="customize-back">
            <ChevronLeft className="w-3.5 h-3.5" /> Customise
          </Link>
        </div>
        <div className="px-2">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(""); setFilterCat("All"); setShowAddForm(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors"
                style={{ background: isActive ? "rgba(29,140,248,0.1)" : "transparent", color: isActive ? C.text : "#999" }}
                data-testid={`customize-tab-${t.id}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold mb-6">Customise</h1>

          {activeTab === "desktop" && (
            <div className="space-y-4" data-testid="desktop-placeholder-grid">
              <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Desktop integration placeholder</div>
                    <p className="text-xs leading-relaxed" style={{ color: C.muted }}>Future desktop operations routing will live here. No live desktop operation is connected in this step.</p>
                  </div>
                  <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: C.yellow }} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/customize?tab=connectors" className="p-4 rounded-xl flex items-center justify-between transition-colors hover:border-[#444]" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div>
                    <div className="text-sm font-medium">Connectors</div>
                    <div className="text-xs" style={{ color: C.muted }}>Manage integration connectors</div>
                  </div>
                  <ArrowRight className="w-4 h-4" style={{ color: C.muted }} />
                </Link>
                <Link to="/customize?tab=plugins" className="p-4 rounded-xl flex items-center justify-between transition-colors hover:border-[#444]" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div>
                    <div className="text-sm font-medium">Plugins</div>
                    <div className="text-xs" style={{ color: C.muted }}>Manage plugin catalog and placeholders</div>
                  </div>
                  <ArrowRight className="w-4 h-4" style={{ color: C.muted }} />
                </Link>
                <Link to="/customize?tab=skills" className="p-4 rounded-xl flex items-center justify-between transition-colors hover:border-[#444]" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div>
                    <div className="text-sm font-medium">Skills</div>
                    <div className="text-xs" style={{ color: C.muted }}>Manage enabled and placeholder skills</div>
                  </div>
                  <ArrowRight className="w-4 h-4" style={{ color: C.muted }} />
                </Link>
                <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
                  <div className="text-sm font-medium mb-1">Desktop operations panel</div>
                  <div className="text-xs" style={{ color: C.muted }}>Reserved placeholder for approval-gated desktop actions.</div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== "desktop" && (
            <>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-11 pr-4 py-3 rounded-xl text-sm"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
              data-testid="directory-search" />
          </div>
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>
              OpenClaw & Partners
            </span>
            <div className="flex items-center gap-2">
              {categories.length > 2 && (
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg appearance-none cursor-pointer"
                  style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, outline: "none" }}
                  data-testid="directory-filter">
                  {categories.map(c => <option key={c} value={c}>{c === "All" ? "Filter by" : c}</option>)}
                </select>
              )}
            </div>
          </div>

          {activeTab === "skills" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="skills-grid">
              {fSkills.map(skill => <SkillCard key={skill.id} skill={skill} />)}
              {fSkills.length === 0 && !showAddForm && <CardEmpty />}
              {showAddForm ? renderAddForm() : renderAddBtn()}
            </div>
          )}

          {activeTab === "connectors" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="connectors-grid">
              {fConnectors.map(conn => <ConnectorCard key={conn.id} conn={conn} />)}
              {fConnectors.length === 0 && !showAddForm && <CardEmpty />}
              {showAddForm ? renderAddForm() : renderAddBtn()}
            </div>
          )}

          {activeTab === "plugins" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="plugins-grid">
              {fPlugins.map(plugin => <PluginCard key={plugin.id} plugin={plugin} />)}
              {fPlugins.length === 0 && !showAddForm && <CardEmpty />}
              {showAddForm ? renderAddForm() : renderAddBtn()}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
