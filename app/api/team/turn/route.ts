import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { orchestrateTeamTurn } from "@/lib/team/orchestrator";
import { toExecutionBoard } from "@/lib/team/validators";
import {
  SpecialistAgentType,
  TEAM_ROOM_DEFAULT_AGENTS,
  TeamRoomMessage,
  TeamTurnErrorResponse,
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

function createRecoverableError(message: string): NextResponse<TeamTurnErrorResponse> {
  return NextResponse.json(
    {
      errorCode: "TEAM_TURN_FAILED",
      message,
      recoverable: true,
    },
    { status: 502 },
  );
}

export async function POST(request: Request): Promise<NextResponse<TeamTurnSuccessResponse | TeamTurnErrorResponse>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        errorCode: "MISSING_API_KEY",
        message: "서버에 ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.",
        recoverable: false,
      },
      { status: 500 },
    );
  }

  try {
    const payload = await request.json();
    const parsedRequest = parseRequest(payload);

    if (!parsedRequest) {
      return NextResponse.json(
        {
          errorCode: "INVALID_REQUEST",
          message: "요청 본문 형식이 올바르지 않습니다.",
          recoverable: false,
        },
        { status: 400 },
      );
    }

    const response = await orchestrateTeamTurn({
      apiKey,
      request: parsedRequest,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return createRecoverableError(error.message);
    }

    const errorMessage = error instanceof Error ? error.message : "예상하지 못한 서버 오류";
    return createRecoverableError(errorMessage);
  }
}
