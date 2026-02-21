import {
  ExecutionBoard,
  ExecutionTask,
  RecoveryLevel,
  SpecialistAgentType,
  SpecialistInsight,
  TeamRoomMessage,
  UserContext,
} from "@/lib/types";

export function resolveRecoveryLevel(
  hasSpecialistFallback: boolean,
  hasPmFallback: boolean,
): RecoveryLevel {
  if (hasPmFallback) {
    return "pm_fallback";
  }

  if (hasSpecialistFallback) {
    return "specialist_fallback";
  }

  return "none";
}

export function buildSpecialistFallback(agentType: SpecialistAgentType): SpecialistInsight {
  const label: Record<SpecialistAgentType, string> = {
    marketing: "마케팅",
    cs: "CS",
    data: "데이터",
    dev: "개발",
  };

  return {
    agentType,
    summary: `${label[agentType]} 관점에서 기본 실행안을 유지합니다.`,
    priorities: ["핵심 과제를 1주 단위로 분해", "담당자 명확화", "성과지표 주간 점검"],
    risks: ["우선순위 분산", "리소스 과부하"],
    assumptions: [
      "현재 대화 맥락이 최신이라고 가정",
      "다음 턴에서 세부 수치 보완 가능",
    ],
  };
}

export function buildFallbackConsensusNotes(
  context: UserContext,
  specialistInsights: SpecialistInsight[],
): string[] {
  const budgetNote =
    context.budgetMonthly !== null && context.budgetMonthly < 50
      ? "예산 제약이 커서 도구 도입보다 실행 절차 단순화를 우선합니다."
      : "예산 범위 내에서 자동화와 운영 안정화를 병행합니다.";

  const runwayNote =
    context.runwayMonths !== null && context.runwayMonths <= 3
      ? "런웨이가 짧아 1~2주 내 검증 가능한 과제를 우선합니다."
      : "중기 과제와 단기 과제를 함께 운영합니다.";

  const topPriority = specialistInsights
    .flatMap((insight) => insight.priorities)
    .filter((value) => value.trim().length > 0)
    .slice(0, 3);

  return [
    `우선 실행 축: ${topPriority.join(" / ") || "핵심 목표 재정의"}`,
    budgetNote,
    runwayNote,
  ];
}

export function buildFallbackBoard(
  context: UserContext,
  specialistInsights: SpecialistInsight[],
  currentBoard: ExecutionBoard | null,
): ExecutionBoard {
  const version = currentBoard ? currentBoard.version + 1 : 1;
  const baseDate = new Date();

  const tasks = specialistInsights.map((insight, index) => {
    const dueDate = new Date(baseDate.getTime() + (index + 2) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return {
      id: `task-${index + 1}`,
      title: insight.priorities[0] ?? `${insight.agentType} 핵심 실행 과제 정의`,
      ownerAgent: insight.agentType,
      priority: index < 2 ? "high" : "medium",
      effort: index < 2 ? "M" : "S",
      dueDate,
      status: "todo",
      metric: "주간 완료율 80% 이상",
      dependencies: [],
      rationale: insight.summary,
    } as ExecutionTask;
  });

  return {
    projectGoal: context.idea || "핵심 문제를 해결하는 MVP를 출시합니다.",
    tasks,
    kpis: [
      {
        name: "주간 핵심 과제 완료율",
        target: "80% 이상",
        cadence: "주간",
      },
      {
        name: "실행보드 갱신 리드타임",
        target: "24시간 이내",
        cadence: "주간",
      },
    ],
    risks: [
      {
        risk: "우선순위 변경이 잦아 실행이 분산됨",
        mitigation: "주간 1회 우선순위 재조정 원칙 유지",
      },
      {
        risk: "핵심 리소스 부족으로 일정 지연",
        mitigation: "S/M 단위로 과제를 쪼개 병렬 실행",
      },
    ],
    weeklyPlan: [
      "월: 이번 주 핵심 목표 1개 확정",
      "화: 상위 우선순위 과제 3개 착수",
      "수: 중간 점검 및 병목 제거",
      "목: 성과지표 업데이트",
      "금: 주간 회고 및 다음 주 계획 갱신",
    ],
    updatedAt: new Date().toISOString(),
    version,
  };
}

export function buildFallbackMarkdown(
  board: ExecutionBoard,
  specialistInsights: SpecialistInsight[],
  consensusNotes: string[],
): string {
  return [
    "# 팀룸 실행 요약",
    "",
    "## 오케스트레이터 결론",
    "일부 응답을 복구해 실행보드를 재생성했습니다. 다음 턴에서 세부 지표를 보강해 주세요.",
    "",
    "## 합의 근거",
    ...consensusNotes.map((note) => `- ${note}`),
    "",
    "## 에이전트 인사이트",
    ...specialistInsights.map(
      (insight) =>
        `- **${insight.agentType}**: ${insight.summary} (우선: ${insight.priorities.slice(0, 2).join(" / ")})`,
    ),
    "",
    "## 실행보드 요약",
    `- 목표: ${board.projectGoal}`,
    `- 과제 수: ${board.tasks.length}개`,
    `- 고우선 과제: ${board.tasks.filter((task) => task.priority === "high").length}개`,
    "",
    "## 이번 주 체크리스트",
    ...board.weeklyPlan.map((item) => `- [ ] ${item}`),
  ].join("\n");
}

export function fallbackUserMessage(messages: TeamRoomMessage[]): string {
  if (messages.length === 0) {
    return "팀룸 실행보드를 생성해 주세요.";
  }

  const lastMessage = [...messages].reverse().find((message) => message.role === "user");
  return lastMessage?.content ?? "최신 대화를 기반으로 실행보드를 갱신해 주세요.";
}

export function getRecoveryNotice(level: RecoveryLevel): string | null {
  if (level === "specialist_fallback") {
    return "일부 전문가 응답이 불안정해 복구 로직으로 실행보드를 보정했습니다.";
  }

  if (level === "pm_fallback") {
    return "PM 통합 응답이 불안정해 안전한 기본 보드로 복구했습니다.";
  }

  return null;
}
