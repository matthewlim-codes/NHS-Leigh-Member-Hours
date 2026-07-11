import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ScalePicker } from "../components/scale-picker";
import { PrimaryButton, TutorOsHeader, TutorOsShell } from "../components/shell";
import { emptyStudentEvidence } from "../lib/evidence-types";
import { getSession, verifySession, type TutorOsSession } from "../lib/api";

export default function TutorOsVerifyPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<TutorOsSession | null>(null);
  const [studentEvidence, setStudentEvidence] = useState(emptyStudentEvidence());
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

  const studentEvidenceComplete = studentEvidence.whatChangedToday.trim().length > 0;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !studentEvidenceComplete) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await verifySession(session.id, {
        answer,
        studentEvidence: {
          ...studentEvidence,
          stillConfusing: studentEvidence.stillConfusing.trim(),
          whatChangedToday: studentEvidence.whatChangedToday.trim(),
        },
      });
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
          {done.fusedHeadline && (
            <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-[#1865F2]">
              What changed: {done.fusedHeadline}
            </p>
          )}
          <p className="text-sm text-slate-600 leading-relaxed">
            {done.verifyMismatch
              ? "Flagged for officers: tutor rubric and student score disagreed."
              : done.learningMoment
                ? "Evidence fused into memory. Next prep brief for this tutee will be sharper."
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

        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <div>
            <h3 className="font-bold text-slate-900">Your reflection</h3>
            <p className="mt-1 text-sm text-slate-600">
              These small signals help your tutor and AI track real progress.
            </p>
          </div>

          <ScalePicker
            label="Confidence before session"
            value={studentEvidence.confidenceBefore}
            onChange={(confidenceBefore) =>
              setStudentEvidence((ev) => ({ ...ev, confidenceBefore }))
            }
            lowLabel="Lost"
            highLabel="Got it"
          />

          <ScalePicker
            label="Confidence after session"
            value={studentEvidence.confidenceAfter}
            onChange={(confidenceAfter) =>
              setStudentEvidence((ev) => ({ ...ev, confidenceAfter }))
            }
            lowLabel="Still lost"
            highLabel="Got it"
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-800">
              What still feels confusing?
            </span>
            <textarea
              value={studentEvidence.stillConfusing}
              onChange={(e) =>
                setStudentEvidence((ev) => ({ ...ev, stillConfusing: e.target.value }))
              }
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
              placeholder="When the middle term is negative…"
            />
          </label>

          <label className="block space-y-1.5 rounded-xl border border-[#1865F2]/30 bg-blue-50/50 p-3">
            <span className="text-sm font-bold text-[#1865F2]">What changed today?</span>
            <p className="text-xs text-slate-600">Not a summary — what shifted for you?</p>
            <textarea
              value={studentEvidence.whatChangedToday}
              onChange={(e) =>
                setStudentEvidence((ev) => ({ ...ev, whatChangedToday: e.target.value }))
              }
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
              placeholder="I finally understand why negatives flip"
              required
            />
          </label>
        </div>

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

        <PrimaryButton
          type="submit"
          disabled={submitting || !session || !studentEvidenceComplete || !answer.trim()}
        >
          {submitting ? "Scoring…" : "Submit check-in"}
        </PrimaryButton>
      </form>
    </TutorOsShell>
  );
}
