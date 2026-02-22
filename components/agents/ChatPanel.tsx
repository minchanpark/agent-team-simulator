"use client";

import Card from "@/components/ui/Card";
import AgentMapActions from "@/components/agents/chat/AgentMapActions";
import AgentMessageList from "@/components/agents/chat/AgentMessageList";
import AgentComposer from "@/components/agents/chat/AgentComposer";
import AgentMapView from "@/components/agents/AgentMapView";
import useAgentChat from "@/components/agents/hooks/useAgentChat";
import {
  AgentMeta,
  DIAGNOSTIC_DIMENSIONS,
  UserContext,
} from "@/lib/types";

interface ChatPanelProps {
  agent: AgentMeta;
  context: UserContext;
}

export function ChatPanel({ agent, context }: ChatPanelProps) {
  const {
    hasHydrated,
    canStartChat,
    hasMapDocument,
    input,
    session,
    bottomAnchorRef,
    isSubmittingDiagnosis,
    isGeneratingMap,
    diagnosisErrorMessage,
    mapErrorMessage,
    retryAfterSec,
    readyCount,
    missingLabels,
    quickActions,
    setInput,
    sendText,
    handleGenerateMap,
    handleResetDiagnosis,
    handleRetryQuestion,
    handleQuickAction,
  } = useAgentChat({ agent, context });

  const isInputDisabled =
    !canStartChat || isSubmittingDiagnosis || isGeneratingMap || hasMapDocument || retryAfterSec > 0;

  return (
    <Card className="mx-auto flex h-[78vh] w-full max-w-4xl flex-col p-0">
      <header className="space-y-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {agent.emoji}
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{agent.name}</h1>
            <p className="text-sm text-slate-600">{agent.summary}</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          진단 진행도: {readyCount}/{DIAGNOSTIC_DIMENSIONS.length}
          {missingLabels.length > 0 && <span className="ml-1">· 미수집: {missingLabels.join(", ")}</span>}
          {session.progress.readyForMap && <span className="ml-1 font-semibold text-teal-700">· 맵 생성 가능</span>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-4">
        {!hasHydrated && (
          <div aria-live="polite" className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            세션 데이터를 불러오는 중입니다...
          </div>
        )}

        {!canStartChat && (
          <div aria-live="polite" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            온보딩 정보가 없어 진단을 시작할 수 없습니다. 먼저 온보딩에서 아이디어와 팀 상황을 입력해 주세요.
          </div>
        )}

        <AgentMessageList
          messages={session.messages}
          isSubmittingDiagnosis={isSubmittingDiagnosis}
          isGeneratingMap={isGeneratingMap}
          diagnosisErrorMessage={diagnosisErrorMessage}
          mapErrorMessage={mapErrorMessage}
          onRetryQuestion={handleRetryQuestion}
          onRetryMap={handleGenerateMap}
        />

        {session.mapDocument && (
          <div className="mt-6">
            <AgentMapView agent={agent} mapDocument={session.mapDocument} />
          </div>
        )}

        <div ref={bottomAnchorRef} />
      </main>

      <footer className="space-y-3 border-t border-slate-200 p-4">
        <AgentComposer
          input={input}
          onInputChange={setInput}
          onSubmitText={sendText}
          disabled={isInputDisabled}
          retryAfterSec={retryAfterSec}
        />

        <AgentMapActions
          hasMapDocument={hasMapDocument}
          messagesLength={session.messages.length}
          readyForMap={session.progress.readyForMap}
          isGeneratingMap={isGeneratingMap}
          disabled={!canStartChat || isSubmittingDiagnosis || isGeneratingMap || retryAfterSec > 0}
          quickActions={quickActions}
          onGenerateMap={handleGenerateMap}
          onReset={handleResetDiagnosis}
          onQuickAction={handleQuickAction}
        />
      </footer>
    </Card>
  );
}

export default ChatPanel;
