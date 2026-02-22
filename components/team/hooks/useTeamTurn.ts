"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TeamExportMarkdownResponse,
  TeamMessageType,
  TeamTurnSuccessResponse,
  ApiErrorResponse,
} from "@/lib/types";
import { useOnboardingStore } from "@/lib/store/onboarding";
import { getRecoveryNotice } from "@/lib/team/recovery";

interface TeamMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  speakerAgent?: "pm";
  messageType?: TeamMessageType;
}

type TrackedEventName =
  | "team_room_opened"
  | "team_turn_submitted"
  | "team_turn_succeeded"
  | "team_turn_failed"
  | "execution_board_generated";

interface ApiFailure {
  message: string;
  code: ApiErrorResponse["errorCode"] | "UNKNOWN";
  retryAfterSec?: number;
  recoverable: boolean;
}

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
): TeamMessage {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
    speakerAgent,
    messageType,
  };
}

async function parseApiFailure(response: Response, fallbackMessage: string): Promise<ApiFailure> {
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
    retryAfterSec: payload.retryAfterSec,
    recoverable: payload.recoverable,
  };
}

function triggerMarkdownDownload(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const fileUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = fileUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(fileUrl);
}

export function useTeamTurn() {
  const context = useOnboardingStore((state) => state.context);
  const teamSession = useOnboardingStore((state) => state.teamSession);
  const appendTeamMessage = useOnboardingStore((state) => state.appendTeamMessage);
  const setTeamRunning = useOnboardingStore((state) => state.setTeamRunning);
  const setTeamResult = useOnboardingStore((state) => state.setTeamResult);
  const setTeamError = useOnboardingStore((state) => state.setTeamError);
  const clearTeamError = useOnboardingStore((state) => state.clearTeamError);
  const resetTeamSession = useOnboardingStore((state) => state.resetTeamSession);

  const [input, setInput] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [retryAfterSec, setRetryAfterSec] = useState(0);
  const isDev = process.env.NODE_ENV !== "production";
  const [debugMode, setDebugMode] = useState(false);

  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [teamSession.messages, teamSession.status]);

  useEffect(() => {
    emitTeamEvent("team_room_opened");
  }, []);

  useEffect(() => {
    if (retryAfterSec <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRetryAfterSec((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfterSec]);

  const canStartChat = context.idea.trim().length > 0;
  const isRunning = teamSession.status === "running";

  const sendTurn = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isRunning || !canStartChat || retryAfterSec > 0) {
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
          const failure = await parseApiFailure(response, "팀룸 응답 생성에 실패했습니다.");

          if (failure.code === "RATE_LIMITED" && failure.retryAfterSec) {
            setRetryAfterSec(failure.retryAfterSec);
          }

          throw new Error(
            failure.recoverable ? failure.message : `요청이 거부되었습니다. ${failure.message}`,
          );
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

        if (payload.recoveryLevel && payload.recoveryLevel !== "none") {
          const notice = getRecoveryNotice(payload.recoveryLevel);
          if (notice) {
            appendTeamMessage(createMessage("assistant", notice, "pm", "recovery"));
          }
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
      debugMode,
      isDev,
      isRunning,
      retryAfterSec,
      setTeamError,
      setTeamResult,
      setTeamRunning,
      teamSession.board,
      teamSession.messages,
    ],
  );

  const submitTurn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendTurn(input);
  };

  const quickActions = useMemo(
    () => [
      {
        id: "reprioritize",
        label: "우선순위 재정렬",
        prompt: "현재 실행보드에서 가장 임팩트가 큰 작업 3개를 다시 우선순위로 정렬해줘.",
      },
      {
        id: "risk",
        label: "리스크만 업데이트",
        prompt: "현재 계획의 핵심 리스크와 완화 전략만 업데이트해줘.",
      },
      {
        id: "weekly",
        label: "이번 주 계획만 갱신",
        prompt: "이번 주 실행 체크리스트만 다시 작성해줘. 기존 보드 구조는 유지해줘.",
      },
    ],
    [],
  );

  const sendQuickAction = (prompt: string) => {
    void sendTurn(prompt);
  };

  const handleRetry = () => {
    clearTeamError();
    void sendTurn("현재 실행보드를 기준으로 다음 우선순위를 업데이트해줘.");
  };

  const handleDownloadMarkdown = async () => {
    if (!teamSession.board || !teamSession.lastResult || isDownloading || retryAfterSec > 0) {
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
        const failure = await parseApiFailure(response, "마크다운 생성에 실패했습니다.");
        if (failure.code === "RATE_LIMITED" && failure.retryAfterSec) {
          setRetryAfterSec(failure.retryAfterSec);
        }

        throw new Error(
          failure.recoverable ? failure.message : `요청이 거부되었습니다. ${failure.message}`,
        );
      }

      const payload = (await response.json()) as TeamExportMarkdownResponse;
      triggerMarkdownDownload(payload.markdown, payload.fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setTeamError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return {
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
  };
}

export default useTeamTurn;
