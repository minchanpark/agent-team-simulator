/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/team/turn/route";

const originalApiKey = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.SECURITY_GUARDS_ENABLED = "false";
});

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalApiKey;
});

describe("/api/team/turn payload guard", () => {
  it("rejects requests with too many messages", async () => {
    const request = new Request("https://app.example.com/api/team/turn", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "30.0.0.1",
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
        messages: Array.from({ length: 41 }).map((_, index) => ({
          role: "user",
          content: `message-${index}`,
          timestamp: new Date().toISOString(),
        })),
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { errorCode: string; message: string };

    expect(response.status).toBe(400);
    expect(payload.errorCode).toBe("INVALID_REQUEST");
    expect(payload.message).toContain("최대 40개");
  });
});
