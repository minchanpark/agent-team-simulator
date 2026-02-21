import { formatPainPoints, STAGE_LABELS, TEAM_SIZE_LABELS } from "@/lib/agents/recommend";
import {
  ExecutionBoard,
  SpecialistAgentType,
  SpecialistInsight,
  TeamRoomMessage,
  UserContext,
} from "@/lib/types";

const AGENT_DIAGNOSIS_FOCUS: Record<SpecialistAgentType, string> = {
  marketing:
    "당신은 마케팅 전략가입니다. 채널 운영, 메시지, 콘텐츠 실행에 필요한 진단을 수행합니다.",
  cs: "당신은 고객 성공 리드입니다. 고객 문의 흐름, 응대 품질, FAQ 체계를 진단합니다.",
  data: "당신은 데이터 분석 리드입니다. KPI 정의, 측정 구조, 실험 프레임을 진단합니다.",
  dev: "당신은 기술 파트너입니다. 구현 방식, 도구 선택, 개발 리소스 제약을 진단합니다.",
};

const SPECIALIST_LABELS: Record<SpecialistAgentType, string> = {
  marketing: "마케팅",
  cs: "CS",
  data: "데이터",
  dev: "개발",
};

function buildBaseContext(context: UserContext): string {
  return [
    "[스타트업 컨텍스트]",
    `- 아이디어: ${context.idea}`,
    `- 팀 규모: ${TEAM_SIZE_LABELS[context.teamSize]}`,
    `- 현재 가장 힘든 업무: ${formatPainPoints(context.painPoints)}`,
    `- 현재 단계: ${STAGE_LABELS[context.currentStage]}`,
    `- 월 예산: ${context.budgetMonthly !== null ? `${context.budgetMonthly}만원` : "미입력"}`,
    `- 런웨이: ${context.runwayMonths !== null ? `${context.runwayMonths}개월` : "미입력"}`,
    `- 팀 역할: ${context.teamRoles.length > 0 ? context.teamRoles.join(", ") : "미입력"}`,
    `- 제약 조건: ${context.constraints.length > 0 ? context.constraints.join(", ") : "미입력"}`,
  ].join("\n");
}

function buildTeamTranscript(messages: TeamRoomMessage[]): string {
  if (messages.length === 0) {
    return "(대화 기록 없음)";
  }

  return messages
    .map((message) => {
      if (message.speakerAgent) {
        return `${message.speakerAgent}: ${message.content}`;
      }

      return `${message.role === "user" ? "user" : "assistant"}: ${message.content}`;
    })
    .join("\n");
}

export function getDiagnosisPrompt(agentType: SpecialistAgentType, context: UserContext): string {
  return `
${AGENT_DIAGNOSIS_FOCUS[agentType]}

${buildBaseContext(context)}

[진단 목표]
- 아래 필수 진단 차원 5개를 모두 파악하면 readyForMap=true 로 판단합니다.
- 필수 진단 차원:
  1) goal: 이번 분기/월의 구체적 목표
  2) bottleneck: 현재 가장 큰 병목
  3) target: 핵심 대상 고객/사용자
  4) resource: 인력/예산/시간 제약
  5) metric: 성공 판단 지표

[출력 규칙]
- 반드시 JSON만 출력합니다. 코드블록, 설명 문장, 마크다운을 절대 출력하지 마세요.
- completed, missing 배열에는 위 5개 차원 이름(goal, bottleneck, target, resource, metric)만 사용합니다.
- readyForMap=false 이면 message를 아래 3줄 형식으로 작성합니다.
  1) "질문: ..." (핵심 질문 1문장)
  2) "이유: ..." (왜 이 질문이 필요한지 1문장)
  3) "예시 답변: ..." (2~3개 예시를 "/"로 구분)
- 질문은 너무 짧지 않게 구체적으로 작성하세요. (최소 35자 이상 권장)
- readyForMap=true 이면 message는 "에이전트 맵 생성 버튼을 눌러 결과를 확인하세요."처럼 생성 안내 한 문장이어야 합니다.
- 한국어로 작성합니다.

[JSON 스키마]
{
  "message": "string",
  "progress": {
    "completed": ["goal", "bottleneck", "target", "resource", "metric"],
    "missing": ["goal", "bottleneck", "target", "resource", "metric"],
    "readyForMap": false
  }
}
`.trim();
}

export function getMapPrompt(
  agentType: SpecialistAgentType,
  context: UserContext,
  transcript: string,
): string {
  return `
${AGENT_DIAGNOSIS_FOCUS[agentType]}

${buildBaseContext(context)}

[대화 기록]
${transcript || "(대화 기록 없음)"}

[요청]
- 위 컨텍스트와 대화 기록을 바탕으로 ${agentType} 에이전트용 실행 가능한 에이전트 맵 문서를 작성하세요.
- 반드시 마크다운(MD) 문서 본문만 출력하세요.
- 모호한 표현을 피하고, 바로 실행할 수 있는 수준으로 작성하세요.
- 모든 텍스트는 한국어로 작성하세요.

[문서 형식]
- 아래 제목 순서를 반드시 지키세요.
1) # ${agentType} 에이전트 맵
2) ## 진단 요약
3) ## 우선 과제 3개
4) ## 워크플로
5) ## KPI
6) ## 리스크 및 완화 전략
7) ## 첫 주 실행계획

[섹션별 제약]
- 우선 과제: 번호 목록 3개
- 워크플로: 2~3개, 각 항목에 도구/단계/예상효과 포함
- KPI: 3~5개, 각 항목에 지표명/목표값/측정주기 포함
- 리스크: 2~4개, 각 항목에 리스크/완화전략 포함
- 첫 주 실행계획: 체크리스트 5~7개
`.trim();
}

export function getSpecialistTeamPrompt(
  agentType: SpecialistAgentType,
  context: UserContext,
  messages: TeamRoomMessage[],
): string {
  return `
당신은 ${SPECIALIST_LABELS[agentType]} 전문 에이전트입니다.

${buildBaseContext(context)}

[팀룸 대화 기록]
${buildTeamTranscript(messages)}

[요청]
- PM 오케스트레이터가 의사결정할 수 있도록, 당신의 전문 관점 핵심 인사이트를 JSON으로 작성하세요.
- 추상 조언 금지. 즉시 실행 가능한 우선 액션과 리스크를 제시하세요.
- 한국어로 작성하세요.

[출력 규칙]
- 반드시 JSON 객체 1개만 출력합니다.
- 코드블록/마크다운/설명문 금지.
- priorities/risks/assumptions 각 항목은 짧고 명확하게 작성합니다. (권장 12~60자)
- 문자열 안에 큰따옴표(\") 사용 금지.

[JSON 스키마]
{
  "summary": "string",
  "priorities": ["string", "string", "string"],
  "risks": ["string", "string"],
  "assumptions": ["string", "string"]
}
`.trim();
}

export function getConsensusGuardPrompt(): string {
  return `
[합의 가드레일]
- 우선순위는 영향도(고객/매출), 리소스 제약(예산/인력), 마감 현실성(런웨이/단계) 3축을 함께 고려합니다.
- 추상적 제안보다 1주 내 실행 가능한 항목을 우선합니다.
- 충돌이 있으면 범위를 줄여서 실행 가능한 공통분모를 선택합니다.
`.trim();
}

export function getPmOrchestratorPrompt(
  context: UserContext,
  specialistInsights: SpecialistInsight[],
  currentBoard: ExecutionBoard | null,
  messages: TeamRoomMessage[],
  consensusNotes: string[],
): string {
  const insightText = specialistInsights
    .map(
      (insight) => `- ${insight.agentType}
  summary: ${insight.summary}
  priorities: ${insight.priorities.join(" | ")}
  risks: ${insight.risks.join(" | ")}
  assumptions: ${insight.assumptions.join(" | ")}`,
    )
    .join("\n");

  const boardText = currentBoard ? JSON.stringify(currentBoard, null, 2) : "(기존 보드 없음)";
  const consensusText = consensusNotes.length > 0 ? consensusNotes.map((note) => `- ${note}`).join("\n") : "- 없음";

  return `
당신은 PM 오케스트레이터입니다. 여러 전문 에이전트 의견을 통합해 실행보드를 업데이트합니다.

${buildBaseContext(context)}

[팀룸 대화 기록]
${buildTeamTranscript(messages)}

[전문 에이전트 인사이트]
${insightText}

[사전 합의 노트]
${consensusText}

[현재 실행보드]
${boardText}

${getConsensusGuardPrompt()}

[요청]
- 전문 에이전트 의견 충돌을 조정해 우선순위를 합의합니다.
- 기존 보드가 있으면 "전체 재작성"이 아니라 변경 근거를 명확히 하여 필요한 부분만 업데이트합니다.
- 답변은 반드시 JSON 객체 1개로만 출력합니다.
- 모든 텍스트는 한국어로 작성합니다.
- JSON 문자열은 모두 한 줄 문자열로 작성하고 줄바꿈 문자를 포함하지 않습니다.

[제약]
- tasks는 4~6개
- 각 task는 ownerAgent를 marketing/cs/data/dev 중 하나로 지정
- dueDate는 ISO 날짜(YYYY-MM-DD)
- status는 todo/doing/done 중 하나
- weeklyPlan은 5~7개 체크리스트
- consensusNotes는 최소 3개
- changedTasks는 이번 턴에 신규/수정된 task title 목록
- task title은 12~70자 권장, 문장 끝 마침표 생략
- metric/rationale은 짧게 작성 (각 40자 이내)
- 모든 문자열에서 큰따옴표(\") 사용 금지
- mdSummary는 생략 가능
- 응답은 1100 토큰 내로 간결하게 작성

[JSON 스키마]
{
  "orchestratorReply": "string",
  "consensusNotes": ["string"],
  "changedTasks": ["string"],
  "board": {
    "projectGoal": "string",
    "tasks": [
      {
        "id": "string",
        "title": "string",
        "ownerAgent": "marketing|cs|data|dev",
        "priority": "high|medium|low",
        "effort": "S|M|L",
        "dueDate": "YYYY-MM-DD",
        "status": "todo|doing|done",
        "metric": "string",
        "dependencies": ["string"],
        "rationale": "string"
      }
    ],
    "kpis": [
      {
        "name": "string",
        "target": "string",
        "cadence": "string"
      }
    ],
    "risks": [
      {
        "risk": "string",
        "mitigation": "string"
      }
    ],
    "weeklyPlan": ["string"],
    "updatedAt": "ISO datetime",
    "version": 1
  }
}
`.trim();
}

export function getPmOrchestratorRepairPrompt(
  context: UserContext,
  specialistInsights: SpecialistInsight[],
  currentBoard: ExecutionBoard | null,
  messages: TeamRoomMessage[],
  consensusNotes: string[],
): string {
  return `
당신은 JSON 복구 전용 PM입니다. 아래 정보를 바탕으로 반드시 유효한 JSON 객체 1개만 출력합니다.

${buildBaseContext(context)}

[팀룸 대화 기록]
${buildTeamTranscript(messages)}

[전문 에이전트 인사이트]
${specialistInsights
  .map(
    (insight) =>
      `- ${insight.agentType}: ${insight.summary} | priorities=${insight.priorities.join(" / ")} | risks=${insight.risks.join(" / ")}`,
  )
  .join("\n")}

[합의 노트]
${consensusNotes.map((note) => `- ${note}`).join("\n")}

[현재 실행보드]
${currentBoard ? JSON.stringify(currentBoard, null, 2) : "(기존 보드 없음)"}

[출력 규칙]
- JSON 외 텍스트 금지.
- 코드블록 금지.
- 모든 문자열은 한 줄로 작성.
- mdSummary는 출력하지 않아도 됨.

[JSON 스키마]
{
  "orchestratorReply": "string",
  "consensusNotes": ["string"],
  "changedTasks": ["string"],
  "board": {
    "projectGoal": "string",
    "tasks": [
      {
        "id": "string",
        "title": "string",
        "ownerAgent": "marketing|cs|data|dev",
        "priority": "high|medium|low",
        "effort": "S|M|L",
        "dueDate": "YYYY-MM-DD",
        "status": "todo|doing|done",
        "metric": "string",
        "dependencies": ["string"],
        "rationale": "string"
      }
    ],
    "kpis": [{ "name": "string", "target": "string", "cadence": "string" }],
    "risks": [{ "risk": "string", "mitigation": "string" }],
    "weeklyPlan": ["string"],
    "updatedAt": "ISO datetime",
    "version": 1
  }
}
`.trim();
}
