import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Maximize2, Sparkles, X } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { PracticeDifficultyMode, PracticeProblem } from "../lib/api";
import { DIFFICULTY_LABEL } from "../lib/practice-problems-templates";
import { SecondaryButton } from "./shell";

const MODE_OPTIONS: Array<{ value: PracticeDifficultyMode; label: string }> = [
  { value: "easier", label: "Easier" },
  { value: "same", label: "Same difficulty" },
  { value: "harder", label: "Harder" },
];

export function PracticeProblemsSection({
  problems,
  generating,
  difficultyMode,
  onDifficultyModeChange,
  onGenerate,
  onChange,
}: {
  problems: PracticeProblem[];
  generating: boolean;
  difficultyMode: PracticeDifficultyMode;
  onDifficultyModeChange: (mode: PracticeDifficultyMode) => void;
  onGenerate: () => void;
  onChange: (problems: PracticeProblem[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [zoomedId, setZoomedId] = useState<string | null>(null);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const p of problems) {
        if (next[p.id] === undefined) next[p.id] = false;
      }
      return next;
    });
  }, [problems]);

  useEffect(() => {
    if (!zoomedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedId]);

  const updateProblem = (id: string, patch: Partial<PracticeProblem>) => {
    onChange(problems.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const zoomed = problems.find((p) => p.id === zoomedId) ?? null;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Practice questions</h3>
          <p className="mt-1 text-sm text-slate-600">
            Generate fresh problems across five levels (basic → advanced). Choose easier, same, or
            harder when regenerating.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="block min-w-0 flex-1 space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Regenerate difficulty
          </span>
          <select
            value={difficultyMode}
            onChange={(e) => onDifficultyModeChange(e.target.value as PracticeDifficultyMode)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
            data-testid="select-practice-difficulty-mode"
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <SecondaryButton
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex w-full items-center justify-center gap-2 sm:mt-6 sm:w-auto sm:min-w-[220px]"
          data-testid="button-generate-practice"
        >
          <Sparkles className="h-4 w-4" />
          {generating
            ? "Generating…"
            : problems.length > 0
              ? "Regenerate practice questions"
              : "Generate practice questions"}
        </SecondaryButton>
      </div>

      {problems.length === 0 && !generating && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No practice questions yet. Tap generate to create three new problems with tutor steps and
          discussion stems.
        </p>
      )}

      <ul className="space-y-4">
        {problems.map((problem, index) => {
          const isOpen = expanded[problem.id] ?? false;
          return (
            <li
              key={problem.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <Collapsible open={isOpen} onOpenChange={() => toggleExpanded(problem.id)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#1865F2]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1865F2]">
                    {DIFFICULTY_LABEL[problem.difficulty] ?? `Problem ${index + 1}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setZoomedId(problem.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      data-testid={`button-zoom-practice-${index}`}
                    >
                      <Maximize2 className="h-4 w-4" />
                      Zoom
                    </button>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        {isOpen ? (
                          <>
                            Hide tutor hints
                            <ChevronUp className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            Show steps &amp; discussion stems
                            <ChevronDown className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                <label className="mt-3 block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Question for student
                  </span>
                  <textarea
                    value={problem.prompt}
                    onChange={(e) => updateProblem(problem.id, { prompt: e.target.value })}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[15px] leading-relaxed text-slate-800 outline-none focus:border-[#1865F2] focus:bg-white focus:ring-2 focus:ring-[#1865F2]/20"
                    placeholder="Edit the practice question…"
                  />
                </label>

                <CollapsibleContent className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Solution steps (tutor reference)
                    </p>
                    {problem.steps.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">No steps generated.</p>
                    ) : (
                      <ol className="mt-2 space-y-2">
                        {problem.steps.map((step, stepIndex) => (
                          <li key={`${problem.id}-step-${stepIndex}`} className="flex gap-2">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                              {stepIndex + 1}
                            </span>
                            <div className="min-w-0">
                              {step.label && step.label !== "Step" && (
                                <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                              )}
                              <p className="text-sm leading-relaxed text-slate-600">{step.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Discussion stems
                    </p>
                    {problem.discussionStems.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">No discussion stems generated.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {problem.discussionStems.map((stem) => (
                          <li
                            key={`${problem.id}-${stem}`}
                            className="flex gap-2 text-sm leading-relaxed text-slate-700"
                          >
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1865F2]" />
                            <span>{stem}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        })}
      </ul>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Practice problem zoom"
          data-testid="practice-problem-zoom"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                {DIFFICULTY_LABEL[zoomed.difficulty] ?? "Practice"}
              </p>
              <p className="mt-1 text-sm text-white/70">Full-screen problem view</p>
            </div>
            <button
              type="button"
              onClick={() => setZoomedId(null)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Close zoom"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <p className="max-w-3xl text-center text-3xl font-bold leading-snug tracking-tight sm:text-4xl md:text-5xl">
              {zoomed.prompt}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
