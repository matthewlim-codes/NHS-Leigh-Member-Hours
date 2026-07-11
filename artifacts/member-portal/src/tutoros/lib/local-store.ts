import type {
  PrepBrief,
  PracticeProblem,
  SessionListResponse,
  SessionType,
  TutorOsSession,
  TutorRubric,
  TutoringRequest,
  TutoringRequestStatus,
} from "./api";
import {
  buildDemoTuteeMemoryMap,
  DEMO_TUTORING_REQUESTS,
  slugifyTutee,
  teacherNotesFromMemory,
} from "./demo-data";
import {
  normalizePracticeProblems,
  templatePracticeProblems,
} from "./practice-problems-templates";

const SESSIONS_KEY = "tutoros-sessions-v1";
const MEMORY_KEY = "tutoros-memory-v2";
const REQUESTS_KEY = "tutoros-requests-v1";
const PREP_FN_URL = "https://api.butterbase.ai/v1/app_tsc2mvlq21yo/fn/prep-brief";

const TEMPLATE_CREATED_AT = "2026-07-11T16:00:00.000Z";

/** Demo open requests teachers would post for tutors to claim. */
const TEMPLATE_TUTORING_REQUESTS: TutoringRequest[] = [
  {
    id: "template-math-im2-jordan",
    studentName: "Jordan Lee",
    grade: "10",
    assignedBy: "Ms. Patel · IM2 Period 2",
    subject: "Algebra II / IM2",
    topic: "factoring",
    notes: "Needs help factoring quadratics before the unit quiz. Prefers worked examples.",
    status: "open",
    claimedByUsername: null,
    claimedAt: null,
    createdAt: TEMPLATE_CREATED_AT,
    updatedAt: TEMPLATE_CREATED_AT,
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
    status: "open",
    claimedByUsername: null,
    claimedAt: null,
    createdAt: "2026-07-11T16:05:00.000Z",
    updatedAt: "2026-07-11T16:05:00.000Z",
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
    status: "open",
    claimedByUsername: null,
    claimedAt: null,
    createdAt: "2026-07-11T16:10:00.000Z",
    updatedAt: "2026-07-11T16:10:00.000Z",
  },
];

interface TuteeMemory {
  tuteeSlug: string;
  tuteeName: string;
  profile: {
    preferredApproach?: string;
    struggles?: string[];
    skills?: string[];
    teacherNotes?: string[];
    grade?: string;
    assignedBy?: string;
    [key: string]: unknown;
  };
  episodes: Array<{
    topic: string;
    summary: string;
    outcome?: string;
    approach?: string;
    score?: number;
  }>;
}

function slugify(name: string): string {
  return slugifyTutee(name);
}

function readSessions(): TutorOsSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TutorOsSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeSessions(sessions: TutorOsSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function readMemoryMap(): Record<string, TuteeMemory> {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return seedDemoMemory();
    const parsed = JSON.parse(raw) as Record<string, TuteeMemory>;
    return parsed && typeof parsed === "object" ? { ...seedDemoMemory(), ...parsed } : seedDemoMemory();
  } catch {
    return seedDemoMemory();
  }
}

function writeMemoryMap(map: Record<string, TuteeMemory>) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(map));
}

function seedDemoMemory(): Record<string, TuteeMemory> {
  return buildDemoTuteeMemoryMap();
}

function buildTemplateBrief(input: {
  tuteeName: string;
  subject: string;
  topic: string;
  memory: TuteeMemory | null;
}): PrepBrief {
  const { tuteeName, subject, topic, memory } = input;
  const teacherNotes = teacherNotesFromMemory(memory);
  if (!memory || memory.episodes.length === 0) {
    const contextBullets =
      teacherNotes.length > 0
        ? teacherNotes
        : [`Teacher focus area: ${topic}`, "Check in on confidence before diving into problems."];
    return {
      struggles: Array.isArray(memory?.profile.struggles)
        ? memory.profile.struggles.map(String)
        : [`No prior TutorOS memory for ${tuteeName} yet.`],
      recommendedApproach: "Confidence-building warm-up, then one guided example.",
      workedExample: `Walk one worked example for ${topic} in ${subject} together, then ask the student to try a near-transfer problem.`,
      watchFors: [
        "Ask them to explain the first step before solving.",
        "Stop and re-teach if they freeze for >20 seconds.",
      ],
      contextTitle: teacherNotes.length > 0 ? "What the teacher noted" : "What they need help with",
      contextBullets,
      approachBullets: [
        "Open with a quick warm-up question on a prerequisite skill.",
        "Model one example out loud, narrating each step.",
        "Hand off a similar problem and coach while they work.",
      ],
      workedExampleSteps: [
        { label: "Model", detail: `Walk through one ${topic} example together in ${subject}.` },
        { label: "Coach", detail: "Have the student explain each step before writing." },
        { label: "Transfer", detail: "Give a similar problem and let them try with hints." },
      ],
      misconceptionTips: [
        "Ask them to explain the first step before solving.",
        "Stop and re-teach if they freeze for >20 seconds.",
      ],
      teacherNotes: teacherNotes.length > 0 ? teacherNotes : undefined,
      coachNote: `You're meeting ${tuteeName} for ${subject} on ${topic}. Start with a quick confidence check, teach one clear example out loud, then hand them a similar problem while you coach. Keep the session interactive — have them narrate each step.`,
      memorySource: teacherNotes.length > 0 ? "demo" : "empty",
      isAdapted: false,
    };
  }

  const episode = memory.episodes[0];
  const preferred = memory.profile.preferredApproach ?? "visual / structured walkthrough";

  return {
    struggles: [episode.summary, ...(memory.profile.struggles ?? []).slice(0, 2)],
    recommendedApproach: `Use ${preferred} — prior sessions show this works better for ${tuteeName}.`,
    workedExample:
      "Box method for x² + 5x + 6: fill the box with factors of 6 that sum to 5 → (x+2)(x+3). Have them place the terms.",
    watchFors: [
      "Watch for the same mistake from last time.",
      "Have them narrate each step out loud.",
      "Avoid jumping straight to formulas — start with the box method.",
    ],
    contextTitle: "Last session review",
    contextBullets: [
      `Last time: ${episode.summary}`,
      `Strategy that helped: ${preferred}`,
      "What to adjust: slow down before independent practice.",
    ],
    approachBullets: [
      `Start with ${preferred} — it worked before for ${tuteeName}.`,
      "Ask what they remember from last session before re-teaching.",
      "Give one guided example, then a near-transfer problem.",
    ],
    workedExampleSteps: [
      { label: "Set up", detail: "Draw a 2×2 box for x² + 5x + 6." },
      { label: "Fill factors", detail: "Find factors of 6 that sum to 5: 2 and 3." },
      { label: "Write answer", detail: "Read off (x + 2)(x + 3). Have the student place terms." },
    ],
    misconceptionTips: [
      "Watch for the same mistake from last time.",
      "Have them narrate each step out loud.",
      "Avoid jumping straight to formulas — start with the box method.",
    ],
    coachNote: `${tuteeName} already has history on ${topic}: ${episode.summary} Lead with ${preferred}. Open by asking what they remember from last time, then rebuild the idea with a visual example before any independent practice.`,
    memorySource: "demo",
    isAdapted: true,
  };
}

async function fetchAiPrepBrief(input: {
  tuteeName: string;
  subject: string;
  topic: string;
  memory: TuteeMemory | null;
}): Promise<PrepBrief | null> {
  try {
    const response = await fetch(PREP_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tuteeName: input.tuteeName,
        subject: input.subject,
        topic: input.topic,
        memory: input.memory,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as PrepBrief & { error?: string };
    if (!data || data.error) return null;
    if (!data.recommendedApproach || !data.workedExample) return null;
    return {
      struggles: Array.isArray(data.struggles) ? data.struggles : [],
      recommendedApproach: String(data.recommendedApproach),
      workedExample: String(data.workedExample),
      watchFors: Array.isArray(data.watchFors) ? data.watchFors : [],
      contextTitle: data.contextTitle ? String(data.contextTitle) : undefined,
      contextBullets: Array.isArray(data.contextBullets) ? data.contextBullets : undefined,
      approachBullets: Array.isArray(data.approachBullets) ? data.approachBullets : undefined,
      workedExampleSteps: Array.isArray(data.workedExampleSteps)
        ? data.workedExampleSteps
        : undefined,
      misconceptionTips: Array.isArray(data.misconceptionTips)
        ? data.misconceptionTips
        : undefined,
      teacherNotes: Array.isArray(data.teacherNotes) ? data.teacherNotes : undefined,
      coachNote: data.coachNote ? String(data.coachNote) : undefined,
      memorySource: data.memorySource === "ai" ? "ai" : data.isAdapted ? "demo" : "empty",
      isAdapted: Boolean(data.isAdapted),
    };
  } catch {
    return null;
  }
}

function buildExitProblem(subject: string, topic: string): string {
  const t = `${subject} ${topic}`.toLowerCase();
  if (t.includes("factor") || t.includes("algebra")) return "Factor: x² + 7x + 12";
  if (t.includes("linear")) return "Solve: 2x + 5 = 17";
  return `Write one sentence explaining today's idea for ${topic}, then solve a similar practice problem.`;
}

function scoreVerification(input: {
  explanation: string;
  answer: string;
  topic: string;
  tutorRubric: TutorRubric;
}) {
  const explanation = input.explanation.trim().toLowerCase();
  const answer = input.answer.trim().toLowerCase();
  let score = 1;
  score += explanation.length > 40 ? 2 : explanation.length > 15 ? 1 : 0;

  const topic = input.topic.toLowerCase();
  let correct = false;
  if (topic.includes("factor") || topic.includes("algebra")) {
    correct =
      (answer.includes("x+3") && answer.includes("x+4")) ||
      answer.includes("(x+3)(x+4)") ||
      answer.includes("(x+4)(x+3)");
  } else if (topic.includes("linear")) {
    correct = answer.includes("6");
  } else {
    correct = answer.length > 2;
  }

  if (correct) score += 2;
  else if (answer.length > 0) score += 1;
  score = Math.max(1, Math.min(5, score));

  const mismatch =
    (input.tutorRubric === "independent" && score <= 2) ||
    (input.tutorRubric === "not_yet" && score >= 4);

  return {
    score,
    mismatch,
    learningMoment: score >= 3 && !mismatch,
    notes: correct
      ? "Exit problem looks correct; explanation quality factored into score."
      : "Exit problem incomplete or incorrect; score reflects explanation + attempt.",
  };
}

function upsertSession(session: TutorOsSession) {
  const sessions = readSessions().filter((s) => s.id !== session.id);
  sessions.unshift(session);
  writeSessions(sessions.slice(0, 100));
  return session;
}

function rememberAfterVerify(session: TutorOsSession) {
  if (session.verifyScore == null) return;
  const map = readMemoryMap();
  const existing = map[session.tuteeSlug] ?? {
    tuteeSlug: session.tuteeSlug,
    tuteeName: session.tuteeName,
    profile: {},
    episodes: [],
  };

  const episode = {
    topic: session.topic,
    summary: `Session on ${session.subject} / ${session.topic}. Verify score ${session.verifyScore}/5.`,
    outcome: session.verifyScore >= 4 ? "improved" : session.verifyScore >= 3 ? "partial" : "struggled",
    approach: session.prepBrief.isAdapted ? "box method / visual" : "initial",
    score: session.verifyScore,
  };

  const skills = [...(existing.profile.skills ?? [])];
  if (session.verifyScore >= 4) skills.unshift(`factors ${session.topic} with guidance`);

  map[session.tuteeSlug] = {
    ...existing,
    tuteeName: session.tuteeName,
    profile: {
      ...existing.profile,
      preferredApproach:
        session.verifyScore >= 3
          ? "visual / box method"
          : existing.profile.preferredApproach ?? "visual / step-by-step",
      skills: skills.slice(0, 8),
    },
    episodes: [episode, ...existing.episodes].slice(0, 20),
  };
  writeMemoryMap(map);
}

function demoRequestToTutoringRequest(demo: (typeof DEMO_TUTORING_REQUESTS)[number]): TutoringRequest {
  return {
    id: demo.id,
    studentName: demo.studentName,
    grade: demo.grade,
    assignedBy: demo.assignedBy,
    subject: demo.subject,
    topic: demo.topic,
    notes: demo.notes,
    status: "open",
    claimedByUsername: null,
    claimedAt: null,
    createdAt: demo.createdAt,
    updatedAt: demo.createdAt,
  };
}

function ensureTemplateRequests(existing: TutoringRequest[]): TutoringRequest[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  let changed = false;
  for (const demo of DEMO_TUTORING_REQUESTS) {
    if (!byId.has(demo.id)) {
      byId.set(demo.id, demoRequestToTutoringRequest(demo));
      changed = true;
    }
  }
  const merged = Array.from(byId.values());
  if (changed || !localStorage.getItem(REQUESTS_KEY)) {
    writeRequests(merged);
  }
  return merged;
}

function readRequests(): TutoringRequest[] {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    let parsed: TutoringRequest[] = [];
    if (raw) {
      const value = JSON.parse(raw) as TutoringRequest[];
      parsed = Array.isArray(value) ? value : [];
    }
    return ensureTemplateRequests(parsed);
  } catch {
    return ensureTemplateRequests([]);
  }
}

function writeRequests(requests: TutoringRequest[]) {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
}

export const localTutorOs = {
  async startSession(input: {
    tuteeName: string;
    subject: string;
    topic: string;
  }): Promise<TutorOsSession> {
    const tuteeSlug = slugify(input.tuteeName);
    const memory = readMemoryMap()[tuteeSlug] ?? null;
    const aiBrief = await fetchAiPrepBrief({
      tuteeName: input.tuteeName,
      subject: input.subject,
      topic: input.topic,
      memory,
    });
    const prepBrief =
      aiBrief ??
      buildTemplateBrief({
        tuteeName: input.tuteeName,
        subject: input.subject,
        topic: input.topic,
        memory,
      });
    const now = new Date().toISOString();
    const session: TutorOsSession = {
      id: crypto.randomUUID(),
      tutorUsername: "local-tutor",
      tuteeName: input.tuteeName.trim(),
      tuteeSlug,
      subject: input.subject.trim(),
      topic: input.topic.trim(),
      status: "prep",
      prepBrief,
      startedAt: null,
      timerStarted: false,
      exitProblem: buildExitProblem(input.subject, input.topic),
      createdAt: now,
      updatedAt: now,
    };
    return upsertSession(session);
  },

  listMySessions(): SessionListResponse {
    const sessions = readSessions();
    return {
      sessions,
      stats: {
        total: sessions.filter((s) => s.timerStarted || s.status === "verified").length,
        learningMoments: sessions.filter((s) => s.learningMoment).length,
        unverified: sessions.filter(
          (s) =>
            s.timerStarted &&
            (s.status === "logged" || s.status === "awaiting_verify"),
        ).length,
        awaitingVerify: sessions.filter(
          (s) => s.status === "awaiting_verify" && s.timerStarted,
        ).length,
      },
    };
  },

  getSession(id: string): TutorOsSession {
    const session = readSessions().find((s) => s.id === id);
    if (!session) throw new Error("Session not found");
    return session;
  },

  beginSession(id: string): TutorOsSession {
    const session = this.getSession(id);
    return upsertSession({
      ...session,
      status: "active",
      startedAt: new Date().toISOString(),
      timerStarted: true,
      updatedAt: new Date().toISOString(),
    });
  },

  endSession(
    id: string,
    input: { tutorRubric: TutorRubric; sessionType: SessionType; durationMinutes?: number },
  ): TutorOsSession {
    const session = this.getSession(id);
    if (session.status !== "active" || !session.timerStarted) {
      throw new Error("Session timer must be running before ending");
    }
    const endedAt = new Date().toISOString();
    const durationMinutes =
      input.durationMinutes ??
      Math.max(
        1,
        Math.round(
          (Date.parse(endedAt) - Date.parse(session.startedAt ?? endedAt)) / 60000,
        ),
      );
    return upsertSession({
      ...session,
      status: "awaiting_verify",
      endedAt,
      durationMinutes,
      sessionType: input.sessionType,
      tutorRubric: input.tutorRubric,
      updatedAt: endedAt,
    });
  },

  verifySession(id: string, input: { explanation: string; answer: string }): TutorOsSession {
    const session = this.getSession(id);
    if (!session.tutorRubric) throw new Error("Tutor must complete the rubric before verify");
    const scored = scoreVerification({
      explanation: input.explanation,
      answer: input.answer,
      topic: session.topic,
      tutorRubric: session.tutorRubric,
    });
    const updated = upsertSession({
      ...session,
      status: "verified",
      verifyExplanation: input.explanation,
      verifyAnswer: input.answer,
      verifyScore: scored.score,
      verifyMismatch: scored.mismatch,
      learningMoment: scored.learningMoment,
      memoryNotes: { notes: scored.notes },
      updatedAt: new Date().toISOString(),
    });
    rememberAfterVerify(updated);
    return updated;
  },

  purgeSessions(input: { tuteeName?: string; tuteeSlug?: string } = {}): {
    deleted: number;
    ids: string[];
  } {
    const sessions = readSessions();
    const kept = sessions.filter((s) => {
      if (input.tuteeSlug && s.tuteeSlug !== input.tuteeSlug) return true;
      if (
        input.tuteeName &&
        s.tuteeName.trim().toLowerCase() !== input.tuteeName.trim().toLowerCase()
      ) {
        return true;
      }
      if (!input.tuteeSlug && !input.tuteeName) return false;
      return false;
    });
    const deletedIds = sessions.filter((s) => !kept.includes(s)).map((s) => s.id);
    writeSessions(kept);
    return { deleted: deletedIds.length, ids: deletedIds };
  },

  listTutoringRequests(filter?: {
    status?: TutoringRequestStatus;
  }): { requests: TutoringRequest[] } {
    let requests = readRequests();
    if (filter?.status) {
      requests = requests.filter((r) => r.status === filter.status);
    }
    return {
      requests: requests.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    };
  },

  createTutoringRequest(input: {
    studentName: string;
    grade: string;
    assignedBy: string;
    subject: string;
    topic: string;
    notes?: string;
  }): TutoringRequest {
    const now = new Date().toISOString();
    const request: TutoringRequest = {
      id: crypto.randomUUID(),
      studentName: input.studentName.trim(),
      grade: input.grade.trim(),
      assignedBy: input.assignedBy.trim(),
      subject: input.subject.trim(),
      topic: input.topic.trim(),
      notes: input.notes?.trim() || null,
      status: "open",
      claimedByUsername: null,
      claimedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const all = readRequests();
    all.unshift(request);
    writeRequests(all);
    return request;
  },

  claimTutoringRequest(id: string): TutoringRequest {
    const all = readRequests();
    const idx = all.findIndex((r) => r.id === id);
    if (idx < 0 || all[idx].status !== "open") {
      throw new Error("Open request not found");
    }
    const now = new Date().toISOString();
    all[idx] = {
      ...all[idx],
      status: "claimed",
      claimedByUsername: "local-tutor",
      claimedAt: now,
      updatedAt: now,
    };
    writeRequests(all);
    return all[idx];
  },

  generatePracticeProblems(sessionId: string): TutorOsSession {
    const session = this.getSession(sessionId);
    const practiceProblems = templatePracticeProblems({
      subject: session.subject,
      topic: session.topic,
    });
    return upsertSession({
      ...session,
      prepBrief: { ...session.prepBrief, practiceProblems },
      updatedAt: new Date().toISOString(),
    });
  },

  updatePracticeProblems(
    sessionId: string,
    practiceProblems: PracticeProblem[],
  ): TutorOsSession {
    const session = this.getSession(sessionId);
    return upsertSession({
      ...session,
      prepBrief: {
        ...session.prepBrief,
        practiceProblems: normalizePracticeProblems(practiceProblems),
      },
      updatedAt: new Date().toISOString(),
    });
  },
};
