/**
 * Demo students and teacher requests — aligned with the teacher portal placeholders.
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
}

export const DEMO_TUTORING_REQUESTS: DemoTutoringRequestSeed[] = [
  {
    id: "demo-req-maria-garcia",
    studentName: "Maria Garcia",
    grade: "10",
    assignedBy: "Ms. Chen · Period 3",
    subject: "Algebra II",
    topic: "factoring quadratics",
    notes:
      "Recent quiz showed sign errors when factoring. Struggles with word problems; prefers visuals and step-by-step models.",
  },
  {
    id: "demo-req-alex-rivera",
    studentName: "Alex Rivera",
    grade: "10",
    assignedBy: "Ms. Chen · Period 3",
    subject: "Algebra II",
    topic: "factoring quadratics",
    notes:
      "Struggles with word problems; prefers visuals. Needs help connecting factors back to the original equation.",
  },
];

const MARIA = DEMO_TUTORING_REQUESTS[0];

export function buildMariaGarciaMemory(): DemoTuteeMemorySeed {
  return {
    tuteeSlug: slugifyTutee(MARIA.studentName),
    tuteeName: MARIA.studentName,
    profile: {
      grade: MARIA.grade,
      assignedBy: MARIA.assignedBy,
      teacherNotes: [
        `Assigned by ${MARIA.assignedBy} for ${MARIA.subject}`,
        "Recent quiz showed sign errors when factoring trinomials",
        "Struggles with word problems — prefers visual, step-by-step models",
        "Confidence drops quickly when signs flip; start with encouragement",
      ],
      preferredApproach: "visual / step-by-step",
      struggles: ["sign errors when factoring", "word problems feel overwhelming"],
      skills: [],
    },
    episodes: [],
  };
}

export function buildDemoTuteeMemoryMap(): Record<string, DemoTuteeMemorySeed> {
  const maria = buildMariaGarciaMemory();
  return { [maria.tuteeSlug]: maria };
}

export function teacherNotesFromMemory(
  memory: DemoTuteeMemorySeed | { profile: DemoTuteeMemorySeed["profile"] } | null,
): string[] {
  if (!memory) return [];
  const notes = memory.profile.teacherNotes;
  return Array.isArray(notes) ? notes.map(String).filter(Boolean) : [];
}
