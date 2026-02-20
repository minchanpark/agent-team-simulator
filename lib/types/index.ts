export type AgentType = "marketing" | "cs" | "data" | "dev";

export type TeamSize = "solo" | "small" | "early";

export type PainPoint =
  | "content_marketing"
  | "customer_support"
  | "data_analysis"
  | "product_development";

export type MessageRole = "user" | "assistant";
export type ChatMode = "diagnosis" | "generate_map";
export type DiagnosticDimension = "goal" | "bottleneck" | "target" | "resource" | "metric";
export type AgentSessionStatus = "idle" | "diagnosing" | "ready" | "mapped";

export const DIAGNOSTIC_DIMENSIONS: DiagnosticDimension[] = [
  "goal",
  "bottleneck",
  "target",
  "resource",
  "metric",
];

export interface UserContext {
  idea: string;
  painPoints: PainPoint[];
  teamSize: TeamSize;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface DiagnosticProgress {
  completed: DiagnosticDimension[];
  missing: DiagnosticDimension[];
  readyForMap: boolean;
}

export interface AgentMapWorkflow {
  name: string;
  tools: string[];
  steps: string[];
  expectedImpact: string;
}

export interface AgentMapKpi {
  name: string;
  target: string;
  cadence: string;
}

export interface AgentMapRisk {
  risk: string;
  mitigation: string;
}

export interface AgentMap {
  agentType: AgentType;
  diagnosisSummary: string;
  priorityJobs: string[];
  workflows: AgentMapWorkflow[];
  kpis: AgentMapKpi[];
  risks: AgentMapRisk[];
  firstWeekPlan: string[];
}

export interface AgentMapDocument {
  agentType: AgentType;
  format: "md";
  fileName: string;
  content: string;
  createdAt: string;
}

export interface AgentSession {
  messages: ChatMessage[];
  progress: DiagnosticProgress;
  mapDocument: AgentMapDocument | null;
  status: AgentSessionStatus;
}

interface BaseChatRequest {
  agentType: AgentType;
  messages: ChatMessage[];
  context: UserContext;
}

export interface DiagnosisChatRequest extends BaseChatRequest {
  mode: "diagnosis";
}

export interface GenerateMapChatRequest extends BaseChatRequest {
  mode: "generate_map";
}

export type ChatRequest = DiagnosisChatRequest | GenerateMapChatRequest;

export interface DiagnosisChatResponse {
  mode: "diagnosis";
  message: string;
  progress: DiagnosticProgress;
}

export interface GenerateMapChatResponse {
  mode: "generate_map";
  document: AgentMapDocument;
}

export type ChatResponse = DiagnosisChatResponse | GenerateMapChatResponse;

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
