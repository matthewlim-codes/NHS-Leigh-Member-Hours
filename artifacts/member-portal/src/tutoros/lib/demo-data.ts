/**
 * Demo students and teacher requests — aligned with teacher-assign template cards.
 * Keep in sync with artifacts/api-server/src/lib/tutoros-demo-data.ts
 */

export function slugifyTutee(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface DemoTuteeMemorySeed {
  tuteeSlug: string;
  tuteeName: string;
  profile: {
    grade?: string;
    assignedBy?: string;
    teacherNotes?: string[];
    preferredApproach?: string;
    struggles?: string[];
    skills?: string[];
    [key: string]: unknown;
  };
  episodes: Array<{
    topic: string;
    summary: string;
    outcome?: string;
    approach?: string;
    when?: string;
    score?: number;
  }>;
}

export interface DemoTutoringRequestSeed {
  id: string;
  studentName: string;
  grade: string;
  assignedBy: string;
  subject: string;
  topic: string;
  notes: string;
  createdAt: string;
}

export const TEMPLATE_CREATED_AT = "2026-07-11T16:00:00.000Z";

/** Demo open requests teachers would post for tutors to claim. */
export const DEMO_TUTORING_REQUESTS: DemoTutoringRequestSeed[] = [
  {
    id: "template-math-im2-jordan",
    studentName: "Jordan Lee",
    grade: "10",
    assignedBy: "Ms. Patel · IM2 Period 2",
    subject: "Algebra II / IM2",
    topic: "factoring",
    notes: "Needs help factoring quadratics before the unit quiz. Prefers worked examples.",
    createdAt: TEMPLATE_CREATED_AT,
  },
  {
    id: "template-chem-honors-sam",
    studentName: "Sam Nguyen",
    grade: "11",
    assignedBy: "Mr. Ortiz · Chemistry Honors",
    subject: "Chemistry Honors",
    topic: "periodic trends",
    notes:
      "Struggles with electronegativity, atomic radius, and ionization energy across the periodic table.",
    createdAt: "2026-07-11T16:05:00.000Z",
  },
  {
    id: "template-english-maya",
    studentName: "Maya Brooks",
    grade: "9",
    assignedBy: "Ms. Rivera · English 9",
    subject: "English",
    topic: "essay writing · passive vs active voice",
    notes:
      "Essay drafts lean on passive voice. Needs grammar rules and practice rewriting sentences in active voice.",
    createdAt: "2026-07-11T16:10:00.000Z",
  },
];

const JORDAN = DEMO_TUTORING_REQUESTS[0];

/** First-session tutee memory — no prior TutorOS episodes, teacher notes only. */
export function buildJordanLeeMemory(): DemoTuteeMemorySeed {
  return {
    tuteeSlug: slugifyTutee(JORDAN.studentName),
    tuteeName: JORDAN.studentName,
    profile: {
      grade: JORDAN.grade,
      assignedBy: JORDAN.assignedBy,
      teacherNotes: [
        `Assigned by ${JORDAN.assignedBy} for ${JORDAN.subject}`,
        JORDAN.notes,
      ],
      preferredApproach: "worked examples / step-by-step",
      struggles: ["factoring quadratics before the unit quiz"],
      skills: [],
    },
    episodes: [],
  };
}

export function buildDemoTuteeMemoryMap(): Record<string, DemoTuteeMemorySeed> {
  const jordan = buildJordanLeeMemory();
  return { [jordan.tuteeSlug]: jordan };
}

export function teacherNotesFromMemory(
  memory: DemoTuteeMemorySeed | { profile: DemoTuteeMemorySeed["profile"] } | null,
): string[] {
  if (!memory) return [];
  const notes = memory.profile.teacherNotes;
  return Array.isArray(notes) ? notes.map(String).filter(Boolean) : [];
}
