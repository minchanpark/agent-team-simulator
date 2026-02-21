import Anthropic from "@anthropic-ai/sdk";
import {
  ExecutionBoard,
  ExecutionTask,
  SpecialistAgentType,
  SpecialistInsight,
} from "@/lib/types";

export interface ParsedPmPayload {
  orchestratorReply: string;
  consensusNotes: string[];
  changedTasks: string[];
  board: ExecutionBoard;
  mdSummary: string;
}

function sanitizeText(value: string, maxLength = 120): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/["“”]/g, "'")
    .trim()
    .slice(0, maxLength);
}

function sanitizeList(values: string[], maxItems = 5, maxLength = 120): string[] {
  return values.map((value) => sanitizeText(value, maxLength)).filter(Boolean).slice(0, maxItems);
}

export function extractText(content: Anthropic.Messages.Message["content"]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const withoutFence = fencedMatch ? fencedMatch[1].trim() : trimmed;

  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFence.slice(firstBrace, lastBrace + 1).trim();
  }

  return withoutFence;
}

export function parseJsonResponse(raw: string): unknown | null {
  const jsonCandidate = extractJsonCandidate(raw);
  if (!jsonCandidate) {
    return null;
  }

  try {
    return JSON.parse(jsonCandidate);
  } catch {
    return null;
  }
}

function isSpecialistAgentType(
  value: unknown,
  agents: SpecialistAgentType[],
): value is SpecialistAgentType {
  return typeof value === "string" && agents.includes(value as SpecialistAgentType);
}

function normalizeTask(
  task: unknown,
  index: number,
  agents: SpecialistAgentType[],
): ExecutionTask | null {
  if (typeof task !== "object" || task === null) {
    return null;
  }

  const candidate = task as Partial<ExecutionTask>;

  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  if (!title) {
    return null;
  }

  const ownerAgent = isSpecialistAgentType(candidate.ownerAgent, agents)
    ? candidate.ownerAgent
    : agents[index % agents.length] ?? "marketing";

  const priority =
    candidate.priority === "high" || candidate.priority === "medium" || candidate.priority === "low"
      ? candidate.priority
      : "medium";

  const effort = candidate.effort === "S" || candidate.effort === "M" || candidate.effort === "L"
    ? candidate.effort
    : "M";

  const status =
    candidate.status === "todo" || candidate.status === "doing" || candidate.status === "done"
      ? candidate.status
      : "todo";

  const dueDate =
    typeof candidate.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate.dueDate)
      ? candidate.dueDate
      : new Date(Date.now() + (index + 2) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return {
    id:
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : `task-${index + 1}`,
    title: sanitizeText(title, 90),
    ownerAgent,
    priority,
    effort,
    dueDate,
    status,
    metric:
      typeof candidate.metric === "string"
        ? sanitizeText(candidate.metric, 80)
        : "주간 실행 완료율",
    dependencies:
      Array.isArray(candidate.dependencies) &&
      candidate.dependencies.every((value) => typeof value === "string")
        ? candidate.dependencies
        : [],
    rationale:
      typeof candidate.rationale === "string"
        ? sanitizeText(candidate.rationale, 200)
        : "핵심 목표 달성을 위한 우선 과제입니다.",
  };
}

export function toExecutionBoard(
  value: unknown,
  fallbackVersion: number,
  agents: SpecialistAgentType[],
): ExecutionBoard | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<ExecutionBoard>;

  if (typeof candidate.projectGoal !== "string" || candidate.projectGoal.trim().length === 0) {
    return null;
  }

  const tasks = Array.isArray(candidate.tasks)
    ? candidate.tasks
        .map((task, index) => normalizeTask(task, index, agents))
        .filter((task): task is ExecutionTask => task !== null)
    : [];

  if (tasks.length === 0) {
    return null;
  }

  const kpis = Array.isArray(candidate.kpis)
    ? candidate.kpis
        .map((kpi) => {
          if (typeof kpi !== "object" || kpi === null) {
            return null;
          }

          const parsed = kpi as { name?: unknown; target?: unknown; cadence?: unknown };
          if (
            typeof parsed.name !== "string" ||
            typeof parsed.target !== "string" ||
            typeof parsed.cadence !== "string"
          ) {
            return null;
          }

          return {
            name: parsed.name,
            target: parsed.target,
            cadence: parsed.cadence,
          };
        })
        .filter((kpi): kpi is ExecutionBoard["kpis"][number] => kpi !== null)
    : [];

  const risks = Array.isArray(candidate.risks)
    ? candidate.risks
        .map((risk) => {
          if (typeof risk !== "object" || risk === null) {
            return null;
          }

          const parsed = risk as { risk?: unknown; mitigation?: unknown };
          if (typeof parsed.risk !== "string" || typeof parsed.mitigation !== "string") {
            return null;
          }

          return {
            risk: parsed.risk,
            mitigation: parsed.mitigation,
          };
        })
        .filter((risk): risk is ExecutionBoard["risks"][number] => risk !== null)
    : [];

  const weeklyPlan = Array.isArray(candidate.weeklyPlan)
    ? candidate.weeklyPlan.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  const version = typeof candidate.version === "number" && Number.isFinite(candidate.version)
    ? Math.max(1, Math.floor(candidate.version))
    : fallbackVersion;

  return {
    projectGoal: candidate.projectGoal.trim(),
    tasks,
    kpis,
    risks,
    weeklyPlan,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim().length > 0
        ? candidate.updatedAt
        : new Date().toISOString(),
    version,
  };
}

export function toSpecialistPayload(
  value: unknown,
  agentType: SpecialistAgentType,
): SpecialistInsight | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as {
    summary?: unknown;
    priorities?: unknown;
    risks?: unknown;
    assumptions?: unknown;
  };

  if (typeof candidate.summary !== "string" || candidate.summary.trim().length === 0) {
    return null;
  }

  const priorities = Array.isArray(candidate.priorities)
    ? candidate.priorities.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  const risks = Array.isArray(candidate.risks)
    ? candidate.risks.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const assumptions = Array.isArray(candidate.assumptions)
    ? candidate.assumptions.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  return {
    agentType,
    summary: sanitizeText(candidate.summary, 220),
    priorities: sanitizeList(priorities, 5, 90),
    risks: sanitizeList(risks, 5, 90),
    assumptions: sanitizeList(assumptions, 5, 90),
  };
}

export function buildBoardSummaryMarkdown(
  board: ExecutionBoard,
  consensusNotes: string[],
  changedTasks: string[],
): string {
  return [
    "# 실행 요약",
    "",
    "## 목표",
    `- ${board.projectGoal}`,
    "",
    "## 합의 근거",
    ...(consensusNotes.length > 0 ? consensusNotes.slice(0, 5).map((note) => `- ${note}`) : ["- 없음"]),
    "",
    "## 변경 작업",
    ...(changedTasks.length > 0 ? changedTasks.slice(0, 8).map((task) => `- ${task}`) : ["- 없음"]),
    "",
    "## 이번 주 체크리스트",
    ...board.weeklyPlan.slice(0, 7).map((item) => `- [ ] ${item}`),
  ].join("\n");
}

export function toPmPayload(
  value: unknown,
  currentBoard: ExecutionBoard | null,
  agents: SpecialistAgentType[],
): ParsedPmPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as {
    orchestratorReply?: unknown;
    consensusNotes?: unknown;
    changedTasks?: unknown;
    board?: unknown;
    mdSummary?: unknown;
  };

  const fallbackVersion = currentBoard ? currentBoard.version + 1 : 1;
  const board = toExecutionBoard(candidate.board, fallbackVersion, agents);
  if (!board) {
    return null;
  }

  const consensusNotes = Array.isArray(candidate.consensusNotes)
    ? candidate.consensusNotes.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  const changedTasks = Array.isArray(candidate.changedTasks)
    ? candidate.changedTasks.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  const normalizedConsensusNotes = sanitizeList(consensusNotes, 6, 140);
  const normalizedChangedTasks = sanitizeList(changedTasks, 10, 90);
  const orchestratorReply =
    typeof candidate.orchestratorReply === "string" && candidate.orchestratorReply.trim().length > 0
      ? sanitizeText(candidate.orchestratorReply, 220)
      : "전문 에이전트 의견을 통합해 실행보드를 업데이트했습니다.";

  const mdSummary =
    typeof candidate.mdSummary === "string" && candidate.mdSummary.trim().length > 0
      ? candidate.mdSummary.trim()
      : buildBoardSummaryMarkdown(board, normalizedConsensusNotes, normalizedChangedTasks);

  return {
    orchestratorReply,
    consensusNotes: normalizedConsensusNotes,
    changedTasks: normalizedChangedTasks,
    board,
    mdSummary,
  };
}
