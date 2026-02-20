import Link from "next/link";

const highlights = [
  {
    title: "3분 진단",
    description: "아이디어/고민/팀 상황을 입력하면 바로 에이전트 팀을 추천합니다.",
  },
  {
    title: "실전 대화",
    description: "마케팅, CS, 데이터, 개발보조 에이전트와 즉시 대화할 수 있습니다.",
  },
  {
    title: "구현 청사진",
    description: "도구, 단계, 예상 비용까지 포함한 실행 계획을 받아볼 수 있습니다.",
  },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(20,184,166,0.15),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(251,146,60,0.18),transparent_40%)]" />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div className="space-y-6">
            <p className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-700">
              AI Agent Team Simulator
            </p>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              아이디어를
              <br className="hidden sm:block" />
              실행 가능한 AI 팀으로 바꾸세요
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              예비창업자를 위한 AI 코파일럿 서비스입니다. 스타트업 상황을 입력하면,
              역할별 에이전트 팀을 추천하고 바로 대화와 구현 청사진까지 제공합니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                진단 시작하기
              </Link>
              <Link
                href="/result"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              >
                추천 결과 미리보기
              </Link>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">이번 MVP에서 제공하는 기능</h2>
            <ul className="mt-4 space-y-3">
              {highlights.map((item) => (
                <li key={item.title} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
