"use client";

import { useEffect, useState } from "react";
import TaskBoard, { type TodoList, type Todo } from "../TaskBoard";

export default function TodosPage() {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [completed, setCompleted] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/todos")
      .then(r => r.ok ? r.json() : { lists: [], active: [], completed: [] })
      .then(d => {
        setLists(d.lists || []);
        setTodos(d.active || []);
        setCompleted(d.completed || []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/10 gap-4">
        <a href="/" className="text-xl font-black tracking-tight uppercase hover:opacity-70 transition-opacity shrink-0">Luck Images</a>
        <div className="flex items-center gap-4 md:gap-6 flex-wrap justify-end">
          <a href="/dashboard?page=apps" className="text-xs tracking-[2px] uppercase text-[#666] hover:text-white transition-colors">← Dashboard</a>
          <form action="/api/auth/signout" method="post" className="inline">
            <button type="submit" className="text-xs tracking-[3px] uppercase text-[#666] hover:text-white transition-colors">Sign Out</button>
          </form>
        </div>
      </header>

      <div className="flex-1 px-4 md:px-8 py-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <p className="text-xs tracking-[4px] uppercase text-[#555] mb-1">Command Center</p>
          <h1 className="text-2xl font-black tracking-tight uppercase">Task Lists</h1>
          <p className="text-xs text-[#444] mt-1">Drag tasks to reorder or move between lists. Double-click a list name to rename it.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-xs tracking-[3px] uppercase text-[#444]">Loading...</p>
          </div>
        ) : (
          <TaskBoard
            lists={lists}
            todos={todos}
            completedTodos={completed}
            onTodosChange={setTodos}
            onCompletedChange={setCompleted}
            onListsChange={setLists}
          />
        )}
      </div>
    </main>
  );
}
