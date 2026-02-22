/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/team/events/route";

describe("/api/team/events", () => {
  it("returns RATE_LIMITED with Retry-After header when limit exceeded", async () => {
    let lastResponse: Response | null = null;

    for (let index = 0; index < 31; index += 1) {
      const request = new Request("https://app.example.com/api/team/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "20.0.0.1",
        },
        body: JSON.stringify({
          event: "team_room_opened",
        }),
      });

      lastResponse = await POST(request);
    }

    expect(lastResponse).not.toBeNull();

    const response = lastResponse as Response;
    const payload = (await response.json()) as { errorCode: string; retryAfterSec?: number };
    expect(response.status).toBe(429);
    expect(payload.errorCode).toBe("RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(payload.retryAfterSec).toBeGreaterThan(0);
  });
});
