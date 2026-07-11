import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Flag } from "lucide-react";
import { TutorOsHeader, TutorOsShell } from "../components/shell";
import { getCommandView, type CommandResponse } from "../lib/api";

export default function TutorOsCommandPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<CommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCommandView()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <TutorOsShell>
      <TutorOsHeader title="Officer Command" onBack={() => setLocation("/tutoros")} />
      <div className="px-5 py-5 space-y-5">
        <div className="rounded-2xl bg-[#0B1F4D] text-white p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-blue-200">
            {data?.label ?? "Tonight — HW Center"}
          </p>
          {data ? (
            <div className="mt-4 space-y-1">
              <p className="text-2xl font-bold">
                {data.sessionsCount} sessions · {data.verifiedCount} verified
              </p>
              <p className="text-lg text-blue-100">{data.hours} hours</p>
              <p className="pt-2 text-sm text-amber-300">
                Flagged: {data.flaggedCount} session
                {data.flaggedCount === 1 ? "" : "s"} (tutor/tutee score mismatch)
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-blue-100">{error ?? "Loading tonight’s summary…"}</p>
          )}
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Officers see aggregates and flags — not student transcripts. Human oversight stays in the
          loop.
        </p>

        {data && data.flagged.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700 mb-2">
              Flagged for follow-up
            </h3>
            <ul className="space-y-2">
              {data.flagged.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <Flag className="h-4 w-4 mt-1 text-amber-700" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.tuteeName} · {item.topic}
                    </p>
                    <p className="text-sm text-slate-600">
                      Tutor {item.tutorUsername} · score {item.verifyScore ?? "—"}/5 · rubric{" "}
                      {item.tutorRubric ?? "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
              Tonight’s sessions
            </h3>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
              {data.sessions.map((session) => (
                <li key={session.id} className="px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    {session.tuteeName} · {session.subject}
                  </p>
                  <p className="text-sm text-slate-500">
                    {session.tutorUsername}
                    {session.verifyScore != null ? ` · ${session.verifyScore}/5` : ` · ${session.status}`}
                    {session.learningMoment ? " · learning moment ✓" : ""}
                  </p>
                </li>
              ))}
              {data.sessions.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  No sessions logged tonight yet.
                </li>
              )}
            </ul>
          </section>
        )}
      </div>
    </TutorOsShell>
  );
}
