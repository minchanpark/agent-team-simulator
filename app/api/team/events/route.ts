import { NextResponse } from "next/server";
import {
  getTeamMetricsSnapshot,
  isTeamEventName,
  trackTeamEvent,
  TeamEventName,
} from "@/lib/team/telemetry";
import { createApiErrorResponse, createSuccessResponse } from "@/lib/security/error";
import { guardJsonRequest } from "@/lib/security/request-guard";
import { ApiErrorResponse } from "@/lib/types";

interface TeamEventPayload {
  event: TeamEventName;
  metadata?: Record<string, unknown>;
}

function parsePayload(value: unknown): TeamEventPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<TeamEventPayload>;
  if (!isTeamEventName(candidate.event)) {
    return null;
  }

  return {
    event: candidate.event,
    metadata: candidate.metadata,
  };
}

export async function POST(request: Request) {
  const guard = await guardJsonRequest(request, {
    routeKey: "team_events",
    maxBodyBytes: 32 * 1024,
    rateLimit: {
      perMinute: 30,
      perDay: 1000,
    },
    parsePayload,
  });

  if (!guard.ok) {
    return guard.response;
  }

  try {
    trackTeamEvent(guard.payload.event, guard.payload.metadata);
    return createSuccessResponse({ ok: true }, guard.requestId);
  } catch {
    return createApiErrorResponse({
      status: 500,
      errorCode: "INTERNAL_ERROR",
      message: "이벤트 저장에 실패했습니다.",
      recoverable: true,
      requestId: guard.requestId,
    });
  }
}

export async function GET(): Promise<
  NextResponse<{
    total: number;
    counts: Record<TeamEventName, number>;
    lastEventAt: string | null;
    averageLatencyMs: number | null;
  } | ApiErrorResponse>
> {
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    return createSuccessResponse(getTeamMetricsSnapshot(), requestId);
  } catch {
    return createApiErrorResponse({
      status: 500,
      errorCode: "INTERNAL_ERROR",
      message: "이벤트 조회에 실패했습니다.",
      recoverable: true,
      requestId,
    });
  }
}
