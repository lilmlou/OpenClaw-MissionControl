import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, Mic, Plus, ChevronLeft, ChevronDown, ChevronRight, ArrowRight,
  Folder, MonitorSmartphone, Layers, Puzzle, Smartphone, Check, Wrench,
} from "lucide-react";
import { C, COWORK_TASKS, COWORK_CATEGORIES, CONNECTORS, DESKTOP_APP_GROUPS } from "@/lib/constants";
import { useGateway, switchModel } from "@/lib/useGateway";
import { Markdown, Toggle } from "@/components/shared";
import { ModelSelector } from "@/components/ModelSelector";

export default function CoworkPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const { models, providers, activeModel, connectors, toggleConnector } = useGateway();
  const navigate = useNavigate();
  const [activeTask, setActiveTask] = useState(null);
  const [replyVal, setReplyVal] = useState("");
  const [taskMessages, setTaskMessages] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [showConnectors, setShowConnectors] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [coworkPlusOpen, setCoworkPlusOpen] = useState(false);
  const coworkPlusRef = useRef(null);
  const messagesEndRef = useRef(null);

  const filteredTasks = COWORK_TASKS.filter(task => {
    if (category !== "all" && task.category !== category) return false;
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeConnectors = Object.values(connectors).filter(Boolean).length;

  const handleTaskClick = (task) => {
    setActiveTask(task);
    setTaskMessages([{ id: 1, role: "user", content: task.prompt }]);
    setIsWorking(true);
    setProgressSteps([{ id: 1, label: "Understanding request", done: true }, { id: 2, label: "Processing", done: false }, { id: 3, label: "Delivering result", done: false }]);
    setRecentTasks(prev => {
      const filtered = prev.filter(t => t.id !== task.id);
      return [task, ...filtered].slice(0, 8);
    });
    setTimeout(() => {
      setTaskMessages(prev => [...prev, { id: 2, role: "assistant", content: `Got it. I'll work on "${task.title}" for you.\n\nLet me start by understanding what you need. I'll ask some follow-up questions to make sure I get this right before diving in.` }]);
      setProgressSteps(prev => prev.map((s, i) => i <= 1 ? { ...s, done: true } : s));
      setIsWorking(false);
    }, 2000);
  };

  const handleReply = () => {
    if (!replyVal.trim()) return;
    const newMsg = { id: taskMessages.length + 1, role: "user", content: replyVal.trim() };
    setTaskMessages(prev => [...prev, newMsg]);
    setReplyVal("");
    setIsWorking(true);
    setTimeout(() => {
      setTaskMessages(prev => [...prev, { id: prev.length + 1, role: "assistant", content: "Understood. I'm processing that now and will update you shortly with the next steps." }]);
      setIsWorking(false);
    }, 1500);
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [taskMessages, isWorking]);

  // Close cowork plus menu on outside click
  useEffect(() => {
    if (!coworkPlusOpen) return;
    const h = (e) => { if (coworkPlusRef.current && !coworkPlusRef.current.contains(e.target)) setCoworkPlusOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [coworkPlusOpen]);

  if (!activeTask) {
    return (
      <div className="h-full flex flex-col" style={{ color: C.text }}>
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Delegate to OpenClaw</h1>
              <p className="text-lg" style={{ color: C.muted }}>Hand off a task, get a polished deliverable</p>
            </div>
            {/* Connectors panel — services + desktop apps */}
            <div className="rounded-xl mb-6 overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <button onClick={() => setShowConnectors(v => !v)}
                className="w-full flex items-center justify-between p-4 transition-colors hover:bg-white/[0.02]"
                data-testid="cowork-connectors-toggle">
                <div className="flex items-center gap-3">
                  <MonitorSmartphone className="w-5 h-5" style={{ color: C.accent }} />
                  <div className="text-left">
                    <span className="text-sm font-medium">Connectors &amp; Desktop Apps</span>
                    <span className="text-xs ml-2" style={{ color: C.muted }}>{activeConnectors} active</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/customize?tab=plugins" onClick={e => e.stopPropagation()}>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs" style={{ border: `1px solid ${C.border}`, color: C.muted }}>
                      <Puzzle className="w-3 h-3" /> Plugins
                    </span>
                  </Link>
                  {showConnectors
                    ? <ChevronDown className="w-4 h-4" style={{ color: "#555" }} />
                    : <ChevronRight className="w-4 h-4" style={{ color: "#555" }} />}
                </div>
              </button>
              {showConnectors && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {/* Service connectors */}
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Services</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0 px-4 pb-3">
                    {CONNECTORS.map(c => (
                      <div key={c.id} className="flex items-center gap-2 py-[5px]">
                        <c.icon className="w-3.5 h-3.5 shrink-0" style={{ color: connectors[c.id] ? C.green : "#555" }} />
                        <span className="text-[12px] flex-1 truncate" style={{ color: connectors[c.id] ? C.text : "#888" }}>{c.label}</span>
                        <Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                      </div>
                    ))}
                  </div>

                  {/* Desktop App Groups */}
                  <div className="px-4 pt-2 pb-1" style={{ borderTop: `1px solid ${C.border}` }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Desktop Apps</span>
                  </div>
                  <div className="px-2 pb-3">
                    {DESKTOP_APP_GROUPS.map(group => {
                      const GroupIcon = group.icon;
                      const isExpanded = expandedGroup === group.id;
                      const groupActiveCount = group.apps.filter(a => connectors[a.id]).length;
                      return (
                        <div key={group.id}>
                          <button type="button" onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg transition-colors hover:bg-white/[0.03]"
                            data-testid={`desktop-group-${group.id}`}>
                            <GroupIcon className="w-4 h-4 shrink-0" style={{ color: group.color }} />
                            <span className="text-[13px] font-medium flex-1 text-left" style={{ color: C.text }}>{group.name}</span>
                            {groupActiveCount > 0 && <span className="text-[10px] px-1.5 rounded-full" style={{ background: `${group.color}20`, color: group.color }}>{groupActiveCount}</span>}
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5" style={{ color: "#555" }} />
                              : <ChevronRight className="w-3.5 h-3.5" style={{ color: "#555" }} />}
                          </button>
                          {isExpanded && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0 pl-9 pr-3 pb-2">
                              {group.apps.map(app => {
                                const AppIcon = app.icon;
                                return (
                                  <div key={app.id} className="flex items-center gap-2 py-[4px]">
                                    <AppIcon className="w-3 h-3 shrink-0" style={{ color: connectors[app.id] ? group.color : "#555" }} />
                                    <span className="text-[11px] flex-1 truncate" style={{ color: connectors[app.id] ? C.text : "#777" }}>{app.label}</span>
                                    <Toggle on={connectors[app.id]} onToggle={() => toggleConnector(app.id)} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: `1px solid ${C.border}`, background: "rgba(255,255,255,0.01)" }}>
                    <Link to="/customize?tab=connectors" className="flex items-center gap-1.5 text-xs" style={{ color: C.accent }}>
                      <Plus className="w-3 h-3" /> Add app
                    </Link>
                    <Link to="/settings?tab=apps" className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
                      <Wrench className="w-3 h-3" /> Manage connectors
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {COWORK_CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = category === cat.id;
                return (
                  <button key={cat.id} onClick={() => setCategory(cat.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all"
                    style={{ background: isActive ? C.accent : C.surface, color: isActive ? "#fff" : C.muted, border: `1px solid ${isActive ? C.accent : C.border}` }}>
                    <Icon className="w-4 h-4" />{cat.label}
                  </button>
                );
              })}
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
                className="w-full pl-11 pr-4 py-3 rounded-xl text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map(task => {
                const Icon = task.icon;
                return (
                  <button key={task.id} onClick={() => handleTaskClick(task)}
                    className="text-left p-4 rounded-xl transition-all hover:border-blue-500/50 hover:bg-blue-500/5 group"
                    style={{ background: C.surface, border: `1px solid ${C.border}` }}
                    data-testid={`cowork-task-${task.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-blue-500/20"
                        style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                        <Icon className="w-5 h-5 transition-colors group-hover:text-blue-400" style={{ color: C.muted }} />
                      </div>
                      <div>
                        <div className="font-medium mb-1 group-hover:text-blue-400 transition-colors">{task.title}</div>
                        {task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.tags.map(tag => (<span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.surface2, color: C.muted }}>{tag}</span>))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="p-4 border-t" style={{ borderColor: C.border, background: C.bg }}>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2"><Smartphone className="w-4 h-4" style={{ color: C.muted }} /><span className="text-sm" style={{ color: C.muted }}>Start a task from your phone</span></div>
              <div className="flex items-center gap-2">
                <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
                <Mic className="w-4 h-4 cursor-pointer" style={{ color: C.muted }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const TaskIcon = activeTask.icon;
  return (
    <div className="h-full flex" style={{ color: C.text }}>
      <div className="hidden lg:flex flex-col shrink-0 overflow-hidden" style={{ width: 220, borderRight: `1px solid ${C.border}`, background: "#0b0b0b" }}>
        <div className="p-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setActiveTask(null)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors" style={{ color: C.muted }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
            data-testid="cowork-back-btn">
            <ChevronLeft className="w-4 h-4" /><Plus className="w-4 h-4" /> New task
          </button>
        </div>
        {recentTasks.length > 0 && (
          <div className="px-3 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2 px-2" style={{ color: "#555" }}>Recents</div>
            {recentTasks.map(t => {
              const isActive = t.id === activeTask?.id;
              return (
                <button key={t.id} onClick={() => handleTaskClick(t)} className="w-full text-left px-2 py-1.5 rounded-md text-[13px] truncate transition-colors mb-0.5"
                  style={{ background: isActive ? "rgba(29,140,248,0.1)" : "transparent", color: isActive ? C.accent : "#888" }}>{t.title}</button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${C.border}`, background: "#0d0d0d" }}>
          <button onClick={() => setActiveTask(null)} className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg transition-colors" style={{ color: C.muted }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
            <TaskIcon className="w-4 h-4" style={{ color: C.accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{activeTask.title}</div>
            {activeTask.tags.length > 0 && <div className="text-[10px]" style={{ color: C.muted }}>{activeTask.tags.join(" / ")}</div>}
          </div>
          <ChevronDown className="w-4 h-4" style={{ color: "#555" }} />
        </div>

        <div className="flex-1 overflow-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {taskMessages.map(msg => (
              <div key={msg.id} className="flex gap-3" data-testid={`cowork-msg-${msg.id}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 mt-0.5"
                  style={{ background: msg.role === "user" ? C.surface2 : "rgba(29,140,248,0.1)", border: `1px solid ${msg.role === "user" ? C.border : "rgba(29,140,248,0.2)"}` }}>
                  {msg.role === "user" ? "M" : <span style={{ fontSize: 14 }}>&#129438;</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-relaxed" style={{ color: msg.role === "user" ? "#ccc" : C.text }}>
                    <Markdown content={msg.content} />
                  </div>
                </div>
              </div>
            ))}
            {isWorking && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>
                  <span style={{ fontSize: 14 }}>&#129438;</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#f59e0b" }} />
                  <span style={{ color: C.muted }}>Working on it...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="text-[11px] mb-2 px-1" style={{ color: "#555" }}>
              <span style={{ color: C.accent }}>{activeModel ? activeModel.split("/").pop() : "Select model"}</span> uses your limit faster. Try another model for longer conversations.
            </div>
            <div className="rounded-2xl shadow-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <textarea value={replyVal} onChange={e => setReplyVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                placeholder="Reply..." rows={1}
                className="w-full focus:outline-none resize-none text-[14px] font-sans" style={{ background: "transparent", border: "none", color: C.text, padding: "12px 16px 8px", minHeight: 44, maxHeight: 160 }}
                data-testid="cowork-reply-input" />
              <div className="flex items-center gap-2 px-3 pb-3">
                <div ref={coworkPlusRef} className="relative">
                  <button onClick={() => setCoworkPlusOpen(v => !v)}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                    style={{ background: coworkPlusOpen ? "rgba(29,140,248,0.15)" : C.surface2, border: `1px solid ${coworkPlusOpen ? C.accent : C.border}`, color: coworkPlusOpen ? C.accent : C.muted }}
                    data-testid="cowork-conv-plus-btn">
                    <Plus className={`w-3 h-3 transition-transform duration-200 ${coworkPlusOpen ? "rotate-45" : ""}`} />
                  </button>
                  {coworkPlusOpen && (
                    <div className="absolute bottom-full left-0 mb-2 z-50 w-64 rounded-xl py-1 shadow-2xl max-h-[360px] overflow-y-auto" style={{ background: "#151515", border: "1px solid #2a2a2a" }}>
                      <div className="px-3 py-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Services</span>
                      </div>
                      {CONNECTORS.slice(0, 6).map(c => (
                        <div key={c.id} className="flex items-center gap-2 px-3 py-[5px] transition-colors hover:bg-white/[0.03]" style={{ color: C.text }}>
                          <c.icon className="w-3 h-3 shrink-0" style={{ color: connectors[c.id] ? C.green : "#555" }} />
                          <span className="text-[11px] flex-1">{c.label}</span>
                          <Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                        </div>
                      ))}
                      <div className="my-1" style={{ height: 1, background: "#1e1e1e" }} />
                      <div className="px-3 py-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Desktop Apps</span>
                      </div>
                      {DESKTOP_APP_GROUPS.map(group => {
                        const GroupIcon = group.icon;
                        const isExp = expandedGroup === group.id;
                        const gCount = group.apps.filter(a => connectors[a.id]).length;
                        return (
                          <div key={group.id}>
                            <button type="button" onClick={() => setExpandedGroup(isExp ? null : group.id)}
                              className="w-full flex items-center gap-2 px-3 py-[6px] transition-colors hover:bg-white/[0.03]"
                              data-testid={`conv-desktop-${group.id}`}>
                              <GroupIcon className="w-3 h-3 shrink-0" style={{ color: group.color }} />
                              <span className="text-[11px] font-medium flex-1 text-left" style={{ color: C.text }}>{group.name}</span>
                              {gCount > 0 && <span className="text-[9px] px-1 rounded-full" style={{ background: `${group.color}20`, color: group.color }}>{gCount}</span>}
                              {isExp ? <ChevronDown className="w-3 h-3" style={{ color: "#555" }} /> : <ChevronRight className="w-3 h-3" style={{ color: "#555" }} />}
                            </button>
                            {isExp && group.apps.map(app => {
                              const AppIcon = app.icon;
                              return (
                                <div key={app.id} className="flex items-center gap-2 pl-7 pr-3 py-[4px] transition-colors hover:bg-white/[0.03]">
                                  <AppIcon className="w-3 h-3 shrink-0" style={{ color: connectors[app.id] ? group.color : "#555" }} />
                                  <span className="text-[10px] flex-1" style={{ color: connectors[app.id] ? C.text : "#777" }}>{app.label}</span>
                                  <Toggle on={connectors[app.id]} onToggle={() => toggleConnector(app.id)} />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      <div className="my-1" style={{ height: 1, background: "#1e1e1e" }} />
                      <button onClick={() => { setCoworkPlusOpen(false); navigate("/settings?tab=apps"); }}
                        className="w-full flex items-center gap-2 px-3 py-[6px] text-[11px] transition-colors hover:bg-white/[0.03]" style={{ color: C.muted }}>
                        <Wrench className="w-3 h-3" /> Manage connectors
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1" />
                <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
                <button onClick={handleReply} disabled={!replyVal.trim()} className="h-7 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors"
                  style={{ background: replyVal.trim() ? C.accent : C.surface2, color: replyVal.trim() ? "#fff" : "#555" }}
                  data-testid="cowork-queue-btn">
                  Queue <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="text-[10px] mt-1.5 text-center" style={{ color: "#444" }}>OpenClaw is AI and can make mistakes. Please double-check responses.</div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-col shrink-0 overflow-auto" style={{ width: 240, borderLeft: `1px solid ${C.border}`, background: "#0b0b0b" }}>
        <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#666" }}>Progress</span>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "#555" }} />
          </div>
          <div className="space-y-3">
            {progressSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: step.done ? "rgba(34,197,94,0.15)" : C.surface2, border: `1.5px solid ${step.done ? "#22c55e" : "#333"}` }}>
                  {step.done && <Check className="w-3 h-3" style={{ color: "#22c55e" }} />}
                </div>
                <span className="text-[12px]" style={{ color: step.done ? "#aaa" : "#555" }}>{step.label}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] mt-3" style={{ color: "#444" }}>See task progress for longer tasks.</div>
        </div>
        <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Folder className="w-4 h-4" style={{ color: "#555" }} /><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#666" }}>Working folder</span></div>
            <ChevronRight className="w-3.5 h-3.5" style={{ color: "#555" }} />
          </div>
        </div>
        <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Layers className="w-4 h-4" style={{ color: "#555" }} /><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#666" }}>Connectors</span></div>
            <span className="text-[10px]" style={{ color: C.accent }}>{Object.values(connectors).filter(Boolean).length} active</span>
          </div>
          <div className="space-y-1">
            {CONNECTORS.filter(c => connectors[c.id]).map(c => (
              <div key={c.id} className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
                <c.icon className="w-3 h-3" style={{ color: C.green }} />{c.label}
              </div>
            ))}
            {DESKTOP_APP_GROUPS.flatMap(g => g.apps.filter(a => connectors[a.id]).map(a => {
              const AppIcon = a.icon;
              return (
                <div key={a.id} className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
                  <AppIcon className="w-3 h-3" style={{ color: g.color }} />{a.label}
                </div>
              );
            }))}
            {Object.values(connectors).filter(Boolean).length === 0 && <div className="text-[10px]" style={{ color: "#444" }}>No connectors active</div>}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#666" }}>Context</span>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "#555" }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}>
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[10px] mt-3" style={{ color: "#444" }}>Track tools and referenced files used in this task.</div>
        </div>
      </div>
    </div>
  );
}
