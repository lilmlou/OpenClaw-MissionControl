import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, PenTool, Code2, Folder, Briefcase, Globe, Database, Rocket, Plus, ChevronLeft, MessageSquare } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { Button } from "@/components/ui/button";

export default function SpacesPage() {
  const { spaces, threads, addSpace, deleteSpace } = useGateway();
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedSpace, setSelectedSpace] = useState(null);

  const SPACE_ICONS = { FileText, PenTool, Code2, Folder, Briefcase, Globe, Database, Rocket };
  const SPACE_COLORS = ["#3b82f6", "#ec4899", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];

  const handleCreate = () => {
    if (!newName.trim()) return;
    addSpace(newName.trim(), "Folder", SPACE_COLORS[spaces.length % SPACE_COLORS.length]);
    setNewName("");
    setShowNew(false);
  };

  const getSpaceThreads = (spaceId) => threads.filter(t => t.spaceId === spaceId);

  if (selectedSpace) {
    const sp = spaces.find(s => s.id === selectedSpace);
    if (!sp) { setSelectedSpace(null); return null; }
    const spThreads = getSpaceThreads(sp.id);
    const Icon = SPACE_ICONS[sp.icon] || Folder;
    return (
      <div className="h-full flex flex-col" style={{ color: C.text }}>
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setSelectedSpace(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: C.muted }}><ChevronLeft className="w-4 h-4" /></button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: sp.color + "20" }}><Icon className="w-4 h-4" style={{ color: sp.color }} /></div>
          <div><div className="font-medium">{sp.name}</div><div className="text-xs" style={{ color: C.muted }}>{spThreads.length} conversation{spThreads.length !== 1 ? "s" : ""}</div></div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {spThreads.length === 0 ? (
            <div className="text-center py-16"><Folder className="w-10 h-10 mx-auto mb-3" style={{ color: "#333" }} /><p className="text-sm" style={{ color: C.muted }}>No conversations in this space yet</p><p className="text-xs mt-1" style={{ color: "#555" }}>Conversations will auto-save here or you can move them manually</p></div>
          ) : (
            <div className="space-y-2">
              {spThreads.map(t => (
                <button key={t.id} onClick={() => { useGateway.getState().setActiveThread(t.id); navigate("/"); }}
                  className="w-full text-left p-3 rounded-xl transition-colors hover:bg-white/5"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{t.title}</div><div className="text-[11px]" style={{ color: C.muted }}>{new Date(t.createdAt).toLocaleDateString()}</div></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Spaces</h1>
        <Button className="gap-2" style={{ background: C.accent }} onClick={() => setShowNew(true)} data-testid="new-space-btn"><Plus className="w-4 h-4" /> New Space</Button>
      </div>
      <p className="text-sm" style={{ color: C.muted }}>Organize conversations by project or topic. Threads auto-save based on context.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {spaces.map(space => {
          const Icon = SPACE_ICONS[space.icon] || Folder;
          const count = getSpaceThreads(space.id).length;
          return (
            <button key={space.id} onClick={() => setSelectedSpace(space.id)}
              className="text-left p-4 rounded-xl cursor-pointer transition-all hover:border-[#444] group"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: space.color + "18" }}>
                  <Icon className="w-5 h-5" style={{ color: space.color }} />
                </div>
                <div>
                  <div className="font-medium">{space.name}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{space.description || `${count} conversation${count !== 1 ? "s" : ""}`}</div>
                </div>
              </div>
            </button>
          );
        })}
        {showNew ? (
          <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.accent}40` }}>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Space name..." autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNew(false); }}
              className="w-full px-3 py-2 rounded-lg text-sm mb-3" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }} data-testid="new-space-input" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} style={{ background: C.accent }}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} style={{ color: C.muted }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)} className="p-4 rounded-xl border-dashed flex items-center justify-center transition-colors hover:border-[#444]"
            style={{ border: `2px dashed ${C.border}`, color: C.muted, minHeight: 100 }}>
            <div className="text-center"><Plus className="w-6 h-6 mx-auto mb-1" /><span className="text-sm">Add Space</span></div>
          </button>
        )}
      </div>
    </div>
  );
}
