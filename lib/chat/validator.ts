import {
  ChatMessage,
  ChatMode,
  ChatRequest,
  SpecialistAgentType,
  UserContext,
} from "@/lib/types";

const AGENT_TYPES: SpecialistAgentType[] = ["marketing", "cs", "data", "dev"];
const CHAT_MODES: ChatMode[] = ["diagnosis", "generate_map"];

function isAgentType(value: string): value is SpecialistAgentType {
  return AGENT_TYPES.includes(value as SpecialistAgentType);
}

function isChatMode(value: string): value is ChatMode {
  return CHAT_MODES.includes(value as ChatMode);
}

function isUserContext(value: unknown): value is UserContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UserContext;

  const hasValidIdea = typeof candidate.idea === "string";
  const hasValidPainPoints =
    Array.isArray(candidate.painPoints) &&
    candidate.painPoints.every((item) => typeof item === "string");
  const hasValidTeamSize =
    candidate.teamSize === "solo" || candidate.teamSize === "small" || candidate.teamSize === "early";
  const hasValidBudget = candidate.budgetMonthly === null || typeof candidate.budgetMonthly === "number";
  const hasValidRunway = candidate.runwayMonths === null || typeof candidate.runwayMonths === "number";
  const hasValidTeamRoles =
    Array.isArray(candidate.teamRoles) && candidate.teamRoles.every((role) => typeof role === "string");
  const hasValidStage =
    candidate.currentStage === "idea" ||
    candidate.currentStage === "mvp" ||
    candidate.currentStage === "beta" ||
    candidate.currentStage === "launch";
  const hasValidConstraints =
    Array.isArray(candidate.constraints) &&
    candidate.constraints.every((constraint) => typeof constraint === "string");

  return (
    hasValidIdea &&
    hasValidPainPoints &&
    hasValidTeamSize &&
    hasValidBudget &&
    hasValidRunway &&
    hasValidTeamRoles &&
    hasValidStage &&
    hasValidConstraints
  );
}

function isMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      (message as ChatMessage).role !== undefined &&
      ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant") &&
      typeof (message as ChatMessage).content === "string",
  );
}

export function parseChatRequest(payload: unknown): ChatRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as Partial<ChatRequest>;

  if (!candidate.mode || !isChatMode(candidate.mode)) {
    return null;
  }

  if (!candidate.agentType || !isAgentType(candidate.agentType)) {
    return null;
  }

  if (!candidate.context || !isUserContext(candidate.context)) {
    return null;
  }

  if (!candidate.messages || !isMessages(candidate.messages)) {
    return null;
  }

  return {
    mode: candidate.mode,
    agentType: candidate.agentType,
    context: candidate.context,
    messages: candidate.messages,
  };
}

export function validateChatRequestPayload(payload: ChatRequest): string | null {
  if (payload.messages.length > 30) {
    return "messages는 최대 30개까지 허용됩니다.";
  }

  let totalLength = 0;
  for (const message of payload.messages) {
    const currentLength = message.content.trim().length;
    if (currentLength > 1200) {
      return "각 메시지는 최대 1200자까지 허용됩니다.";
    }
    totalLength += currentLength;
  }

  if (totalLength > 18000) {
    return "메시지 총 길이는 최대 18000자까지 허용됩니다.";
  }

  return null;
}
