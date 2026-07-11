import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Flag, Clock } from "lucide-react";
import { TutorOsHeader, TutorOsShell } from "../components/shell";
import { listMySessions, type SessionListResponse } from "../lib/api";

export default function TutorOsHistoryPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<SessionListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMySessions()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <TutorOsShell>
      <TutorOsHeader title="Session history" onBack={() => setLocation("/tutoros")} />
      <div className="px-4 py-4">
        {data && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-2xl font-bold text-slate-900">{data.stats.learningMoments}</p>
              <p className="text-xs text-slate-500">Verified learning moments</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-2xl font-bold text-slate-900">{data.stats.unverified}</p>
              <p className="text-xs text-slate-500">Unverified / pending</p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!data && !error && <p className="text-sm text-slate-500">Loading…</p>}

        {data?.sessions.length === 0 && (
          <p className="text-sm text-slate-500 py-8 text-center">No sessions yet.</p>
        )}

        <ul className="divide-y divide-slate-100">
          {data?.sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={
                  session.status === "awaiting_verify" && session.timerStarted
                    ? `/tutoros/verify/${session.id}`
                    : `/tutoros/session/${session.id}`
                }
                className="flex items-start gap-3 py-4 hover:bg-slate-50 -mx-2 px-2 rounded-xl"
              >
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  {session.verifyMismatch ? (
                    <Flag className="h-4 w-4 text-amber-600" />
                  ) : session.learningMoment ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {session.tuteeName} · {session.topic}
                  </p>
                  <p className="text-sm text-slate-500">
                    {session.subject}
                    {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
                    {session.verifyScore != null ? ` · ${session.verifyScore}/5` : ` · ${session.status}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </TutorOsShell>
  );
}
