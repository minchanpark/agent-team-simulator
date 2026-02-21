import Anthropic from "@anthropic-ai/sdk";
import { getSpecialistTeamPrompt } from "@/lib/agents/prompts";
import { buildSpecialistFallback, fallbackUserMessage } from "@/lib/team/recovery";
import { extractText, parseJsonResponse, toSpecialistPayload } from "@/lib/team/validators";
import {
  SpecialistAgentType,
  SpecialistInsight,
  SpecialistRunResult,
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
        max_tokens: 1400,
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

export async function runSpecialists(params: {
  anthropic: Anthropic;
  spec: TeamSpec;
  context: UserContext;
  messages: TeamRoomMessage[];
  activeAgents: SpecialistAgentType[];
}): Promise<{
  insights: SpecialistInsight[];
  runs: SpecialistRunResult[];
  hasFallback: boolean;
}> {
  const { anthropic, spec, context, messages, activeAgents } = params;
  const userMessage = fallbackUserMessage(messages);

  const runs = await Promise.all(
    activeAgents.map(async (agentType) => {
      const startedAt = Date.now();

      try {
        const specialistAttempt = await createStructuredResponse(
          anthropic,
          {
            system: getSpecialistTeamPrompt(agentType, context, messages),
            messages: [{ role: "user", content: userMessage }],
          },
          (value) => toSpecialistPayload(value, agentType),
          spec.policy.modelCandidates,
          spec.policy.specialistRetryLimit,
        );

        if (specialistAttempt.parsed) {
          const run: SpecialistRunResult = {
            agentType,
            status: "ok",
            model: specialistAttempt.model,
            latencyMs: Date.now() - startedAt,
            insight: specialistAttempt.parsed,
          };

          return run;
        }

        const fallbackInsight = buildSpecialistFallback(agentType);
        const run: SpecialistRunResult = {
          agentType,
          status: "fallback",
          model: specialistAttempt.model,
          latencyMs: Date.now() - startedAt,
          insight: fallbackInsight,
          error: "SPECIALIST_PARSE_FAILED",
        };

        return run;
      } catch (error) {
        const fallbackInsight = buildSpecialistFallback(agentType);
        const run: SpecialistRunResult = {
          agentType,
          status: "fallback",
          latencyMs: Date.now() - startedAt,
          insight: fallbackInsight,
          error: error instanceof Error ? error.message : "SPECIALIST_UNKNOWN_ERROR",
        };

        return run;
      }
    }),
  );

  return {
    insights: runs.map((run) => run.insight),
    runs,
    hasFallback: runs.some((run) => run.status === "fallback"),
  };
}
