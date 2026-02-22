import Anthropic from "@anthropic-ai/sdk";
import { orchestrateTeamTurn } from "@/lib/team/orchestrator";
import { toExecutionBoard } from "@/lib/team/validators";
import { createApiErrorResponse, createSuccessResponse, toUpstreamErrorResponse } from "@/lib/security/error";
import { guardJsonRequest } from "@/lib/security/request-guard";
import {
  SpecialistAgentType,
  TEAM_ROOM_DEFAULT_AGENTS,
  TeamRoomMessage,
  TeamTurnRequest,
  TeamTurnSuccessResponse,
  UserContext,
} from "@/lib/types";

function isSpecialistAgentType(value: unknown): value is SpecialistAgentType {
  return typeof value === "string" && TEAM_ROOM_DEFAULT_AGENTS.includes(value as SpecialistAgentType);
}

function normalizeMessages(value: unknown): TeamRoomMessage[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized: TeamRoomMessage[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const candidate = item as Partial<TeamRoomMessage>;
    if (
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      typeof candidate.content !== "string"
    ) {
      return null;
    }

    normalized.push({
      role: candidate.role,
      content: candidate.content,
      timestamp:
        typeof candidate.timestamp === "string" && candidate.timestamp.length > 0
          ? candidate.timestamp
          : new Date().toISOString(),
      speakerAgent: isSpecialistAgentType(candidate.speakerAgent)
        ? candidate.speakerAgent
        : candidate.speakerAgent === "pm"
          ? "pm"
          : undefined,
      messageType:
        candidate.messageType === "recovery" || candidate.messageType === "normal"
          ? candidate.messageType
          : undefined,
    });
  }

  return normalized;
}

function isUserContext(value: unknown): value is UserContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UserContext;

  const hasValidIdea = typeof candidate.idea === "string";
  const hasValidPainPoints =
    Array.isArray(candidate.painPoints) && candidate.painPoints.every((item) => typeof item === "string");
  const hasValidTeamSize =
    candidate.teamSize === "solo" || candidate.teamSize === "small" || candidate.teamSize === "early";
  const hasValidBudget = candidate.budgetMonthly === null || typeof candidate.budgetMonthly === "number";
  const hasValidRunway = candidate.runwayMonths === null || typeof candidate.runwayMonths === "number";
  const hasValidRoles =
    Array.isArray(candidate.teamRoles) && candidate.teamRoles.every((role) => typeof role === "string");
  const hasValidStage =
    candidate.currentStage === "idea" ||
    candidate.currentStage === "mvp" ||
    candidate.currentStage === "beta" ||
    candidate.currentStage === "launch";
  const hasValidConstraints =
    Array.isArray(candidate.constraints) && candidate.constraints.every((constraint) => typeof constraint === "string");

  return (
    hasValidIdea &&
    hasValidPainPoints &&
    hasValidTeamSize &&
    hasValidBudget &&
    hasValidRunway &&
    hasValidRoles &&
    hasValidStage &&
    hasValidConstraints
  );
}

function parseRequest(payload: unknown): TeamTurnRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as Partial<TeamTurnRequest>;
  if (!isUserContext(candidate.context)) {
    return null;
  }

  const messages = normalizeMessages(candidate.messages);
  if (!messages) {
    return null;
  }

  const activeAgents =
    Array.isArray(candidate.activeAgents) && candidate.activeAgents.every(isSpecialistAgentType)
      ? Array.from(new Set(candidate.activeAgents))
      : TEAM_ROOM_DEFAULT_AGENTS;

  const currentBoard =
    candidate.currentBoard === null || candidate.currentBoard === undefined
      ? null
      : toExecutionBoard(candidate.currentBoard, 1, activeAgents);

  return {
    context: candidate.context,
    messages,
    currentBoard,
    activeAgents,
    teamSpecId: typeof candidate.teamSpecId === "string" ? candidate.teamSpecId : undefined,
    debug: candidate.debug === true,
  };
}

function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function validateRequestPayload(payload: TeamTurnRequest): string | null {
  if (payload.messages.length > 40) {
    return "메시지는 최대 40개까지 전송할 수 있습니다.";
  }

  let totalLength = 0;
  for (const message of payload.messages) {
    const currentLength = message.content.trim().length;
    if (currentLength > 1200) {
      return "각 메시지는 최대 1200자까지 전송할 수 있습니다.";
    }

    totalLength += currentLength;
  }

  if (totalLength > 24000) {
    return "메시지 총 길이는 최대 24000자까지 전송할 수 있습니다.";
  }

  return null;
}

export async function POST(request: Request): Promise<Response> {
  const missingKeyRequestId = createRequestId();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return createApiErrorResponse({
      status: 500,
      errorCode: "MISSING_API_KEY",
      message: "서버에 ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.",
      recoverable: false,
      requestId: missingKeyRequestId,
    });
  }

  const guard = await guardJsonRequest(request, {
    routeKey: "team_turn",
    maxBodyBytes: 64 * 1024,
    rateLimit: {
      perMinute: 6,
      perDay: 60,
    },
    parsePayload: parseRequest,
    payloadValidator: validateRequestPayload,
  });

  if (!guard.ok) {
    return guard.response;
  }

  try {
    const response = await orchestrateTeamTurn({
      apiKey,
      request: guard.payload,
    });

    return createSuccessResponse<TeamTurnSuccessResponse>(response, guard.requestId);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return toUpstreamErrorResponse(guard.requestId);
    }

    return createApiErrorResponse({
      status: 500,
      errorCode: "INTERNAL_ERROR",
      message: "팀룸 응답 생성 중 오류가 발생했습니다.",
      recoverable: true,
      requestId: guard.requestId,
    });
  }
}
