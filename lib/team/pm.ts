import Anthropic from "@anthropic-ai/sdk";
import { getPmOrchestratorPrompt } from "@/lib/agents/prompts";
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

async function createWithFallback(
  anthropic: Anthropic,
  createPayload: CreatePayload,
  modelCandidates: string[],
): Promise<ModelResponse> {
  for (const model of modelCandidates) {
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens: 2000,
        temperature: 0.2,
        system: createPayload.system,
        messages: createPayload.messages,
      });

      return {
        model,
        message,
      };
    } catch (error) {
      if (error instanceof Anthropic.NotFoundError) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `사용 가능한 모델을 찾지 못했습니다. 시도한 모델: ${modelCandidates.join(", ")}`,
  );
}

async function createStructuredResponse<T>(
  anthropic: Anthropic,
  createPayload: CreatePayload,
  parser: (value: unknown) => T | null,
  modelCandidates: string[],
  retryLimit: number,
): Promise<StructuredResponseAttempt<T>> {
  let lastText = "";
  let model: string | undefined;

  for (let attempt = 0; attempt < retryLimit; attempt += 1) {
    const response = await createWithFallback(anthropic, createPayload, modelCandidates);
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
}): Promise<{ payload: ParsedPmPayload | null; model?: string }> {
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
  );

  return {
    payload: response.parsed,
    model: response.model,
  };
}
