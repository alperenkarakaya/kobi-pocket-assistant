"use client";

import { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus, X, Loader2, GripVertical } from "lucide-react";
import { clsx } from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────

type TaskStatus = "pending" | "accepted" | "in_progress" | "completed";

interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  created_at: string;
}

// ── Column definitions ──────────────────────────────────────────────────────

const COLUMNS: {
  id: TaskStatus;
  label: string;
  color: string;
  dotColor: string;
  border: string;
  headerBg: string;
}[] = [
  {
    id: "pending",
    label: "Sırada",
    color: "text-yellow-400",
    dotColor: "bg-yellow-400",
    border: "border-yellow-500/20",
    headerBg: "bg-yellow-500/8",
  },
  {
    id: "accepted",
    label: "Kabul Edildi",
    color: "text-blue-400",
    dotColor: "bg-blue-400",
    border: "border-blue-500/20",
    headerBg: "bg-blue-500/8",
  },
  {
    id: "in_progress",
    label: "İşlemde",
    color: "text-orange-400",
    dotColor: "bg-orange-400",
    border: "border-orange-500/20",
    headerBg: "bg-orange-500/8",
  },
  {
    id: "completed",
    label: "Tamamlandı",
    color: "text-brand-400",
    dotColor: "bg-brand-400",
    border: "border-brand-500/20",
    headerBg: "bg-brand-500/8",
  },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    const res = await fetch(`${API}/api/tasks`);
    setTasks(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const byStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  // ── Drag end handler ──────────────────────────────────────────────────────

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const taskId = parseInt(result.draggableId);
    const newStatus = result.destination.droppableId as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    await fetch(`${API}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  // ── Add task ──────────────────────────────────────────────────────────────

  const handleAdd = async (status: TaskStatus) => {
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);
    const res = await fetch(`${API}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), status }),
    });
    const task: Task = await res.json();
    setTasks((prev) => [...prev, task]);
    setNewTitle("");
    setAddingTo(null);
    setSubmitting(false);
  };

  // ── Delete task ───────────────────────────────────────────────────────────

  const handleDelete = async (taskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`${API}/api/tasks/${taskId}`, { method: "DELETE" });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-600">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] p-6">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-5%,rgba(34,197,94,0.06),transparent)]" />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Görev Yönetimi</h1>
          <p className="text-slate-500 text-sm mt-1">
            Görevleri sürükle-bırak ile sütunlar arasında taşıyın.
          </p>
        </div>

        {/* Board */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const colTasks = byStatus(col.id);
              return (
                <div
                  key={col.id}
                  className={clsx(
                    "rounded-xl border flex flex-col",
                    col.border,
                    "bg-[#0e1612]"
                  )}
                >
                  {/* Column header */}
                  <div
                    className={clsx(
                      "flex items-center justify-between px-4 py-3 rounded-t-xl border-b",
                      col.border,
                      col.headerBg
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={clsx("w-2 h-2 rounded-full", col.dotColor)} />
                      <span className={clsx("text-sm font-semibold", col.color)}>
                        {col.label}
                      </span>
                      <span className="text-xs text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded-full">
                        {colTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setAddingTo(col.id);
                        setNewTitle("");
                      }}
                      className={clsx(
                        "p-1 rounded-lg transition-colors hover:bg-slate-800",
                        col.color
                      )}
                      title="Görev ekle"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  {/* Inline add form */}
                  {addingTo === col.id && (
                    <div className="px-3 pt-3">
                      <textarea
                        autoFocus
                        rows={2}
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAdd(col.id);
                          }
                          if (e.key === "Escape") setAddingTo(null);
                        }}
                        placeholder="Görev başlığı... (Enter ile ekle)"
                        className="w-full px-3 py-2 bg-[#1a2520] border border-[rgba(34,197,94,0.15)] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/40 resize-none"
                      />
                      <div className="flex gap-2 mt-2 mb-1">
                        <button
                          onClick={() => handleAdd(col.id)}
                          disabled={submitting || !newTitle.trim()}
                          className="flex-1 text-xs bg-brand-500/15 text-brand-400 border border-brand-500/25 py-1.5 rounded-lg hover:bg-brand-500/25 transition-colors disabled:opacity-40"
                        >
                          {submitting ? "Ekleniyor..." : "Ekle"}
                        </button>
                        <button
                          onClick={() => setAddingTo(null)}
                          className="text-xs text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Droppable task list */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={clsx(
                          "flex-1 p-3 space-y-2 min-h-[120px] rounded-b-xl transition-colors duration-150",
                          snapshot.isDraggingOver && "bg-slate-800/30"
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
                                  "group relative flex items-start gap-2 bg-[#111a14] border rounded-lg p-3 text-sm text-slate-300 transition-all",
                                  snapshot.isDragging
                                    ? "shadow-2xl border-brand-500/40 rotate-1 scale-105 opacity-90"
                                    : "border-[rgba(34,197,94,0.07)] hover:border-[rgba(34,197,94,0.18)]"
                                )}
                              >
                                {/* Drag handle */}
                                <span
                                  {...provided.dragHandleProps}
                                  className="mt-0.5 text-slate-700 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0"
                                >
                                  <GripVertical size={14} />
                                </span>

                                <span className="flex-1 leading-snug pr-4">
                                  {task.title}
                                </span>

                                {/* Delete button */}
                                <button
                                  onClick={() => handleDelete(task.id)}
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}

                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <p className="text-center text-slate-700 text-xs py-8 select-none">
                            Görev yok
                          </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
