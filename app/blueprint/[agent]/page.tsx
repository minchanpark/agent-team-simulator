import Link from "next/link";
import { notFound } from "next/navigation";
import Card from "@/components/ui/Card";
import { BLUEPRINTS } from "@/lib/agents/blueprints";
import { AGENT_META, isAgentType } from "@/lib/agents/recommend";

interface BlueprintPageProps {
  params: {
    agent: string;
  };
}

function renderDifficulty(level: number): string {
  return "★".repeat(level) + "☆".repeat(5 - level);
}

export default function BlueprintPage({ params }: BlueprintPageProps) {
  if (!isAgentType(params.agent)) {
    notFound();
  }

  const agent = AGENT_META[params.agent];
  const blueprint = BLUEPRINTS[params.agent];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 space-y-3">
        <p className="text-sm font-semibold text-teal-700">구현 청사진</p>
        <h1 className="text-3xl font-black text-slate-900">
          {agent.emoji} {agent.name} 실행 계획
        </h1>
        <p className="text-sm text-slate-600">{agent.summary}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Card>
          <h2 className="text-lg font-bold text-slate-900">실행 단계</h2>
          <ol className="mt-4 space-y-3">
            {blueprint.steps.map((step, index) => (
              <li key={step} className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <span className="mr-2 font-semibold text-slate-900">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-900">구성 정보</h2>

          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">필요 도구</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {blueprint.tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {tool}
                  </span>
                ))}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">예상 비용</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{blueprint.cost}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">난이도</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {renderDifficulty(blueprint.difficulty)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <footer className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/result/${agent.type}`}
          className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          에이전트와 계속 대화하기
        </Link>
        <Link
          href="/result"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          추천 결과로 이동
        </Link>
      </footer>
    </main>
  );
}
