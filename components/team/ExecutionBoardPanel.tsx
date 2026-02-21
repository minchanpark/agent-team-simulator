"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TaskBoard from "@/components/team/TaskBoard";
import { ExecutionBoard, TaskStatus, TeamTurnResult } from "@/lib/types";

interface ExecutionBoardPanelProps {
  board: ExecutionBoard | null;
  lastResult: TeamTurnResult | null;
  isRunning: boolean;
  isDownloading: boolean;
  onDownloadMarkdown: () => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
}

export function ExecutionBoardPanel({
  board,
  lastResult,
  isRunning,
  isDownloading,
  onDownloadMarkdown,
  onUpdateTaskStatus,
}: ExecutionBoardPanelProps) {
  if (!board) {
    return (
      <Card>
        <h2 className="text-lg font-bold text-slate-900">실행보드</h2>
        <p className="mt-2 text-sm text-slate-600">
          팀룸 대화를 시작하면 PM 오케스트레이터가 실행보드를 자동 생성합니다.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Execution Board</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{board.projectGoal}</h2>
            <p className="mt-1 text-xs text-slate-500">
              버전 v{board.version} · 업데이트 {new Date(board.updatedAt).toLocaleString("ko-KR")}
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={onDownloadMarkdown}
            disabled={isDownloading || !lastResult}
          >
            {isDownloading ? "내보내는 중..." : "MD 다운로드"}
          </Button>
        </div>

        {lastResult && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">이번 턴 변경 작업</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {lastResult.changedTasks.length > 0 ? (
                lastResult.changedTasks.map((task, index) => (
                  <li key={`${task}-${index}`}>- {task}</li>
                ))
              ) : (
                <li>- 변경 작업 없음</li>
              )}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900">작업 보드</h3>
        <div className="mt-3">
          <TaskBoard tasks={board.tasks} onUpdateStatus={onUpdateTaskStatus} />
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <h3 className="text-sm font-semibold text-slate-900">KPI</h3>
            <ul className="mt-2 space-y-2">
              {board.kpis.map((kpi) => (
                <li key={`${kpi.name}-${kpi.target}`} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{kpi.name}</p>
                  <p className="mt-1">
                    목표: {kpi.target} · 주기: {kpi.cadence}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">리스크</h3>
            <ul className="mt-2 space-y-2">
              {board.risks.map((risk) => (
                <li key={risk.risk} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{risk.risk}</p>
                  <p className="mt-1">완화 전략: {risk.mitigation}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900">이번 주 실행 계획</h3>
        <ul className="mt-2 space-y-2">
          {board.weeklyPlan.map((item, index) => (
            <li key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              - [ ] {item}
            </li>
          ))}
        </ul>
        {isRunning && <p className="mt-3 text-xs text-teal-700">다음 턴에서 보드를 다시 갱신합니다.</p>}
      </Card>
    </div>
  );
}

export default ExecutionBoardPanel;
