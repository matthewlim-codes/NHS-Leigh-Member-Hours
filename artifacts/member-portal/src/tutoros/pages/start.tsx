import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { PrimaryButton, TutorOsHeader, TutorOsShell } from "../components/shell";
import { startSession } from "../lib/api";

const SUBJECTS = [
  "Algebra I",
  "Algebra II / IM2",
  "Geometry",
  "Precalculus",
  "Biology",
  "Chemistry",
  "Chemistry Honors",
  "English",
  "Digital SAT Math",
];

function readParam(search: string, key: string) {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(key) ?? "";
}

export default function TutorOsStartPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  const prefill = useMemo(
    () => ({
      tutee: readParam(search, "tutee"),
      subject: readParam(search, "subject"),
      topic: readParam(search, "topic"),
      requestId: readParam(search, "requestId"),
    }),
    [search],
  );

  const [tuteeName, setTuteeName] = useState(prefill.tutee || "Jordan Lee");
  const [subject, setSubject] = useState(
    SUBJECTS.includes(prefill.subject) ? prefill.subject : prefill.subject || "Algebra II / IM2",
  );
  const [topic, setTopic] = useState(prefill.topic || "factoring");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromTeacher = Boolean(prefill.tutee && prefill.subject && prefill.topic);
  const isMariaDemo = tuteeName.trim().toLowerCase() === "maria";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await startSession({
        tuteeName,
        subject,
        topic,
        requestId: prefill.requestId || undefined,
      });
      setLocation(`/tutoros/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TutorOsShell>
      <TutorOsHeader title="Start Session" onBack={() => setLocation("/tutoros")} />
      <form onSubmit={onSubmit} className="px-5 py-5 space-y-5">
        <p className="text-sm text-slate-500 leading-relaxed">
          Enter who you&apos;re tutoring and what you&apos;ll cover. TutorOS builds a prep brief from
          memory so you start where the last session ended.
        </p>

        {fromTeacher && (
          <div className="rounded-2xl bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 shadow-sm shadow-emerald-100">
            Prefilled from a teacher request. Adjust if needed, then start.
          </div>
        )}

        {isMariaDemo && (
          <div className="rounded-2xl bg-blue-50/80 px-4 py-3 text-sm text-[#1865F2] shadow-sm shadow-blue-100">
            Maria has prior memory — your prep should adapt to last session.
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Tutee name</span>
          <input
            value={tuteeName}
            onChange={(e) => setTuteeName(e.target.value)}
            className="h-12 w-full rounded-2xl bg-white px-4 text-base shadow-sm shadow-slate-200/80 outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-[#1865F2]/25"
            placeholder="Jordan Lee"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Subject</span>
          <select
            value={SUBJECTS.includes(subject) ? subject : SUBJECTS[0]}
            onChange={(e) => setSubject(e.target.value)}
            className="h-12 w-full rounded-2xl bg-white px-4 text-base shadow-sm shadow-slate-200/80 outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-[#1865F2]/25"
          >
            {!SUBJECTS.includes(subject) && subject ? (
              <option value={subject}>{subject}</option>
            ) : null}
            {SUBJECTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Topic</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-12 w-full rounded-2xl bg-white px-4 text-base shadow-sm shadow-slate-200/80 outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-[#1865F2]/25"
            placeholder="factoring"
            required
          />
        </label>

        {error && (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">{error}</p>
        )}

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "Building prep brief..." : "Build prep brief"}
        </PrimaryButton>
      </form>
    </TutorOsShell>
  );
}
