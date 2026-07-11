/**
 * Butterbase data plane client for TutorOS sessions + tutee memory.
 * Falls back to an in-memory store when BUTTERBASE_API_KEY is unset.
 */

import {
  buildDemoTuteeMemoryMap,
  DEMO_TUTORING_REQUESTS,
  slugifyTutee,
  teacherNotesFromMemory,
} from "./tutoros-demo-data";

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;

export type SessionStatus = "prep" | "active" | "awaiting_verify" | "verified" | "logged";

export type TutorRubric = "independent" | "with_hints" | "not_yet";
export type SessionType = "hw_center" | "tutorial";

export interface WorkedExampleStep {
  label: string;
  detail: string;
}

export type PracticeProblemDifficulty = "warm-up" | "guided" | "independent";

export interface PracticeProblem {
  id: string;
  prompt: string;
  steps: WorkedExampleStep[];
  discussionStems: string[];
  difficulty: PracticeProblemDifficulty;
}

export interface PrepBrief {
  struggles: string[];
  recommendedApproach: string;
  workedExample: string;
  watchFors: string[];
  /** Natural-language coaching paragraph from the LLM prep agent */
  coachNote?: string;
  contextTitle?: string;
  contextBullets?: string[];
  approachBullets?: string[];
  workedExampleSteps?: WorkedExampleStep[];
  misconceptionTips?: string[];
  teacherNotes?: string[];
  /** AI-generated (or tutor-edited) practice problems for the session */
  practiceProblems?: PracticeProblem[];
  memorySource: "everos" | "demo" | "empty" | "ai";
  isAdapted: boolean;
}

export interface TutorOsSession {
  id: string;
  tutorUsername: string;
  tuteeName: string;
  tuteeSlug: string;
  subject: string;
  topic: string;
  status: SessionStatus;
  prepBrief: PrepBrief;
  startedAt?: string | null;
  timerStarted?: boolean;
  endedAt?: string | null;
  durationMinutes?: number | null;
  sessionType?: SessionType | null;
  tutorRubric?: TutorRubric | null;
  verifyExplanation?: string | null;
  verifyAnswer?: string | null;
  verifyScore?: number | null;
  verifyMismatch?: boolean;
  learningMoment?: boolean;
  exitProblem?: string | null;
  memoryNotes?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TuteeMemory {
  tuteeSlug: string;
  tuteeName: string;
  profile: {
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

const memoryFallback = new Map<string, TuteeMemory>();
const sessionFallback = new Map<string, TutorOsSession>();

function seedDemoMemory() {
  for (const [slug, memory] of Object.entries(buildDemoTuteeMemoryMap())) {
    if (!memoryFallback.has(slug)) {
      memoryFallback.set(slug, memory);
    }
  }
}

seedDemoMemory();

function getApiKey(): string | undefined {
  return process.env.BUTTERBASE_API_KEY;
}

async function bbFetch(path: string, init?: RequestInit) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Butterbase ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mapSessionRow(row: Record<string, unknown>): TutorOsSession {
  return {
    id: String(row.id),
    tutorUsername: String(row.tutor_username),
    tuteeName: String(row.tutee_name),
    tuteeSlug: String(row.tutee_slug),
    subject: String(row.subject),
    topic: String(row.topic),
    status: row.status as SessionStatus,
    prepBrief: (row.prep_brief as PrepBrief) ?? emptyBrief(),
    startedAt: (row.started_at as string | null) ?? null,
    timerStarted: Boolean(row.timer_started ?? row.started_at),
    endedAt: (row.ended_at as string | null) ?? null,
    durationMinutes: (row.duration_minutes as number | null) ?? null,
    sessionType: (row.session_type as SessionType | null) ?? null,
    tutorRubric: (row.tutor_rubric as TutorRubric | null) ?? null,
    verifyExplanation: (row.verify_explanation as string | null) ?? null,
    verifyAnswer: (row.verify_answer as string | null) ?? null,
    verifyScore: (row.verify_score as number | null) ?? null,
    verifyMismatch: Boolean(row.verify_mismatch),
    learningMoment: Boolean(row.learning_moment),
    exitProblem: (row.exit_problem as string | null) ?? null,
    memoryNotes: (row.memory_notes as Record<string, unknown> | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

function emptyBrief(): PrepBrief {
  return {
    struggles: [],
    recommendedApproach: "Start with a warm-up example and check confidence.",
    workedExample: "Walk through one guided example together before independent practice.",
    watchFors: ["Check understanding before moving on."],
    memorySource: "empty",
    isAdapted: false,
  };
}

export function tuteeSlugFromName(name: string): string {
  return slugifyTutee(name);
}

/** Reset a tutee's memory to the demo first-session profile (teacher notes, no episodes). */
export async function resetTuteeMemory(tuteeSlug: string): Promise<TuteeMemory | null> {
  seedDemoMemory();
  const demo = buildDemoTuteeMemoryMap()[tuteeSlug];
  if (!demo) return null;

  memoryFallback.set(tuteeSlug, demo);
  await upsertTuteeMemory(demo);
  return demo;
}

export async function getTuteeMemory(tuteeSlug: string): Promise<TuteeMemory | null> {
  seedDemoMemory();
  try {
    const data = await bbFetch(
      `/tutee_memory?tutee_slug=eq.${encodeURIComponent(tuteeSlug)}&limit=1`,
    );
    if (Array.isArray(data) && data[0]) {
      const row = data[0] as Record<string, unknown>;
      return {
        tuteeSlug: String(row.tutee_slug),
        tuteeName: String(row.tutee_name),
        profile: (row.profile as TuteeMemory["profile"]) ?? {},
        episodes: (row.episodes as TuteeMemory["episodes"]) ?? [],
      };
    }
  } catch {
    // fall through to demo memory
  }
  return memoryFallback.get(tuteeSlug) ?? null;
}

export async function upsertTuteeMemory(memory: TuteeMemory): Promise<void> {
  memoryFallback.set(memory.tuteeSlug, memory);
  try {
    const existing = await bbFetch(
      `/tutee_memory?tutee_slug=eq.${encodeURIComponent(memory.tuteeSlug)}&limit=1`,
    );
    if (Array.isArray(existing) && existing[0]) {
      await bbFetch(`/tutee_memory?tutee_slug=eq.${encodeURIComponent(memory.tuteeSlug)}`, {
        method: "PATCH",
        body: JSON.stringify({
          tutee_name: memory.tuteeName,
          profile: memory.profile,
          episodes: memory.episodes,
          updated_at: new Date().toISOString(),
        }),
      });
      return;
    }
    await bbFetch(`/tutee_memory`, {
      method: "POST",
      body: JSON.stringify({
        tutee_slug: memory.tuteeSlug,
        tutee_name: memory.tuteeName,
        profile: memory.profile,
        episodes: memory.episodes,
      }),
    });
  } catch {
    // demo fallback already updated
  }
}

export function buildPrepBrief(input: {
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
      workedExample: workedExampleFor(subject, topic, false),
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
      workedExampleSteps: workedExampleStepsFor(subject, topic, false),
      misconceptionTips: [
        "Ask them to explain the first step before solving.",
        "Stop and re-teach if they freeze for >20 seconds.",
      ],
      teacherNotes: teacherNotes.length > 0 ? teacherNotes : undefined,
      memorySource: teacherNotes.length > 0 ? "demo" : "empty",
      isAdapted: false,
    };
  }

  const related = memory.episodes.filter((e) =>
    e.topic.toLowerCase().includes(topic.toLowerCase().split(" ")[0] ?? "") ||
    topic.toLowerCase().includes(e.topic.toLowerCase().split(" ")[0] ?? ""),
  );
  const episode = related[0] ?? memory.episodes[0];
  const preferred =
    typeof memory.profile.preferredApproach === "string"
      ? memory.profile.preferredApproach
      : "visual / structured walkthrough";
  const struggles = Array.isArray(memory.profile.struggles)
    ? memory.profile.struggles.map(String)
    : [episode.summary];

  return {
    struggles: [
      episode.summary,
      ...struggles.filter((s) => !episode.summary.includes(s)).slice(0, 2),
    ],
    recommendedApproach: `Use ${preferred} — prior sessions show this works better for ${tuteeName}.`,
    workedExample: workedExampleFor(subject, topic, true),
    watchFors: [
      "Watch for the same mistake from last time.",
      "Have them narrate each step out loud.",
      episode.approach === "formula-first"
        ? "Avoid jumping straight to formulas — start with the box method."
        : "Confirm they can transfer the approach to a new problem.",
    ],
    contextTitle: "Last session review",
    contextBullets: [
      `Last time: ${episode.summary}`,
      `Strategy that helped: ${preferred}`,
      episode.outcome === "improved"
        ? "What worked: visual structure kept them on track."
        : "What to adjust: slow down before independent practice.",
    ],
    approachBullets: [
      `Start with ${preferred} — it worked before for ${tuteeName}.`,
      "Ask what they remember from last session before re-teaching.",
      "Give one guided example, then a near-transfer problem.",
    ],
    workedExampleSteps: workedExampleStepsFor(subject, topic, true),
    misconceptionTips: [
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
  const steps = workedExampleStepsFor(subject, topic, adapted);
  return steps.map((s) => s.detail).join(" → ");
}

function workedExampleStepsFor(
  subject: string,
  topic: string,
  adapted: boolean,
): Array<{ label: string; detail: string }> {
  const t = `${subject} ${topic}`.toLowerCase();
  if (t.includes("factor") || t.includes("algebra")) {
    return adapted
      ? [
          { label: "Set up", detail: "Draw a 2×2 box for x² + 5x + 6." },
          { label: "Fill factors", detail: "Find factors of 6 that sum to 5: 2 and 3." },
          { label: "Write answer", detail: "Read off (x + 2)(x + 3). Have the student place terms." },
        ]
      : [
          { label: "Identify", detail: "Find two numbers that multiply to 6 and add to 5." },
          { label: "Factor", detail: "Those numbers are 2 and 3 → (x + 2)(x + 3)." },
          { label: "Check", detail: "Expand briefly to confirm the original expression." },
        ];
  }
  if (t.includes("sat") || t.includes("linear")) {
    return [
      { label: "Isolate the variable term", detail: "Add 7 to both sides: 3x − 7 + 7 = 11 + 7 → 3x = 18." },
      { label: "Solve for x", detail: "Divide both sides by 3 → x = 6." },
      { label: "Verify", detail: "Substitute x = 6 back: 3(6) − 7 = 11 ✓" },
    ];
  }
  return [
    { label: "Model", detail: `Walk through one ${topic} example together in ${subject}.` },
    { label: "Coach", detail: "Have the student explain each step before writing." },
    { label: "Transfer", detail: "Give a similar problem and let them try with hints." },
  ];
}

export function buildExitProblem(subject: string, topic: string): string {
  const t = `${subject} ${topic}`.toLowerCase();
  if (t.includes("factor") || t.includes("algebra")) {
    return "Factor: x² + 7x + 12";
  }
  if (t.includes("linear")) {
    return "Solve: 2x + 5 = 17";
  }
  return `Write one sentence explaining today's idea for ${topic}, then solve a similar practice problem.`;
}

export function scoreVerification(input: {
  explanation: string;
  answer: string;
  topic: string;
  tutorRubric: TutorRubric;
}): { score: number; mismatch: boolean; learningMoment: boolean; notes: string } {
  const explanation = input.explanation.trim().toLowerCase();
  const answer = input.answer.trim().toLowerCase();
  let score = 1;

  const explanationQuality =
    explanation.length > 40 ? 2 : explanation.length > 15 ? 1 : 0;
  score += explanationQuality;

  const topic = input.topic.toLowerCase();
  let correct = false;
  if (topic.includes("factor") || topic.includes("algebra")) {
    correct =
      (answer.includes("x+3") && answer.includes("x+4")) ||
      (answer.includes("(x+3)") && answer.includes("(x+4)")) ||
      answer.includes("(x+3)(x+4)") ||
      answer.includes("(x+4)(x+3)");
  } else if (topic.includes("linear")) {
    correct = answer.includes("6") || answer.replace(/\s/g, "") === "x=6";
  } else {
    correct = answer.length > 2;
  }

  if (correct) score += 2;
  else if (answer.length > 0) score += 1;

  score = Math.max(1, Math.min(5, score));

  const tutorHigh = input.tutorRubric === "independent";
  const tutorLow = input.tutorRubric === "not_yet";
  const mismatch =
    (tutorHigh && score <= 2) || (tutorLow && score >= 4) || (input.tutorRubric === "with_hints" && score === 5 && !correct);

  const learningMoment = score >= 3 && !mismatch;

  return {
    score,
    mismatch,
    learningMoment,
    notes: correct
      ? "Exit problem looks correct; explanation quality factored into score."
      : "Exit problem incomplete or incorrect; score reflects explanation + attempt.",
  };
}

export async function createSession(input: {
  tutorUsername: string;
  tuteeName: string;
  subject: string;
  topic: string;
}): Promise<TutorOsSession> {
  const tuteeSlug = slugifyTutee(input.tuteeName);
  const { generatePrepBrief } = await import("./prep-agent");
  const prepBrief = await generatePrepBrief({
    tuteeName: input.tuteeName,
    subject: input.subject,
    topic: input.topic,
    tuteeSlug,
  });
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const exitProblem = buildExitProblem(input.subject, input.topic);

  const session: TutorOsSession = {
    id,
    tutorUsername: input.tutorUsername,
    tuteeName: input.tuteeName.trim(),
    tuteeSlug,
    subject: input.subject.trim(),
    topic: input.topic.trim(),
    status: "prep",
    prepBrief,
    startedAt: null,
    timerStarted: false,
    exitProblem,
    createdAt: now,
    updatedAt: now,
  };

  sessionFallback.set(id, session);

  try {
    const row = await bbFetch(`/sessions`, {
      method: "POST",
      body: JSON.stringify({
        id,
        tutor_username: session.tutorUsername,
        tutee_name: session.tuteeName,
        tutee_slug: session.tuteeSlug,
        subject: session.subject,
        topic: session.topic,
        status: session.status,
        prep_brief: session.prepBrief,
        started_at: session.startedAt,
        timer_started: session.timerStarted ?? false,
        exit_problem: session.exitProblem,
      }),
    });
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return mapSessionRow(row as Record<string, unknown>);
    }
    if (Array.isArray(row) && row[0]) {
      return mapSessionRow(row[0] as Record<string, unknown>);
    }
  } catch {
    // use fallback
  }

  return session;
}

export async function getSession(id: string): Promise<TutorOsSession | null> {
  try {
    const data = await bbFetch(`/sessions?id=eq.${encodeURIComponent(id)}&limit=1`);
    if (Array.isArray(data) && data[0]) {
      const mapped = mapSessionRow(data[0] as Record<string, unknown>);
      sessionFallback.set(id, mapped);
      return mapped;
    }
  } catch {
    // fallback
  }
  return sessionFallback.get(id) ?? null;
}

export async function updateSession(
  id: string,
  patch: Partial<TutorOsSession>,
): Promise<TutorOsSession | null> {
  const current = await getSession(id);
  if (!current) return null;

  const updated: TutorOsSession = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  sessionFallback.set(id, updated);

  try {
    await bbFetch(`/sessions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: updated.status,
        started_at: updated.startedAt,
        timer_started: updated.timerStarted,
        ended_at: updated.endedAt,
        duration_minutes: updated.durationMinutes,
        session_type: updated.sessionType,
        tutor_rubric: updated.tutorRubric,
        verify_explanation: updated.verifyExplanation,
        verify_answer: updated.verifyAnswer,
        verify_score: updated.verifyScore,
        verify_mismatch: updated.verifyMismatch,
        learning_moment: updated.learningMoment,
        exit_problem: updated.exitProblem,
        memory_notes: updated.memoryNotes,
        prep_brief: updated.prepBrief,
        updated_at: updated.updatedAt,
      }),
    });
  } catch {
    // fallback already updated
  }

  return updated;
}

export async function purgeSessionsForTutor(
  tutorUsername: string,
  options?: { tuteeSlug?: string; tuteeName?: string },
): Promise<{ deleted: number; ids: string[] }> {
  const deletedIds: string[] = [];

  for (const [id, session] of sessionFallback.entries()) {
    if (session.tutorUsername !== tutorUsername) continue;
    if (options?.tuteeSlug && session.tuteeSlug !== options.tuteeSlug) continue;
    if (
      options?.tuteeName &&
      session.tuteeName.trim().toLowerCase() !== options.tuteeName.trim().toLowerCase()
    ) {
      continue;
    }
    sessionFallback.delete(id);
    deletedIds.push(id);
  }

  try {
    let query = `/sessions?tutor_username=eq.${encodeURIComponent(tutorUsername)}&select=id,tutee_slug,tutee_name&limit=100`;
    if (options?.tuteeSlug) {
      query += `&tutee_slug=eq.${encodeURIComponent(options.tuteeSlug)}`;
    }
    const data = await bbFetch(query);
    if (Array.isArray(data)) {
      for (const row of data) {
        const record = row as Record<string, unknown>;
        const id = String(record.id);
        if (
          options?.tuteeName &&
          String(record.tutee_name).trim().toLowerCase() !==
            options.tuteeName.trim().toLowerCase()
        ) {
          continue;
        }
        await bbFetch(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!deletedIds.includes(id)) deletedIds.push(id);
      }
    }
  } catch {
    // in-memory fallback already cleared
  }

  return { deleted: deletedIds.length, ids: deletedIds };
}

export async function listSessionsForTutor(tutorUsername: string): Promise<TutorOsSession[]> {
  try {
    const data = await bbFetch(
      `/sessions?tutor_username=eq.${encodeURIComponent(tutorUsername)}&order=created_at.desc&limit=50`,
    );
    if (Array.isArray(data)) {
      return data.map((row) => mapSessionRow(row as Record<string, unknown>));
    }
  } catch {
    // fallback
  }
  return [...sessionFallback.values()]
    .filter((s) => s.tutorUsername === tutorUsername)
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt));
}

export async function rememberAfterVerify(session: TutorOsSession): Promise<void> {
  if (session.verifyScore == null) return;

  const existing =
    (await getTuteeMemory(session.tuteeSlug)) ??
    ({
      tuteeSlug: session.tuteeSlug,
      tuteeName: session.tuteeName,
      profile: {},
      episodes: [],
    } satisfies TuteeMemory);

  const approach =
    session.prepBrief.isAdapted || session.verifyScore >= 4
      ? session.prepBrief.recommendedApproach
      : "needs follow-up";

  const episode = {
    topic: session.topic,
    summary: `Session on ${session.subject} / ${session.topic}. Verify score ${session.verifyScore}/5. Approach: ${approach}`,
    outcome: session.verifyScore >= 4 ? "improved" : session.verifyScore >= 3 ? "partial" : "struggled",
    approach: session.prepBrief.isAdapted ? "box method / visual" : "initial",
    when: new Date().toISOString(),
    score: session.verifyScore,
  };

  const skills = Array.isArray(existing.profile.skills)
    ? [...existing.profile.skills]
    : [];
  if (session.verifyScore >= 4) {
    skills.unshift(`factors ${session.topic} with guidance`);
  }

  const next: TuteeMemory = {
    ...existing,
    tuteeName: session.tuteeName,
    profile: {
      ...existing.profile,
      preferredApproach:
        session.verifyScore >= 3
          ? "visual / box method"
          : existing.profile.preferredApproach ?? "visual / box method",
      skills: skills.slice(0, 8),
      struggles:
        session.verifyScore <= 2
          ? [
              ...(Array.isArray(existing.profile.struggles)
                ? existing.profile.struggles.map(String)
                : []),
              `Still developing ${session.topic}`,
            ].slice(0, 6)
          : existing.profile.struggles,
    },
    episodes: [episode, ...existing.episodes].slice(0, 20),
  };

  await upsertTuteeMemory(next);
}

export type TutoringRequestStatus = "open" | "claimed" | "done";

export interface TutoringRequest {
  id: string;
  studentName: string;
  grade: string;
  assignedBy: string;
  subject: string;
  topic: string;
  notes?: string | null;
  status: TutoringRequestStatus;
  claimedByUsername?: string | null;
  claimedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const requestFallback = new Map<string, TutoringRequest>();

function seedTemplateRequests() {
  for (const demo of DEMO_TUTORING_REQUESTS) {
    if (!requestFallback.has(demo.id)) {
      requestFallback.set(demo.id, {
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
      });
    }
  }
}

seedTemplateRequests();

export async function createTutoringRequest(input: {
  studentName: string;
  grade: string;
  assignedBy: string;
  subject: string;
  topic: string;
  notes?: string;
}): Promise<TutoringRequest> {
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
  requestFallback.set(request.id, request);
  return request;
}

export async function listTutoringRequests(filter?: {
  status?: TutoringRequestStatus;
}): Promise<TutoringRequest[]> {
  seedTemplateRequests();
  const all = Array.from(requestFallback.values());
  const filtered = filter?.status ? all.filter((r) => r.status === filter.status) : all;
  return filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getTutoringRequest(id: string): Promise<TutoringRequest | null> {
  return requestFallback.get(id) ?? null;
}

export async function claimTutoringRequest(
  id: string,
  tutorUsername: string,
): Promise<TutoringRequest | null> {
  const existing = requestFallback.get(id);
  if (!existing || existing.status !== "open") return null;
  const now = new Date().toISOString();
  const updated: TutoringRequest = {
    ...existing,
    status: "claimed",
    claimedByUsername: tutorUsername,
    claimedAt: now,
    updatedAt: now,
  };
  requestFallback.set(id, updated);
  return updated;
}

export async function completeTutoringRequest(id: string): Promise<TutoringRequest | null> {
  const existing = requestFallback.get(id);
  if (!existing) return null;
  const updated: TutoringRequest = {
    ...existing,
    status: "done",
    updatedAt: new Date().toISOString(),
  };
  requestFallback.set(id, updated);
  return updated;
}

export function getButterbaseAppId(): string {
  return APP_ID;
}
