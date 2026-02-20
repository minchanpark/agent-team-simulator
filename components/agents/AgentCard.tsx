import Link from "next/link";
import Card from "@/components/ui/Card";
import { AgentMeta, AgentSessionStatus } from "@/lib/types";

interface AgentCardProps {
  agent: AgentMeta;
  status: AgentSessionStatus;
}

const STATUS_BADGE_LABEL: Record<AgentSessionStatus, string> = {
  idle: "미진단",
  diagnosing: "진단중",
  ready: "진단중",
  mapped: "맵완료",
};

const STATUS_BADGE_CLASSNAME: Record<AgentSessionStatus, string> = {
  idle: "border-slate-200 bg-slate-50 text-slate-600",
  diagnosing: "border-amber-200 bg-amber-50 text-amber-700",
  ready: "border-amber-200 bg-amber-50 text-amber-700",
  mapped: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const CTA_LABEL: Record<AgentSessionStatus, string> = {
  idle: "진단 시작하기",
  diagnosing: "이어서 진단",
  ready: "이어서 진단",
  mapped: "맵 보기",
};

export function AgentCard({ agent, status }: AgentCardProps) {
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

          <p
            className={[
              "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
              STATUS_BADGE_CLASSNAME[status],
            ].join(" ")}
          >
            {STATUS_BADGE_LABEL[status]}
          </p>

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
          {CTA_LABEL[status]}
        </Link>
      </div>
    </Card>
  );
}

export default AgentCard;
