import { SpecialistInsight, UserContext } from "@/lib/types";

interface ScoredPriority {
  text: string;
  score: number;
}

function scorePriority(text: string, rank: number, context: UserContext): number {
  let score = 4 - Math.min(rank, 3);

  if (context.runwayMonths !== null && context.runwayMonths <= 3) {
    if (/\b(대규모|전면|전사|플랫폼 재구축|리뉴얼)\b/i.test(text)) {
      score -= 2;
    }
    if (/\b(검증|실험|측정|MVP|베타|온보딩)\b/i.test(text)) {
      score += 1;
    }
  }

  if (context.budgetMonthly !== null && context.budgetMonthly < 50) {
    if (/\b(광고 집행|외주|유료 툴|대행)\b/i.test(text)) {
      score -= 2;
    }
    if (/\b(템플릿|자동화|체크리스트|리포트)\b/i.test(text)) {
      score += 1;
    }
  }

  if (context.constraints.some((constraint) => /외주\s*불가/.test(constraint))) {
    if (/외주/.test(text)) {
      score -= 2;
    }
  }

  return score;
}

function rankPriorities(insights: SpecialistInsight[], context: UserContext): ScoredPriority[] {
  const scoreMap = new Map<string, number>();

  insights.forEach((insight) => {
    insight.priorities.forEach((priority, index) => {
      const trimmed = priority.trim();
      if (!trimmed) {
        return;
      }

      const score = scorePriority(trimmed, index, context);
      scoreMap.set(trimmed, (scoreMap.get(trimmed) ?? 0) + score);
    });
  });

  return [...scoreMap.entries()]
    .map(([text, score]) => ({ text, score }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

export function buildConsensus(
  context: UserContext,
  specialistInsights: SpecialistInsight[],
): { consensusNotes: string[]; rankedPriorities: string[] } {
  const ranked = rankPriorities(specialistInsights, context);
  const topPriorities = ranked.slice(0, 3).map((item) => item.text);

  const resourceNote =
    context.budgetMonthly !== null && context.budgetMonthly < 50
      ? "리소스 제약: 월 예산이 낮아 고비용 실행보다 경량 자동화/운영 개선을 우선합니다."
      : "리소스 제약: 예산 범위 내에서 실험 속도와 운영 안정성을 균형 있게 배치합니다.";

  const runwayNote =
    context.runwayMonths !== null && context.runwayMonths <= 3
      ? "마감 현실성: 런웨이가 짧아 1~2주 내 검증 가능한 과제를 우선합니다."
      : "마감 현실성: 단기 성과 과제와 구조 개선 과제를 병행합니다.";

  const priorityNote =
    topPriorities.length > 0
      ? `우선순위 합의: ${topPriorities.join(" / ")}`
      : "우선순위 합의: 실행 가능한 공통분모 과제를 우선합니다.";

  return {
    consensusNotes: [priorityNote, resourceNote, runwayNote],
    rankedPriorities: ranked.map((item) => item.text),
  };
}
