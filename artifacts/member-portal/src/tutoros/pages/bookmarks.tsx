import { Link } from "wouter";
import { Bookmark } from "lucide-react";
import { TutorOsHeader, TutorOsShell } from "../components/shell";
import { SubjectIcon } from "../components/subject-icon";
import { getCourse, getCourseSubject } from "../data/curriculum";
import { useBookmarks } from "../hooks/use-bookmarks";

export default function TutorOsBookmarksPage() {
  const { bookmarks, toggleBookmark } = useBookmarks();

  const items = bookmarks
    .map((courseId) => {
      const course = getCourse(courseId);
      const subject = getCourseSubject(courseId);
      if (!course || !subject) return null;
      return { course, subject };
    })
    .filter(Boolean) as Array<{
    course: NonNullable<ReturnType<typeof getCourse>>;
    subject: NonNullable<ReturnType<typeof getCourseSubject>>;
  }>;

  return (
    <TutorOsShell>
      <TutorOsHeader title="Bookmarks" />
      <div className="px-4 py-4">
        {items.length === 0 ? (
          <div className="mt-16 text-center px-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#1865F2]">
              <Bookmark className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">No bookmarks yet</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Save courses from Explore so you can pull them up quickly between tutoring sessions.
            </p>
            <Link
              href="/tutoros/explore"
              className="mt-6 inline-flex rounded-full bg-[#1865F2] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Browse subjects
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map(({ course, subject }) => (
              <li key={course.id} className="flex items-center gap-3 py-4">
                <Link
                  href={`/tutoros/courses/${course.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <SubjectIcon subject={subject} size="sm" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{course.title}</p>
                    <p className="text-sm text-slate-500">{subject.name}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleBookmark(course.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#1865F2] hover:bg-blue-50"
                  aria-label={`Remove ${course.title} bookmark`}
                >
                  <Bookmark className="h-5 w-5 fill-current" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TutorOsShell>
  );
}
