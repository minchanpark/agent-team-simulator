import { AGENT_META } from "@/lib/agents/recommend";
import { AgentBlueprint, AgentType } from "@/lib/types";

export const BLUEPRINTS: Record<AgentType, AgentBlueprint> = {
  marketing: {
    tools: ["Claude API", "n8n", "Buffer", "Canva"],
    steps: [
      "콘텐츠 주제와 톤 가이드를 정의합니다.",
      "Claude API로 초안을 생성하고 n8n으로 자동화합니다.",
      "Buffer로 채널별 스케줄 발행을 구성합니다.",
      "주간 성과를 집계해 다음 주 캘린더를 업데이트합니다.",
    ],
    cost: "월 $20~50",
    difficulty: 2,
  },
  cs: {
    tools: ["Claude API", "Notion", "Slack", "Zapier"],
    steps: [
      "반복 문의를 유형별로 분류합니다.",
      "FAQ 지식베이스를 Notion에 정리합니다.",
      "문의 수신 시 Claude API로 답변 초안을 생성합니다.",
      "Slack 알림과 에스컬레이션 루틴을 추가합니다.",
    ],
    cost: "월 $15~30",
    difficulty: 1,
  },
  data: {
    tools: ["Google Sheets", "Looker Studio", "n8n"],
    steps: [
      "핵심 KPI(획득/활성/유지)를 정의합니다.",
      "Google Sheets에 지표 입력 템플릿을 만듭니다.",
      "n8n으로 데이터 수집/정규화를 자동화합니다.",
      "Looker Studio 대시보드로 주간 리포트를 구성합니다.",
    ],
    cost: "월 $0~20",
    difficulty: 2,
  },
  dev: {
    tools: ["Lovable", "Bubble", "Supabase", "Vercel"],
    steps: [
      "핵심 사용자 플로우를 와이어프레임으로 정리합니다.",
      "Lovable/Bubble로 클릭 가능한 MVP를 제작합니다.",
      "Supabase로 인증/데이터 모델을 연결합니다.",
      "Vercel에 배포하고 피드백 루프를 운영합니다.",
    ],
    cost: "월 $25~70",
    difficulty: 3,
  },
};

export function getBlueprint(agentType: AgentType): AgentBlueprint {
  return BLUEPRINTS[agentType];
}

export function getAgentName(agentType: AgentType): string {
  return AGENT_META[agentType].name;
}
