import { Link, useLocation, useParams } from "wouter";
import { Bookmark, ChevronRight } from "lucide-react";
import { TutorOsShell } from "../components/shell";
import { SubjectIcon } from "../components/subject-icon";
import {
  getCourse,
  getCourseMasteryTotal,
  getCourseSubject,
  getUpNextUnit,
} from "../data/curriculum";
import { useBookmarks } from "../hooks/use-bookmarks";
import NotFound from "@/pages/not-found";
import { cn } from "@/lib/utils";

export default function TutorOsCoursePage() {
  const params = useParams<{ courseId: string }>();
  const [, setLocation] = useLocation();
  const course = getCourse(params.courseId ?? "");
  const subject = getCourseSubject(params.courseId ?? "");
  const { isBookmarked, toggleBookmark } = useBookmarks();

  if (!course || !subject) {
    return <NotFound />;
  }

  const totalMastery = getCourseMasteryTotal(course);
  const upNext = getUpNextUnit(course);
  const bookmarked = isBookmarked(course.id);

  return (
    <TutorOsShell>
      <header className="bg-[#0B1F4D] text-white">
        <div className="flex h-14 items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => setLocation(`/tutoros/subjects/${subject.id}`)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            {course.subtitle && (
              <p className="text-xs uppercase tracking-[0.14em] text-blue-200">{course.subtitle}</p>
            )}
            <h1 className="truncate text-lg font-semibold">{course.title}</h1>
          </div>
          <button
            type="button"
            onClick={() => toggleBookmark(course.id)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark course"}
          >
            <Bookmark className={cn("h-5 w-5", bookmarked && "fill-current")} />
          </button>
        </div>
      </header>

      <div className="px-4 py-5 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <SubjectIcon subject={subject} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                0/{totalMastery.toLocaleString()} (0%) Mastery Points
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-0 rounded-full bg-[#1865F2]" />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          {course.aboutLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center justify-between rounded-xl px-1 py-2 text-[#1865F2] hover:bg-blue-50"
            >
              <span className="text-sm font-semibold">{link.label}</span>
              <ChevronRight className="h-4 w-4" />
            </a>
          ))}
        </section>

        {upNext && (
          <section className="rounded-2xl border-2 border-[#1865F2]/40 bg-blue-50/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1865F2]">
              Up next for you
            </p>
            <Link href={`/tutoros/courses/${course.id}/units/${upNext.id}`} className="mt-2 block">
              <h2 className="text-lg font-bold text-slate-900">{upNext.title}</h2>
              <p className="mt-1 text-sm text-slate-600">
                0/{upNext.masteryPoints} mastery points
              </p>
            </Link>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
            Course content
          </h3>
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
            {course.units.map((unit) => (
              <li key={unit.id}>
                <Link
                  href={`/tutoros/courses/${course.id}/units/${unit.id}`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition"
                >
                  <SubjectIcon subject={subject} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{unit.title}</p>
                    <p className="text-sm text-slate-500">
                      {unit.lessons.length} lessons · {unit.masteryPoints} pts
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm leading-relaxed text-slate-600 pb-2">{course.description}</p>
      </div>
    </TutorOsShell>
  );
}
