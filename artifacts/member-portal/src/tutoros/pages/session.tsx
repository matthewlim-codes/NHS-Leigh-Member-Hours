import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  PrimaryButton,
  SecondaryButton,
  TutorOsHeader,
  TutorOsShell,
} from "../components/shell";
import {
  beginSession,
  endSession,
  getSession,
  type SessionType,
  type TutorOsSession,
  type TutorRubric,
} from "../lib/api";

export default function TutorOsSessionPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<TutorOsSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [tick, setTick] = useState(0);
  const [rubric, setRubric] = useState<TutorRubric | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>("hw_center");
  const [showRubric, setShowRubric] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getSession(params.id)
      .then((data) => {
        setSession(data);
        if (data.status === "awaiting_verify") {
          setLocation(`/tutoros/verify/${data.id}`);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [params.id, setLocation]);

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const elapsed = useMemo(() => {
    if (!session) return "0:00";
    const start = Date.parse(session.startedAt);
    const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [session, tick]);

  const onBegin = async () => {
    if (!session) return;
    setError(null);
    try {
      const updated = await beginSession(session.id);
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not begin");
    }
  };

  const onEnd = async () => {
    if (!session || !rubric) return;
    setEnding(true);
    setError(null);
    try {
      const mins = Math.max(
        1,
        Math.round((Date.now() - Date.parse(session.startedAt)) / 60000),
      );
      const updated = await endSession(session.id, {
        tutorRubric: rubric,
        sessionType,
        durationMinutes: mins,
      });
      setLocation(`/tutoros/verify/${updated.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end session");
    } finally {
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <TutorOsShell>
        <div className="p-8 text-center text-slate-500">Loading session…</div>
      </TutorOsShell>
    );
  }

  if (!session) {
    return (
      <TutorOsShell>
        <TutorOsHeader title="Session" onBack={() => setLocation("/tutoros")} />
        <div className="p-6 text-sm text-red-600">{error ?? "Session not found"}</div>
      </TutorOsShell>
    );
  }

  const brief = session.prepBrief;

  return (
    <TutorOsShell>
      <TutorOsHeader
        title={session.status === "prep" ? "Prep brief" : "Live session"}
        onBack={() => setLocation("/tutoros")}
      />

      <div className="px-5 py-5 space-y-5">
        <div className="rounded-2xl bg-[#0B1F4D] text-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-blue-200">
            {session.subject}
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {session.tuteeName} · {session.topic}
          </h2>
          {brief.isAdapted ? (
            <p className="mt-2 text-sm text-emerald-300">
              {brief.memorySource === "ai" ? "AI prep · adapted from memory" : "Adapted from prior memory"}
            </p>
          ) : (
            <p className="mt-2 text-sm text-blue-200">
              {brief.memorySource === "ai" ? "AI prep · first session" : "First session — starter prep"}
            </p>
          )}
        </div>

        {brief.coachNote && (
          <section className="rounded-2xl border border-[#1865F2]/25 bg-blue-50/50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1865F2]">
              Coach note
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
              {brief.coachNote}
            </p>
          </section>
        )}

        {session.status === "active" && (
          <div className="rounded-2xl border border-slate-200 px-4 py-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Timer
            </p>
            <p className="mt-2 font-mono text-5xl font-bold text-slate-900">{elapsed}</p>
            <p className="mt-2 text-sm text-slate-500">No AI listening. Just you and your tutee.</p>
          </div>
        )}

        <BriefCard title="What they struggled with" items={brief.struggles} />
        <BriefCard title="Recommended approach" items={[brief.recommendedApproach]} />
        <BriefCard title="Worked example" items={[brief.workedExample]} />
        <BriefCard title="Watch-fors" items={brief.watchFors} />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {session.status === "prep" && (
          <PrimaryButton onClick={onBegin}>Start tutoring timer</PrimaryButton>
        )}

        {session.status === "active" && !showRubric && (
          <PrimaryButton onClick={() => setShowRubric(true)}>End session</PrimaryButton>
        )}

        {session.status === "active" && showRubric && (
          <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">3-tap rubric</h3>
            <p className="text-sm text-slate-600">Can the student do this…</p>
            <div className="space-y-2">
              {(
                [
                  ["independent", "Independently"],
                  ["with_hints", "With hints"],
                  ["not_yet", "Not yet"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRubric(value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left font-semibold transition ${
                    rubric === value
                      ? "border-[#1865F2] bg-blue-50 text-[#1865F2]"
                      : "border-slate-200 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold text-slate-800">Session type</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["hw_center", "HW Center"],
                  ["tutorial", "Tutorial"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSessionType(value)}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                    sessionType === value
                      ? "border-[#1865F2] bg-blue-50 text-[#1865F2]"
                      : "border-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <PrimaryButton onClick={onEnd} disabled={!rubric || ending}>
              {ending ? "Saving…" : "Hand phone to student → Verify"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowRubric(false)}>Back</SecondaryButton>
          </div>
        )}

        {session.status === "verified" && (
          <PrimaryButton onClick={() => setLocation("/tutoros")}>
            Back to TutorOS home
          </PrimaryButton>
        )}
      </div>
    </TutorOsShell>
  );
}

function BriefCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1865F2]">
        {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
