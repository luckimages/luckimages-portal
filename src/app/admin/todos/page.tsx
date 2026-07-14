"use client";

import { useEffect, useState } from "react";
import TaskBoard, { type TodoList, type Todo } from "@/app/dashboard/TaskBoard";

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
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="px-4 md:px-8 py-8 w-full max-w-[1900px] mx-auto">
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
    </div>
  );
}
