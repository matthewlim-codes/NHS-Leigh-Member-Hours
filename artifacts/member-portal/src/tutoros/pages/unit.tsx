import { Link, useLocation, useParams } from "wouter";
import { TutorOsHeader, TutorOsShell } from "../components/shell";
import { SubjectIcon } from "../components/subject-icon";
import { getCourse, getCourseSubject, getUnit } from "../data/curriculum";
import NotFound from "@/pages/not-found";

export default function TutorOsUnitPage() {
  const params = useParams<{ courseId: string; unitId: string }>();
  const [, setLocation] = useLocation();
  const course = getCourse(params.courseId ?? "");
  const subject = getCourseSubject(params.courseId ?? "");
  const unit = getUnit(params.courseId ?? "", params.unitId ?? "");

  if (!course || !subject || !unit) {
    return <NotFound />;
  }

  const unitIndex = course.units.findIndex((item) => item.id === unit.id);
  const nextUnit = course.units[unitIndex + 1];

  return (
    <TutorOsShell>
      <TutorOsHeader
        title={course.title}
        onBack={() => setLocation(`/tutoros/courses/${course.id}`)}
      />

      <div className="px-4 pt-5 pb-8">
        <div className="flex items-start gap-3 mb-5">
          <SubjectIcon subject={subject} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Unit {unitIndex + 1}
            </p>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">{unit.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              0/{unit.masteryPoints} mastery points
            </p>
          </div>
        </div>

        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white">
          {unit.lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <div className="flex items-start gap-3 px-4 py-4">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-500">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 leading-snug">{lesson.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{lesson.masteryPoints} mastery points</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {nextUnit && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-3">
              Next unit
            </p>
            <Link
              href={`/tutoros/courses/${course.id}/units/${nextUnit.id}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 hover:bg-slate-50 transition"
            >
              <SubjectIcon subject={subject} size="sm" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{nextUnit.title}</p>
                <p className="text-sm text-slate-500">
                  {nextUnit.lessons.length} lessons · {nextUnit.masteryPoints} pts
                </p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </TutorOsShell>
  );
}
