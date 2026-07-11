import type { PrepBrief, PrepMemoryBadge } from "../lib/api";
import { normalizePrepBrief } from "../lib/prep-brief-utils";
import { cn } from "@/lib/utils";

const badgeTone: Record<PrepMemoryBadge["tone"], string> = {
  blue: "bg-blue-50 text-[#1865F2]",
  emerald: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-600",
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
  sky: "bg-sky-50 text-sky-700",
};

export function PrepBriefView({
  brief,
  subject,
  topic,
  tuteeName,
}: {
  brief: PrepBrief;
  subject: string;
  topic: string;
  tuteeName: string;
}) {
  const normalized = normalizePrepBrief(brief, topic);
  const badges = brief.memoryBadges ?? [];

  return (
    <article className="prep-brief-article space-y-8 pb-2">
      <header className="space-y-3 pb-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
          {subject} · {topic}
        </p>
        <h2 className="text-[1.65rem] font-bold leading-tight tracking-tight text-slate-900">
          Prep brief for {tuteeName}
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-500">
          {brief.isAdapted
            ? "Continue from last time — memory shaped this plan."
            : "First session — start with what the teacher flagged, then one clear example."}
        </p>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1" data-testid="memory-badges">
            {badges.map((badge) => (
              <span
                key={badge.id}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  badgeTone[badge.tone] ?? badgeTone.slate,
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </header>

      {brief.coachNote && (
        <p className="text-[15px] leading-relaxed text-slate-700 pl-3 border-l-2 border-[#1865F2]/40">
          {brief.coachNote}
        </p>
      )}

      {(brief.memoryEpisodes?.length ?? 0) > 0 && (
        <section className="space-y-3 rounded-2xl bg-slate-50/80 px-4 py-4 shadow-sm shadow-slate-200/60">
          <h3 className="text-sm font-semibold text-slate-800">Memory for this learner</h3>
          <ul className="space-y-2">
            {brief.memoryEpisodes!.map((episode) => (
              <li key={`${episode.topic}-${episode.summary.slice(0, 24)}`} className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">{episode.topic}: </span>
                {episode.summary}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(brief.teacherNotes?.length ?? 0) > 0 && (
        <PrepSection title="From the teacher">
          <BulletList items={brief.teacherNotes!} />
        </PrepSection>
      )}

      {(brief.materialsCited?.length ?? 0) > 0 && (
        <PrepSection title="From course materials">
          <BulletList items={brief.materialsCited!.map((m) => m.slice(0, 180))} />
        </PrepSection>
      )}

      <PrepSection title={normalized.contextTitle}>
        <BulletList items={normalized.contextBullets} />
      </PrepSection>

      <PrepSection title={normalized.approachTitle}>
        <BulletList items={normalized.approachBullets} />
      </PrepSection>

      <PrepSection title={normalized.workedExampleTitle}>
        <p className="text-[15px] font-medium text-slate-800">{normalized.problemStatement}</p>
        <ol className="mt-4 space-y-4">
          {normalized.steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1865F2]/10 text-sm font-bold text-[#1865F2]">
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                {step.label !== `Step ${index + 1}` && (
                  <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                )}
                <p className="text-[15px] leading-relaxed text-slate-700">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </PrepSection>

      {normalized.misconceptionTips.length > 0 && (
        <PrepSection title="Common misconceptions to address">
          <BulletList items={normalized.misconceptionTips} />
        </PrepSection>
      )}
    </article>
  );
}

function PrepSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-bold tracking-tight text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-[15px] text-slate-500">No notes yet.</p>;
  }

  return (
    <ul className="space-y-2 pl-1">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-700">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
