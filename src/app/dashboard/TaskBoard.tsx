"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type TodoList = { id: string; name: string; position: number };
export type Todo = {
  id: string; text: string; title?: string; notes?: string; details?: string;
  created_by: string; created_at: string; completed_at: string | null;
  is_urgent: boolean; list_id?: string | null; assigned_to?: string; due_date?: string | null;
};

interface Props {
  lists: TodoList[];
  todos: Todo[];
  completedTodos: Todo[];
  onTodosChange: (todos: Todo[]) => void;
  onCompletedChange: (todos: Todo[]) => void;
  onListsChange: (lists: TodoList[]) => void;
}

function assigneeLabel(a?: string) {
  if (a === "ryan") return { label: "R", cls: "bg-[#4ade80]/15 text-[#4ade80]" };
  if (a === "leif") return { label: "L", cls: "bg-[#60a5fa]/15 text-[#60a5fa]" };
  return { label: "B", cls: "bg-white/10 text-[#888]" };
}
function cycleAssignee(current?: string) {
  if (!current || current === "both") return "ryan";
  if (current === "ryan") return "leif";
  return "both";
}
function fmtDue(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: "text-red-400" };
  if (diff === 0) return { label: "Today", cls: "text-[#fbbf24]" };
  if (diff === 1) return { label: "Tomorrow", cls: "text-[#fbbf24]" };
  return { label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }), cls: "text-[#555]" };
}
function userColor(name: string) {
  if (name === "ryan") return "text-[#4ade80]";
  if (name === "leif") return "text-[#60a5fa]";
  return "text-[#888]";
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

async function apiTodo(body: Record<string, unknown>) {
  return fetch("/api/admin/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// Single draggable task row
function SortableTask({
  task, isDragging, expanded, editing, editTitle, editNotes,
  onExpand, onEdit, onEditTitle, onEditNotes, onSaveEdit, onCancelEdit,
  onComplete, onDelete, onCycleAssignee,
}: {
  task: Todo; isDragging?: boolean;
  expanded: boolean; editing: boolean;
  editTitle: string; editNotes: string;
  onExpand: () => void; onEdit: () => void;
  onEditTitle: (v: string) => void; onEditNotes: (v: string) => void;
  onSaveEdit: () => void; onCancelEdit: () => void;
  onComplete: () => void; onDelete: () => void;
  onCycleAssignee: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, over } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const asgn = assigneeLabel(task.assigned_to);
  const due = fmtDue(task.due_date);
  const title = task.title || task.text;

  return (
    <div ref={setNodeRef} style={style} className={`border-b border-white/5 ${isDragging ? "bg-white/[0.03]" : ""}`}>
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] group">
        {/* Drag handle */}
        <button
          {...attributes} {...listeners}
          className="text-[#333] hover:text-[#666] transition-colors cursor-grab active:cursor-grabbing flex-shrink-0 touch-none text-base"
          tabIndex={-1}
        >
          ⠿
        </button>
        {/* Circle checkbox */}
        <button
          onClick={onComplete}
          className="w-5 h-5 rounded-full border border-white/25 flex-shrink-0 hover:border-[#4ade80] hover:bg-[#4ade80]/10 transition-all"
        />
        {/* Title area */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
          <p className="text-sm text-white truncate">{title}</p>
          {(task.notes || task.details) && !expanded && (
            <p className="text-xs text-[#555] truncate mt-0.5">{task.notes || task.details}</p>
          )}
          {due && <p className={`text-xs mt-0.5 ${due.cls}`}>{due.label}</p>}
        </div>
        {/* Assignee badge */}
        <button
          onClick={onCycleAssignee}
          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${asgn.cls}`}
          title={`${task.assigned_to || "both"} — click to change`}
        >{asgn.label}</button>
        <button onClick={onExpand} className="text-[#333] text-xs">{expanded ? "▲" : "▼"}</button>
      </div>
      {expanded && (
        <div className="px-5 pb-4 bg-white/[0.015]">
          {editing ? (
            <div className="flex flex-col gap-2 pt-1">
              <input value={editTitle} onChange={e => onEditTitle(e.target.value)}
                className="bg-[#1a1a1a] border border-white/10 text-sm px-3 py-2 outline-none text-white w-full"
                placeholder="Title" />
              <textarea value={editNotes} onChange={e => onEditNotes(e.target.value)}
                className="bg-[#1a1a1a] border border-white/10 text-sm px-3 py-2 outline-none text-white w-full resize-none"
                rows={2} placeholder="Notes (optional)" />
              <div className="flex gap-3">
                <button onClick={onSaveEdit} className="text-xs tracking-[1px] uppercase text-[#4ade80] hover:text-white transition-colors">Save</button>
                <button onClick={onCancelEdit} className="text-xs tracking-[1px] uppercase text-[#444] hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="pt-1 flex flex-col gap-1.5">
              {(task.notes || task.details) && <p className="text-sm text-[#888] leading-relaxed whitespace-pre-wrap">{task.notes || task.details}</p>}
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs ${userColor(task.created_by)}`}>{task.created_by}</span>
                <span className="text-xs text-[#444]">{fmtTime(task.created_at)}</span>
                <button onClick={onEdit} className="text-xs text-[#555] hover:text-white transition-colors uppercase tracking-[1px]">Edit</button>
                <button onClick={onDelete} className="text-xs text-[#444] hover:text-red-400 transition-colors uppercase tracking-[1px]">Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Ghost card shown under the pointer while dragging
function DragGhostCard({ task }: { task: Todo }) {
  const asgn = assigneeLabel(task.assigned_to);
  return (
    <div className="bg-[#1a1a1a] border border-white/20 shadow-xl px-3 py-2.5 flex items-center gap-2 w-64 opacity-95">
      <span className="text-[#444] flex-shrink-0">⠿</span>
      <span className="w-4 h-4 rounded-full border border-white/25 flex-shrink-0" />
      <span className="text-xs text-white flex-1 truncate">{task.title || task.text}</span>
      <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${asgn.cls}`}>{asgn.label}</span>
    </div>
  );
}

export default function TaskBoard({ lists, todos, completedTodos, onTodosChange, onCompletedChange, onListsChange }: Props) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [completedOpen, setCompletedOpen] = useState<Record<string, boolean>>({});
  const [listRenamingId, setListRenamingId] = useState<string | null>(null);
  const [listRenameValue, setListRenameValue] = useState("");

  // Add task state per list
  const [addOpenList, setAddOpenList] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addAssignee, setAddAssignee] = useState("both");
  const [addDueDate, setAddDueDate] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeDragTask = activeDragId ? todos.find(t => t.id === activeDragId) : null;

  function getListForTask(taskId: string) {
    return todos.find(t => t.id === taskId)?.list_id ?? null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const overId = e.over?.id;
    if (!overId) return;
    // Check if hovering a list column header (id = list.id) or a task (id = task.id)
    const overTask = todos.find(t => t.id === overId);
    const targetListId = overTask ? (overTask.list_id ?? null) : lists.find(l => l.id === overId)?.id ?? null;
    if (targetListId !== overListId) setOverListId(targetListId);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveDragId(null);
    setOverListId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeTask = todos.find(t => t.id === activeId);
    if (!activeTask) return;

    const overTask = todos.find(t => t.id === overId);
    const targetListId = overTask ? (overTask.list_id ?? null) : lists.find(l => l.id === overId)?.id ?? null;
    const sourceListId = activeTask.list_id ?? null;

    let newTodos = [...todos];

    if (sourceListId !== targetListId) {
      // Move to different list
      newTodos = newTodos.map(t => t.id === activeId ? { ...t, list_id: targetListId } : t);
      // Persist to DB
      apiTodo({ action: "update", id: activeId, list_id: targetListId });
    } else if (activeId !== overId && overTask) {
      // Reorder within same list
      const listTasks = newTodos.filter(t => t.list_id === sourceListId);
      const oldIdx = listTasks.findIndex(t => t.id === activeId);
      const newIdx = listTasks.findIndex(t => t.id === overId);
      const reordered = arrayMove(listTasks, oldIdx, newIdx);
      // Rebuild full todos list preserving other lists
      const otherTasks = newTodos.filter(t => t.list_id !== sourceListId);
      newTodos = [...otherTasks, ...reordered];
      // Persist positions
      reordered.forEach((t, i) => apiTodo({ action: "update", id: t.id, position: i }));
    }

    onTodosChange(newTodos);
  }

  async function handleComplete(id: string) {
    await apiTodo({ action: "complete", id });
    const done = todos.find(t => t.id === id);
    onTodosChange(todos.filter(t => t.id !== id));
    if (done) onCompletedChange([{ ...done, completed_at: new Date().toISOString() }, ...completedTodos]);
  }

  async function handleUncomplete(id: string) {
    await apiTodo({ action: "uncomplete", id });
    const item = completedTodos.find(t => t.id === id);
    onCompletedChange(completedTodos.filter(t => t.id !== id));
    if (item) onTodosChange([...todos, { ...item, completed_at: null }]);
  }

  async function handleDelete(id: string) {
    await apiTodo({ action: "delete", id });
    onTodosChange(todos.filter(t => t.id !== id));
    onCompletedChange(completedTodos.filter(t => t.id !== id));
  }

  async function handleSaveEdit(id: string) {
    await apiTodo({ action: "update", id, title: editTitle, notes: editNotes });
    onTodosChange(todos.map(t => t.id === id ? { ...t, title: editTitle, text: editTitle, notes: editNotes } : t));
    setEditing(null);
  }

  async function handleCycleAssignee(id: string, current?: string) {
    const next = cycleAssignee(current);
    await apiTodo({ action: "update", id, assigned_to: next });
    onTodosChange(todos.map(t => t.id === id ? { ...t, assigned_to: next } : t));
  }

  async function handleAddTask(listId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim()) return;
    const res = await apiTodo({ action: "create", title: addTitle, notes: addNotes, list_id: listId, assigned_to: addAssignee, due_date: addDueDate || null });
    if (res.ok) {
      const { todo } = await res.json();
      onTodosChange([...todos, todo]);
    }
    setAddOpenList(null); setAddTitle(""); setAddNotes(""); setAddAssignee("both"); setAddDueDate("");
  }

  async function handleCreateList() {
    if (lists.length >= 5) return;
    const res = await apiTodo({ action: "create_list", name: "New List", position: lists.length });
    if (res.ok) { const { list } = await res.json(); onListsChange([...lists, list]); }
  }

  async function handleRenameList(id: string, name: string) {
    await apiTodo({ action: "rename_list", id, name });
    onListsChange(lists.map(l => l.id === id ? { ...l, name } : l));
    setListRenamingId(null);
  }

  async function handleDeleteList(id: string) {
    if (!confirm("Delete this list and all its tasks?")) return;
    await apiTodo({ action: "delete_list", id });
    onListsChange(lists.filter(l => l.id !== id));
    onTodosChange(todos.filter(t => t.list_id !== id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2 items-stretch">
        {lists.map(list => {
          const listTasks = todos.filter(t => t.list_id === list.id);
          const listCompleted = completedTodos.filter(t => t.list_id === list.id);
          const isOver = overListId === list.id && activeDragId !== null && getListForTask(activeDragId) !== list.id;

          return (
            <div key={list.id} className={`bg-[#111] border flex flex-col flex-1 min-w-[300px] min-h-[calc(100vh-220px)] transition-colors ${isOver ? "border-white/30 bg-white/[0.03]" : "border-white/10"}`}>
              {/* List header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
                {listRenamingId === list.id ? (
                  <input
                    autoFocus
                    value={listRenameValue}
                    onChange={e => setListRenameValue(e.target.value)}
                    onBlur={() => handleRenameList(list.id, listRenameValue || list.name)}
                    onKeyDown={e => { if (e.key === "Enter") handleRenameList(list.id, listRenameValue || list.name); if (e.key === "Escape") setListRenamingId(null); }}
                    className="bg-transparent text-sm outline-none text-white flex-1 font-semibold tracking-[1px] uppercase"
                  />
                ) : (
                  <button
                    onDoubleClick={() => { setListRenamingId(list.id); setListRenameValue(list.name); }}
                    className="text-sm tracking-[1.5px] uppercase text-[#888] hover:text-white transition-colors text-left flex-1 font-semibold"
                    title="Double-click to rename"
                  >
                    {list.name}
                    {listTasks.length > 0 && <span className="ml-1.5 text-[#444] font-normal">({listTasks.length})</span>}
                  </button>
                )}
                <button onClick={() => handleDeleteList(list.id)} className="text-[#222] hover:text-red-400 transition-colors text-base ml-2" title="Delete list">×</button>
              </div>

              {/* Tasks */}
              <SortableContext items={listTasks.map(t => t.id)} strategy={verticalListSortingStrategy} id={list.id}>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {listTasks.length === 0 && (
                    <div className={`p-4 text-xs italic text-center transition-colors ${isOver ? "text-[#555]" : "text-[#2a2a2a]"}`}>
                      {isOver ? "Drop here" : "No tasks"}
                    </div>
                  )}
                  {listTasks.map(t => (
                    <SortableTask
                      key={t.id}
                      task={t}
                      isDragging={activeDragId === t.id}
                      expanded={expanded === t.id}
                      editing={editing === t.id}
                      editTitle={editTitle}
                      editNotes={editNotes}
                      onExpand={() => setExpanded(expanded === t.id ? null : t.id)}
                      onEdit={() => { setEditing(t.id); setEditTitle(t.title || t.text); setEditNotes(t.notes || t.details || ""); }}
                      onEditTitle={setEditTitle}
                      onEditNotes={setEditNotes}
                      onSaveEdit={() => handleSaveEdit(t.id)}
                      onCancelEdit={() => setEditing(null)}
                      onComplete={() => handleComplete(t.id)}
                      onDelete={() => handleDelete(t.id)}
                      onCycleAssignee={() => handleCycleAssignee(t.id, t.assigned_to)}
                    />
                  ))}

                  {/* Completed collapse */}
                  {listCompleted.length > 0 && (
                    <div className="border-t border-white/5 mt-1">
                      <button onClick={() => setCompletedOpen(o => ({ ...o, [list.id]: !o[list.id] }))} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-[#444] hover:text-[#777] transition-colors">
                        <span>{completedOpen[list.id] ? "▾" : "▸"}</span>
                        <span>{listCompleted.length} completed</span>
                      </button>
                      {completedOpen[list.id] && listCompleted.map(t => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 opacity-50 hover:opacity-75">
                          <button onClick={() => handleUncomplete(t.id)} className="w-4 h-4 rounded-full border border-white/40 flex-shrink-0 bg-white/10 flex items-center justify-center text-[9px] text-white hover:border-white transition-all">✓</button>
                          <span className="text-sm text-[#666] line-through flex-1 truncate">{t.title || t.text}</span>
                          <button onClick={() => handleDelete(t.id)} className="text-xs text-[#444] hover:text-red-400 transition-colors">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SortableContext>

              {/* Add task */}
              {addOpenList === list.id ? (
                <form onSubmit={e => handleAddTask(list.id, e)} className="border-t border-white/10 flex flex-col gap-2 p-3.5">
                  <input value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Task title"
                    className="bg-transparent text-sm px-3 py-2 outline-none placeholder:text-[#444] text-white border border-white/10" autoFocus />
                  <input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Notes (optional)"
                    className="bg-transparent text-sm px-3 py-2 outline-none placeholder:text-[#444] text-white border border-white/10" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex gap-1.5">
                      {(["both", "ryan", "leif"] as const).map(a => {
                        const lbl = a === "both" ? "B" : a === "ryan" ? "R" : "L";
                        const active = addAssignee === a;
                        const cls = a === "ryan" ? "border-[#4ade80] text-[#4ade80]" : a === "leif" ? "border-[#60a5fa] text-[#60a5fa]" : "border-white/20 text-[#555]";
                        return (
                          <button key={a} type="button" onClick={() => setAddAssignee(a)}
                            className={`text-xs w-6 h-6 border rounded-full transition-colors ${active ? cls : "border-white/10 text-[#333]"}`}>
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                    <input type="date" value={addDueDate} onChange={e => setAddDueDate(e.target.value)}
                      className="bg-transparent border border-white/10 text-xs text-[#666] px-2 py-1 outline-none flex-1 min-w-0" />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="text-xs uppercase tracking-[1px] text-[#4ade80] hover:text-white transition-colors">Add</button>
                    <button type="button" onClick={() => setAddOpenList(null)} className="text-xs uppercase tracking-[1px] text-[#444] hover:text-white transition-colors">Cancel</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setAddOpenList(list.id)} className="border-t border-white/10 w-full text-left px-4 py-3 text-sm text-[#444] hover:text-[#777] transition-colors">
                  + Add task
                </button>
              )}
            </div>
          );
        })}

        {/* New list button */}
        {lists.length < 5 && (
          <button onClick={handleCreateList}
            className="flex-1 min-w-[220px] max-w-[280px] border border-dashed border-white/10 hover:border-white/20 text-[#333] hover:text-[#666] transition-colors text-sm flex items-center justify-center gap-1.5 min-h-[calc(100vh-220px)]">
            + New List
          </button>
        )}
      </div>

      {/* Drag overlay ghost */}
      <DragOverlay>
        {activeDragTask ? <DragGhostCard task={activeDragTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
