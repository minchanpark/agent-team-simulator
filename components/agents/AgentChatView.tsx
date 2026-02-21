"use client";

import Link from "next/link";
import ChatPanel from "@/components/agents/ChatPanel";
import { AGENT_META } from "@/lib/agents/recommend";
import { useOnboardingStore } from "@/lib/store/onboarding";
import { SpecialistAgentType } from "@/lib/types";

interface AgentChatViewProps {
  agentType: SpecialistAgentType;
}

export function AgentChatView({ agentType }: AgentChatViewProps) {
  const context = useOnboardingStore((state) => state.context);
  const agent = AGENT_META[agentType];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/result"
          className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          추천 결과로 돌아가기
        </Link>
      </div>

      <ChatPanel agent={agent} context={context} />
    </div>
  );
}

export default AgentChatView;
