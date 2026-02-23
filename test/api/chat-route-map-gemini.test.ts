/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatRequest } from "@/lib/types";

const originalGeminiApiKey = process.env.GEMINI_API_KEY;
const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;

function createMapPayload(): ChatRequest {
  return {
    mode: "generate_map",
    agentType: "marketing",
    messages: [
      {
        role: "user",
        content: "타겟 고객은 40대 이상 소상공인입니다.",
      },
      {
        role: "assistant",
        content: "좋습니다. 목표와 제약도 알려주세요.",
      },
      {
        role: "user",
        content: "월 예산 30만원, 주 15시간, 베타 50명 확보가 목표입니다.",
      },
    ],
    context: {
      idea: "소상공인 홍보 자동화",
      painPoints: ["content_marketing"],
      teamSize: "solo",
      budgetMonthly: 30,
      runwayMonths: 6,
      teamRoles: ["기획", "개발"],
      currentStage: "idea",
      constraints: ["외주 불가"],
    },
  };
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-gemini-key";
  delete process.env.ANTHROPIC_API_KEY;
  process.env.SECURITY_GUARDS_ENABLED = "false";
});

afterEach(() => {
  process.env.GEMINI_API_KEY = originalGeminiApiKey;
  process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/chat generate_map with Gemini", () => {
  it("returns markdown map document without Anthropic key", async () => {
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
          generateContent: async () => ({
            text: [
              "# marketing 에이전트 맵",
              "",
              "## 진단 요약",
              "핵심 제약을 반영해 실행 우선순위를 정리했습니다.",
            ].join("\n"),
          }),
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
        "x-forwarded-for": "40.0.0.11",
      },
      body: JSON.stringify(createMapPayload()),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      mode: string;
      document: { fileName: string; content: string };
    };

    expect(payload.mode).toBe("generate_map");
    expect(payload.document.fileName).toContain("agent-map-marketing-");
    expect(payload.document.content).toContain("# marketing 에이전트 맵");
  });

  it("returns MISSING_API_KEY when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const { POST } = await import("@/app/api/chat/route");

    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "40.0.0.12",
      },
      body: JSON.stringify(createMapPayload()),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { errorCode: string; message: string };

    expect(response.status).toBe(500);
    expect(payload.errorCode).toBe("MISSING_API_KEY");
    expect(payload.message).toContain("GEMINI_API_KEY");
  });
});
