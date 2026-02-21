"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConsensusCard from "@/components/team/ConsensusCard";
import ExecutionBoardPanel from "@/components/team/ExecutionBoardPanel";
import TeamChatTimeline from "@/components/team/TeamChatTimeline";
import {
  formatConstraints,
  formatPainPoints,
  formatTeamRoles,
  STAGE_LABELS,
  TEAM_SIZE_LABELS,
} from "@/lib/agents/recommend";
import { useOnboardingStore } from "@/lib/store/onboarding";
import { getRecoveryNotice } from "@/lib/team/recovery";
import {
  TeamExportMarkdownResponse,
  TeamMessageType,
  TeamTurnErrorResponse,
  TeamTurnSuccessResponse,
} from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react") as typeof import("react");

type TrackedEventName =
  | "team_room_opened"
  | "team_turn_submitted"
  | "team_turn_succeeded"
  | "team_turn_failed"
  | "execution_board_generated"
  | "team_consensus_completed"
  | "team_recovery_applied"
  | "team_trace_captured";

function emitTeamEvent(event: TrackedEventName, metadata?: Record<string, unknown>) {
  void fetch("/api/team/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event,
      metadata,
    }),
  }).catch(() => null);
}

function createMessage(
  role: "user" | "assistant",
  content: string,
  speakerAgent?: "pm",
  messageType?: TeamMessageType,
): {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  speakerAgent?: "pm";
  messageType?: TeamMessageType;
} {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
    speakerAgent,
    messageType,
  };
}

export function TeamRoomView() {
  const context = useOnboardingStore((state) => state.context);
  const teamSession = useOnboardingStore((state) => state.teamSession);
  const appendTeamMessage = useOnboardingStore((state) => state.appendTeamMessage);
  const setTeamRunning = useOnboardingStore((state) => state.setTeamRunning);
  const setTeamResult = useOnboardingStore((state) => state.setTeamResult);
  const setTeamError = useOnboardingStore((state) => state.setTeamError);
  const setTeamBoard = useOnboardingStore((state) => state.setTeamBoard);
  const updateTeamTaskStatus = useOnboardingStore((state) => state.updateTeamTaskStatus);
  const clearTeamError = useOnboardingStore((state) => state.clearTeamError);
  const resetTeamSession = useOnboardingStore((state) => state.resetTeamSession);

  const [input, setInput] = React.useState("");
  const [isDownloading, setIsDownloading] = React.useState(false);
  const isDev = process.env.NODE_ENV !== "production";
  const [debugMode, setDebugMode] = React.useState(false);

  const bottomAnchorRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [teamSession.messages, teamSession.status]);

  React.useEffect(() => {
    emitTeamEvent("team_room_opened");
  }, []);

  const canStartChat = context.idea.trim().length > 0;
  const isRunning = teamSession.status === "running";

  const sendTurn = React.useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isRunning || !canStartChat) {
        return;
      }

      const userMessage = createMessage("user", trimmed);
      const nextMessages = [...teamSession.messages, userMessage];

      appendTeamMessage(userMessage);
      setTeamRunning();
      setInput("");
      emitTeamEvent("team_turn_submitted");

      try {
        const response = await fetch("/api/team/turn", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            context,
            messages: nextMessages,
            currentBoard: teamSession.board,
            teamSpecId: "default-v1",
            debug: isDev && debugMode,
          }),
        });

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as TeamTurnErrorResponse | null;

          if (errorPayload?.fallbackBoard) {
            setTeamBoard(errorPayload.fallbackBoard);
          }

          throw new Error(errorPayload?.message ?? "팀룸 응답 생성에 실패했습니다.");
        }

        const payload = (await response.json()) as TeamTurnSuccessResponse;
        setTeamResult({
          result: payload.result,
          trace: payload.trace,
          recoveryLevel: payload.recoveryLevel,
        });
        appendTeamMessage(createMessage("assistant", payload.result.orchestratorReply, "pm", "normal"));
        emitTeamEvent("team_turn_succeeded", { latencyMs: payload.latencyMs });
        emitTeamEvent("execution_board_generated", { taskCount: payload.result.board.tasks.length });
        emitTeamEvent("team_consensus_completed");

        if (payload.trace) {
          emitTeamEvent("team_trace_captured");
        }

        if (payload.recoveryLevel && payload.recoveryLevel !== "none") {
          const notice = getRecoveryNotice(payload.recoveryLevel);
          if (notice) {
            appendTeamMessage(createMessage("assistant", notice, "pm", "recovery"));
          }
          emitTeamEvent("team_recovery_applied", { recoveryLevel: payload.recoveryLevel });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        setTeamError(message);
        emitTeamEvent("team_turn_failed");
      }
    },
    [
      appendTeamMessage,
      canStartChat,
      context,
      isRunning,
      setTeamBoard,
      setTeamError,
      setTeamResult,
      setTeamRunning,
      teamSession.board,
      teamSession.messages,
      isDev,
      debugMode,
    ],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendTurn(input);
  };

  const handleRetry = () => {
    clearTeamError();
    void sendTurn("현재 실행보드를 기준으로 다음 우선순위를 업데이트해줘.");
  };

  const handleDownloadMarkdown = async () => {
    if (!teamSession.board || !teamSession.lastResult || isDownloading) {
      return;
    }

    setIsDownloading(true);

    try {
      const response = await fetch("/api/team/export-md", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          board: teamSession.board,
          lastTurnResult: teamSession.lastResult,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as TeamTurnErrorResponse | null;
        throw new Error(errorPayload?.message ?? "마크다운 생성에 실패했습니다.");
      }

      const payload = (await response.json()) as TeamExportMarkdownResponse;
      const blob = new Blob([payload.markdown], {
        type: "text/markdown;charset=utf-8",
      });
      const fileUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = fileUrl;
      anchor.download = payload.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setTeamError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
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
                onChange={(event) => setDebugMode(event.target.checked)}
                className="h-4 w-4 accent-teal-600"
              />
              Debug Trace
            </label>
          )}
          <Link
            href="/result"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            추천 결과로 이동
          </Link>
          <Button type="button" variant="ghost" onClick={resetTeamSession}>
            팀룸 초기화
          </Button>
        </div>
      </header>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">현재 컨텍스트</h2>
        <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold">아이디어:</span> {context.idea || "미입력"}
          </p>
          <p>
            <span className="font-semibold">고민:</span> {formatPainPoints(context.painPoints)}
          </p>
          <p>
            <span className="font-semibold">팀 규모:</span> {TEAM_SIZE_LABELS[context.teamSize]}
          </p>
          <p>
            <span className="font-semibold">현재 단계:</span> {STAGE_LABELS[context.currentStage]}
          </p>
          <p>
            <span className="font-semibold">월 예산:</span>{" "}
            {context.budgetMonthly !== null ? `${context.budgetMonthly}만원` : "미입력"}
          </p>
          <p>
            <span className="font-semibold">런웨이:</span>{" "}
            {context.runwayMonths !== null ? `${context.runwayMonths}개월` : "미입력"}
          </p>
          <p className="sm:col-span-2">
            <span className="font-semibold">팀 역할:</span> {formatTeamRoles(context.teamRoles)}
          </p>
          <p className="sm:col-span-2">
            <span className="font-semibold">제약 조건:</span> {formatConstraints(context.constraints)}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="flex h-[75vh] flex-col p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">팀 대화 타임라인</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {!canStartChat && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                온보딩에서 아이디어를 입력한 뒤 통합 대화를 시작할 수 있습니다.
              </div>
            )}

            {teamSession.error && (
              <div className="mb-4 space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p>{teamSession.error}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={handleRetry}>
                    재시도
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={clearTeamError}
                  >
                    닫기
                  </Button>
                </div>
              </div>
            )}
            {teamSession.recoveryLevel !== "none" && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                복구 모드 적용됨: {teamSession.recoveryLevel}
              </div>
            )}

            <TeamChatTimeline messages={teamSession.messages} isRunning={isRunning} />
            <div ref={bottomAnchorRef} />
          </div>

          <div className="border-t border-slate-200 p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="팀이 해결해야 할 문제를 입력하세요"
                disabled={!canStartChat || isRunning}
                className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              <Button type="submit" disabled={!canStartChat || isRunning || input.trim().length === 0}>
                전송
              </Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          <ConsensusCard result={teamSession.lastResult} />
          <ExecutionBoardPanel
            board={teamSession.board}
            lastResult={teamSession.lastResult}
            isRunning={isRunning}
            isDownloading={isDownloading}
            onDownloadMarkdown={handleDownloadMarkdown}
            onUpdateTaskStatus={updateTeamTaskStatus}
          />
          {isDev && debugMode && teamSession.trace && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trace (Debug)</p>
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                {JSON.stringify(teamSession.trace, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

export default TeamRoomView;
