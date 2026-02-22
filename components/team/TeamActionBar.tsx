"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
}

interface TeamActionBarProps {
  isDev: boolean;
  debugMode: boolean;
  onToggleDebug: (value: boolean) => void;
  onReset: () => void;
  quickActions: QuickAction[];
  onQuickAction: (prompt: string) => void;
  disabledQuickAction: boolean;
}

export function TeamActionBar({
  isDev,
  debugMode,
  onToggleDebug,
  onReset,
  quickActions,
  onQuickAction,
  disabledQuickAction,
}: TeamActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-teal-700">Team Room</p>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">멀티 에이전트 통합 대화방</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {isDev && (
          <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(event) => onToggleDebug(event.target.checked)}
              className="h-4 w-4 accent-teal-600"
            />
            Debug Trace
          </label>
        )}

        {quickActions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="ghost"
            onClick={() => onQuickAction(action.prompt)}
            disabled={disabledQuickAction}
          >
            {action.label}
          </Button>
        ))}

        <Link
          href="/result"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          추천 결과로 이동
        </Link>
        <Button type="button" variant="ghost" onClick={onReset}>
          팀룸 초기화
        </Button>
      </div>
    </div>
  );
}

export default TeamActionBar;
