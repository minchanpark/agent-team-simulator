/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalApiKey = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.SECURITY_GUARDS_ENABLED = "false";
});

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalApiKey;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("/api/team/turn upstream error mapping", () => {
  it("maps Anthropic API error to UPSTREAM_UNAVAILABLE", async () => {
    vi.mock("@anthropic-ai/sdk", () => {
      class MockAPIError extends Error {
        status: number;

        constructor(message: string) {
          super(message);
          this.status = 502;
        }
      }

      class MockAnthropic {
        static APIError = MockAPIError;
      }

      return {
        default: MockAnthropic,
      };
    });

    vi.mock("@/lib/team/orchestrator", () => {
      return {
        orchestrateTeamTurn: async () => {
          const errorClass = (await import("@anthropic-ai/sdk")).default.APIError as {
            new (message: string): Error;
          };
          throw new errorClass("sensitive upstream reason");
        },
      };
    });

    const { POST } = await import("@/app/api/team/turn/route");

    const request = new Request("https://app.example.com/api/team/turn", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.4",
      },
      body: JSON.stringify({
        context: {
          idea: "테스트",
          painPoints: ["content_marketing"],
          teamSize: "solo",
          budgetMonthly: 30,
          runwayMonths: 6,
          teamRoles: ["기획"],
          currentStage: "idea",
          constraints: ["외주 불가"],
        },
        messages: [
          {
            role: "user",
            content: "실행보드 만들어줘",
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { errorCode: string; message: string };

    expect(response.status).toBe(502);
    expect(payload.errorCode).toBe("UPSTREAM_UNAVAILABLE");
    expect(payload.message).not.toContain("sensitive upstream reason");
  });
});
