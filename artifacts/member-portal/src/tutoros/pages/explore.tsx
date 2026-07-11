import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import { TutorOsShell } from "../components/shell";
import { SubjectIcon } from "../components/subject-icon";
import { subjects } from "../data/curriculum";

export default function TutorOsExplorePage() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (subject) =>
        subject.name.toLowerCase().includes(q) ||
        subject.description.toLowerCase().includes(q) ||
        subject.courses.some((course) => course.title.toLowerCase().includes(q)),
    );
  }, [query]);

  const surprise = () => {
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const course = subject.courses[Math.floor(Math.random() * subject.courses.length)];
    setLocation(`/tutoros/courses/${course.id}`);
  };

  return (
    <TutorOsShell>
      <div className="px-4 pt-4 pb-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-[#1865F2] focus:bg-white focus:ring-2 focus:ring-[#1865F2]/20"
              aria-label="Search subjects"
            />
          </div>
          <button
            type="button"
            className="h-11 rounded-full px-4 text-sm font-semibold text-[#1865F2] hover:bg-blue-50"
          >
            Filter
          </button>
        </div>

        <div className="mt-6 flex items-end justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Browse TutorOS
          </h1>
          <button
            type="button"
            onClick={surprise}
            className="shrink-0 text-sm font-semibold text-[#1865F2]"
          >
            Surprise me!
          </button>
        </div>

        <ul className="mt-4 divide-y divide-slate-100">
          {filtered.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/tutoros/subjects/${subject.id}`}
                className="flex items-center gap-4 py-4 hover:bg-slate-50 -mx-2 px-2 rounded-xl transition"
              >
                <SubjectIcon subject={subject} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{subject.name}</p>
                  <p className="text-sm text-slate-500 truncate">{subject.description}</p>
                </div>
              </Link>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-10 text-center text-sm text-slate-500">
              No subjects match “{query}”.
            </li>
          )}
        </ul>
      </div>
    </TutorOsShell>
  );
}
