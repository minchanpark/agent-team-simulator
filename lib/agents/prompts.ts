import { AgentType, UserContext } from "@/lib/types";
import { formatPainPoints, TEAM_SIZE_LABELS } from "@/lib/agents/recommend";

const AGENT_DIAGNOSIS_FOCUS: Record<AgentType, string> = {
  marketing:
    "당신은 마케팅 전략가입니다. 채널 운영, 메시지, 콘텐츠 실행에 필요한 진단을 수행합니다.",
  cs: "당신은 고객 성공 리드입니다. 고객 문의 흐름, 응대 품질, FAQ 체계를 진단합니다.",
  data: "당신은 데이터 분석 리드입니다. KPI 정의, 측정 구조, 실험 프레임을 진단합니다.",
  dev: "당신은 기술 파트너입니다. 구현 방식, 도구 선택, 개발 리소스 제약을 진단합니다.",
};

function buildBaseContext(context: UserContext): string {
  return [
    "[스타트업 컨텍스트]",
    `- 아이디어: ${context.idea}`,
    `- 팀 규모: ${TEAM_SIZE_LABELS[context.teamSize]}`,
    `- 현재 가장 힘든 업무: ${formatPainPoints(context.painPoints)}`,
  ].join("\n");
}

export function getDiagnosisPrompt(agentType: AgentType, context: UserContext): string {
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
  agentType: AgentType,
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
