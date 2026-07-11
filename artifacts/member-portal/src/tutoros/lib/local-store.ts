import type {
  CommandResponse,
  PrepBrief,
  SessionListResponse,
  SessionType,
  TutorOsSession,
  TutorRubric,
} from "./api";

const SESSIONS_KEY = "tutoros-sessions-v1";
const MEMORY_KEY = "tutoros-memory-v1";

interface TuteeMemory {
  tuteeSlug: string;
  tuteeName: string;
  profile: {
    preferredApproach?: string;
    struggles?: string[];
    skills?: string[];
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
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function readSessions(): TutorOsSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TutorOsSession[];
    return Array.isArray(parsed) ? parsed : [];
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
    if (!raw) return seedMaria();
    const parsed = JSON.parse(raw) as Record<string, TuteeMemory>;
    return parsed && typeof parsed === "object" ? { ...seedMaria(), ...parsed } : seedMaria();
  } catch {
    return seedMaria();
  }
}

function writeMemoryMap(map: Record<string, TuteeMemory>) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(map));
}

function seedMaria(): Record<string, TuteeMemory> {
  return {
    maria: {
      tuteeSlug: "maria",
      tuteeName: "Maria",
      profile: {
        preferredApproach: "visual / box method",
        struggles: ["sign errors when factoring", "jumps to FOIL without structure"],
        skills: ["needs guidance on factoring quadratics"],
      },
      episodes: [
        {
          topic: "factoring quadratics",
          summary:
            "Tried factoring x²+5x+6 with FOIL reverse only. Got stuck on signs. Score 2/5.",
          outcome: "struggled",
          approach: "formula-first",
          score: 2,
        },
      ],
    },
  };
}

function buildPrepBrief(input: {
  tuteeName: string;
  subject: string;
  topic: string;
  memory: TuteeMemory | null;
}): PrepBrief {
  const { tuteeName, subject, topic, memory } = input;
  if (!memory || memory.episodes.length === 0) {
    return {
      struggles: [`No prior TutorOS memory for ${tuteeName} yet.`],
      recommendedApproach: "Confidence-building warm-up, then one guided example.",
      workedExample: workedExampleFor(subject, topic, false),
      watchFors: [
        "Ask them to explain the first step before solving.",
        "Stop and re-teach if they freeze for >20 seconds.",
      ],
      memorySource: "empty",
      isAdapted: false,
    };
  }

  const episode = memory.episodes[0];
  const preferred = memory.profile.preferredApproach ?? "visual / structured walkthrough";
  const struggles = memory.profile.struggles ?? [episode.summary];

  return {
    struggles: [episode.summary, ...struggles.filter((s) => !episode.summary.includes(s)).slice(0, 2)],
    recommendedApproach: `Use ${preferred} — prior sessions show this works better for ${tuteeName}.`,
    workedExample: workedExampleFor(subject, topic, true),
    watchFors: [
      "Watch for the same mistake from last time.",
      "Have them narrate each step out loud.",
      episode.approach === "formula-first"
        ? "Avoid jumping straight to formulas — start with the box method."
        : "Confirm they can transfer the approach to a new problem.",
    ],
    memorySource: "demo",
    isAdapted: true,
  };
}

function workedExampleFor(subject: string, topic: string, adapted: boolean): string {
  const t = `${subject} ${topic}`.toLowerCase();
  if (t.includes("factor") || t.includes("algebra")) {
    return adapted
      ? "Box method for x² + 5x + 6: fill the box with factors of 6 that sum to 5 → (x+2)(x+3). Have Maria place the terms herself."
      : "Factor x² + 5x + 6 by finding two numbers that multiply to 6 and add to 5 → (x+2)(x+3).";
  }
  return `Walk one worked example for ${topic} together, then ask the student to try a near-transfer problem.`;
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
          : existing.profile.preferredApproach ?? "visual / box method",
      skills: skills.slice(0, 8),
    },
    episodes: [episode, ...existing.episodes].slice(0, 20),
  };
  writeMemoryMap(map);
}

export const localTutorOs = {
  startSession(input: { tuteeName: string; subject: string; topic: string }): TutorOsSession {
    const tuteeSlug = slugify(input.tuteeName);
    const memory = readMemoryMap()[tuteeSlug] ?? null;
    const now = new Date().toISOString();
    const session: TutorOsSession = {
      id: crypto.randomUUID(),
      tutorUsername: "local-tutor",
      tuteeName: input.tuteeName.trim(),
      tuteeSlug,
      subject: input.subject.trim(),
      topic: input.topic.trim(),
      status: "prep",
      prepBrief: buildPrepBrief({
        tuteeName: input.tuteeName,
        subject: input.subject,
        topic: input.topic,
        memory,
      }),
      startedAt: now,
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
        total: sessions.length,
        learningMoments: sessions.filter((s) => s.learningMoment).length,
        unverified: sessions.filter(
          (s) => s.status === "logged" || s.status === "awaiting_verify",
        ).length,
        awaitingVerify: sessions.filter((s) => s.status === "awaiting_verify").length,
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
      updatedAt: new Date().toISOString(),
    });
  },

  endSession(
    id: string,
    input: { tutorRubric: TutorRubric; sessionType: SessionType; durationMinutes?: number },
  ): TutorOsSession {
    const session = this.getSession(id);
    const endedAt = new Date().toISOString();
    const durationMinutes =
      input.durationMinutes ??
      Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(session.startedAt)) / 60000));
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

  getCommandView(): CommandResponse {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const iso = start.toISOString();
    const sessions = readSessions().filter((s) => s.startedAt >= iso);
    const flagged = sessions.filter((s) => s.verifyMismatch);
    const hours =
      Math.round((sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0) / 60) * 10) / 10;

    return {
      label: "Tonight — HW Center & Tutorial",
      sessionsCount: sessions.length,
      verifiedCount: sessions.filter((s) => s.learningMoment).length,
      hours,
      flaggedCount: flagged.length,
      flagged: flagged.map((s) => ({
        id: s.id,
        tuteeName: s.tuteeName,
        subject: s.subject,
        topic: s.topic,
        tutorUsername: s.tutorUsername,
        verifyScore: s.verifyScore,
        tutorRubric: s.tutorRubric,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        tuteeName: s.tuteeName,
        subject: s.subject,
        topic: s.topic,
        tutorUsername: s.tutorUsername,
        status: s.status,
        learningMoment: s.learningMoment,
        verifyScore: s.verifyScore,
        verifyMismatch: s.verifyMismatch,
        durationMinutes: s.durationMinutes,
        sessionType: s.sessionType,
      })),
    };
  },
};
