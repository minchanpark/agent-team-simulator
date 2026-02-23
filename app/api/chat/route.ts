import { ApiError as GeminiApiError, GoogleGenAI } from "@google/genai";
import { getDiagnosisStreamPrompt, getMapPrompt } from "@/lib/agents/prompts";
import { encodeSseEvent } from "@/lib/chat/sse";
import { parseChatRequest, validateChatRequestPayload } from "@/lib/chat/validator";
import {
  createApiErrorPayload,
  createApiErrorResponse,
  createSuccessResponse,
} from "@/lib/security/error";
import { guardJsonRequest } from "@/lib/security/request-guard";
import {
  AgentMapDocument,
  ApiErrorResponse,
  ChatMessage,
  DIAGNOSTIC_DIMENSIONS,
  DiagnosticDimension,
  DiagnosisStreamDoneData,
  DiagnosisStreamErrorEvent,
  SpecialistAgentType,
  UserContext,
} from "@/lib/types";

const DEFAULT_GEMINI_DIAGNOSIS_MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash"];
const DEFAULT_GEMINI_MAP_MODEL_CANDIDATES = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"];
const GEMINI_RATE_LIMIT_RETRY_AFTER_SEC = 60;

interface CreatePayload {
  system: string;
  messages: ChatMessage[];
}

interface GeminiContentMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
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

function getGeminiModelCandidates(mode: "diagnosis" | "map"): string[] {
  const configuredGlobalModel = process.env.GEMINI_MODEL?.trim();
  const configuredModeModel =
    mode === "diagnosis" ? process.env.GEMINI_DIAGNOSIS_MODEL?.trim() : process.env.GEMINI_MAP_MODEL?.trim();
  const defaults =
    mode === "diagnosis" ? DEFAULT_GEMINI_DIAGNOSIS_MODEL_CANDIDATES : DEFAULT_GEMINI_MAP_MODEL_CANDIDATES;

  const models = [configuredModeModel, configuredGlobalModel, ...defaults].filter(
    (model): model is string => Boolean(model),
  );

  return Array.from(new Set(models));
}

function normalizeMessagesForModel(messages: ChatMessage[]): ChatMessage[] {
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

function normalizeMessagesForGemini(messages: ChatMessage[]): GeminiContentMessage[] {
  const normalized = normalizeMessagesForModel(messages);

  return normalized.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
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

function pickDiagnosisMessageFromRawText(rawText: string): string | null {
  const cleaned = rawText
    .replace(/```(?:json|md|markdown)?/gi, "")
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

function formatDiagnosisMessage(message: string, progress: DiagnosisStreamDoneData["progress"]): string {
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

function buildDiagnosisFallback(rawText: string, messages: ChatMessage[]): DiagnosisStreamDoneData {
  const baseMessage = pickDiagnosisMessageFromRawText(rawText) ?? "현재 상황을 구체적으로 알려주세요.";

  const userTurnCount = Math.min(
    messages.filter((item) => item.role === "user").length,
    DIAGNOSTIC_DIMENSIONS.length,
  );
  const completed = DIAGNOSTIC_DIMENSIONS.slice(0, userTurnCount);
  const missing = DIAGNOSTIC_DIMENSIONS.slice(userTurnCount);
  const progress: DiagnosisStreamDoneData["progress"] = {
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

function createDiagnosisStreamErrorPayload(error: unknown, requestId: string): DiagnosisStreamErrorEvent["data"] {
  if (error instanceof GeminiApiError) {
    return createApiErrorPayload({
      ...mapGeminiError(error),
      requestId,
    });
  }

  return createApiErrorPayload({
    status: 500,
    errorCode: "INTERNAL_ERROR",
    message: "예상하지 못한 서버 오류가 발생했습니다.",
    recoverable: true,
    requestId,
  });
}

function isGeminiRateLimitedError(error: GeminiApiError): boolean {
  if (error.status === 429) {
    return true;
  }

  const message = error.message.toLowerCase();
  return /quota|rate[\s-]?limit|resource_exhausted|too many requests/.test(message);
}

function mapGeminiError(error: GeminiApiError): Omit<ApiErrorResponse, "requestId"> & { status: number } {
  if (isGeminiRateLimitedError(error)) {
    return {
      status: 429,
      errorCode: "RATE_LIMITED",
      message: "Gemini API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
      recoverable: true,
      retryAfterSec: GEMINI_RATE_LIMIT_RETRY_AFTER_SEC,
    };
  }

  return {
    status: 502,
    errorCode: "UPSTREAM_UNAVAILABLE",
    message: "외부 AI 서비스 응답이 불안정합니다. 잠시 후 다시 시도해 주세요.",
    recoverable: true,
  };
}

async function createDiagnosisStreamWithFallback(
  gemini: GoogleGenAI,
  createPayload: CreatePayload,
  onToken: (token: string) => void,
): Promise<string> {
  const modelCandidates = getGeminiModelCandidates("diagnosis");
  const safeMessages = normalizeMessagesForGemini(createPayload.messages);
  let lastError: unknown = null;

  for (const model of modelCandidates) {
    let emittedToken = false;
    let collectedText = "";

    try {
      const stream = await withTimeout(
        gemini.models.generateContentStream({
          model,
          contents: safeMessages,
          config: {
            systemInstruction: createPayload.system,
            maxOutputTokens: 1400,
            temperature: 0.2,
          },
        }),
        30000,
        "CHAT_STREAM_CALL",
      );

      for await (const chunk of stream) {
        const text = typeof chunk.text === "string" ? chunk.text : "";
        if (!text) {
          continue;
        }

        emittedToken = true;
        collectedText += text;
        onToken(text);
      }

      return collectedText;
    } catch (error) {
      lastError = error;
      if (emittedToken) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    `CHAT_STREAM_CALL_FAILED: ` +
      `사용 가능한 모델을 찾지 못했습니다. .env.local의 GEMINI_MODEL 값을 확인해 주세요. 시도한 모델: ${modelCandidates.join(
        ", ",
      )}`,
  );
}

async function createMapWithFallback(gemini: GoogleGenAI, createPayload: CreatePayload): Promise<string> {
  const modelCandidates = getGeminiModelCandidates("map");
  const safeMessages = normalizeMessagesForGemini(createPayload.messages);
  let lastErrorMessage = "";

  for (const model of modelCandidates) {
    try {
      const response = await withTimeout(
        gemini.models.generateContent({
          model,
          contents: safeMessages,
          config: {
            systemInstruction: createPayload.system,
            maxOutputTokens: 4096,
            temperature: 0.2,
          },
        }),
        45000,
        "CHAT_MAP_CALL",
      );

      const text = typeof response.text === "string" ? response.text.trim() : "";
      if (text.length > 0) {
        return text;
      }

      lastErrorMessage = "CHAT_MAP_EMPTY_RESPONSE";
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "CHAT_MAP_CALL_FAILED";
      continue;
    }
  }

  throw new Error(
    lastErrorMessage ||
      `사용 가능한 모델을 찾지 못했습니다. .env.local의 GEMINI_MODEL 값을 확인해 주세요. 시도한 모델: ${modelCandidates.join(
        ", ",
      )}`,
  );
}

function createDiagnosisSseResponse(params: {
  gemini: GoogleGenAI;
  requestId: string;
  agentType: SpecialistAgentType;
  context: UserContext;
  messages: ChatMessage[];
}): Response {
  const { gemini, requestId, agentType, context, messages } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendEvent = (event: string, payload: unknown): void => {
        controller.enqueue(encoder.encode(encodeSseEvent(event, payload)));
      };

      void (async () => {
        let collected = "";

        try {
          collected = await createDiagnosisStreamWithFallback(
            gemini,
            {
              system: getDiagnosisStreamPrompt(agentType, context),
              messages,
            },
            (token) => {
              sendEvent("token", { text: token });
            },
          );

          sendEvent("done", buildDiagnosisFallback(collected, messages));
        } catch (error) {
          if (error instanceof GeminiApiError) {
            console.error("[api/chat] Gemini diagnosis stream failed", {
              status: error.status,
              message: error.message,
            });
          }
          sendEvent("error", createDiagnosisStreamErrorPayload(error, requestId));
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  });
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
    "  - 도구: Gemini, Notion",
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

export async function POST(request: Request): Promise<Response> {
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
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return createApiErrorResponse({
        status: 500,
        errorCode: "MISSING_API_KEY",
        message: "서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.",
        recoverable: false,
        requestId: guard.requestId,
      });
    }

    const gemini = new GoogleGenAI({ apiKey: geminiApiKey });

    if (parsedRequest.mode === "diagnosis") {
      return createDiagnosisSseResponse({
        gemini,
        requestId: guard.requestId,
        agentType: parsedRequest.agentType,
        context: parsedRequest.context,
        messages: parsedRequest.messages,
      });
    }

    let markdown = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const rawText = await createMapWithFallback(gemini, {
          system: getMapPrompt(
            parsedRequest.agentType,
            parsedRequest.context,
            buildTranscript(parsedRequest.messages),
          ),
          messages: parsedRequest.messages,
        });

        markdown = normalizeMarkdownResponse(rawText);
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
    if (error instanceof GeminiApiError) {
      console.error("[api/chat] Gemini map generation failed", {
        status: error.status,
        message: error.message,
      });
      return createApiErrorResponse({
        ...mapGeminiError(error),
        requestId: guard.requestId,
      });
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
