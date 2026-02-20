"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { AgentMeta, ChatMessage, ChatResponse, UserContext } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react") as typeof import("react");

interface ChatPanelProps {
  agent: AgentMeta;
  context: UserContext;
}

const INITIAL_GUIDE_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "안녕하세요. 현재 상황을 기반으로 실행 가능한 액션 플랜을 바로 정리해드릴게요. 먼저 가장 급한 문제를 한 문장으로 알려주세요.",
};

export function ChatPanel({ agent, context }: ChatPanelProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([INITIAL_GUIDE_MESSAGE]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const bottomAnchorRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) {
      return;
    }

    const nextUserMessage: ChatMessage = { role: "user", content: trimmedInput };
    const nextMessages = [...messages, nextUserMessage];

    setMessages(nextMessages);
    setInput("");
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: agent.type,
          messages: nextMessages,
          context,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "대화 응답을 가져오지 못했습니다.");
      }

      const payload = (await response.json()) as ChatResponse;
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: payload.message,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const canStartChat = context.idea.trim().length > 0;

  return (
    <Card className="mx-auto flex h-[78vh] w-full max-w-4xl flex-col p-0">
      <header className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {agent.emoji}
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{agent.name}</h1>
            <p className="text-sm text-slate-600">{agent.summary}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-4">
        {!canStartChat && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            온보딩 정보가 없어 기본 모드로 동작합니다. 더 정확한 답변을 위해 진단을 먼저 진행해 주세요.
          </div>
        )}

        <ul className="space-y-3">
          {messages.map((message, index) => (
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

          {isLoading && (
            <li className="max-w-[85%] rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
              답변을 생성하고 있습니다...
            </li>
          )}
        </ul>

        {errorMessage && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
        <div ref={bottomAnchorRef} />
      </main>

      <footer className="space-y-3 border-t border-slate-200 p-4">
        <form onSubmit={submitMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="예: 다음 2주 안에 바로 실행할 마케팅 액션 5개를 알려줘"
            className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
          <Button type="submit" disabled={isLoading || input.trim().length === 0}>
            전송
          </Button>
        </form>

        <Link
          href={`/blueprint/${agent.type}`}
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          구현 청사진 보기
        </Link>
      </footer>
    </Card>
  );
}

export default ChatPanel;
