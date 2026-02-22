"use client";

import Button from "@/components/ui/Button";
import { ChatMessage } from "@/lib/types";

interface AgentMessageListProps {
  messages: ChatMessage[];
  isSubmittingDiagnosis: boolean;
  isGeneratingMap: boolean;
  diagnosisErrorMessage: string | null;
  mapErrorMessage: string | null;
  onRetryQuestion: () => void;
  onRetryMap: () => void;
}

export function AgentMessageList({
  messages,
  isSubmittingDiagnosis,
  isGeneratingMap,
  diagnosisErrorMessage,
  mapErrorMessage,
  onRetryQuestion,
  onRetryMap,
}: AgentMessageListProps) {
  return (
    <>
      <ul className="space-y-3">
        {messages.map((message, index) => (
          <li
            key={`${message.role}-${index}`}
            className={[
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
              message.role === "user" ? "ml-auto bg-teal-600 text-white" : "bg-slate-100 text-slate-800",
            ].join(" ")}
          >
            {message.content}
          </li>
        ))}

        {isSubmittingDiagnosis && (
          <li
            aria-live="polite"
            className="max-w-[85%] rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500"
          >
            진단 질문을 생성하고 있습니다...
          </li>
        )}

        {isGeneratingMap && (
          <li
            aria-live="polite"
            className="max-w-[85%] rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500"
          >
            에이전트 맵을 생성하고 있습니다...
          </li>
        )}
      </ul>

      {diagnosisErrorMessage && (
        <div
          aria-live="assertive"
          className="mt-4 space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <p>{diagnosisErrorMessage}</p>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={onRetryQuestion}>
            질문 다시 받기
          </Button>
        </div>
      )}

      {mapErrorMessage && (
        <div
          aria-live="assertive"
          className="mt-4 space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <p>{mapErrorMessage}</p>
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={onRetryMap}>
            맵 다시 생성
          </Button>
        </div>
      )}
    </>
  );
}

export default AgentMessageList;
