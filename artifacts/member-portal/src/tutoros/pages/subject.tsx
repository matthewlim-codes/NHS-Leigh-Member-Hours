import { Link, useLocation, useParams } from "wouter";
import { TutorOsHeader, TutorOsShell } from "../components/shell";
import { SubjectIcon } from "../components/subject-icon";
import { getSubject } from "../data/curriculum";
import NotFound from "@/pages/not-found";

export default function TutorOsSubjectPage() {
  const params = useParams<{ subjectId: string }>();
  const [, setLocation] = useLocation();
  const subject = getSubject(params.subjectId ?? "");

  if (!subject) {
    return <NotFound />;
  }

  return (
    <TutorOsShell>
      <TutorOsHeader title={subject.name} onBack={() => setLocation("/tutoros/explore")} />
      <div className="px-2">
        <p className="px-4 pt-3 pb-2 text-sm text-slate-500">{subject.description}</p>
        <ul>
          {subject.courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/tutoros/courses/${course.id}`}
                className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 hover:bg-slate-50 transition"
              >
                <SubjectIcon subject={subject} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{course.title}</p>
                  {course.subtitle && (
                    <p className="text-sm text-slate-500">{course.subtitle}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </TutorOsShell>
  );
}
