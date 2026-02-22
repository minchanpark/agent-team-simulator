/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { ChatRequest } from "@/lib/types";

const originalApiKey = process.env.ANTHROPIC_API_KEY;
const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
const originalSecurityGuardsEnabled = process.env.SECURITY_GUARDS_ENABLED;

function createPayload(): ChatRequest {
  return {
    mode: "diagnosis",
    agentType: "marketing",
    messages: [{ role: "user", content: "안녕하세요" }],
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

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.ALLOWED_ORIGINS;
  process.env.SECURITY_GUARDS_ENABLED = "false";
});

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalApiKey;
  process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  process.env.SECURITY_GUARDS_ENABLED = originalSecurityGuardsEnabled;
});

describe("/api/chat guard", () => {
  it("returns INVALID_REQUEST for wrong content-type", async () => {
    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "x-forwarded-for": "10.0.0.1",
      },
      body: JSON.stringify(createPayload()),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { errorCode: string };

    expect(response.status).toBe(400);
    expect(payload.errorCode).toBe("INVALID_REQUEST");
  });

  it("returns REQUEST_TOO_LARGE for oversized body", async () => {
    const oversizedPayload = createPayload();
    oversizedPayload.messages = [
      {
        role: "user",
        content: "x".repeat(70 * 1024),
      },
    ];

    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.2",
      },
      body: JSON.stringify(oversizedPayload),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { errorCode: string };

    expect(response.status).toBe(413);
    expect(payload.errorCode).toBe("REQUEST_TOO_LARGE");
  });

  it("returns UNSUPPORTED_ORIGIN for mismatched origin", async () => {
    process.env.SECURITY_GUARDS_ENABLED = "true";
    process.env.ALLOWED_ORIGINS = "https://allowed.example.com";

    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example.com",
        "x-forwarded-for": "10.0.0.3",
      },
      body: JSON.stringify(createPayload()),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { errorCode: string };

    expect(response.status).toBe(403);
    expect(payload.errorCode).toBe("UNSUPPORTED_ORIGIN");
  });
});
