import { Link } from "wouter";
import { Settings } from "lucide-react";
import { TutorOsShell } from "../components/shell";

function NotebookHero() {
  return (
    <div className="relative mx-auto mt-8 mb-6 flex h-44 w-44 items-center justify-center">
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-50" />
      <div className="absolute -left-2 top-8 h-16 w-16 rounded-2xl bg-emerald-400/90 rotate-[-12deg] shadow-md" />
      <div className="relative z-10 h-28 w-24 rounded-xl bg-white border-2 border-slate-200 shadow-lg overflow-hidden">
        <div className="h-full w-3 bg-rose-400 absolute left-0" />
        <div className="ml-5 mt-4 space-y-2 pr-3">
          <div className="h-1.5 rounded bg-slate-200" />
          <div className="h-1.5 rounded bg-slate-200 w-4/5" />
          <div className="h-1.5 rounded bg-slate-200 w-3/5" />
          <div className="h-1.5 rounded bg-slate-200 w-4/5" />
        </div>
      </div>
      <div className="absolute right-2 bottom-6 h-20 w-5 rounded-full bg-amber-300 rotate-[28deg] shadow-md" />
      <div className="absolute right-8 bottom-10 h-3 w-3 rounded-full bg-amber-500" />
      <div className="absolute bottom-4 left-10 h-10 w-10 rounded-full bg-lime-300/80" />
    </div>
  );
}

export default function TutorOsHomePage() {
  return (
    <TutorOsShell>
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1865F2]">
              Leigh NHS Tutors
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">TutorOS</h1>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#1865F2] hover:bg-blue-50"
            aria-label="Hours dashboard settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>

        <NotebookHero />

        <div className="text-center px-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Ready to start tutoring?
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            Browse prep tracks, bookmark lessons, and pull up foundations before your next HW Center
            or Tutorial session.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <Link href="/tutoros/explore">
            <span className="inline-flex w-full items-center justify-center rounded-full bg-[#1865F2] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#1557d0]">
              Explore subjects
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="block text-center text-sm font-semibold text-[#1865F2] py-2"
          >
            View my NHS hours
          </Link>
        </div>

        <section className="mt-10 rounded-3xl bg-slate-900 text-white overflow-hidden">
          <div className="relative px-5 pt-8 pb-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(56,189,248,0.35),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(99,102,241,0.35),transparent_40%)]" />
            <div className="relative">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-slate-800/80 border border-white/10">
                <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
                  <path
                    d="M32 8c8 10 12 20 12 30a12 12 0 0 1-24 0c0-10 4-20 12-30Z"
                    fill="#60A5FA"
                  />
                  <circle cx="32" cy="30" r="5" fill="#0B1F4D" />
                  <path d="M22 40l-8 10 10-4 2-6Zm20 0l8 10-10-4-2-6Z" fill="#F97316" />
                  <path d="M28 48h8l-2 8h-4l-2-8Z" fill="#FBBF24" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center">Need to add a class?</h3>
              <p className="mt-2 text-center text-sm text-slate-300 leading-relaxed">
                Jump into a subject track with class codes from your NHS tutoring coordinator, or
                browse open prep materials below.
              </p>
              <Link
                href="/tutoros/explore"
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-base font-semibold text-[#1865F2] shadow-sm transition hover:bg-slate-100"
              >
                Join a track
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 mb-4">
          <h3 className="text-lg font-bold text-slate-900">Recent lessons</h3>
          <p className="mt-1 text-sm text-slate-500">
            Start with Digital SAT Math foundations or Algebra 1 — popular picks for Leigh tutors.
          </p>
          <div className="mt-4 space-y-2">
            <Link
              href="/tutoros/courses/digital-sat-math"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:bg-slate-50 transition"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-white font-bold">
                Σ
              </span>
              <div>
                <p className="font-semibold text-slate-900">Digital SAT Math</p>
                <p className="text-sm text-slate-500">Foundations: Algebra</p>
              </div>
            </Link>
            <Link
              href="/tutoros/courses/algebra-1"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:bg-slate-50 transition"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white font-bold">
                +
              </span>
              <div>
                <p className="font-semibold text-slate-900">Algebra 1</p>
                <p className="text-sm text-slate-500">Linear equations and inequalities</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </TutorOsShell>
  );
}
