import { notFound } from "next/navigation";
import AgentChatView from "@/components/agents/AgentChatView";
import { isAgentType } from "@/lib/agents/recommend";

interface AgentChatPageProps {
  params: {
    agent: string;
  };
}

export default function AgentChatPage({ params }: AgentChatPageProps) {
  if (!isAgentType(params.agent)) {
    notFound();
  }

  return <AgentChatView agentType={params.agent} />;
}
