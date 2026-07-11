import type { TutorRubric } from "./tutoros-store";

export interface TutorEvidence {
  todaysGoal: string;
  biggestMisconception: string;
  whatClicked: string;
  independence: number;
  whatChangedToday: string;
}

export interface StudentEvidence {
  confidenceBefore: number;
  confidenceAfter: number;
  stillConfusing: string;
  whatChangedToday: string;
}

export interface TeacherEvidence {
  whatChangedToday: string;
}

export interface FusedLearningEpisode {
  topic: string;
  summary: string;
  headline: string;
  outcome: "improved" | "partial" | "struggled";
  approach?: string;
  when: string;
  score?: number;
  signals: {
    tutor?: TutorEvidence;
    student?: StudentEvidence;
    teacher?: TeacherEvidence;
    verifyScore?: number;
    tutorRubric?: TutorRubric;
    confidenceDelta?: number;
  };
}

function clampScale(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function deriveOutcome(input: {
  verifyScore?: number | null;
  independence?: number;
  confidenceBefore?: number;
  confidenceAfter?: number;
}): FusedLearningEpisode["outcome"] {
  const confidenceDelta =
    input.confidenceBefore != null && input.confidenceAfter != null
      ? input.confidenceAfter - input.confidenceBefore
      : 0;

  if (input.verifyScore != null) {
    if (input.verifyScore >= 4 || confidenceDelta >= 2) return "improved";
    if (input.verifyScore >= 3 || confidenceDelta >= 1) return "partial";
    return "struggled";
  }

  const independence = input.independence ?? 3;
  if (independence >= 4 || confidenceDelta >= 2) return "improved";
  if (independence >= 3 || confidenceDelta >= 1) return "partial";
  return "struggled";
}

function pickHeadline(signals: {
  tutor?: TutorEvidence;
  student?: StudentEvidence;
  teacher?: TeacherEvidence;
}): string {
  const parts = [
    signals.tutor?.whatChangedToday.trim(),
    signals.student?.whatChangedToday.trim(),
    signals.teacher?.whatChangedToday.trim(),
  ].filter(Boolean);

  if (parts.length === 1) return parts[0]!;
  if (parts.length > 1) return parts.join(" · ");
  return "Session recorded — no change signal captured yet.";
}

function buildSummary(input: {
  subject: string;
  topic: string;
  headline: string;
  tutor?: TutorEvidence;
  student?: StudentEvidence;
  teacher?: TeacherEvidence;
  verifyScore?: number | null;
  tutorRubric?: TutorRubric | null;
}): string {
  const lines: string[] = [`What changed: ${input.headline}`];

  if (input.tutor) {
    lines.push(
      `Tutor goal: ${input.tutor.todaysGoal}`,
      `Misconception: ${input.tutor.biggestMisconception}`,
      `Clicked: ${input.tutor.whatClicked}`,
      `Independence: ${input.tutor.independence}/5`,
    );
  }

  if (input.student) {
    lines.push(
      `Confidence: ${input.student.confidenceBefore}/5 → ${input.student.confidenceAfter}/5`,
      input.student.stillConfusing
        ? `Still confusing: ${input.student.stillConfusing}`
        : "Still confusing: (none noted)",
    );
  }

  if (input.teacher?.whatChangedToday) {
    lines.push(`Teacher: ${input.teacher.whatChangedToday}`);
  }

  if (input.verifyScore != null) {
    lines.push(`Verify score: ${input.verifyScore}/5`);
  }
  if (input.tutorRubric) {
    lines.push(`Tutor rubric: ${input.tutorRubric.replace("_", " ")}`);
  }

  lines.push(`Subject/topic: ${input.subject} / ${input.topic}`);
  return lines.join("\n");
}

export function parseTutorEvidence(raw: unknown): TutorEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const todaysGoal = typeof value.todaysGoal === "string" ? value.todaysGoal.trim() : "";
  const biggestMisconception =
    typeof value.biggestMisconception === "string" ? value.biggestMisconception.trim() : "";
  const whatChangedToday =
    typeof value.whatChangedToday === "string" ? value.whatChangedToday.trim() : "";
  const whatClickedRaw = typeof value.whatClicked === "string" ? value.whatClicked.trim() : "";
  // Prefer explicit click note; otherwise reuse what changed (fields were redundant).
  const whatClicked = whatClickedRaw || whatChangedToday;
  const independence =
    typeof value.independence === "number" ? clampScale(value.independence) : 0;

  if (!todaysGoal || !biggestMisconception || !whatChangedToday || independence < 1) {
    return null;
  }

  return {
    todaysGoal,
    biggestMisconception,
    whatClicked,
    independence,
    whatChangedToday,
  };
}

export function parseStudentEvidence(raw: unknown): StudentEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const stillConfusing =
    typeof value.stillConfusing === "string" ? value.stillConfusing.trim() : "";
  const whatChangedToday =
    typeof value.whatChangedToday === "string" ? value.whatChangedToday.trim() : "";
  const confidenceBefore =
    typeof value.confidenceBefore === "number" ? clampScale(value.confidenceBefore) : 0;
  const confidenceAfter =
    typeof value.confidenceAfter === "number" ? clampScale(value.confidenceAfter) : 0;

  if (!whatChangedToday || confidenceBefore < 1 || confidenceAfter < 1) {
    return null;
  }

  return {
    confidenceBefore,
    confidenceAfter,
    stillConfusing,
    whatChangedToday,
  };
}

export function parseTeacherEvidence(raw: unknown): TeacherEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const whatChangedToday =
    typeof value.whatChangedToday === "string" ? value.whatChangedToday.trim() : "";
  if (!whatChangedToday) return null;
  return { whatChangedToday };
}

export function fuseEvidence(input: {
  subject: string;
  topic: string;
  tutorEvidence?: TutorEvidence | null;
  studentEvidence?: StudentEvidence | null;
  teacherEvidence?: TeacherEvidence | null;
  verifyScore?: number | null;
  tutorRubric?: TutorRubric | null;
}): FusedLearningEpisode {
  const tutor = input.tutorEvidence ?? undefined;
  const student = input.studentEvidence ?? undefined;
  const teacher = input.teacherEvidence ?? undefined;
  const confidenceDelta =
    student != null ? student.confidenceAfter - student.confidenceBefore : undefined;

  const headline = pickHeadline({ tutor, student, teacher });
  const outcome = deriveOutcome({
    verifyScore: input.verifyScore,
    independence: tutor?.independence,
    confidenceBefore: student?.confidenceBefore,
    confidenceAfter: student?.confidenceAfter,
  });

  return {
    topic: input.topic,
    headline,
    summary: buildSummary({
      subject: input.subject,
      topic: input.topic,
      headline,
      tutor,
      student,
      teacher,
      verifyScore: input.verifyScore,
      tutorRubric: input.tutorRubric,
    }),
    outcome,
    approach: tutor?.whatClicked || undefined,
    when: new Date().toISOString(),
    score: input.verifyScore ?? undefined,
    signals: {
      tutor,
      student,
      teacher,
      verifyScore: input.verifyScore ?? undefined,
      tutorRubric: input.tutorRubric ?? undefined,
      confidenceDelta,
    },
  };
}

export function studentExplanationFromEvidence(evidence: StudentEvidence): string {
  return [evidence.whatChangedToday, evidence.stillConfusing].filter(Boolean).join(" ");
}
