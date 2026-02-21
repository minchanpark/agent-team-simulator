import Anthropic from "@anthropic-ai/sdk";
import { buildConsensus } from "@/lib/team/consensus";
import {
  buildFallbackBoard,
  buildFallbackConsensusNotes,
  buildFallbackMarkdown,
  resolveRecoveryLevel,
} from "@/lib/team/recovery";
import { resolveTeamSpec } from "@/lib/team/spec";
import { runSpecialists } from "@/lib/team/specialists";
import { trackTeamEvent } from "@/lib/team/telemetry";
import { runPmOrchestrator } from "@/lib/team/pm";
import {
  BoardPatchResult,
  ExecutionBoard,
  ExecutionTask,
  TeamTurnRequest,
  TeamTurnResult,
  TeamTurnSuccessResponse,
  TeamTurnTrace,
} from "@/lib/types";

function uniqueStrings(values: string[], limit = 8): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function isTaskChanged(previous: ExecutionTask | undefined, next: ExecutionTask): boolean {
  if (!previous) {
    return true;
  }

  return (
    previous.title !== next.title ||
    previous.status !== next.status ||
    previous.priority !== next.priority ||
    previous.effort !== next.effort ||
    previous.dueDate !== next.dueDate ||
    previous.ownerAgent !== next.ownerAgent ||
    previous.metric !== next.metric
  );
}

function buildBoardPatch(
  previousBoard: ExecutionBoard | null,
  nextBoard: ExecutionBoard,
): BoardPatchResult {
  if (!previousBoard) {
    const initialTasks = nextBoard.tasks.slice(0, 6);
    return {
      changedTaskIds: initialTasks.map((task) => task.id),
      changedTasks: initialTasks.map((task) => task.title),
      patchSummary: "초기 실행보드 생성",
    };
  }

  const previousMap = new Map(previousBoard.tasks.map((task) => [task.id, task]));
  const changedTasks = nextBoard.tasks.filter((task) => isTaskChanged(previousMap.get(task.id), task));

  const patchSummary =
    changedTasks.length > 0
      ? `${changedTasks.length}개 작업이 신규/수정되었습니다.`
      : "작업 구조는 유지되고 메타데이터만 갱신되었습니다.";

  return {
    changedTaskIds: changedTasks.map((task) => task.id),
    changedTasks: changedTasks.map((task) => task.title),
    patchSummary,
  };
}

function createTraceBase(teamSpecId: string, policy: TeamTurnTrace["policy"]): TeamTurnTrace {
  return {
    traceId: `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    teamSpecId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    totalLatencyMs: 0,
    policy,
    steps: [],
    specialistRuns: [],
  };
}

export async function orchestrateTeamTurn(params: {
  apiKey: string;
  request: TeamTurnRequest;
}): Promise<TeamTurnSuccessResponse> {
  const { apiKey, request } = params;
  const startedAt = Date.now();

  const spec = resolveTeamSpec(request.teamSpecId, request.activeAgents);
  const trace = createTraceBase(spec.id, spec.policy);

  trace.steps.push({
    step: "validate",
    status: "ok",
    latencyMs: 0,
    detail: `activeAgents=${spec.activeAgents.join(",")}`,
  });

  const anthropic = new Anthropic({ apiKey });

  const specialistStart = Date.now();
  const specialistResult = await runSpecialists({
    anthropic,
    spec,
    context: request.context,
    messages: request.messages,
    activeAgents: spec.activeAgents,
  });

  trace.specialistRuns = specialistResult.runs;
  trace.steps.push({
    step: "specialists",
    status: specialistResult.hasFallback ? "fallback" : "ok",
    latencyMs: Date.now() - specialistStart,
    detail: `${specialistResult.runs.filter((run) => run.status === "fallback").length} fallback`,
  });

  const consensusStart = Date.now();
  const consensusResult = buildConsensus(request.context, specialistResult.insights);
  const fallbackConsensus = buildFallbackConsensusNotes(request.context, specialistResult.insights);
  const consensusNotes =
    consensusResult.consensusNotes.length > 0 ? consensusResult.consensusNotes : fallbackConsensus;

  trace.steps.push({
    step: "consensus",
    status: "ok",
    latencyMs: Date.now() - consensusStart,
    detail: consensusNotes.join(" | "),
  });
  trackTeamEvent("team_consensus_completed");

  const pmStart = Date.now();
  let pmPayload: Awaited<ReturnType<typeof runPmOrchestrator>>["payload"] = null;
  let pmModel: string | undefined;

  try {
    const pmResult = await runPmOrchestrator({
      anthropic,
      spec,
      context: request.context,
      specialistInsights: specialistResult.insights,
      currentBoard: request.currentBoard,
      messages: request.messages,
      consensusNotes,
    });
    pmPayload = pmResult.payload;
    pmModel = pmResult.model;
  } catch {
    pmPayload = null;
  }

  const pmFallback = !pmPayload;
  trace.steps.push({
    step: "pm",
    status: pmFallback ? "fallback" : "ok",
    latencyMs: Date.now() - pmStart,
    model: pmModel,
    detail: pmFallback ? "PM payload parse/call failed" : "PM orchestration succeeded",
  });

  const fallbackBoard = buildFallbackBoard(
    request.context,
    specialistResult.insights,
    request.currentBoard,
  );

  const finalBoard = pmPayload?.board ?? fallbackBoard;
  const finalConsensusNotes = uniqueStrings(
    pmPayload?.consensusNotes && pmPayload.consensusNotes.length > 0
      ? pmPayload.consensusNotes
      : consensusNotes,
    6,
  );

  const boardPatch = buildBoardPatch(request.currentBoard, finalBoard);
  const changedTasks = uniqueStrings(
    pmPayload?.changedTasks && pmPayload.changedTasks.length > 0
      ? pmPayload.changedTasks
      : boardPatch.changedTasks,
    8,
  );

  const recoveryLevel = resolveRecoveryLevel(specialistResult.hasFallback, pmFallback);
  if (recoveryLevel !== "none") {
    trackTeamEvent("team_recovery_applied", { recoveryLevel });
  }

  const result: TeamTurnResult = {
    orchestratorReply:
      pmPayload?.orchestratorReply ??
      "일부 응답을 복구해 실행보드를 재생성했습니다. 우선순위를 확인하고 다음 턴에서 보완해 주세요.",
    specialistInsights: specialistResult.insights,
    consensusNotes: finalConsensusNotes,
    changedTasks,
    boardPatch,
    board: finalBoard,
    mdSummary:
      pmPayload?.mdSummary ??
      buildFallbackMarkdown(finalBoard, specialistResult.insights, finalConsensusNotes),
  };

  const latencyMs = Date.now() - startedAt;
  trace.steps.push({
    step: "commit",
    status: recoveryLevel === "none" ? "ok" : "fallback",
    latencyMs: 0,
    detail: result.boardPatch.patchSummary,
  });
  trace.finishedAt = new Date().toISOString();
  trace.totalLatencyMs = latencyMs;

  if (request.debug) {
    trackTeamEvent("team_trace_captured");
  }

  return {
    result,
    latencyMs,
    recoveryLevel,
    trace: request.debug ? trace : undefined,
  };
}
