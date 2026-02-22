"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  formatConstraints,
  formatPainPoints,
  formatTeamRoles,
  PAIN_POINT_OPTIONS,
  STAGE_LABELS,
  STAGE_OPTIONS,
  TEAM_SIZE_LABELS,
  TEAM_SIZE_OPTIONS,
} from "@/lib/agents/recommend";
import { useOnboardingStore } from "@/lib/store/onboarding";
import { PainPoint, UserContext } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react") as typeof import("react");

const TOTAL_STEPS = 4;

interface PresetOption {
  id: string;
  name: string;
  description: string;
  context: UserContext;
}

type OnboardingErrorKey =
  | "idea"
  | "painPoints"
  | "budgetMonthly"
  | "runwayMonths"
  | "teamRoles"
  | "constraints";

type OnboardingErrorMap = Partial<Record<OnboardingErrorKey, string>>;

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: "content_saas",
    name: "콘텐츠 자동화 SaaS",
    description: "1인 창업자 대상 마케팅 콘텐츠 자동 생성 도구",
    context: {
      idea: "소상공인을 위한 AI SNS 콘텐츠 자동화 도구",
      painPoints: ["content_marketing", "product_development"],
      teamSize: "solo",
      budgetMonthly: 50,
      runwayMonths: 6,
      teamRoles: ["기획", "개발"],
      currentStage: "mvp",
      constraints: ["외주 불가", "주당 20시간 이내"],
    },
  },
  {
    id: "education_coach",
    name: "학습 코칭 앱",
    description: "대학생 대상 학습 습관 코칭/리마인더 서비스",
    context: {
      idea: "대학생을 위한 AI 학습 습관 코칭 앱",
      painPoints: ["customer_support", "data_analysis"],
      teamSize: "small",
      budgetMonthly: 80,
      runwayMonths: 8,
      teamRoles: ["PM", "디자인", "개발"],
      currentStage: "beta",
      constraints: ["2개월 내 베타 개선", "주요 지표 주간 점검"],
    },
  },
  {
    id: "b2b_ops",
    name: "B2B 운영 자동화",
    description: "초기 팀 운영/고객응대/리포트 자동화 솔루션",
    context: {
      idea: "중소기업 운영팀을 위한 업무 자동화 AI 어시스턴트",
      painPoints: ["customer_support", "data_analysis", "product_development"],
      teamSize: "early",
      budgetMonthly: 120,
      runwayMonths: 10,
      teamRoles: ["대표", "운영", "개발", "세일즈"],
      currentStage: "launch",
      constraints: ["보안 규정 준수", "고객사 커스텀 요구 반영"],
    },
  },
];

function parseListInput(raw: string): string[] {
  return raw
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function downloadSnapshot(content: string): void {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `onboarding-snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function OnboardingForm() {
  const context = useOnboardingStore((state) => state.context);
  const storageMode = useOnboardingStore((state) => state.storageMode);
  const setStorageMode = useOnboardingStore((state) => state.setStorageMode);
  const exportSnapshot = useOnboardingStore((state) => state.exportSnapshot);
  const importSnapshot = useOnboardingStore((state) => state.importSnapshot);
  const replaceContext = useOnboardingStore((state) => state.replaceContext);
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
  const [presetId, setPresetId] = React.useState("");
  const [errors, setErrors] = React.useState<OnboardingErrorMap>({});
  const [snapshotMessage, setSnapshotMessage] = React.useState<string | null>(null);

  const [teamRolesInput, setTeamRolesInput] = React.useState(context.teamRoles.join(", "));
  const [constraintsInput, setConstraintsInput] = React.useState(context.constraints.join("\n"));

  const snapshotInputRef = React.useRef<HTMLInputElement | null>(null);

  const progressClassName =
    step === 1 ? "w-1/4" : step === 2 ? "w-2/4" : step === 3 ? "w-3/4" : "w-full";

  const validateCurrentStep = (): boolean => {
    const nextErrors: OnboardingErrorMap = {};

    if (step === 1 && context.idea.trim().length === 0) {
      nextErrors.idea = "아이디어 한 줄 설명을 입력해 주세요.";
    }

    if (step === 2 && context.painPoints.length === 0) {
      nextErrors.painPoints = "현재 가장 힘든 업무를 1개 이상 선택해 주세요.";
    }

    if (step === 4) {
      const parsedRoles = parseListInput(teamRolesInput);
      const parsedConstraints = parseListInput(constraintsInput);

      if (context.budgetMonthly === null || context.budgetMonthly < 0) {
        nextErrors.budgetMonthly = "월 예산을 0 이상의 숫자로 입력해 주세요.";
      }

      if (context.runwayMonths === null || context.runwayMonths <= 0) {
        nextErrors.runwayMonths = "런웨이(개월)를 1 이상으로 입력해 주세요.";
      }

      if (parsedRoles.length === 0) {
        nextErrors.teamRoles = "팀 역할을 1개 이상 입력해 주세요.";
      }

      if (parsedConstraints.length === 0) {
        nextErrors.constraints = "제약 조건을 1개 이상 입력해 주세요.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleApplyPreset = () => {
    const selectedPreset = PRESET_OPTIONS.find((item) => item.id === presetId);
    if (!selectedPreset) {
      return;
    }

    replaceContext(selectedPreset.context);
    setTeamRolesInput(selectedPreset.context.teamRoles.join(", "));
    setConstraintsInput(selectedPreset.context.constraints.join("\n"));
    setErrors({});
    setSnapshotMessage(`프리셋 적용 완료: ${selectedPreset.name}`);
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

    setErrors({});
    setStep((current) => Math.max(1, current - 1));
  };

  const handleExportSnapshot = () => {
    const snapshot = exportSnapshot();
    downloadSnapshot(snapshot);
    setSnapshotMessage("스냅샷을 다운로드했습니다.");
  };

  const handleImportSnapshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const result = importSnapshot(text);

    if (result.ok) {
      setTeamRolesInput(useOnboardingStore.getState().context.teamRoles.join(", "));
      setConstraintsInput(useOnboardingStore.getState().context.constraints.join("\n"));
      setSnapshotMessage("스냅샷을 불러왔습니다.");
      setErrors({});
    } else {
      setSnapshotMessage(result.error ?? "스냅샷 불러오기에 실패했습니다.");
    }

    if (snapshotInputRef.current) {
      snapshotInputRef.current.value = "";
    }
  };

  const updatePainPoint = (value: PainPoint) => {
    togglePainPoint(value);
    if (errors.painPoints) {
      setErrors((current) => ({
        ...current,
        painPoints: undefined,
      }));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
      <Card className="w-full">
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

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">예시 프리셋</h2>
            <p className="text-xs text-slate-600">기본 입력을 빠르게 채워 진단 흐름을 테스트할 수 있습니다.</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={presetId}
                onChange={(event) => setPresetId(event.target.value)}
                className="h-10 flex-1 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="">프리셋 선택</option>
                {PRESET_OPTIONS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} · {preset.description}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={handleApplyPreset} disabled={!presetId}>
                프리셋 적용
              </Button>
            </div>
          </section>

          {step === 1 && (
            <section className="space-y-2" aria-labelledby="idea-label">
              <label id="idea-label" htmlFor="idea" className="text-sm font-semibold text-slate-800">
                1. 아이디어를 한 줄로 설명해 주세요
              </label>
              <textarea
                id="idea"
                rows={5}
                value={context.idea}
                placeholder="예: 소상공인을 위한 AI 인스타그램 콘텐츠 자동화 도구"
                onChange={(event) => {
                  setIdea(event.target.value);
                  if (errors.idea) {
                    setErrors((current) => ({ ...current, idea: undefined }));
                  }
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              {errors.idea && <p className="text-xs text-red-600">{errors.idea}</p>}
            </section>
          )}

          {step === 2 && (
            <section className="space-y-2" aria-labelledby="pain-points-label">
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
                        isSelected ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => updatePainPoint(option.value)}
                      />
                      <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                    </label>
                  );
                })}
              </div>
              {errors.painPoints && <p className="text-xs text-red-600">{errors.painPoints}</p>}
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
                        isSelected ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300",
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
                        isSelected ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300",
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
                      if (errors.budgetMonthly) {
                        setErrors((current) => ({ ...current, budgetMonthly: undefined }));
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="예: 50"
                  />
                  {errors.budgetMonthly && <p className="text-xs text-red-600">{errors.budgetMonthly}</p>}
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
                      if (errors.runwayMonths) {
                        setErrors((current) => ({ ...current, runwayMonths: undefined }));
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="예: 6"
                  />
                  {errors.runwayMonths && <p className="text-xs text-red-600">{errors.runwayMonths}</p>}
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
                    if (errors.teamRoles) {
                      setErrors((current) => ({ ...current, teamRoles: undefined }));
                    }
                  }}
                  placeholder="예: PM, 프론트엔드, 백엔드"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
                {errors.teamRoles && <p className="text-xs text-red-600">{errors.teamRoles}</p>}
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
                    if (errors.constraints) {
                      setErrors((current) => ({ ...current, constraints: undefined }));
                    }
                  }}
                  placeholder="예: 외주 불가\n2개월 내 베타 출시"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
                {errors.constraints && <p className="text-xs text-red-600">{errors.constraints}</p>}
              </label>
            </section>
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

      <div className="space-y-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">입력 요약</h2>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>
              <span className="font-semibold">아이디어:</span> {context.idea || "미입력"}
            </p>
            <p>
              <span className="font-semibold">고민:</span> {formatPainPoints(context.painPoints)}
            </p>
            <p>
              <span className="font-semibold">팀 규모:</span> {TEAM_SIZE_LABELS[context.teamSize]}
            </p>
            <p>
              <span className="font-semibold">현재 단계:</span> {STAGE_LABELS[context.currentStage]}
            </p>
            <p>
              <span className="font-semibold">월 예산:</span>{" "}
              {context.budgetMonthly !== null ? `${context.budgetMonthly}만원` : "미입력"}
            </p>
            <p>
              <span className="font-semibold">런웨이:</span>{" "}
              {context.runwayMonths !== null ? `${context.runwayMonths}개월` : "미입력"}
            </p>
            <p>
              <span className="font-semibold">팀 역할:</span> {formatTeamRoles(context.teamRoles)}
            </p>
            <p>
              <span className="font-semibold">제약 조건:</span> {formatConstraints(context.constraints)}
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">저장/복원</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={storageMode === "session" ? "primary" : "secondary"}
              onClick={() => setStorageMode("session")}
            >
              세션 저장
            </Button>
            <Button
              type="button"
              variant={storageMode === "local" ? "primary" : "secondary"}
              onClick={() => setStorageMode("local")}
            >
              로컬 저장
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleExportSnapshot}>
              스냅샷 내보내기
            </Button>
            <Button type="button" variant="ghost" onClick={() => snapshotInputRef.current?.click()}>
              스냅샷 가져오기
            </Button>
            <input
              ref={snapshotInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportSnapshot}
            />
          </div>

          <p className="mt-2 text-xs text-slate-600">
            현재 저장 모드: {storageMode === "local" ? "로컬 저장소(브라우저 종료 후 유지)" : "세션 저장소(브라우저 탭 종료 시 초기화)"}
          </p>

          {snapshotMessage && (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {snapshotMessage}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

export default OnboardingForm;
