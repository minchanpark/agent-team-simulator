"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  PAIN_POINT_OPTIONS,
  STAGE_OPTIONS,
  TEAM_SIZE_OPTIONS,
} from "@/lib/agents/recommend";
import { useOnboardingStore } from "@/lib/store/onboarding";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react") as typeof import("react");

const TOTAL_STEPS = 4;

function parseListInput(raw: string): string[] {
  return raw
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function OnboardingForm() {
  const context = useOnboardingStore((state) => state.context);
  const setIdea = useOnboardingStore((state) => state.setIdea);
  const togglePainPoint = useOnboardingStore((state) => state.togglePainPoint);
  const setTeamSize = useOnboardingStore((state) => state.setTeamSize);
  const setBudgetMonthly = useOnboardingStore((state) => state.setBudgetMonthly);
  const setRunwayMonths = useOnboardingStore((state) => state.setRunwayMonths);
  const setTeamRoles = useOnboardingStore((state) => state.setTeamRoles);
  const setCurrentStage = useOnboardingStore((state) => state.setCurrentStage);
  const setConstraints = useOnboardingStore((state) => state.setConstraints);

  const [step, setStep] = React.useState(1);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [teamRolesInput, setTeamRolesInput] = React.useState(context.teamRoles.join(", "));
  const [constraintsInput, setConstraintsInput] = React.useState(context.constraints.join("\n"));

  const progressClassName =
    step === 1 ? "w-1/4" : step === 2 ? "w-2/4" : step === 3 ? "w-3/4" : "w-full";

  const validateCurrentStep = (): boolean => {
    if (step === 1 && context.idea.trim().length === 0) {
      setErrorMessage("아이디어 한 줄 설명을 입력해 주세요.");
      return false;
    }

    if (step === 2 && context.painPoints.length === 0) {
      setErrorMessage("현재 가장 힘든 업무를 1개 이상 선택해 주세요.");
      return false;
    }

    if (step === 4) {
      const parsedRoles = parseListInput(teamRolesInput);
      const parsedConstraints = parseListInput(constraintsInput);

      if (context.budgetMonthly === null || context.budgetMonthly < 0) {
        setErrorMessage("월 예산을 숫자로 입력해 주세요. (예: 50)");
        return false;
      }

      if (context.runwayMonths === null || context.runwayMonths <= 0) {
        setErrorMessage("런웨이(개월)를 입력해 주세요. (예: 6)");
        return false;
      }

      if (parsedRoles.length === 0) {
        setErrorMessage("팀 역할을 1개 이상 입력해 주세요.");
        return false;
      }

      if (parsedConstraints.length === 0) {
        setErrorMessage("제약 조건을 1개 이상 입력해 주세요.");
        return false;
      }
    }

    setErrorMessage(null);
    return true;
  };

  const handleNext = () => {
    if (isTransitioning) {
      return;
    }

    if (step === 4) {
      setTeamRoles(parseListInput(teamRolesInput));
      setConstraints(parseListInput(constraintsInput));
    }

    if (!validateCurrentStep()) {
      return;
    }

    if (step === TOTAL_STEPS) {
      setIsTransitioning(true);
      window.location.assign("/result");
      return;
    }

    setStep((current) => current + 1);
  };

  const handlePrev = () => {
    if (isTransitioning) {
      return;
    }

    setErrorMessage(null);
    setStep((current) => Math.max(1, current - 1));
  };

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-medium text-teal-700">
            진단 {step} / {TOTAL_STEPS}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            팀 상황을 기반으로 AI 팀룸을 구성합니다
          </h1>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div className={["h-full rounded-full bg-teal-600 transition-all", progressClassName].join(" ")} />
          </div>
        </header>

        {step === 1 && (
          <section className="space-y-3" aria-labelledby="idea-label">
            <label id="idea-label" htmlFor="idea" className="text-sm font-semibold text-slate-800">
              1. 아이디어를 한 줄로 설명해 주세요
            </label>
            <textarea
              id="idea"
              rows={5}
              value={context.idea}
              placeholder="예: 소상공인을 위한 AI 인스타그램 콘텐츠 자동화 도구"
              onChange={(event) => setIdea(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3" aria-labelledby="pain-points-label">
            <h2 id="pain-points-label" className="text-sm font-semibold text-slate-800">
              2. 지금 가장 어려운 업무를 선택해 주세요 (복수 선택)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {PAIN_POINT_OPTIONS.map((option) => {
                const isSelected = context.painPoints.includes(option.value);

                return (
                  <label
                    key={option.value}
                    className={[
                      "cursor-pointer rounded-xl border p-4 transition-colors",
                      isSelected
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => togglePainPoint(option.value)}
                    />
                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4" aria-labelledby="team-context-label">
            <h2 id="team-context-label" className="text-sm font-semibold text-slate-800">
              3. 현재 팀 규모와 단계를 선택해 주세요
            </h2>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">팀 규모</p>
              {TEAM_SIZE_OPTIONS.map((option) => {
                const isSelected = context.teamSize === option.value;

                return (
                  <label
                    key={option.value}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                      isSelected
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="teamSize"
                      checked={isSelected}
                      onChange={() => setTeamSize(option.value)}
                      className="mt-1 h-4 w-4 accent-teal-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                      <span className="block text-sm text-slate-600">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">현재 단계</p>
              {STAGE_OPTIONS.map((option) => {
                const isSelected = context.currentStage === option.value;

                return (
                  <label
                    key={option.value}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                      isSelected
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="currentStage"
                      checked={isSelected}
                      onChange={() => setCurrentStage(option.value)}
                      className="mt-1 h-4 w-4 accent-teal-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                      <span className="block text-sm text-slate-600">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4" aria-labelledby="resource-label">
            <h2 id="resource-label" className="text-sm font-semibold text-slate-800">
              4. 리소스와 제약 조건을 입력해 주세요
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-800">월 예산 (만원)</span>
                <input
                  type="number"
                  min={0}
                  value={context.budgetMonthly ?? ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setBudgetMonthly(value.length > 0 ? Number(value) : null);
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  placeholder="예: 50"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-800">런웨이 (개월)</span>
                <input
                  type="number"
                  min={1}
                  value={context.runwayMonths ?? ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setRunwayMonths(value.length > 0 ? Number(value) : null);
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  placeholder="예: 6"
                />
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-800">팀 역할 (콤마 또는 줄바꿈으로 구분)</span>
              <textarea
                rows={3}
                value={teamRolesInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setTeamRolesInput(value);
                  setTeamRoles(parseListInput(value));
                }}
                placeholder="예: PM, 프론트엔드, 백엔드"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-800">제약 조건 (콤마 또는 줄바꿈으로 구분)</span>
              <textarea
                rows={4}
                value={constraintsInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setConstraintsInput(value);
                  setConstraints(parseListInput(value));
                }}
                placeholder="예: 외주 불가\n2개월 내 베타 출시"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </section>
        )}

        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={handlePrev} disabled={step === 1 || isTransitioning}>
            이전
          </Button>
          <Button onClick={handleNext} disabled={isTransitioning}>
            {step === TOTAL_STEPS ? (isTransitioning ? "이동 중..." : "결과 보기") : "다음"}
          </Button>
        </footer>
      </div>
    </Card>
  );
}

export default OnboardingForm;
