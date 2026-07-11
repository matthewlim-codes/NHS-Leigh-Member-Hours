import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrepBriefView } from "../components/prep-brief-view";
import { PracticeProblemsSection } from "../components/practice-problems-section";
import {
  PrimaryButton,
  SecondaryButton,
  TutorOsHeader,
  TutorOsShell,
} from "../components/shell";
import {
  beginSession,
  endSession,
  generatePracticeProblems,
  getSession,
  updatePracticeProblems,
  type PracticeProblem,
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
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showRubric, setShowRubric] = useState(false);
  const [generatingProblems, setGeneratingProblems] = useState(false);
  const [savingProblems, setSavingProblems] = useState(false);
  const saveProblemsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!params.id) return;
    getSession(params.id)
      .then((data) => {
        setSession(data);
        if (data.status === "awaiting_verify" && data.timerStarted) {
          setLocation(`/tutoros/verify/${data.id}`);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [params.id, setLocation]);

  useEffect(() => {
    if (!session || session.status !== "active" || !session.startedAt) return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const elapsed = useMemo(() => {
    if (!session?.startedAt) return "0:00";
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

  const onGeneratePracticeProblems = async () => {
    if (!session) return;
    setGeneratingProblems(true);
    setError(null);
    try {
      const updated = await generatePracticeProblems(session.id);
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate practice questions");
    } finally {
      setGeneratingProblems(false);
    }
  };

  const onPracticeProblemsChange = (problems: PracticeProblem[]) => {
    if (!session) return;
    const sessionId = session.id;
    setSession({
      ...session,
      prepBrief: { ...session.prepBrief, practiceProblems: problems },
    });

    if (saveProblemsTimer.current) clearTimeout(saveProblemsTimer.current);
    saveProblemsTimer.current = setTimeout(async () => {
      setSavingProblems(true);
      try {
        const updated = await updatePracticeProblems(sessionId, problems);
        setSession(updated);
      } catch {
        // Keep local edits visible even if save fails
      } finally {
        setSavingProblems(false);
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (saveProblemsTimer.current) clearTimeout(saveProblemsTimer.current);
    };
  }, []);

  const onEnd = async () => {
    if (!session || !rubric || !session.startedAt) return;
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

      <div className="px-5 py-5 space-y-6">
        {session.status === "active" && session.startedAt && (
          <div className="rounded-2xl border border-slate-200 px-4 py-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Timer
            </p>
            <p className="mt-2 font-mono text-5xl font-bold text-slate-900">{elapsed}</p>
            <p className="mt-2 text-sm text-slate-500">No AI listening. Just you and your tutee.</p>
          </div>
        )}

        <PrepBriefView
          brief={brief}
          subject={session.subject}
          topic={session.topic}
          tuteeName={session.tuteeName}
        />

        <PracticeProblemsSection
          problems={brief.practiceProblems ?? []}
          generating={generatingProblems}
          onGenerate={onGeneratePracticeProblems}
          onChange={onPracticeProblemsChange}
        />

        {savingProblems && (
          <p className="text-xs text-slate-500">Saving practice question edits…</p>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {session.status === "prep" && (
          <PrimaryButton onClick={onBegin}>Start tutoring timer</PrimaryButton>
        )}

        {session.status === "active" && !showRubric && (
          <PrimaryButton onClick={() => setShowEndConfirm(true)}>End session</PrimaryButton>
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

      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>End tutoring session?</DialogTitle>
            <DialogDescription>
              Are you sure you want to end this session with {session.tuteeName}? The timer will
              stop and you&apos;ll complete a quick rubric before student verification.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <PrimaryButton
              onClick={() => {
                setShowEndConfirm(false);
                setShowRubric(true);
              }}
            >
              Yes, end session
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowEndConfirm(false)}>
              Keep tutoring
            </SecondaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TutorOsShell>
  );
}
