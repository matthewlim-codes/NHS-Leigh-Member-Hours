import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { PrimaryButton, TutorOsHeader, TutorOsShell } from "../components/shell";
import { getSession, verifySession, type TutorOsSession } from "../lib/api";

export default function TutorOsVerifyPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<TutorOsSession | null>(null);
  const [explanation, setExplanation] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<TutorOsSession | null>(null);

  useEffect(() => {
    if (!params.id) return;
    getSession(params.id)
      .then((data) => {
        setSession(data);
        if (data.status === "verified") setDone(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [params.id]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await verifySession(session.id, { explanation, answer });
      setDone(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <TutorOsShell>
        <TutorOsHeader title="Learning moment" onBack={() => setLocation("/tutoros")} />
        <div className="px-5 py-8 text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-3xl font-bold">
            {done.verifyScore}/5
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {done.learningMoment ? "Verified learning moment" : "Session recorded"}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {done.verifyMismatch
              ? "Flagged for officers: tutor rubric and student score disagreed."
              : done.learningMoment
                ? "Memory updated. Next prep brief for this tutee will be sharper."
                : "Hours can still count. Learning moments require a stronger verify match."}
          </p>
          <PrimaryButton onClick={() => setLocation("/tutoros")}>Done</PrimaryButton>
        </div>
      </TutorOsShell>
    );
  }

  return (
    <TutorOsShell showBottomNav={false}>
      <TutorOsHeader title="Verify" onBack={() => setLocation(session ? `/tutoros/session/${session.id}` : "/tutoros")} />
      <form onSubmit={onSubmit} className="px-5 py-5 space-y-5">
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Student check-in · ~30 seconds
          </p>
          <p className="mt-2 text-sm text-slate-700">
            No account needed. Hand the phone to{" "}
            <span className="font-semibold">{session?.tuteeName ?? "your tutee"}</span>.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-800">
            In your own words, what do you understand better now?
          </span>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
            placeholder="I can factor by…"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-800">
            Try this: {session?.exitProblem ?? "One problem similar to today"}
          </span>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
            placeholder="Your answer"
            required
          />
        </label>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <PrimaryButton type="submit" disabled={submitting || !session}>
          {submitting ? "Scoring…" : "Submit check-in"}
        </PrimaryButton>
      </form>
    </TutorOsShell>
  );
}
