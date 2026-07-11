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
  type PracticeDifficultyMode,
  type PracticeProblem,
  type SessionType,
  type TutorOsSession,
  type TutorRubric,
} from "../lib/api";
import { ScalePicker } from "../components/scale-picker";
import { emptyTutorEvidence } from "../lib/evidence-types";

type SessionPanel = "prep" | "live" | "rubric";

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
  const [panel, setPanel] = useState<SessionPanel>("prep");
  const [generatingProblems, setGeneratingProblems] = useState(false);
  const [savingProblems, setSavingProblems] = useState(false);
  const [difficultyMode, setDifficultyMode] = useState<PracticeDifficultyMode>("same");
  const [lastGeneratedMode, setLastGeneratedMode] = useState<PracticeDifficultyMode | null>(null);
  const [tutorEvidence, setTutorEvidence] = useState(emptyTutorEvidence());
  const saveProblemsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!params.id) return;
    getSession(params.id)
      .then((data) => {
        setSession(data);
        if (data.status === "awaiting_verify" && data.timerStarted) {
          setLocation(`/tutoros/verify/${data.id}`);
          return;
        }
        if (data.status === "active") setPanel("live");
        else if (data.status === "prep") setPanel("prep");
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
      setPanel("live");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not begin");
    }
  };

  const onGeneratePracticeProblems = async () => {
    if (!session) return;
    setGeneratingProblems(true);
    setError(null);
    try {
      const current = (session.prepBrief.practiceProblems ?? []).map((p) => p.prompt);
      const history = Array.isArray(session.prepBrief.avoidedPracticePrompts)
        ? session.prepBrief.avoidedPracticePrompts
        : [];
      const avoidPrompts = [...new Set([...current, ...history])];
      const updated = await generatePracticeProblems(session.id, {
        difficultyMode,
        avoidPrompts,
      });
      setLastGeneratedMode(difficultyMode);
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

  const tutorEvidenceComplete =
    tutorEvidence.todaysGoal.trim().length > 0 &&
    tutorEvidence.biggestMisconception.trim().length > 0 &&
    tutorEvidence.whatChangedToday.trim().length > 0;

  const onEnd = async () => {
    if (!session || !rubric || !session.startedAt || !tutorEvidenceComplete) return;
    setEnding(true);
    setError(null);
    try {
      const mins = Math.max(
        1,
        Math.round((Date.now() - Date.parse(session.startedAt)) / 60000),
      );
      const changed = tutorEvidence.whatChangedToday.trim();
      const updated = await endSession(session.id, {
        tutorRubric: rubric,
        sessionType,
        durationMinutes: mins,
        tutorEvidence: {
          ...tutorEvidence,
          todaysGoal: tutorEvidence.todaysGoal.trim(),
          biggestMisconception: tutorEvidence.biggestMisconception.trim(),
          whatClicked: changed,
          whatChangedToday: changed,
        },
      });
      setLocation(`/tutoros/verify/${updated.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end session");
    } finally {
      setEnding(false);
    }
  };

  const startHref = session
    ? `/tutoros/start?tutee=${encodeURIComponent(session.tuteeName)}&subject=${encodeURIComponent(session.subject)}&topic=${encodeURIComponent(session.topic)}`
    : "/tutoros/start";

  const onHeaderBack = () => {
    if (!session) {
      setLocation("/tutoros");
      return;
    }
    if (panel === "rubric") {
      setPanel("live");
      return;
    }
    if (panel === "live") {
      setPanel("prep");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // prep panel
    setLocation(startHref);
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
  const showRubric = panel === "rubric";
  const showLiveChrome = panel === "live" && session.status === "active";

  return (
    <TutorOsShell>
      <TutorOsHeader
        title={
          showRubric
            ? "Session wrap-up"
            : panel === "live"
              ? "Live session"
              : "Prep brief"
        }
        onBack={onHeaderBack}
      />

      <div className="px-5 py-5 space-y-6">
        {showLiveChrome && session.startedAt && (
          <div className="rounded-2xl border border-slate-200 px-4 py-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Timer
            </p>
            <p className="mt-2 font-mono text-5xl font-bold text-slate-900">{elapsed}</p>
            <p className="mt-2 text-sm text-slate-500">No AI listening. Just you and your tutee.</p>
          </div>
        )}

        {!showRubric && (
          <>
            <PrepBriefView
              brief={brief}
              subject={session.subject}
              topic={session.topic}
              tuteeName={session.tuteeName}
            />

            {(brief.materialsToReview?.length ?? 0) > 0 && (
              <section
                className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-4"
                data-testid="materials-to-review"
              >
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">
                    Review with the student
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Teacher-uploaded worksheets — go through these before generating practice
                    questions.
                  </p>
                </div>
                <ul className="space-y-3">
                  {brief.materialsToReview!.map((material) => {
                    const imageSrc =
                      material.previewDataUrl ||
                      (material.isImage || material.contentType?.startsWith("image/")
                        ? material.fileUrl
                        : undefined);
                    return (
                      <li
                        key={material.id}
                        className="rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm"
                      >
                        <p className="text-sm font-bold text-slate-900">{material.filename}</p>
                        {material.teacherInstructions && (
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            <span className="font-semibold text-emerald-800">Teacher note: </span>
                            {material.teacherInstructions}
                          </p>
                        )}
                        {imageSrc ? (
                          <a
                            href={imageSrc}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 block overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            data-testid={`material-preview-${material.id}`}
                          >
                            <img
                              src={imageSrc}
                              alt={material.filename}
                              className="h-auto w-full max-h-[min(80vh,1200px)] object-contain"
                              loading="eager"
                              decoding="async"
                            />
                          </a>
                        ) : material.fileUrl ? (
                          <a
                            href={material.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                          >
                            Open uploaded file
                          </a>
                        ) : material.preview && !material.teacherInstructions ? (
                          <p className="mt-2 text-sm text-slate-600">{material.preview}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <PracticeProblemsSection
              problems={brief.practiceProblems ?? []}
              generating={generatingProblems}
              difficultyMode={difficultyMode}
              onDifficultyModeChange={setDifficultyMode}
              onGenerate={onGeneratePracticeProblems}
              onChange={onPracticeProblemsChange}
              lastGeneratedMode={lastGeneratedMode}
            />

            {savingProblems && (
              <p className="text-xs text-slate-500">Saving practice question edits…</p>
            )}
          </>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {session.status === "prep" && panel === "prep" && (
          <PrimaryButton onClick={onBegin}>Start tutoring timer</PrimaryButton>
        )}

        {session.status === "active" && panel === "prep" && (
          <PrimaryButton onClick={() => setPanel("live")}>Back to live session</PrimaryButton>
        )}

        {session.status === "active" && panel === "live" && (
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

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div>
                <h4 className="font-bold text-slate-900">Evidence fusion</h4>
                <p className="mt-1 text-sm text-slate-600">
                  Small signals beat one big summary — AI combines these for the next prep brief.
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">What was today&apos;s goal?</span>
                <input
                  value={tutorEvidence.todaysGoal}
                  onChange={(e) =>
                    setTutorEvidence((ev) => ({ ...ev, todaysGoal: e.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
                  placeholder="Factor quadratics without hints"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Biggest misconception?</span>
                <input
                  value={tutorEvidence.biggestMisconception}
                  onChange={(e) =>
                    setTutorEvidence((ev) => ({ ...ev, biggestMisconception: e.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
                  placeholder="Thought factors had to match the middle term exactly"
                />
              </label>

              <ScalePicker
                label="Independence (1–5)"
                value={tutorEvidence.independence}
                onChange={(independence) =>
                  setTutorEvidence((ev) => ({ ...ev, independence }))
                }
                lowLabel="Needs help"
                highLabel="Independent"
              />

              <label className="block space-y-1.5 rounded-xl border border-[#1865F2]/30 bg-blue-50/50 p-3">
                <span className="text-sm font-bold text-[#1865F2]">What changed today?</span>
                <p className="text-xs text-slate-600">
                  Not what happened — what shifted in their learning?
                </p>
                <input
                  value={tutorEvidence.whatChangedToday}
                  onChange={(e) =>
                    setTutorEvidence((ev) => ({
                      ...ev,
                      whatChangedToday: e.target.value,
                      whatClicked: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
                  placeholder="Jordan no longer needs hints for GCF"
                />
              </label>
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

            <PrimaryButton onClick={onEnd} disabled={!rubric || !tutorEvidenceComplete || ending}>
              {ending ? "Saving…" : "Hand phone to student → Verify"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setPanel("live")}>Back</SecondaryButton>
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
                setPanel("rubric");
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
