import Anthropic from "@anthropic-ai/sdk";
import {
  getPmOrchestratorPrompt,
} from "@/lib/agents/prompts";
import { fallbackUserMessage } from "@/lib/team/recovery";
import { extractText, parseJsonResponse, ParsedPmPayload, toPmPayload } from "@/lib/team/validators";
import {
  ExecutionBoard,
  SpecialistInsight,
  TeamRoomMessage,
  TeamSpec,
  UserContext,
} from "@/lib/types";

interface CreatePayload {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

interface ModelResponse {
  model: string;
  message: Anthropic.Messages.Message;
}

interface StructuredResponseAttempt<T> {
  parsed: T | null;
  lastText: string;
  model?: string;
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

function buildJsonRepairSystemPrompt(): string {
  return `
당신은 JSON 복구기입니다.
- 입력 텍스트에서 유효한 JSON 객체 1개를 복구합니다.
- JSON 외 다른 텍스트, 코드블록, 주석을 출력하지 않습니다.
- 문자열은 한 줄로 작성합니다.
- mdSummary는 생략 가능하며, 없으면 출력하지 않습니다.

[JSON 스키마]
{
  "orchestratorReply": "string",
  "consensusNotes": ["string"],
  "changedTasks": ["string"],
  "board": {
    "projectGoal": "string",
    "tasks": [
      {
        "id": "string",
        "title": "string",
        "ownerAgent": "marketing|cs|data|dev",
        "priority": "high|medium|low",
        "effort": "S|M|L",
        "dueDate": "YYYY-MM-DD",
        "status": "todo|doing|done",
        "metric": "string",
        "dependencies": ["string"],
        "rationale": "string"
      }
    ],
    "kpis": [{ "name": "string", "target": "string", "cadence": "string" }],
    "risks": [{ "risk": "string", "mitigation": "string" }],
    "weeklyPlan": ["string"],
    "updatedAt": "ISO datetime",
    "version": 1
  }
}
`.trim();
}

async function createWithFallback(
  anthropic: Anthropic,
  createPayload: CreatePayload,
  modelCandidates: string[],
  maxTokens: number,
  requestTimeoutMs: number,
): Promise<ModelResponse> {
  let lastErrorMessage = "";

  for (const model of modelCandidates) {
    try {
      const message = await withTimeout(
        anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          temperature: 0.2,
          system: createPayload.system,
          messages: createPayload.messages,
        }),
        requestTimeoutMs,
        "PM_CALL",
      );

      return {
        model,
        message,
      };
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "PM_MODEL_CALL_FAILED";
      continue;
    }
  }

  throw new Error(lastErrorMessage || `사용 가능한 모델을 찾지 못했습니다. 시도한 모델: ${modelCandidates.join(", ")}`);
}

async function createStructuredResponse<T>(
  anthropic: Anthropic,
  createPayload: CreatePayload,
  parser: (value: unknown) => T | null,
  modelCandidates: string[],
  retryLimit: number,
  maxTokens: number,
  requestTimeoutMs: number,
): Promise<StructuredResponseAttempt<T>> {
  let lastText = "";
  let model: string | undefined;

  for (let attempt = 0; attempt < retryLimit; attempt += 1) {
    try {
      const response = await createWithFallback(
        anthropic,
        createPayload,
        modelCandidates,
        maxTokens,
        requestTimeoutMs,
      );
      model = response.model;
      const text = extractText(response.message.content);
      lastText = text;

      const parsedJson = parseJsonResponse(text);
      if (!parsedJson) {
        continue;
      }

      const parsed = parser(parsedJson);
      if (parsed) {
        return {
          parsed,
          lastText,
          model,
        };
      }
    } catch (error) {
      lastText = error instanceof Error ? error.message : "PM_STRUCTURED_RESPONSE_FAILED";
      continue;
    }
  }

  return {
    parsed: null,
    lastText,
    model,
  };
}

export async function runPmOrchestrator(params: {
  anthropic: Anthropic;
  spec: TeamSpec;
  context: UserContext;
  specialistInsights: SpecialistInsight[];
  currentBoard: ExecutionBoard | null;
  messages: TeamRoomMessage[];
  consensusNotes: string[];
}): Promise<{
  payload: ParsedPmPayload | null;
  model?: string;
  method: "primary" | "repair" | "failed";
  rawPreview?: string;
  rawText?: string;
}> {
  const {
    anthropic,
    spec,
    context,
    specialistInsights,
    currentBoard,
    messages,
    consensusNotes,
  } = params;

  const response = await createStructuredResponse(
    anthropic,
    {
      system: getPmOrchestratorPrompt(
        context,
        specialistInsights,
        currentBoard,
        messages,
        consensusNotes,
      ),
      messages: [{ role: "user", content: fallbackUserMessage(messages) }],
    },
    (value) => toPmPayload(value, currentBoard, spec.activeAgents),
    spec.policy.modelCandidates,
    spec.policy.pmRetryLimit,
    1200,
    22000,
  );

  if (response.parsed) {
    return {
      payload: response.parsed,
      model: response.model,
      method: "primary",
      rawText: response.lastText,
    };
  }

  const repairResponse = await createStructuredResponse(
    anthropic,
    {
      system: buildJsonRepairSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `다음 텍스트를 위 JSON 스키마에 맞게 복구하세요.\n\n${response.lastText.slice(0, 7000)}`,
        },
      ],
    },
    (value) => toPmPayload(value, currentBoard, spec.activeAgents),
    spec.policy.modelCandidates,
    1,
    800,
    10000,
  );

  if (repairResponse.parsed) {
    return {
      payload: repairResponse.parsed,
      model: repairResponse.model,
      method: "repair",
      rawPreview: response.lastText.slice(0, 280),
      rawText: repairResponse.lastText,
    };
  }

  return {
    payload: null,
    model: repairResponse.model ?? response.model,
    method: "failed",
    rawPreview: (repairResponse.lastText || response.lastText).slice(0, 280),
    rawText: repairResponse.lastText || response.lastText,
  };
}
