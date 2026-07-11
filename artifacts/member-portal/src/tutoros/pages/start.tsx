import { useState } from "react";
import { useLocation } from "wouter";
import { PrimaryButton, TutorOsHeader, TutorOsShell } from "../components/shell";
import { startSession } from "../lib/api";

const SUBJECTS = [
  "Algebra I",
  "Algebra II",
  "Geometry",
  "Precalculus",
  "Biology",
  "Chemistry",
  "English",
  "Digital SAT Math",
];

export default function TutorOsStartPage() {
  const [, setLocation] = useLocation();
  const [tuteeName, setTuteeName] = useState("Maria");
  const [subject, setSubject] = useState("Algebra II");
  const [topic, setTopic] = useState("factoring");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await startSession({ tuteeName, subject, topic });
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
        <p className="text-sm text-slate-600 leading-relaxed">
          Enter who you&apos;re tutoring and what you&apos;ll cover. TutorOS builds a 2-minute prep
          brief from memory.
        </p>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-800">Tutee name</span>
          <input
            value={tuteeName}
            onChange={(e) => setTuteeName(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[#1865F2] focus:bg-white focus:ring-2 focus:ring-[#1865F2]/20"
            placeholder="Maria"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-800">Subject</span>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[#1865F2] focus:bg-white"
          >
            {SUBJECTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-800">Topic</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-[#1865F2] focus:bg-white focus:ring-2 focus:ring-[#1865F2]/20"
            placeholder="factoring"
            required
          />
        </label>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "Building prep brief…" : "Generate prep brief"}
        </PrimaryButton>

        <p className="text-center text-xs text-slate-400">
          Demo tip: keep Maria + factoring to see adapted memory on session 2.
        </p>
      </form>
    </TutorOsShell>
  );
}
