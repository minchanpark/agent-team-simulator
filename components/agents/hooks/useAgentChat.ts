"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnboardingStore } from "@/lib/store/onboarding";
import {
  AgentMeta,
  ApiErrorResponse,
  ApiErrorCode,
  ChatMessage,
  ChatResponse,
  DIAGNOSTIC_DIMENSIONS,
  DiagnosticDimension,
  UserContext,
} from "@/lib/types";

interface RequestFailure {
  message: string;
  code: ApiErrorCode | "UNKNOWN";
  recoverable: boolean;
  retryAfterSec?: number;
}

interface UseAgentChatParams {
  agent: AgentMeta;
  context: UserContext;
}

type QuickActionTemplate = "reprioritize" | "risk" | "weekly_plan";

interface QuickActionOption {
  id: QuickActionTemplate;
  label: string;
  prompt: string;
}

const DIAGNOSTIC_LABELS: Record<DiagnosticDimension, string> = {
  goal: "목표",
  bottleneck: "병목",
  target: "대상 고객",
  resource: "리소스 제약",
  metric: "성공 지표",
};

const QUICK_ACTIONS_BY_AGENT: Record<AgentMeta["type"], QuickActionOption[]> = {
  marketing: [
    {
      id: "reprioritize",
      label: "채널 우선순위 재정렬",
      prompt:
        "마케팅 관점에서 채널/메시지 우선순위를 다시 정렬해줘. 이번 주에 임팩트가 큰 3가지 액션을 먼저 제안해줘.",
    },
    {
      id: "risk",
      label: "카피 리스크 점검",
      prompt:
        "현재 마케팅 계획에서 카피, 타겟 오해, 채널 효율 저하 리스크를 점검하고 완화 전략을 정리해줘.",
    },
    {
      id: "weekly_plan",
      label: "이번 주 캠페인 정리",
      prompt:
        "이번 주 마케팅 실행 계획만 간결하게 다시 작성해줘. 채널별 실험 1개씩 포함해줘.",
    },
  ],
  cs: [
    {
      id: "reprioritize",
      label: "문의 유형 우선순위 정리",
      prompt:
        "CS 관점에서 문의 유형별 우선순위를 다시 정렬해줘. 응답 체감 개선이 큰 항목 3개를 먼저 제안해줘.",
    },
    {
      id: "risk",
      label: "응대 품질 리스크 점검",
      prompt:
        "현재 응대/FAQ 운영에서 품질 저하 리스크를 점검하고, SLA와 CSAT 기준으로 완화 전략을 정리해줘.",
    },
    {
      id: "weekly_plan",
      label: "FAQ 개선 계획 정리",
      prompt:
        "이번 주 CS 실행 계획만 다시 작성해줘. FAQ 개선, 매크로 정비, 에스컬레이션 기준을 포함해줘.",
    },
  ],
  data: [
    {
      id: "reprioritize",
      label: "핵심 지표 우선순위 정리",
      prompt:
        "데이터 관점에서 핵심 지표 우선순위를 다시 정렬해줘. 지금 당장 추적해야 할 지표 3개를 제안해줘.",
    },
    {
      id: "risk",
      label: "데이터 품질 리스크 점검",
      prompt:
        "현재 측정 체계에서 데이터 누락/왜곡 리스크를 점검하고, 신뢰도 확보를 위한 완화 전략을 정리해줘.",
    },
    {
      id: "weekly_plan",
      label: "실험/측정 계획 정리",
      prompt:
        "이번 주 데이터 실행 계획만 다시 작성해줘. 이벤트 트래킹, 대시보드, 실험 검증 일정을 포함해줘.",
    },
  ],
  dev: [
    {
      id: "reprioritize",
      label: "구현 우선순위 재정렬",
      prompt:
        "개발 관점에서 구현 우선순위를 다시 정렬해줘. 난이도 대비 효과가 큰 3개 작업을 먼저 제안해줘.",
    },
    {
      id: "risk",
      label: "기술 리스크 점검",
      prompt:
        "현재 구현 계획에서 기술 부채, 품질 저하, 일정 지연 리스크를 점검하고 완화 전략을 정리해줘.",
    },
    {
      id: "weekly_plan",
      label: "개발 스프린트 정리",
      prompt:
        "이번 주 개발 실행 계획만 다시 작성해줘. 구현, 테스트, 배포 준비를 포함한 스프린트 형태로 정리해줘.",
    },
  ],
};

function toRequestFailure(error: unknown): RequestFailure {
  if (typeof error !== "object" || error === null) {
    return {
      message: "알 수 없는 오류가 발생했습니다.",
      code: "UNKNOWN",
      recoverable: true,
    };
  }

  const candidate = error as Partial<RequestFailure>;
  return {
    message: typeof candidate.message === "string" ? candidate.message : "알 수 없는 오류가 발생했습니다.",
    code: (candidate.code as ApiErrorCode | "UNKNOWN") ?? "UNKNOWN",
    recoverable: candidate.recoverable !== false,
    retryAfterSec:
      typeof candidate.retryAfterSec === "number" && Number.isFinite(candidate.retryAfterSec)
        ? candidate.retryAfterSec
        : undefined,
  };
}

async function parseApiFailure(response: Response, fallbackMessage: string): Promise<RequestFailure> {
  const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
  if (!payload) {
    return {
      message: fallbackMessage,
      code: "UNKNOWN",
      recoverable: response.status >= 500,
    };
  }

  return {
    message: payload.message,
    code: payload.errorCode,
    recoverable: payload.recoverable,
    retryAfterSec: payload.retryAfterSec,
  };
}

export function useAgentChat({ agent, context }: UseAgentChatParams) {
  const hasHydrated = useOnboardingStore((state) => state.hasHydrated);
  const session = useOnboardingStore((state) => state.agentSessions[agent.type]);
  const appendAgentMessage = useOnboardingStore((state) => state.appendAgentMessage);
  const setAgentProgress = useOnboardingStore((state) => state.setAgentProgress);
  const setAgentMapDocument = useOnboardingStore((state) => state.setAgentMapDocument);
  const resetAgentSession = useOnboardingStore((state) => state.resetAgentSession);

  const [input, setInput] = useState("");
  const [isSubmittingDiagnosis, setIsSubmittingDiagnosis] = useState(false);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [diagnosisErrorMessage, setDiagnosisErrorMessage] = useState<string | null>(null);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);
  const [retryAfterSec, setRetryAfterSec] = useState(0);

  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const initialDiagnosisRequestedRef = useRef(false);

  const canStartChat = context.idea.trim().length > 0;
  const hasMapDocument = Boolean(session.mapDocument);
  const quickActions = useMemo(() => QUICK_ACTIONS_BY_AGENT[agent.type], [agent.type]);

  const missingLabels = useMemo(
    () =>
      DIAGNOSTIC_DIMENSIONS.filter((dimension) => session.progress.missing.includes(dimension)).map(
        (dimension) => DIAGNOSTIC_LABELS[dimension],
      ),
    [session.progress.missing],
  );

  useEffect(() => {
    if (retryAfterSec <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRetryAfterSec((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfterSec]);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, session.mapDocument, isSubmittingDiagnosis, isGeneratingMap, diagnosisErrorMessage, mapErrorMessage]);

  const requestDiagnosis = useCallback(
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
        throw await parseApiFailure(response, "진단 질문을 생성하지 못했습니다.");
      }

      const payload = (await response.json()) as ChatResponse;
      if (payload.mode !== "diagnosis") {
        throw {
          message: "진단 응답 형식이 올바르지 않습니다.",
          code: "INVALID_REQUEST",
          recoverable: false,
        } as RequestFailure;
      }

      return payload;
    },
    [agent.type, context],
  );

  const requestAgentMap = useCallback(
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
        throw await parseApiFailure(response, "에이전트 맵 생성에 실패했습니다.");
      }

      const payload = (await response.json()) as ChatResponse;
      if (payload.mode !== "generate_map") {
        throw {
          message: "맵 응답 형식이 올바르지 않습니다.",
          code: "INVALID_REQUEST",
          recoverable: false,
        } as RequestFailure;
      }

      return payload.document;
    },
    [agent.type, context],
  );

  const runDiagnosisTurn = useCallback(
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
        const failure = toRequestFailure(error);
        setDiagnosisErrorMessage(
          failure.recoverable ? failure.message : `요청이 거부되었습니다. ${failure.message}`,
        );
        if (failure.code === "RATE_LIMITED" && failure.retryAfterSec) {
          setRetryAfterSec(failure.retryAfterSec);
        }
      } finally {
        setIsSubmittingDiagnosis(false);
      }
    },
    [agent.type, appendAgentMessage, requestDiagnosis, setAgentProgress],
  );

  useEffect(() => {
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

  const sendText = useCallback(
    async (text: string) => {
      const trimmedInput = text.trim();
      if (!trimmedInput || isSubmittingDiagnosis || isGeneratingMap || hasMapDocument || retryAfterSec > 0) {
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
    },
    [
      agent.type,
      appendAgentMessage,
      hasMapDocument,
      isGeneratingMap,
      isSubmittingDiagnosis,
      retryAfterSec,
      runDiagnosisTurn,
      session.messages,
    ],
  );

  const handleGenerateMap = useCallback(async () => {
    if (!canStartChat || isGeneratingMap || hasMapDocument || retryAfterSec > 0) {
      return;
    }

    setMapErrorMessage(null);
    setIsGeneratingMap(true);

    try {
      const mapDocument = await requestAgentMap(session.messages);
      setAgentMapDocument(agent.type, mapDocument);
    } catch (error) {
      const failure = toRequestFailure(error);
      setMapErrorMessage(
        failure.recoverable ? failure.message : `요청이 거부되었습니다. ${failure.message}`,
      );
      if (failure.code === "RATE_LIMITED" && failure.retryAfterSec) {
        setRetryAfterSec(failure.retryAfterSec);
      }
    } finally {
      setIsGeneratingMap(false);
    }
  }, [
    agent.type,
    canStartChat,
    hasMapDocument,
    isGeneratingMap,
    requestAgentMap,
    retryAfterSec,
    session.messages,
    setAgentMapDocument,
  ]);

  const handleResetDiagnosis = useCallback(() => {
    initialDiagnosisRequestedRef.current = false;
    setInput("");
    setDiagnosisErrorMessage(null);
    setMapErrorMessage(null);
    setRetryAfterSec(0);
    resetAgentSession(agent.type);
  }, [agent.type, resetAgentSession]);

  const handleRetryQuestion = useCallback(() => {
    if (isSubmittingDiagnosis || isGeneratingMap || !canStartChat || retryAfterSec > 0) {
      return;
    }

    void runDiagnosisTurn(session.messages);
  }, [canStartChat, isGeneratingMap, isSubmittingDiagnosis, retryAfterSec, runDiagnosisTurn, session.messages]);

  const handleQuickAction = useCallback(
    async (template: QuickActionTemplate) => {
      const selected = quickActions.find((action) => action.id === template);
      if (!selected) {
        return;
      }

      await sendText(selected.prompt);
    },
    [quickActions, sendText],
  );

  return {
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
    readyCount: session.progress.completed.length,
    missingLabels,
    quickActions,
    setInput,
    sendText,
    handleGenerateMap,
    handleResetDiagnosis,
    handleRetryQuestion,
    handleQuickAction,
  };
}

export default useAgentChat;
