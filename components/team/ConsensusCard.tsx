"use client";

import Card from "@/components/ui/Card";
import { TEAM_AGENT_META } from "@/lib/agents/recommend";
import { TeamTurnResult } from "@/lib/types";

interface ConsensusCardProps {
  result: TeamTurnResult | null;
}

export function ConsensusCard({ result }: ConsensusCardProps) {
  if (!result) {
    return null;
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">합의 결과</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">PM 오케스트레이터 결론</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{result.orchestratorReply}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">합의 근거</p>
        <ul className="space-y-2">
          {result.consensusNotes.map((note, index) => (
            <li key={`${note}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {note}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">전문 에이전트 인사이트</p>
        <ul className="space-y-2">
          {result.specialistInsights.map((insight) => {
            const meta = TEAM_AGENT_META[insight.agentType];

            return (
              <li key={insight.agentType} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {meta.emoji} {meta.name}
                </p>
                <p className="mt-1 text-sm text-slate-700">{insight.summary}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

export default ConsensusCard;
