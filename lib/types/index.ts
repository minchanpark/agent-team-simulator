export type AgentType = "marketing" | "cs" | "data" | "dev";

export type TeamSize = "solo" | "small" | "early";

export type PainPoint =
  | "content_marketing"
  | "customer_support"
  | "data_analysis"
  | "product_development";

export type MessageRole = "user" | "assistant";

export interface UserContext {
  idea: string;
  painPoints: PainPoint[];
  teamSize: TeamSize;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  agentType: AgentType;
  messages: ChatMessage[];
  context: UserContext;
}

export interface ChatResponse {
  message: string;
}

export interface AgentMeta {
  type: AgentType;
  emoji: string;
  name: string;
  summary: string;
  capabilities: [string, string, string];
}

export interface TeamSizeOption {
  value: TeamSize;
  label: string;
  description: string;
}

export interface PainPointOption {
  value: PainPoint;
  label: string;
  description: string;
}

export interface AgentBlueprint {
  tools: string[];
  steps: string[];
  cost: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}
