"use client";

import type { FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AgentMapView from "@/components/agents/AgentMapView";
import { useOnboardingStore } from "@/lib/store/onboarding";
import {
  AgentMeta,
  ChatMessage,
  ChatResponse,
  DIAGNOSTIC_DIMENSIONS,
  DiagnosticDimension,
  UserContext,
} from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react") as typeof import("react");

interface ChatPanelProps {
  agent: AgentMeta;
  context: UserContext;
}

const DIAGNOSTIC_LABELS: Record<DiagnosticDimension, string> = {
  goal: "목표",
  bottleneck: "병목",
  target: "대상 고객",
  resource: "리소스 제약",
  metric: "성공 지표",
};

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

export function ChatPanel({ agent, context }: ChatPanelProps) {
  const hasHydrated = useOnboardingStore((state) => state.hasHydrated);
  const session = useOnboardingStore((state) => state.agentSessions[agent.type]);
  const appendAgentMessage = useOnboardingStore((state) => state.appendAgentMessage);
  const setAgentProgress = useOnboardingStore((state) => state.setAgentProgress);
  const setAgentMapDocument = useOnboardingStore((state) => state.setAgentMapDocument);
  const resetAgentSession = useOnboardingStore((state) => state.resetAgentSession);

  const [input, setInput] = React.useState("");
  const [isSubmittingDiagnosis, setIsSubmittingDiagnosis] = React.useState(false);
  const [isGeneratingMap, setIsGeneratingMap] = React.useState(false);
  const [diagnosisErrorMessage, setDiagnosisErrorMessage] = React.useState<string | null>(null);
  const [mapErrorMessage, setMapErrorMessage] = React.useState<string | null>(null);
  const bottomAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const initialDiagnosisRequestedRef = React.useRef(false);

  const canStartChat = context.idea.trim().length > 0;
  const hasMapDocument = Boolean(session.mapDocument);

  React.useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, session.mapDocument, isSubmittingDiagnosis, isGeneratingMap]);

  const requestDiagnosis = React.useCallback(
    async (messages: ChatMessage[]) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "diagnosis",
          agentType: agent.type,
          messages,
          context,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "진단 질문을 생성하지 못했습니다.");
      }

      const payload = (await response.json()) as ChatResponse;
      if (payload.mode !== "diagnosis") {
        throw new Error("진단 응답 형식이 올바르지 않습니다.");
      }

      return payload;
    },
    [agent.type, context],
  );

  const requestAgentMap = React.useCallback(
    async (messages: ChatMessage[]) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate_map",
          agentType: agent.type,
          messages,
          context,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "에이전트 맵 생성에 실패했습니다.");
      }

      const payload = (await response.json()) as ChatResponse;
      if (payload.mode !== "generate_map") {
        throw new Error("맵 응답 형식이 올바르지 않습니다.");
      }

      return payload.document;
    },
    [agent.type, context],
  );

  const runDiagnosisTurn = React.useCallback(
    async (messages: ChatMessage[]) => {
      setDiagnosisErrorMessage(null);
      setIsSubmittingDiagnosis(true);

      try {
        const diagnosis = await requestDiagnosis(messages);
        appendAgentMessage(agent.type, {
          role: "assistant",
          content: diagnosis.message,
        });
        setAgentProgress(agent.type, diagnosis.progress);
      } catch (error) {
        setDiagnosisErrorMessage(extractErrorMessage(error));
      } finally {
        setIsSubmittingDiagnosis(false);
      }
    },
    [agent.type, appendAgentMessage, requestDiagnosis, setAgentProgress],
  );

  React.useEffect(() => {
    if (!hasHydrated || !canStartChat) {
      return;
    }

    if (session.messages.length > 0 || session.progress.completed.length > 0 || hasMapDocument) {
      return;
    }

    if (initialDiagnosisRequestedRef.current) {
      return;
    }

    initialDiagnosisRequestedRef.current = true;
    void runDiagnosisTurn([]);
  }, [
    canStartChat,
    hasHydrated,
    hasMapDocument,
    runDiagnosisTurn,
    session.messages.length,
    session.progress.completed.length,
  ]);

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isSubmittingDiagnosis || isGeneratingMap || hasMapDocument) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmedInput,
    };
    const nextMessages = [...session.messages, userMessage];

    appendAgentMessage(agent.type, userMessage);
    setInput("");
    await runDiagnosisTurn(nextMessages);
  };

  const handleGenerateMap = async () => {
    if (!canStartChat || isGeneratingMap || hasMapDocument) {
      return;
    }

    setMapErrorMessage(null);
    setIsGeneratingMap(true);

    try {
      const mapDocument = await requestAgentMap(session.messages);
      setAgentMapDocument(agent.type, mapDocument);
    } catch (error) {
      setMapErrorMessage(extractErrorMessage(error));
    } finally {
      setIsGeneratingMap(false);
    }
  };

  const handleResetDiagnosis = () => {
    initialDiagnosisRequestedRef.current = false;
    setInput("");
    setDiagnosisErrorMessage(null);
    setMapErrorMessage(null);
    resetAgentSession(agent.type);
  };

  const handleRetryQuestion = () => {
    if (isSubmittingDiagnosis || isGeneratingMap || !canStartChat) {
      return;
    }

    void runDiagnosisTurn(session.messages);
  };

  const readyCount = session.progress.completed.length;
  const missingLabels = DIAGNOSTIC_DIMENSIONS.filter((dimension) =>
    session.progress.missing.includes(dimension),
  ).map((dimension) => DIAGNOSTIC_LABELS[dimension]);

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
          {session.progress.readyForMap && (
            <span className="ml-1 font-semibold text-teal-700">· 맵 생성 가능</span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-4">
        {!hasHydrated && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            세션 데이터를 불러오는 중입니다...
          </div>
        )}

        {!canStartChat && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            온보딩 정보가 없어 진단을 시작할 수 없습니다. 먼저 온보딩에서 아이디어와 팀 상황을 입력해 주세요.
          </div>
        )}

        <ul className="space-y-3">
          {session.messages.map((message, index) => (
            <li
              key={`${message.role}-${index}`}
              className={[
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-800",
              ].join(" ")}
            >
              {message.content}
            </li>
          ))}

          {isSubmittingDiagnosis && (
            <li className="max-w-[85%] rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
              진단 질문을 생성하고 있습니다...
            </li>
          )}

          {isGeneratingMap && (
            <li className="max-w-[85%] rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
              에이전트 맵을 생성하고 있습니다...
            </li>
          )}
        </ul>

        {diagnosisErrorMessage && (
          <div className="mt-4 space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{diagnosisErrorMessage}</p>
            <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={handleRetryQuestion}>
              질문 다시 받기
            </Button>
          </div>
        )}

        {mapErrorMessage && (
          <div className="mt-4 space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{mapErrorMessage}</p>
            <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={handleGenerateMap}>
              맵 다시 생성
            </Button>
          </div>
        )}

        {session.mapDocument && (
          <div className="mt-6">
            <AgentMapView agent={agent} mapDocument={session.mapDocument} />
          </div>
        )}

        <div ref={bottomAnchorRef} />
      </main>

      <footer className="space-y-3 border-t border-slate-200 p-4">
        <form onSubmit={submitMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="답변을 입력해 주세요"
            className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            disabled={!canStartChat || isSubmittingDiagnosis || isGeneratingMap || hasMapDocument}
          />
          <Button
            type="submit"
            disabled={
              !canStartChat ||
              isSubmittingDiagnosis ||
              isGeneratingMap ||
              input.trim().length === 0 ||
              hasMapDocument
            }
          >
            전송
          </Button>
        </form>

        {session.mapDocument ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={handleGenerateMap} disabled={isGeneratingMap}>
              맵 다시 생성
            </Button>
            <Button type="button" variant="ghost" onClick={handleResetDiagnosis}>
              진단 다시 시작
            </Button>
          </div>
        ) : (
          session.messages.length > 0 && (
            <Button type="button" onClick={handleGenerateMap} disabled={isGeneratingMap}>
              {session.progress.readyForMap ? "에이전트 맵 생성" : "현재 정보로 맵 생성"}
            </Button>
          )
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={handleResetDiagnosis}>
            진단 초기화
          </Button>
        </div>
      </footer>
    </Card>
  );
}

export default ChatPanel;
