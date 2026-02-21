export type AgentType = "marketing" | "cs" | "data" | "dev" | "pm";
export type SpecialistAgentType = Exclude<AgentType, "pm">;

export type TeamSize = "solo" | "small" | "early";
export type CurrentStage = "idea" | "mvp" | "beta" | "launch";

export type PainPoint =
  | "content_marketing"
  | "customer_support"
  | "data_analysis"
  | "product_development";

export type MessageRole = "user" | "assistant";
export type ChatMode = "diagnosis" | "generate_map";
export type DiagnosticDimension = "goal" | "bottleneck" | "target" | "resource" | "metric";
export type AgentSessionStatus = "idle" | "diagnosing" | "ready" | "mapped";
export type TeamSessionStatus = "idle" | "running" | "error";
export type TeamMessageType = "normal" | "recovery";
export type RecoveryLevel = "none" | "specialist_fallback" | "pm_fallback";
export type TeamTraceStepStatus = "ok" | "fallback" | "failed";

export const DIAGNOSTIC_DIMENSIONS: DiagnosticDimension[] = [
  "goal",
  "bottleneck",
  "target",
  "resource",
  "metric",
];

export const TEAM_ROOM_DEFAULT_AGENTS: SpecialistAgentType[] = [
  "marketing",
  "cs",
  "data",
  "dev",
];

export interface UserContext {
  idea: string;
  painPoints: PainPoint[];
  teamSize: TeamSize;
  budgetMonthly: number | null;
  runwayMonths: number | null;
  teamRoles: string[];
  currentStage: CurrentStage;
  constraints: string[];
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface TeamRoomMessage {
  role: MessageRole;
  content: string;
  timestamp: string;
  speakerAgent?: AgentType;
  messageType?: TeamMessageType;
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
  agentType: SpecialistAgentType;
  diagnosisSummary: string;
  priorityJobs: string[];
  workflows: AgentMapWorkflow[];
  kpis: AgentMapKpi[];
  risks: AgentMapRisk[];
  firstWeekPlan: string[];
}

export interface AgentMapDocument {
  agentType: SpecialistAgentType;
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

export type TaskPriority = "high" | "medium" | "low";
export type TaskEffort = "S" | "M" | "L";
export type TaskStatus = "todo" | "doing" | "done";

export interface ExecutionTask {
  id: string;
  title: string;
  ownerAgent: SpecialistAgentType;
  priority: TaskPriority;
  effort: TaskEffort;
  dueDate: string;
  status: TaskStatus;
  metric: string;
  dependencies: string[];
  rationale: string;
}

export interface ExecutionKpi {
  name: string;
  target: string;
  cadence: string;
}

export interface ExecutionRisk {
  risk: string;
  mitigation: string;
}

export interface ExecutionBoard {
  projectGoal: string;
  tasks: ExecutionTask[];
  kpis: ExecutionKpi[];
  risks: ExecutionRisk[];
  weeklyPlan: string[];
  updatedAt: string;
  version: number;
}

export interface SpecialistInsight {
  agentType: SpecialistAgentType;
  summary: string;
  priorities: string[];
  risks: string[];
  assumptions: string[];
}

export interface TeamPolicy {
  modelCandidates: string[];
  specialistRetryLimit: number;
  pmRetryLimit: number;
  maxTasks: number;
}

export interface TeamSpec {
  id: string;
  name: string;
  activeAgents: SpecialistAgentType[];
  policy: TeamPolicy;
}

export interface SpecialistRunResult {
  agentType: SpecialistAgentType;
  status: "ok" | "fallback";
  model?: string;
  latencyMs: number;
  insight: SpecialistInsight;
  error?: string;
}

export interface BoardPatchResult {
  changedTaskIds: string[];
  changedTasks: string[];
  patchSummary: string;
}

export interface TeamTurnTraceStep {
  step: "validate" | "specialists" | "consensus" | "pm" | "commit";
  status: TeamTraceStepStatus;
  latencyMs: number;
  detail?: string;
  model?: string;
}

export interface TeamTurnTrace {
  traceId: string;
  teamSpecId: string;
  startedAt: string;
  finishedAt: string;
  totalLatencyMs: number;
  policy: TeamPolicy;
  steps: TeamTurnTraceStep[];
  specialistRuns: SpecialistRunResult[];
}

export interface TeamTurnResult {
  orchestratorReply: string;
  specialistInsights: SpecialistInsight[];
  consensusNotes: string[];
  changedTasks: string[];
  boardPatch: BoardPatchResult;
  board: ExecutionBoard;
  mdSummary: string;
}

export interface TeamSession {
  messages: TeamRoomMessage[];
  board: ExecutionBoard | null;
  status: TeamSessionStatus;
  lastResult: TeamTurnResult | null;
  trace: TeamTurnTrace | null;
  recoveryLevel: RecoveryLevel;
  consensusNotes: string[];
  error: string | null;
}

interface BaseChatRequest {
  agentType: SpecialistAgentType;
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

export interface TeamTurnRequest {
  context: UserContext;
  messages: TeamRoomMessage[];
  currentBoard: ExecutionBoard | null;
  activeAgents?: SpecialistAgentType[];
  teamSpecId?: string;
  debug?: boolean;
}

export interface TeamTurnSuccessResponse {
  result: TeamTurnResult;
  latencyMs: number;
  trace?: TeamTurnTrace;
  recoveryLevel?: RecoveryLevel;
}

export interface TeamTurnErrorResponse {
  errorCode: string;
  message: string;
  recoverable: boolean;
  fallbackBoard?: ExecutionBoard | null;
}

export interface TeamExportMarkdownRequest {
  board: ExecutionBoard;
  lastTurnResult: TeamTurnResult;
}

export interface TeamExportMarkdownResponse {
  markdown: string;
  fileName: string;
}

export interface AgentMeta {
  type: SpecialistAgentType;
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
