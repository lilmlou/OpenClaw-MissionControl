import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search, Mic, Plus, ChevronLeft, ChevronDown, ChevronRight, ArrowRight,
  Folder, MonitorSmartphone, Layers, Puzzle, Smartphone, Check,
} from "lucide-react";
import { C, COWORK_TASKS, COWORK_CATEGORIES } from "@/lib/constants";
import { useGateway, switchModel } from "@/lib/useGateway";
import { Markdown } from "@/components/shared";
import { ModelSelector } from "@/components/ModelSelector";

export default function CoworkPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const { models, providers, activeModel, connectors } = useGateway();
  const [activeTask, setActiveTask] = useState(null);
  const [replyVal, setReplyVal] = useState("");
  const [taskMessages, setTaskMessages] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
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

  if (!activeTask) {
    return (
      <div className="h-full flex flex-col" style={{ color: C.text }}>
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Delegate to OpenClaw</h1>
              <p className="text-lg" style={{ color: C.muted }}>Hand off a task, get a polished deliverable</p>
            </div>
            {activeConnectors < 4 && (
              <div className="flex items-center justify-between p-4 rounded-xl mb-6" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>
                <div className="flex items-center gap-3"><MonitorSmartphone className="w-5 h-5" style={{ color: C.accent }} /><span className="text-sm">Connect your tools to unlock more capabilities</span></div>
                <div className="flex gap-2">
                  <Link to="/settings"><button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm" style={{ border: `1px solid ${C.border}`, color: C.text }}><Layers className="w-3 h-3" /> Connectors <span className="text-xs bg-blue-600 px-1 rounded">{activeConnectors}</span></button></Link>
                  <Link to="/customize"><button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm" style={{ border: `1px solid ${C.border}`, color: C.text }}><Puzzle className="w-3 h-3" /> Plugins</button></Link>
                </div>
              </div>
            )}
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
                <button className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}><Plus className="w-3 h-3" /></button>
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
