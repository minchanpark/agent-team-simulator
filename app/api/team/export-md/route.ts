import { NextResponse } from "next/server";
import {
  TeamExportMarkdownRequest,
  TeamExportMarkdownResponse,
  TeamTurnErrorResponse,
} from "@/lib/types";

function parseRequest(payload: unknown): TeamExportMarkdownRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as Partial<TeamExportMarkdownRequest>;

  if (
    !candidate.board ||
    typeof candidate.board !== "object" ||
    candidate.board === null ||
    !Array.isArray(candidate.board.tasks)
  ) {
    return null;
  }

  if (
    !candidate.lastTurnResult ||
    typeof candidate.lastTurnResult !== "object" ||
    candidate.lastTurnResult === null ||
    typeof candidate.lastTurnResult.mdSummary !== "string"
  ) {
    return null;
  }

  return {
    board: candidate.board,
    lastTurnResult: candidate.lastTurnResult,
  };
}

function buildMarkdown(request: TeamExportMarkdownRequest): string {
  const { board, lastTurnResult } = request;
  const today = new Date().toISOString().slice(0, 10);

  return [
    `# 팀룸 실행 문서 (${today})`,
    "",
    "## 오케스트레이터 메시지",
    lastTurnResult.orchestratorReply,
    "",
    "## 실행보드 요약",
    `- 목표: ${board.projectGoal}`,
    `- 버전: v${board.version}`,
    `- 업데이트 시각: ${board.updatedAt}`,
    "",
    "## 합의 근거",
    ...(lastTurnResult.consensusNotes.length > 0
      ? lastTurnResult.consensusNotes.map((note) => `- ${note}`)
      : ["- 합의 노트 없음"]),
    "",
    "## 이번 턴 변경 작업",
    ...(lastTurnResult.changedTasks.length > 0
      ? lastTurnResult.changedTasks.map((task) => `- ${task}`)
      : ["- 변경 작업 없음"]),
    "",
    "## 작업 목록",
    ...board.tasks.map(
      (task, index) =>
        `${index + 1}. [${task.status.toUpperCase()}] ${task.title} (${task.ownerAgent})\n   - 우선순위: ${task.priority}\n   - 난이도: ${task.effort}\n   - 마감일: ${task.dueDate}\n   - 지표: ${task.metric}`,
    ),
    "",
    "## KPI",
    ...board.kpis.map((kpi) => `- ${kpi.name}: ${kpi.target} (${kpi.cadence})`),
    "",
    "## 리스크",
    ...board.risks.map((risk) => `- ${risk.risk} → ${risk.mitigation}`),
    "",
    "## 이번 주 실행 체크리스트",
    ...board.weeklyPlan.map((item) => `- [ ] ${item}`),
    "",
    "## 상세 요약",
    lastTurnResult.mdSummary,
  ].join("\n");
}

export async function POST(
  request: Request,
): Promise<NextResponse<TeamExportMarkdownResponse | TeamTurnErrorResponse>> {
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

    const markdown = buildMarkdown(parsedRequest);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return NextResponse.json({
      markdown,
      fileName: `team-room-summary-${timestamp}.md`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "예상하지 못한 서버 오류";

    return NextResponse.json(
      {
        errorCode: "EXPORT_FAILED",
        message,
        recoverable: true,
      },
      { status: 500 },
    );
  }
}
