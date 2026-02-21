"use client";

import { TEAM_AGENT_META } from "@/lib/agents/recommend";
import { TeamRoomMessage } from "@/lib/types";

interface TeamChatTimelineProps {
  messages: TeamRoomMessage[];
  isRunning: boolean;
}

function formatSpeaker(message: TeamRoomMessage): string {
  if (message.speakerAgent) {
    const meta = TEAM_AGENT_META[message.speakerAgent];
    return `${meta.emoji} ${meta.name}`;
  }

  return message.role === "user" ? "사용자" : "에이전트";
}

export function TeamChatTimeline({ messages, isRunning }: TeamChatTimelineProps) {
  if (messages.length === 0 && !isRunning) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        팀룸 대화를 시작하면 PM 오케스트레이터가 각 전문 에이전트 의견을 통합해 실행보드를 자동으로 갱신합니다.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const isPmMessage = message.speakerAgent === "pm";
        const isRecoveryMessage = message.messageType === "recovery";

        return (
          <li
            key={`${message.timestamp}-${index}`}
            className={[
              "max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-6",
              isUser
                ? "ml-auto border-teal-600 bg-teal-600 text-white"
                : isRecoveryMessage
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-800",
            ].join(" ")}
          >
            <div className="mb-1 flex items-center gap-2">
              <p
                className={[
                  "text-xs font-semibold",
                  isUser
                    ? "text-teal-100"
                    : isRecoveryMessage
                      ? "text-amber-700"
                      : "text-slate-500",
                ].join(" ")}
              >
                {formatSpeaker(message)}
              </p>
              {isPmMessage && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  PM
                </span>
              )}
              {isRecoveryMessage && (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  복구
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </li>
        );
      })}

      {isRunning && (
        <li className="max-w-[90%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          팀 에이전트들이 의견을 정리하고 실행보드를 갱신 중입니다...
        </li>
      )}
    </ul>
  );
}

export default TeamChatTimeline;
