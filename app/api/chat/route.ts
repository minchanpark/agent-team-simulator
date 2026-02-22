import Anthropic from "@anthropic-ai/sdk";
import { getDiagnosisPrompt, getMapPrompt } from "@/lib/agents/prompts";
import { parseChatRequest, validateChatRequestPayload } from "@/lib/chat/validator";
import { createApiErrorResponse, createSuccessResponse, toUpstreamErrorResponse } from "@/lib/security/error";
import { guardJsonRequest } from "@/lib/security/request-guard";
import {
  AgentMapDocument,
  ChatMessage,
  DIAGNOSTIC_DIMENSIONS,
  DiagnosticDimension,
  DiagnosticProgress,
  SpecialistAgentType,
  UserContext,
} from "@/lib/types";
const DEFAULT_MODEL_CANDIDATES = [
  "claude-sonnet-4-5",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-latest",
  "claude-3-5-haiku-latest",
];

interface CreatePayload {
  system: string;
  messages: ChatMessage[];
}

interface StructuredResponseAttempt<T> {
  parsed: T | null;
  lastText: string;
}

const FALLBACK_USER_MESSAGE: ChatMessage = {
  role: "user",
  content: "진단 인터뷰를 시작해 주세요.",
};

const CONTINUE_USER_MESSAGE: ChatMessage = {
  role: "user",
  content: "이전 대화 맥락을 이어서 다음 답변을 생성해 주세요.",
};

const DIAGNOSIS_DETAIL_TEMPLATES: Record<
  DiagnosticDimension,
  { question: string; reason: string; examples: [string, string, string] }
> = {
  goal: {
    question: "이번 분기 또는 이번 달에 반드시 달성하려는 목표를 수치 포함으로 설명해 주세요.",
    reason: "목표를 수치화해야 우선순위와 실행 강도를 정확히 설계할 수 있습니다.",
    examples: [
      "4주 내 MVP 출시 및 베타 50명 확보",
      "이번 달 유료 전환 10건 달성",
      "2주 내 핵심 기능 3개 완성",
    ],
  },
  bottleneck: {
    question: "현재 가장 큰 병목이 어디에서 발생하는지, 실제로 지연되는 작업 단계를 구체적으로 알려주세요.",
    reason: "병목 구간을 특정해야 자동화/위임 대상을 정확히 선정할 수 있습니다.",
    examples: [
      "기능 우선순위 결정이 매주 밀림",
      "개발 구현 속도가 느려 배포가 지연됨",
      "요구사항 정리가 늦어 작업 착수가 지연됨",
    ],
  },
  target: {
    question: "핵심 타겟 사용자의 특성(누구인지, 어떤 문제를 겪는지, 현재 대체수단)을 구체적으로 설명해 주세요.",
    reason: "타겟이 선명해야 메시지, 기능, 실험 설계를 정확히 맞출 수 있습니다.",
    examples: [
      "학점 2.0 미만 대학생, 학습 습관 관리에 어려움",
      "1인 온라인 셀러, 콘텐츠 제작 시간이 부족",
      "초기 PM, 기능 정의와 사용자 검증 경험이 부족",
    ],
  },
  resource: {
    question: "현재 투입 가능한 리소스(인력, 예산, 주당 시간)와 절대 넘기면 안 되는 제약을 알려주세요.",
    reason: "리소스 한계를 알아야 실행 가능한 계획과 일정으로 맵을 구성할 수 있습니다.",
    examples: [
      "개발 1명, 디자인 0명, 월 30만원",
      "주당 15시간만 투입 가능",
      "외주 없이 내부 인력으로만 진행 필요",
    ],
  },
  metric: {
    question: "성공 여부를 판단할 핵심 지표를 1~2개 선정하고, 목표값과 측정 주기를 함께 알려주세요.",
    reason: "측정 기준이 있어야 실행 결과를 평가하고 빠르게 방향을 수정할 수 있습니다.",
    examples: [
      "주간 활성 사용자 100명, 매주 측정",
      "가입 대비 활성화율 40%, 주간 측정",
      "유료 전환 10건/월, 월간 측정",
    ],
  },
};

function extractText(content: Anthropic.Messages.Message["content"]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function getModelCandidates(): string[] {
  const configuredModel = process.env.ANTHROPIC_MODEL?.trim();
  const models = [configuredModel, ...DEFAULT_MODEL_CANDIDATES].filter(
    (model): model is string => Boolean(model),
  );

  return Array.from(new Set(models));
}

function normalizeMessagesForAnthropic(messages: ChatMessage[]): ChatMessage[] {
  const baseMessages = messages.length > 0 ? messages : [FALLBACK_USER_MESSAGE];
  const normalized = [...baseMessages];

  if (normalized[0]?.role === "assistant") {
    normalized.unshift(FALLBACK_USER_MESSAGE);
  }

  const last = normalized[normalized.length - 1];
  if (last?.role === "assistant") {
    normalized.push(CONTINUE_USER_MESSAGE);
  }

  return normalized;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label}_TIMEOUT`));
    }, timeoutMs);

    promise
      .then((value) => {
        if (timer) {
          clearTimeout(timer);
        }
        resolve(value);
      })
      .catch((error: unknown) => {
        if (timer) {
          clearTimeout(timer);
        }
        reject(error);
      });
  });
}

async function createWithFallback(
  anthropic: Anthropic,
  createPayload: CreatePayload,
): Promise<Anthropic.Messages.Message> {
  const modelCandidates = getModelCandidates();
  const safeMessages = normalizeMessagesForAnthropic(createPayload.messages);
  let lastErrorMessage = "";

  for (const model of modelCandidates) {
    try {
      return await withTimeout(
        anthropic.messages.create({
          model,
          max_tokens: 1400,
          temperature: 0.2,
          system: createPayload.system,
          messages: safeMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
        30000,
        "CHAT_CALL",
      );
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "CHAT_CALL_FAILED";
      continue;
    }
  }

  throw new Error(
    lastErrorMessage ||
      `사용 가능한 모델을 찾지 못했습니다. .env.local의 ANTHROPIC_MODEL 값을 확인해 주세요. 시도한 모델: ${modelCandidates.join(
        ", ",
      )}`,
  );
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

function parseJsonResponse(raw: string): unknown | null {
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

function isDiagnosticDimension(value: unknown): value is DiagnosticDimension {
  return typeof value === "string" && DIAGNOSTIC_DIMENSIONS.includes(value as DiagnosticDimension);
}

function toDiagnosticProgress(value: unknown): DiagnosticProgress | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<DiagnosticProgress>;
  const completedFromModel = Array.isArray(candidate.completed)
    ? candidate.completed.filter(isDiagnosticDimension)
    : [];
  const missingFromModel = Array.isArray(candidate.missing)
    ? candidate.missing.filter(isDiagnosticDimension)
    : DIAGNOSTIC_DIMENSIONS.filter((dimension) => !completedFromModel.includes(dimension));

  const completed = DIAGNOSTIC_DIMENSIONS.filter(
    (dimension) => completedFromModel.includes(dimension) && !missingFromModel.includes(dimension),
  );
  const missing = DIAGNOSTIC_DIMENSIONS.filter((dimension) => !completed.includes(dimension));

  const readyFromModel =
    typeof candidate.readyForMap === "boolean"
      ? candidate.readyForMap
      : typeof (candidate as { ready_for_map?: unknown }).ready_for_map === "boolean"
        ? Boolean((candidate as { ready_for_map?: unknown }).ready_for_map)
        : missing.length === 0;

  return {
    completed,
    missing,
    readyForMap: missing.length === 0 && readyFromModel,
  };
}

function toDiagnosisPayload(value: unknown): { message: string; progress: DiagnosticProgress } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as {
    message?: unknown;
    nextQuestion?: unknown;
    question?: unknown;
    progress?: unknown;
    completed?: unknown;
    missing?: unknown;
    readyForMap?: unknown;
    ready_for_map?: unknown;
  };
  const messageCandidate = [candidate.message, candidate.nextQuestion, candidate.question].find(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );

  if (!messageCandidate) {
    return null;
  }

  const progress = toDiagnosticProgress(
    candidate.progress ?? {
      completed: candidate.completed,
      missing: candidate.missing,
      readyForMap: candidate.readyForMap,
      ready_for_map: candidate.ready_for_map,
    },
  );
  if (!progress) {
    return null;
  }

  const normalizedMessage = messageCandidate.trim();
  if (!normalizedMessage) {
    return null;
  }

  const detailedMessage = formatDiagnosisMessage(normalizedMessage, progress);

  return {
    message: detailedMessage,
    progress,
  };
}

function pickDiagnosisMessageFromRawText(rawText: string): string | null {
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/\r/g, "")
    .trim();
  if (!cleaned) {
    return null;
  }

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  const preferred = lines.find((line) => line.includes("?")) ?? lines[0];
  const normalized = preferred.replace(/^[-*\d.)\s]+/, "").trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDiagnosisMessage(message: string, progress: DiagnosticProgress): string {
  if (progress.readyForMap) {
    return "진단 핵심 항목이 모두 수집되었습니다. 에이전트 맵 생성 버튼을 눌러 결과를 확인하세요.";
  }

  const normalized = message.replace(/\s+/g, " ").trim();
  const hasReason = /이유\s*[:：]/.test(message);
  const hasExamples = /예시\s*답변\s*[:：]/.test(message);

  if (normalized.length >= 60 && hasReason && hasExamples) {
    return message.trim();
  }

  const targetDimension = progress.missing[0] ?? "goal";
  const template = DIAGNOSIS_DETAIL_TEMPLATES[targetDimension];
  const questionCandidate =
    normalized.length >= 20
      ? normalized.endsWith("?")
        ? normalized
        : `${normalized}?`
      : template.question;

  return [
    `질문: ${questionCandidate}`,
    `이유: ${template.reason}`,
    `예시 답변: ${template.examples.join(" / ")}`,
  ].join("\n");
}

function buildDiagnosisFallback(
  rawText: string,
  messages: ChatMessage[],
): { message: string; progress: DiagnosticProgress } | null {
  const baseMessage = pickDiagnosisMessageFromRawText(rawText) ?? "현재 상황을 구체적으로 알려주세요.";

  const userTurnCount = Math.min(
    messages.filter((item) => item.role === "user").length,
    DIAGNOSTIC_DIMENSIONS.length,
  );
  const completed = DIAGNOSTIC_DIMENSIONS.slice(0, userTurnCount);
  const missing = DIAGNOSTIC_DIMENSIONS.slice(userTurnCount);
  const progress: DiagnosticProgress = {
    completed,
    missing,
    readyForMap: missing.length === 0,
  };
  const message = formatDiagnosisMessage(baseMessage, progress);

  return {
    message,
    progress,
  };
}

async function createStructuredResponse<T>(
  anthropic: Anthropic,
  createPayload: CreatePayload,
  parser: (value: unknown) => T | null,
): Promise<StructuredResponseAttempt<T>> {
  let lastText = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await createWithFallback(anthropic, createPayload);
      const text = extractText(response.content);
      lastText = text;
      const parsedJson = parseJsonResponse(text);

      if (!parsedJson) {
        continue;
      }

      const parsed = parser(parsedJson);
      if (parsed) {
        return { parsed, lastText };
      }
    } catch (error) {
      lastText = error instanceof Error ? error.message : "STRUCTURED_RESPONSE_FAILED";
      continue;
    }
  }

  return { parsed: null, lastText };
}

function buildTranscript(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return "";
  }

  return messages
    .map((message) => `${message.role === "user" ? "사용자" : "에이전트"}: ${message.content}`)
    .join("\n");
}

const AGENT_LABELS: Record<SpecialistAgentType, string> = {
  marketing: "마케팅",
  cs: "CS",
  data: "데이터",
  dev: "개발보조",
};

function normalizeMarkdownResponse(rawText: string): string {
  const trimmed = rawText.replace(/\r/g, "").trim();
  if (!trimmed) {
    return "";
  }

  const fencedMatch = trimmed.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  const content = fencedMatch ? fencedMatch[1] : trimmed;
  return content.trim();
}

function buildFallbackMapMarkdown(
  agentType: SpecialistAgentType,
  context: UserContext,
  messages: ChatMessage[],
): string {
  const agentLabel = AGENT_LABELS[agentType];
  const latestUserInputs = messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.content.trim())
    .filter(Boolean);
  const conversationHint =
    latestUserInputs.length > 0
      ? latestUserInputs.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "대화에서 수집된 추가 정보가 부족하여 온보딩 정보를 우선 반영했습니다.";

  return [
    `# ${agentLabel} 에이전트 맵`,
    "",
    "## 진단 요약",
    `${context.idea} 아이디어를 기준으로 ${agentLabel} 관점에서 실행 우선순위를 정리했습니다.`,
    "",
    "## 우선 과제 3개",
    "1. 1주 내 실행 가능한 최소 단위 과제를 정의하고 담당/완료 기준을 명확화합니다.",
    "2. 반복 작업을 자동화할 도구 1개를 선정해 실험 범위와 성공 기준을 설정합니다.",
    "3. 주간 점검 루틴(성과 리뷰 + 다음 액션 결정)을 운영합니다.",
    "",
    "## 워크플로",
    "- 워크플로 1",
    "  - 도구: Claude, Notion",
    "  - 단계: 요구사항 정리 → 초안 생성 → 내부 검토 → 실행 반영",
    "  - 예상효과: 실행 준비 시간을 단축하고 의사결정 속도를 높임",
    "- 워크플로 2",
    "  - 도구: Spreadsheet, 캘린더",
    "  - 단계: 핵심 지표 정의 → 주간 기록 → 편차 분석 → 개선안 실행",
    "  - 예상효과: 감에 의존한 운영을 줄이고 개선 사이클을 고정",
    "",
    "## KPI",
    "- 지표명: 주간 핵심 액션 완료율 / 목표값: 80% 이상 / 측정주기: 주간",
    "- 지표명: 우선 과제 리드타임 / 목표값: 7일 이내 / 측정주기: 주간",
    "- 지표명: 실험 반영 횟수 / 목표값: 주 2회 이상 / 측정주기: 주간",
    "",
    "## 리스크 및 완화 전략",
    "- 리스크: 우선순위 변경이 잦아 실행이 분산됨",
    "  - 완화전략: 주간 1회만 우선순위 재조정, 긴급 이슈는 별도 트랙으로 분리",
    "- 리스크: 리소스 부족으로 과제 지연 발생",
    "  - 완화전략: 과제를 1~2일 단위로 쪼개고 완료 기준을 낮춰 빠르게 검증",
    "",
    "## 첫 주 실행계획",
    "- [ ] 월: 핵심 목표 1개와 측정 지표 2개를 확정합니다.",
    "- [ ] 화: 우선 과제 3개를 작업 단위로 분해하고 일정에 배치합니다.",
    "- [ ] 수: 자동화 후보 작업 1개를 선정해 파일럿을 실행합니다.",
    "- [ ] 목: 중간 점검 후 병목을 제거할 대체 경로를 확정합니다.",
    "- [ ] 금: 주간 리뷰를 통해 다음 주 실행 계획을 업데이트합니다.",
    "",
    "## 참고 대화 요약",
    conversationHint,
  ].join("\n");
}

function buildMapDocument(agentType: SpecialistAgentType, markdown: string): AgentMapDocument {
  const createdAt = new Date().toISOString();
  const safeTimestamp = createdAt.replace(/[:.]/g, "-");

  return {
    agentType,
    format: "md",
    fileName: `agent-map-${agentType}-${safeTimestamp}.md`,
    content: markdown,
    createdAt,
  };
}

function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
    routeKey: "chat",
    maxBodyBytes: 64 * 1024,
    rateLimit: {
      perMinute: 12,
      perDay: 120,
    },
    parsePayload: parseChatRequest,
    payloadValidator: validateChatRequestPayload,
  });

  if (!guard.ok) {
    return guard.response;
  }

  try {
    const parsedRequest = guard.payload;

    const anthropic = new Anthropic({ apiKey });

    if (parsedRequest.mode === "diagnosis") {
      const diagnosisAttempt = await createStructuredResponse(
        anthropic,
        {
          system: getDiagnosisPrompt(parsedRequest.agentType, parsedRequest.context),
          messages: parsedRequest.messages,
        },
        toDiagnosisPayload,
      );
      const diagnosis =
        diagnosisAttempt.parsed ??
        buildDiagnosisFallback(diagnosisAttempt.lastText, parsedRequest.messages);

      if (!diagnosis) {
        const fallback = buildDiagnosisFallback("", parsedRequest.messages);
        if (!fallback) {
          return createApiErrorResponse({
            status: 502,
            errorCode: "UPSTREAM_UNAVAILABLE",
            message: "진단 응답 형식을 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            recoverable: true,
            requestId: guard.requestId,
          });
        }

        return createSuccessResponse(
          {
            mode: "diagnosis" as const,
            message: fallback.message,
            progress: fallback.progress,
          },
          guard.requestId,
        );
      }

      return createSuccessResponse(
        {
          mode: "diagnosis" as const,
          message: diagnosis.message,
          progress: diagnosis.progress,
        },
        guard.requestId,
      );
    }

    let markdown = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await createWithFallback(anthropic, {
          system: getMapPrompt(
            parsedRequest.agentType,
            parsedRequest.context,
            buildTranscript(parsedRequest.messages),
          ),
          messages: parsedRequest.messages,
        });

        markdown = normalizeMarkdownResponse(extractText(response.content));
        if (markdown.length > 0) {
          break;
        }
      } catch {
        continue;
      }
    }

    if (!markdown) {
      markdown = buildFallbackMapMarkdown(
        parsedRequest.agentType,
        parsedRequest.context,
        parsedRequest.messages,
      );
    }

    const document = buildMapDocument(parsedRequest.agentType, markdown);

    return createSuccessResponse(
      {
        mode: "generate_map" as const,
        document,
      },
      guard.requestId,
    );
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return toUpstreamErrorResponse(guard.requestId);
    }

    return createApiErrorResponse({
      status: 500,
      errorCode: "INTERNAL_ERROR",
      message: "예상하지 못한 서버 오류가 발생했습니다.",
      recoverable: true,
      requestId: guard.requestId,
    });
  }
}
