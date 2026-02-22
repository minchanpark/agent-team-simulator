"use client";

import { memo } from "react";
import { TEAM_AGENT_META } from "@/lib/agents/recommend";
import { ExecutionTask, TaskStatus } from "@/lib/types";

interface TaskBoardProps {
  tasks: ExecutionTask[];
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
}

const STATUS_COLUMNS: Array<{ status: TaskStatus; title: string; color: string }> = [
  { status: "todo", title: "Todo", color: "border-slate-200" },
  { status: "doing", title: "Doing", color: "border-amber-200" },
  { status: "done", title: "Done", color: "border-emerald-200" },
];

const PRIORITY_CLASSNAME: Record<ExecutionTask["priority"], string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-700",
};

export function TaskBoard({ tasks, onUpdateStatus }: TaskBoardProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {STATUS_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);

        return (
          <section key={column.status} className={`rounded-xl border bg-slate-50 p-3 ${column.color}`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{column.title}</h3>
              <span className="text-xs font-medium text-slate-500">{columnTasks.length}</span>
            </div>

            <ul className="space-y-2">
              {columnTasks.map((task) => {
                const ownerMeta = TEAM_AGENT_META[task.ownerAgent];

                return (
                  <li key={task.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">{task.title}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        {ownerMeta.emoji} {ownerMeta.name}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${PRIORITY_CLASSNAME[task.priority]}`}>
                        {task.priority.toUpperCase()}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        {task.effort}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{task.dueDate}</span>
                    </div>

                    <p className="mt-2 text-xs text-slate-600">지표: {task.metric}</p>

                    <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor={`status-${task.id}`}>
                      상태 변경
                    </label>
                    <select
                      id={`status-${task.id}`}
                      value={task.status}
                      onChange={(event) => onUpdateStatus(task.id, event.target.value as TaskStatus)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    >
                      <option value="todo">Todo</option>
                      <option value="doing">Doing</option>
                      <option value="done">Done</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default memo(TaskBoard);
