import { NextResponse } from "next/server";
import {
  getTeamMetricsSnapshot,
  isTeamEventName,
  trackTeamEvent,
  TeamEventName,
} from "@/lib/team/telemetry";

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
  try {
    const payload = await request.json();
    const parsed = parsePayload(payload);

    if (!parsed) {
      return NextResponse.json({ error: "유효하지 않은 이벤트 요청입니다." }, { status: 400 });
    }

    trackTeamEvent(parsed.event, parsed.metadata);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "이벤트 저장에 실패했습니다." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(getTeamMetricsSnapshot());
}
