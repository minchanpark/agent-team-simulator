import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  delete (globalThis as typeof globalThis & { __SECURITY_RATE_LIMIT_STORE__?: unknown })
    .__SECURITY_RATE_LIMIT_STORE__;

  if (typeof HTMLElement !== "undefined") {
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        value: vi.fn(),
        writable: true,
      });
    } else {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  }

  vi.restoreAllMocks();
});
