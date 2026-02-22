/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit";

describe("rate-limit", () => {
  it("enforces per-minute limits", () => {
    const key = "chat:127.0.0.1";
    const policy = {
      perMinute: 2,
      perDay: 20,
    };

    const first = checkRateLimit(key, policy);
    const second = checkRateLimit(key, policy);
    const third = checkRateLimit(key, policy);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.reason).toBe("minute");
    expect(typeof third.retryAfterSec).toBe("number");
  });

  it("resets minute window after ttl", () => {
    const key = "chat:127.0.0.2";
    const policy = {
      perMinute: 1,
      perDay: 20,
    };

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_700_000_000_000);

    expect(checkRateLimit(key, policy).ok).toBe(true);
    expect(checkRateLimit(key, policy).ok).toBe(false);

    nowSpy.mockReturnValue(1_700_000_061_000);
    expect(checkRateLimit(key, policy).ok).toBe(true);
  });

  it("enforces per-day limits", () => {
    const key = "chat:127.0.0.3";
    const policy = {
      perMinute: 100,
      perDay: 2,
    };

    expect(checkRateLimit(key, policy).ok).toBe(true);
    expect(checkRateLimit(key, policy).ok).toBe(true);

    const result = checkRateLimit(key, policy);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("day");
  });
});
