import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, PlayCircle, Sparkles } from "lucide-react";
import { TutorOsShell } from "../components/shell";
import { listMySessions, type SessionListResponse } from "../lib/api";

export default function TutorOsHomePage() {
  const [data, setData] = useState<SessionListResponse | null>(null);

  useEffect(() => {
    listMySessions()
      .then(setData)
      .catch(() => setData({ sessions: [], stats: { total: 0, learningMoments: 0, unverified: 0, awaitingVerify: 0 } }));
  }, []);

  const stats = data?.stats;
  const recent = data?.sessions.slice(0, 3) ?? [];

  return (
    <TutorOsShell>
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1865F2]">
              Leigh NHS Tutors
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">TutorOS</h1>
            <p className="mt-1 text-sm text-slate-500">Memory for peer tutoring</p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-3 py-2 text-center">
            <p className="text-2xl font-bold text-[#1865F2] leading-none">
              {stats?.learningMoments ?? 0}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#1865F2]">
              Moments
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-8 mb-6 flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-50" />
          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#1865F2] text-white shadow-lg">
            <Sparkles className="h-10 w-10" />
          </div>
        </div>

        <div className="text-center px-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Ready to start tutoring?
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            Prep from memory, verify learning in 30 seconds, and give officers proof that tutoring
            worked — without listening in.
          </p>
        </div>

        <div className="mt-8">
          <Link href="/tutoros/start">
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1865F2] px-6 py-3.5 text-base font-semibold text-white shadow-sm">
              <PlayCircle className="h-5 w-5" />
              Start Session
            </span>
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <Stat label="Sessions" value={stats?.total ?? 0} />
          <Stat label="Verified" value={stats?.learningMoments ?? 0} />
          <Stat label="Pending" value={stats?.awaitingVerify ?? 0} />
        </div>

        <section className="mt-8 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Recent sessions</h3>
            <Link href="/tutoros/history" className="text-sm font-semibold text-[#1865F2]">
              See all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No sessions yet. Try the demo: Maria · Algebra II · factoring.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent.map((session) => (
                <li key={session.id}>
                  <Link
                    href={
                      session.status === "awaiting_verify"
                        ? `/tutoros/verify/${session.id}`
                        : `/tutoros/session/${session.id}`
                    }
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1865F2]">
                      {session.learningMoment ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <PlayCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {session.tuteeName} · {session.topic}
                      </p>
                      <p className="text-sm text-slate-500">
                        {session.subject}
                        {session.verifyScore != null ? ` · ${session.verifyScore}/5` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mb-6 text-center text-xs text-slate-400">
          PREP → SESSION → VERIFY → REMEMBER
        </p>
      </div>
    </TutorOsShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 px-3 py-3 text-center">
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  );
}
