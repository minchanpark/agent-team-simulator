import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import OnboardingForm from "@/components/onboarding/OnboardingForm";
import { useOnboardingStore } from "@/lib/store/onboarding";

describe("onboarding flow smoke", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setHasHydrated(true);
  });

  it("moves through onboarding steps and reflects summary", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);

    await user.type(screen.getByPlaceholderText("예: 소상공인을 위한 AI 인스타그램 콘텐츠 자동화 도구"), "테스트 아이디어");
    await user.click(screen.getByRole("button", { name: "다음" }));

    await user.click(screen.getByText("콘텐츠/마케팅"));
    await user.click(screen.getByRole("button", { name: "다음" }));

    await user.click(screen.getByText("2~3인 팀"));
    await user.click(screen.getByText("MVP 개발"));
    await user.click(screen.getByRole("button", { name: "다음" }));

    await user.type(screen.getByPlaceholderText("예: 50"), "50");
    await user.type(screen.getByPlaceholderText("예: 6"), "6");
    await user.type(screen.getByPlaceholderText("예: PM, 프론트엔드, 백엔드"), "PM, 개발");
    await user.type(screen.getByPlaceholderText("예: 외주 불가\\n2개월 내 베타 출시"), "외주 불가");

    expect(screen.getByText(/아이디어:/)).toBeInTheDocument();
    expect(screen.getByText(/테스트 아이디어/)).toBeInTheDocument();
  });
});
