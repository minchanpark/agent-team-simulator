"use client";

import Card from "@/components/ui/Card";
import {
  formatConstraints,
  formatPainPoints,
  formatTeamRoles,
  STAGE_LABELS,
  TEAM_SIZE_LABELS,
} from "@/lib/agents/recommend";
import { UserContext } from "@/lib/types";

interface TeamContextSummaryProps {
  context: UserContext;
}

export function TeamContextSummary({ context }: TeamContextSummaryProps) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">현재 컨텍스트</h2>
      <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <p>
          <span className="font-semibold">아이디어:</span> {context.idea || "미입력"}
        </p>
        <p>
          <span className="font-semibold">고민:</span> {formatPainPoints(context.painPoints)}
        </p>
        <p>
          <span className="font-semibold">팀 규모:</span> {TEAM_SIZE_LABELS[context.teamSize]}
        </p>
        <p>
          <span className="font-semibold">현재 단계:</span> {STAGE_LABELS[context.currentStage]}
        </p>
        <p>
          <span className="font-semibold">월 예산:</span>{" "}
          {context.budgetMonthly !== null ? `${context.budgetMonthly}만원` : "미입력"}
        </p>
        <p>
          <span className="font-semibold">런웨이:</span>{" "}
          {context.runwayMonths !== null ? `${context.runwayMonths}개월` : "미입력"}
        </p>
        <p className="sm:col-span-2">
          <span className="font-semibold">팀 역할:</span> {formatTeamRoles(context.teamRoles)}
        </p>
        <p className="sm:col-span-2">
          <span className="font-semibold">제약 조건:</span> {formatConstraints(context.constraints)}
        </p>
      </div>
    </Card>
  );
}

export default TeamContextSummary;
