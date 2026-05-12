"use client";

import { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Plus, X, Loader2, GripVertical,
  CheckCircle2, CheckCheck, Zap, ListTodo,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { apiFetch } from "@/lib/auth";

type TaskStatus = "pending" | "accepted" | "in_progress" | "completed";

interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  created_at: string;
}

const COLUMNS: {
  id: TaskStatus;
  label: string;
  icon: React.ElementType;
  headerClass: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
}[] = [
  {
    id: "pending",
    label: "Sırada",
    icon: ListTodo,
    headerClass: "bg-slate-50 border-slate-200",
    badgeClass: "bg-slate-100 text-slate-600",
    dotClass: "bg-slate-400",
    borderClass: "border-slate-200",
  },
  {
    id: "accepted",
    label: "Kabul Edildi",
    icon: CheckCircle2,
    headerClass: "bg-brand-50 border-brand-100",
    badgeClass: "bg-brand-100 text-brand-700",
    dotClass: "bg-brand-500",
    borderClass: "border-brand-100",
  },
  {
    id: "in_progress",
    label: "İşlemde",
    icon: Zap,
    headerClass: "bg-amber-50 border-amber-100",
    badgeClass: "bg-amber-100 text-amber-700",
    dotClass: "bg-amber-500",
    borderClass: "border-amber-100",
  },
  {
    id: "completed",
    label: "Tamamlandı",
    icon: CheckCheck,
    headerClass: "bg-gsuccess-50 border-gsuccess-100",
    badgeClass: "bg-gsuccess-100 text-gsuccess-700",
    dotClass: "bg-gsuccess-500",
    borderClass: "border-gsuccess-100",
  },
];

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "az önce";
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

function ColumnSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 flex flex-col bg-white shadow-card">
      <div className="flex items-center justify-between px-4 py-3 rounded-t-xl border-b bg-slate-50 border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-6 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex-1 p-3 space-y-2 min-h-[120px]">
        {[1, 2].map(i => (
          <div
            key={i}
            className="h-14 bg-slate-100 rounded-lg animate-pulse"
            style={{ opacity: i === 1 ? 1 : 0.55 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await apiFetch("/api/tasks");
      if (!res.ok) throw new Error();
      setTasks(await res.json());
    } catch {
      toast.error("Görevler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const taskId = parseInt(result.draggableId);
    const newStatus = result.destination.droppableId as TaskStatus;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const prevTasks = tasks;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(prevTasks);
      toast.error("Görev taşınamadı. Tekrar deneyin.");
    }
  };

  const handleAdd = async (status: TaskStatus) => {
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), status }),
      });
      if (!res.ok) throw new Error();
      const task: Task = await res.json();
      setTasks(prev => [...prev, task]);
      setNewTitle("");
      setAddingTo(null);
    } catch {
      toast.error("Görev eklenemedi. Tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: number) => {
    const prevTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(prevTasks);
      toast.error("Görev silinemedi.");
    }
  };

  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const completedPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Görev Yönetimi</h1>
            <p className="text-slate-500 text-sm mt-1">
              Görevleri sürükle-bırak ile sütunlar arasında taşıyın
            </p>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-card">
              <div className="relative w-28 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gsuccess-500 rounded-full transition-all duration-500"
                  style={{ width: `${completedPct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                {completedCount}/{totalCount}
                <span className="text-slate-400 font-normal ml-1">tamamlandı</span>
              </span>
            </div>
          )}
        </div>

        {/* Board */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <ColumnSkeleton key={i} />)}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {COLUMNS.map(col => {
                const colTasks = byStatus(col.id);
                const ColIcon = col.icon;

                return (
                  <div
                    key={col.id}
                    className={clsx(
                      "rounded-xl border flex flex-col bg-white shadow-card",
                      col.borderClass
                    )}
                  >
                    {/* Column header */}
                    <div className={clsx(
                      "flex items-center justify-between px-4 py-3 rounded-t-xl border-b",
                      col.headerClass
                    )}>
                      <div className="flex items-center gap-2">
                        <ColIcon size={14} className="text-slate-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                        <span className={clsx("text-xs font-semibold px-1.5 py-0.5 rounded-full", col.badgeClass)}>
                          {colTasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => { setAddingTo(col.id); setNewTitle(""); }}
                        className="p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white/60 transition-colors"
                        title="Görev ekle"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Inline add form */}
                    {addingTo === col.id && (
                      <div className="px-3 pt-3">
                        <textarea
                          autoFocus
                          rows={2}
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(col.id); }
                            if (e.key === "Escape") setAddingTo(null);
                          }}
                          placeholder="Görev başlığı… (Enter ile ekle, Esc ile iptal)"
                          className="form-input text-sm resize-none"
                        />
                        <div className="flex gap-2 mt-2 mb-1">
                          <button
                            onClick={() => handleAdd(col.id)}
                            disabled={submitting || !newTitle.trim()}
                            className="flex-1 text-xs btn-primary justify-center py-1.5"
                          >
                            {submitting
                              ? <><Loader2 size={11} className="animate-spin" />Ekleniyor...</>
                              : "Ekle"
                            }
                          </button>
                          <button
                            onClick={() => setAddingTo(null)}
                            className="text-xs btn-secondary px-3 py-1.5"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Task list */}
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={clsx(
                            "flex-1 p-3 space-y-2 min-h-[120px] rounded-b-xl transition-colors duration-150",
                            snapshot.isDraggingOver && "bg-slate-50/80"
                          )}
                        >
                          {colTasks.map((task, index) => (
                            <Draggable
                              key={task.id}
                              draggableId={String(task.id)}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={clsx(
                                    "group relative flex items-start gap-2 bg-white border rounded-lg p-3 text-sm",
                                    "shadow-sm transition-all duration-150",
                                    snapshot.isDragging
                                      ? "shadow-card-lg border-brand-300 rotate-1 scale-[1.02] opacity-95 z-50"
                                      : "border-slate-200 hover:border-slate-300 hover:shadow-card-md"
                                  )}
                                >
                                  <span
                                    {...provided.dragHandleProps}
                                    className="mt-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors"
                                  >
                                    <GripVertical size={14} />
                                  </span>

                                  <div className="flex-1 min-w-0 pr-4">
                                    <p className="leading-snug text-slate-700 break-words">
                                      {task.title}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1.5">
                                      {timeAgo(task.created_at)}
                                    </p>
                                  </div>

                                  <button
                                    onClick={() => handleDelete(task.id)}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded p-0.5 transition-all"
                                    title="Görevi sil"
                                  >
                                    <X size={12} />
                                  </button>

                                  {/* Status dot */}
                                  <span className={clsx(
                                    "absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full",
                                    col.dotClass
                                  )} />
                                </div>
                              )}
                            </Draggable>
                          ))}

                          {provided.placeholder}

                          {colTasks.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-300 select-none">
                              <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center mb-2">
                                <Plus size={14} className="text-slate-300" />
                              </div>
                              <p className="text-xs">Görev yok</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
