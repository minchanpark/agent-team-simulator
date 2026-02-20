import {
  AgentMeta,
  AgentType,
  PainPoint,
  PainPointOption,
  TeamSize,
  TeamSizeOption,
} from "@/lib/types";

export const TEAM_SIZE_LABELS: Record<TeamSize, string> = {
  solo: "1인 창업",
  small: "2~3인 소규모 팀",
  early: "초기 스타트업 팀",
};

export const TEAM_SIZE_OPTIONS: TeamSizeOption[] = [
  {
    value: "solo",
    label: "1인 창업",
    description: "혼자 빠르게 실험하고 검증하는 단계",
  },
  {
    value: "small",
    label: "2~3인 팀",
    description: "핵심 역할이 나뉘기 시작한 단계",
  },
  {
    value: "early",
    label: "초기 팀(4인+)",
    description: "프로세스와 역할 정리가 필요한 단계",
  },
];

export const PAIN_POINT_OPTIONS: PainPointOption[] = [
  {
    value: "content_marketing",
    label: "콘텐츠/마케팅",
    description: "SNS 운영, 카피라이팅, 콘텐츠 일정 관리",
  },
  {
    value: "customer_support",
    label: "고객 응대",
    description: "문의 답변, FAQ 정리, CS 품질 관리",
  },
  {
    value: "data_analysis",
    label: "데이터 분석",
    description: "KPI 설정, 성과 추적, 실험 해석",
  },
  {
    value: "product_development",
    label: "기술/제품 개발",
    description: "PRD 작성, 노코드 도구 선정, 구현 계획",
  },
];

export const PAIN_POINT_LABELS: Record<PainPoint, string> = {
  content_marketing: "콘텐츠/마케팅",
  customer_support: "고객 응대",
  data_analysis: "데이터 분석",
  product_development: "기술/제품 개발",
};

export const AGENT_META: Record<AgentType, AgentMeta> = {
  marketing: {
    type: "marketing",
    emoji: "🧲",
    name: "마케팅 에이전트",
    summary: "SNS 콘텐츠와 카피라이팅을 실무형으로 만들어주는 팀원",
    capabilities: [
      "SNS 게시물 초안 작성",
      "제품 소개 카피라이팅",
      "콘텐츠 캘린더 구성",
    ],
  },
  cs: {
    type: "cs",
    emoji: "💬",
    name: "CS 에이전트",
    summary: "고객 응대 문구와 FAQ 구조를 바로 적용 가능하게 설계",
    capabilities: [
      "문의 답변 템플릿 작성",
      "FAQ 문서 초안 구성",
      "컴플레인 대응 문구 작성",
    ],
  },
  data: {
    type: "data",
    emoji: "📊",
    name: "데이터 에이전트",
    summary: "초기 스타트업이 측정해야 할 핵심 지표를 정리",
    capabilities: [
      "핵심 KPI 3~5개 설계",
      "주간 리포트 템플릿 작성",
      "A/B 테스트 설계 안내",
    ],
  },
  dev: {
    type: "dev",
    emoji: "🛠",
    name: "개발보조 에이전트",
    summary: "노코드/로우코드 중심으로 구현 경로를 구체화",
    capabilities: [
      "아이디어를 PRD로 변환",
      "노코드 툴 비교 제안",
      "개발 명세 초안 작성",
    ],
  },
};

const PRIMARY_AGENT_BY_PAIN_POINT: Record<PainPoint, AgentType> = {
  content_marketing: "marketing",
  customer_support: "cs",
  data_analysis: "data",
  product_development: "dev",
};

const FALLBACK_ORDER: AgentType[] = ["marketing", "cs", "data", "dev"];

export function recommendAgents(painPoints: PainPoint[]): AgentMeta[] {
  const scores = new Map<AgentType, number>(
    FALLBACK_ORDER.map((type, index) => [type, FALLBACK_ORDER.length - index]),
  );

  painPoints.forEach((painPoint) => {
    const targetAgent = PRIMARY_AGENT_BY_PAIN_POINT[painPoint];
    const previous = scores.get(targetAgent) ?? 0;
    scores.set(targetAgent, previous + 100);
  });

  return [...FALLBACK_ORDER]
    .sort((left, right) => {
      const rightScore = scores.get(right) ?? 0;
      const leftScore = scores.get(left) ?? 0;
      return rightScore - leftScore;
    })
    .slice(0, 4)
    .map((agentType) => AGENT_META[agentType]);
}

export function isAgentType(value: string): value is AgentType {
  return value in AGENT_META;
}

export function formatPainPoints(painPoints: PainPoint[]): string {
  if (painPoints.length === 0) {
    return "미선택";
  }

  return painPoints.map((painPoint) => PAIN_POINT_LABELS[painPoint]).join(", ");
}
