import Link from "next/link";
import OnboardingForm from "@/components/onboarding/OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-120px)] w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">스타트업 진단</h1>
        <Link
          href="/"
          className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
        >
          랜딩으로 돌아가기
        </Link>
      </div>

      <OnboardingForm />
    </main>
  );
}
