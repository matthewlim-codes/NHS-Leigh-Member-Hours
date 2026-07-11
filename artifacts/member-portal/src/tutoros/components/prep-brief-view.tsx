import type { PrepBrief } from "../lib/api";
import { normalizePrepBrief } from "../lib/prep-brief-utils";

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

  return (
    <article className="prep-brief-article space-y-8 pb-2">
      <header className="space-y-3 border-b border-slate-100 pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          {subject} &gt; {topic}
        </p>
        <h2 className="text-[1.65rem] font-bold leading-tight tracking-tight text-slate-900">
          Prep brief for {tuteeName}
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600">
          {brief.isAdapted
            ? "Quick review from last time, then today's plan."
            : "First session — start with what the teacher flagged, then teach one clear example."}
        </p>
      </header>

      {brief.coachNote && (
        <p className="text-[15px] leading-relaxed text-slate-700 border-l-4 border-[#1865F2] pl-4">
          {brief.coachNote}
        </p>
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
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
