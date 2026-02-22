import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamRoomView from "@/components/team/TeamRoomView";
import { useOnboardingStore } from "@/lib/store/onboarding";

describe("TeamRoomView rate-limit handling", () => {
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

  it("shows cooldown message and blocks input on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/api/team/events")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.includes("/api/team/turn")) {
          return new Response(
            JSON.stringify({
              errorCode: "RATE_LIMITED",
              message: "요청이 너무 많습니다.",
              recoverable: true,
              requestId: "req_2",
              retryAfterSec: 2,
            }),
            {
              status: 429,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const user = userEvent.setup();
    render(<TeamRoomView />);

    const input = screen.getByPlaceholderText("팀이 해결해야 할 문제를 입력하세요") as HTMLInputElement;
    await user.type(input, "우선순위 점검");
    await user.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => {
      expect(screen.getByText(/요청 제한이 적용되었습니다/)).toBeInTheDocument();
    });
    expect(input.disabled).toBe(true);
  });
});
