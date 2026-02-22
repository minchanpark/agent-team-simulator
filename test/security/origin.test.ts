/** @vitest-environment node */

import { afterEach, describe, expect, it } from "vitest";
import { validateOrigin } from "@/lib/security/origin";

const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
const originalSecurityGuardsEnabled = process.env.SECURITY_GUARDS_ENABLED;

afterEach(() => {
  process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  process.env.SECURITY_GUARDS_ENABLED = originalSecurityGuardsEnabled;
});

describe("origin validation", () => {
  it("allows same-origin requests when ALLOWED_ORIGINS is empty", () => {
    process.env.SECURITY_GUARDS_ENABLED = "true";
    delete process.env.ALLOWED_ORIGINS;

    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ok: true }),
    });

    const result = validateOrigin(request);
    expect(result.allowed).toBe(true);
  });

  it("blocks disallowed origins", () => {
    process.env.SECURITY_GUARDS_ENABLED = "true";
    process.env.ALLOWED_ORIGINS = "https://allowed.example.com";

    const request = new Request("https://app.example.com/api/chat", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ok: true }),
    });

    const result = validateOrigin(request);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("origin_not_allowed");
  });
});
