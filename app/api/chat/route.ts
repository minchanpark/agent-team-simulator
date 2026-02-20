import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSystemPrompt } from "@/lib/agents/prompts";
import { AgentType, ChatMessage, ChatRequest, UserContext } from "@/lib/types";

const AGENT_TYPES: AgentType[] = ["marketing", "cs", "data", "dev"];
const DEFAULT_MODEL_CANDIDATES = [
  "claude-sonnet-4-5",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-latest",
  "claude-3-5-haiku-latest",
];

function isAgentType(value: string): value is AgentType {
  return AGENT_TYPES.includes(value as AgentType);
}

function isUserContext(value: unknown): value is UserContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UserContext;

  const hasValidIdea = typeof candidate.idea === "string";
  const hasValidPainPoints =
    Array.isArray(candidate.painPoints) &&
    candidate.painPoints.every((item) => typeof item === "string");
  const hasValidTeamSize =
    candidate.teamSize === "solo" || candidate.teamSize === "small" || candidate.teamSize === "early";

  return hasValidIdea && hasValidPainPoints && hasValidTeamSize;
}

function isMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      (message as ChatMessage).role !== undefined &&
      ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant") &&
      typeof (message as ChatMessage).content === "string",
  );
}

function parseRequest(payload: unknown): ChatRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as Partial<ChatRequest>;

  if (!candidate.agentType || !isAgentType(candidate.agentType)) {
    return null;
  }

  if (!candidate.context || !isUserContext(candidate.context)) {
    return null;
  }

  if (!candidate.messages || !isMessages(candidate.messages)) {
    return null;
  }

  return {
    agentType: candidate.agentType,
    context: candidate.context,
    messages: candidate.messages,
  };
}

function extractText(content: Anthropic.Messages.Message["content"]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function normalizeAssistantMessage(message: string): string {
  return message
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getModelCandidates(): string[] {
  const configuredModel = process.env.ANTHROPIC_MODEL?.trim();
  const models = [configuredModel, ...DEFAULT_MODEL_CANDIDATES].filter(
    (model): model is string => Boolean(model),
  );

  return Array.from(new Set(models));
}

async function createWithFallback(
  anthropic: Anthropic,
  parsedRequest: ChatRequest,
): Promise<Anthropic.Messages.Message> {
  const modelCandidates = getModelCandidates();

  for (const model of modelCandidates) {
    try {
      return await anthropic.messages.create({
        model,
        max_tokens: 1024,
        temperature: 0.4,
        system: getSystemPrompt(parsedRequest.agentType, parsedRequest.context),
        messages: parsedRequest.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });
    } catch (error) {
      if (error instanceof Anthropic.NotFoundError) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `사용 가능한 모델을 찾지 못했습니다. .env.local의 ANTHROPIC_MODEL 값을 확인해 주세요. 시도한 모델: ${modelCandidates.join(
      ", ",
    )}`,
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const payload = await request.json();
    const parsedRequest = parseRequest(payload);

    if (!parsedRequest) {
      return NextResponse.json({ error: "요청 본문 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await createWithFallback(anthropic, parsedRequest);

    const message = normalizeAssistantMessage(extractText(response.content));
    if (!message) {
      return NextResponse.json(
        { error: "AI 응답에서 텍스트를 찾을 수 없습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "예상하지 못한 서버 오류";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
