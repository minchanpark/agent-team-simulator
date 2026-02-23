/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSseEvents } from "@/lib/chat/sse";
import { ChatRequest } from "@/lib/types";

const originalApiKey = process.env.ANTHROPIC_API_KEY;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;

function createDiagnosisPayload(): ChatRequest {
  return {
    mode: "diagnosis",
    agentType: "marketing",
    messages: [
      {
        role: "user",
        content: "이번 분기 목표를 아직 정리하지 못했어요.",
      },
    ],
    context: {
      idea: "테스트 아이디어",
      painPoints: ["content_marketing"],
      teamSize: "solo",
      budgetMonthly: 50,
      runwayMonths: 6,
      teamRoles: ["기획"],
      currentStage: "idea",
      constraints: ["외주 불가"],
    },
  };
}

async function readSseEvents(response: Response): Promise<Array<{ event: string; data: unknown }>> {
  const reader = response.body?.getReader();
  expect(reader).toBeTruthy();

  const decoder = new TextDecoder();
  let buffered = "";

  while (true) {
    const result = await reader!.read();
    if (result.done) {
      break;
    }

    buffered += decoder.decode(result.value, { stream: true });
  }

  buffered += decoder.decode();
  const parsed = parseSseEvents(buffered);
  const events = [...parsed.events];

  if (parsed.remaining.trim().length > 0) {
    const flushed = parseSseEvents(`${parsed.remaining}\n\n`);
    events.push(...flushed.events);
  }

  return events;
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.SECURITY_GUARDS_ENABLED = "false";
});

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalApiKey;
  process.env.GEMINI_API_KEY = originalGeminiApiKey;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/chat diagnosis streaming", () => {
  it("returns SSE events with token and done payload", async () => {
    vi.doMock("@google/genai", () => {
      class MockApiError extends Error {
        status: number;

        constructor(message: string, status = 500) {
          super(message);
          this.name = "ApiError";
          this.status = status;
        }
      }

      class MockGoogleGenAI {
        models = {
          generateContentStream: async () => {
            async function* generate() {
              yield {
                text: "질문: 이번 분기 핵심 목표를 수치로 알려주세요.",
              };
              yield {
                text: "\n이유: 목표 수치를 알아야 마케팅 실행 우선순위를 정할 수 있습니다.",
              };
              yield {
                text: "\n예시 답변: 베타 50명 확보 / 주간 활성 100명 / 유료 전환 10건",
              };
            }

            return generate();
          },
        };
      }

      return {
        ApiError: MockApiError,
        GoogleGenAI: MockGoogleGenAI,
      };
    });

    const { POST } = await import("@/app/api/chat/route");

    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "40.0.0.1",
      },
      body: JSON.stringify(createDiagnosisPayload()),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSseEvents(response);
    const tokenEvents = events.filter((event) => event.event === "token");
    const doneEvent = events.find((event) => event.event === "done");

    expect(tokenEvents.length).toBeGreaterThan(0);
    expect(doneEvent).toBeTruthy();

    const doneData = doneEvent?.data as {
      message: string;
      progress: { completed: string[]; missing: string[]; readyForMap: boolean };
    };
    expect(doneData.message).toContain("질문:");
    expect(doneData.progress.completed).toEqual(["goal"]);
    expect(doneData.progress.missing).toEqual(["bottleneck", "target", "resource", "metric"]);
    expect(doneData.progress.readyForMap).toBe(false);
  });

  it("emits error SSE event when upstream stream fails", async () => {
    vi.doMock("@google/genai", () => {
      class MockApiError extends Error {
        status: number;

        constructor(message: string, status = 502) {
          super(message);
          this.name = "ApiError";
          this.status = status;
        }
      }

      class MockGoogleGenAI {
        models = {
          generateContentStream: async () => {
            throw new MockApiError("upstream failure");
          },
        };
      }

      return {
        ApiError: MockApiError,
        GoogleGenAI: MockGoogleGenAI,
      };
    });

    const { POST } = await import("@/app/api/chat/route");

    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "40.0.0.2",
      },
      body: JSON.stringify(createDiagnosisPayload()),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSseEvents(response);
    const errorEvent = events.find((event) => event.event === "error");

    expect(errorEvent).toBeTruthy();

    const errorData = errorEvent?.data as { errorCode: string; recoverable: boolean; requestId: string };
    expect(errorData.errorCode).toBe("UPSTREAM_UNAVAILABLE");
    expect(errorData.recoverable).toBe(true);
    expect(errorData.requestId).toBeTruthy();
  });

  it("emits rate-limited SSE event when Gemini quota is exceeded", async () => {
    vi.doMock("@google/genai", () => {
      class MockApiError extends Error {
        status: number;

        constructor(message: string, status = 429) {
          super(message);
          this.name = "ApiError";
          this.status = status;
        }
      }

      class MockGoogleGenAI {
        models = {
          generateContentStream: async () => {
            throw new MockApiError("quota exceeded");
          },
        };
      }

      return {
        ApiError: MockApiError,
        GoogleGenAI: MockGoogleGenAI,
      };
    });

    const { POST } = await import("@/app/api/chat/route");

    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "40.0.0.3",
      },
      body: JSON.stringify(createDiagnosisPayload()),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSseEvents(response);
    const errorEvent = events.find((event) => event.event === "error");

    expect(errorEvent).toBeTruthy();

    const errorData = errorEvent?.data as {
      errorCode: string;
      message: string;
      recoverable: boolean;
      retryAfterSec?: number;
      requestId: string;
    };
    expect(errorData.errorCode).toBe("RATE_LIMITED");
    expect(errorData.message).toContain("사용량 한도");
    expect(errorData.recoverable).toBe(true);
    expect(errorData.retryAfterSec).toBe(60);
    expect(errorData.requestId).toBeTruthy();
  });
});
