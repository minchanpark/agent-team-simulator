import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "@/components/agents/ChatPanel";
import { AGENT_META } from "@/lib/agents/recommend";
import { useOnboardingStore } from "@/lib/store/onboarding";

describe("ChatPanel rate-limit handling", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setHasHydrated(true);
    useOnboardingStore.getState().replaceContext({
      idea: "테스트 아이디어",
      painPoints: ["content_marketing"],
      teamSize: "solo",
      budgetMonthly: 30,
      runwayMonths: 6,
      teamRoles: ["기획"],
      currentStage: "idea",
      constraints: ["외주 불가"],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("disables composer while retryAfterSec is active", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            errorCode: "RATE_LIMITED",
            message: "요청이 너무 많습니다.",
            recoverable: true,
            requestId: "req_1",
            retryAfterSec: 2,
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    render(<ChatPanel agent={AGENT_META.marketing} context={useOnboardingStore.getState().context} />);

    await waitFor(() => {
      expect(screen.getByText(/요청 제한이 적용되었습니다/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("답변을 입력해 주세요") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
