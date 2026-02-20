"use client";

import Link from "next/link";
import AgentCard from "@/components/agents/AgentCard";
import { formatPainPoints, TEAM_SIZE_LABELS, recommendAgents } from "@/lib/agents/recommend";
import { useOnboardingStore } from "@/lib/store/onboarding";

export default function ResultPage() {
  const context = useOnboardingStore((state) => state.context);
  const hasHydrated = useOnboardingStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm font-medium text-slate-600">진단 데이터를 불러오는 중입니다...</p>
      </main>
    );
  }

  const recommendedAgents = recommendAgents(context.painPoints);
  const hasContext = context.idea.trim().length > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 space-y-3">
        <p className="text-sm font-semibold text-teal-700">진단 결과</p>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">추천 AI 에이전트 팀</h1>

        {hasContext ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p>
              <span className="font-semibold">아이디어:</span> {context.idea}
            </p>
            <p className="mt-1">
              <span className="font-semibold">현재 고민:</span> {formatPainPoints(context.painPoints)}
            </p>
            <p className="mt-1">
              <span className="font-semibold">팀 규모:</span> {TEAM_SIZE_LABELS[context.teamSize]}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            아직 진단 데이터가 없습니다. 온보딩을 먼저 진행하면 더 정확한 추천을 받을 수 있습니다.
          </div>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {recommendedAgents.map((agent) => (
          <AgentCard key={agent.type} agent={agent} />
        ))}
      </section>

      <footer className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          진단 다시하기
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          랜딩으로 이동
        </Link>
      </footer>
    </main>
  );
}
