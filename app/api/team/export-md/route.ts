import {
  TeamExportMarkdownRequest,
  TeamExportMarkdownResponse,
} from "@/lib/types";
import { createApiErrorResponse, createSuccessResponse } from "@/lib/security/error";
import { guardJsonRequest } from "@/lib/security/request-guard";

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
  const consensusNotes = Array.isArray(lastTurnResult.consensusNotes)
    ? lastTurnResult.consensusNotes
    : [];
  const changedTasks = Array.isArray(lastTurnResult.changedTasks)
    ? lastTurnResult.changedTasks
    : [];

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
    ...(consensusNotes.length > 0
      ? consensusNotes.map((note) => `- ${note}`)
      : ["- 합의 노트 없음"]),
    "",
    "## 이번 턴 변경 작업",
    ...(changedTasks.length > 0
      ? changedTasks.map((task) => `- ${task}`)
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
): Promise<Response> {
  const guard = await guardJsonRequest(request, {
    routeKey: "team_export_md",
    maxBodyBytes: 64 * 1024,
    rateLimit: {
      perMinute: 10,
      perDay: 600,
    },
    parsePayload: parseRequest,
  });

  if (!guard.ok) {
    return guard.response;
  }

  try {
    const markdown = buildMarkdown(guard.payload);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return createSuccessResponse<TeamExportMarkdownResponse>(
      {
        markdown,
        fileName: `team-room-summary-${timestamp}.md`,
      },
      guard.requestId,
    );
  } catch {
    return createApiErrorResponse({
      status: 500,
      errorCode: "INTERNAL_ERROR",
      message: "마크다운 생성에 실패했습니다.",
      recoverable: true,
      requestId: guard.requestId,
    });
  }
}
