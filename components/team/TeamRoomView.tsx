"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConsensusCard from "@/components/team/ConsensusCard";
import ExecutionBoardPanel from "@/components/team/ExecutionBoardPanel";
import TeamActionBar from "@/components/team/TeamActionBar";
import TeamChatTimeline from "@/components/team/TeamChatTimeline";
import TeamContextSummary from "@/components/team/TeamContextSummary";
import useTeamTurn from "@/components/team/hooks/useTeamTurn";
import { useOnboardingStore } from "@/lib/store/onboarding";

export function TeamRoomView() {
  const updateTeamTaskStatus = useOnboardingStore((state) => state.updateTeamTaskStatus);

  const {
    context,
    teamSession,
    input,
    setInput,
    isDownloading,
    isDev,
    debugMode,
    setDebugMode,
    canStartChat,
    isRunning,
    retryAfterSec,
    bottomAnchorRef,
    submitTurn,
    sendQuickAction,
    quickActions,
    handleRetry,
    handleDownloadMarkdown,
    clearTeamError,
    resetTeamSession,
  } = useTeamTurn();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <TeamActionBar
        isDev={isDev}
        debugMode={debugMode}
        onToggleDebug={setDebugMode}
        onReset={resetTeamSession}
        quickActions={quickActions}
        onQuickAction={sendQuickAction}
        disabledQuickAction={!canStartChat || isRunning || retryAfterSec > 0}
      />

      <TeamContextSummary context={context} />

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

            {retryAfterSec > 0 && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                요청 제한이 적용되었습니다. {retryAfterSec}초 후 다시 시도해 주세요.
              </div>
            )}

            {teamSession.error && (
              <div className="mb-4 space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p>{teamSession.error}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={handleRetry}>
                    재시도
                  </Button>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={clearTeamError}>
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
            <form onSubmit={submitTurn} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="팀이 해결해야 할 문제를 입력하세요"
                disabled={!canStartChat || isRunning || retryAfterSec > 0}
                className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              <Button
                type="submit"
                disabled={!canStartChat || isRunning || input.trim().length === 0 || retryAfterSec > 0}
              >
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
