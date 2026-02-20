import Link from "next/link";
import Card from "@/components/ui/Card";
import { AgentMeta } from "@/lib/types";

interface AgentCardProps {
  agent: AgentMeta;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card className="h-full">
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {agent.emoji}
            </span>
            <div>
              <p className="text-sm font-semibold text-teal-700">추천 에이전트</p>
              <h3 className="text-lg font-bold text-slate-900">{agent.name}</h3>
            </div>
          </div>

          <p className="text-sm text-slate-600">{agent.summary}</p>

          <ul className="space-y-2">
            {agent.capabilities.map((capability) => (
              <li key={capability} className="text-sm text-slate-700">
                • {capability}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href={`/result/${agent.type}`}
          className="inline-flex w-full items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          대화하기
        </Link>
      </div>
    </Card>
  );
}

export default AgentCard;
