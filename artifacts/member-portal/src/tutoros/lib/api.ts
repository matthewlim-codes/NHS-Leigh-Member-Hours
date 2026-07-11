export type SessionStatus = "prep" | "active" | "awaiting_verify" | "verified" | "logged";
export type TutorRubric = "independent" | "with_hints" | "not_yet";
export type SessionType = "hw_center" | "tutorial";

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

export interface WorkedExampleStep {
  label: string;
  detail: string;
}

export type PracticeProblemDifficulty =
  | "basic"
  | "easy"
  | "medium"
  | "challenging"
  | "advanced"
  | "warm-up"
  | "guided"
  | "independent";

export type PracticeDifficultyMode = "easier" | "same" | "harder";

export interface PracticeProblem {
  id: string;
  prompt: string;
  steps: WorkedExampleStep[];
  discussionStems: string[];
  difficulty: PracticeProblemDifficulty;
}

export interface PrepMemoryBadge {
  id: string;
  label: string;
  tone: "blue" | "emerald" | "slate" | "amber" | "violet" | "sky";
}

export interface PrepBrief {
  struggles: string[];
  recommendedApproach: string;
  workedExample: string;
  watchFors: string[];
  coachNote?: string;
  /** Section heading for context block (first vs follow-up session) */
  contextTitle?: string;
  /** Bullet points: teacher notes (first) or last-session review (follow-up) */
  contextBullets?: string[];
  /** Bullet points for recommended teaching approach */
  approachBullets?: string[];
  /** Step-by-step worked example for the tutor to walk through */
  workedExampleSteps?: WorkedExampleStep[];
  /** Tips for common student misconceptions */
  misconceptionTips?: string[];
  /** Teacher-reported needs (first session; populated by teacher-notes integration) */
  teacherNotes?: string[];
  /** AI-generated (or tutor-edited) practice problems */
  practiceProblems?: PracticeProblem[];
  /** Prompts already shown this session — regenerate must never reuse these */
  avoidedPracticePrompts?: string[];
  /** Course-material snippets cited in prep (RAG) */
  materialsCited?: string[];
  /** Teacher-uploaded worksheets the tutor should review with the student */
  materialsToReview?: Array<{
    id: string;
    filename: string;
    teacherInstructions?: string;
    preview?: string;
    contentType?: string;
    isImage?: boolean;
    fileUrl?: string;
    previewDataUrl?: string;
  }>;
  memoryBadges?: PrepMemoryBadge[];
  memoryEpisodes?: Array<{ topic: string; summary: string }>;
  practiceNext?: string;
  aiSummary?: string;
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
  /** ISO timestamp when the tutoring timer started (null until tutor taps Start) */
  startedAt?: string | null;
  /** True once the tutor has started the live session timer */
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
  tutorEvidence?: TutorEvidence | null;
  studentEvidence?: StudentEvidence | null;
  teacherEvidence?: TeacherEvidence | null;
  fusedHeadline?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionListResponse {
  sessions: TutorOsSession[];
  stats: {
    total: number;
    learningMoments: number;
    unverified: number;
    awaitingVerify: number;
  };
}

import { localTutorOs } from "./local-store";

type ApiMode = "unknown" | "server" | "local";

let apiMode: ApiMode = "unknown";

function isMissingRouteStatus(status: number) {
  return status === 404 || status === 405;
}

async function detectServerSupport(): Promise<boolean> {
  if (apiMode === "local") return false;

  try {
    const response = await fetch("/api/tutoros/meta", { credentials: "include" });
    const contentType = response.headers.get("content-type") ?? "";
    if (response.ok && contentType.includes("application/json")) {
      apiMode = "server";
      return true;
    }
    apiMode = "local";
    return false;
  } catch {
    apiMode = "local";
    return false;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (isMissingRouteStatus(response.status)) {
    apiMode = "local";
    throw new RouteMissingError(response.status);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof (data as { error?: string })?.error === "string"
        ? (data as { error: string }).error
        : `Request failed (${response.status})`,
    );
  }
  apiMode = "server";
  return data as T;
}

class RouteMissingError extends Error {
  status: number;
  constructor(status: number) {
    super(`TutorOS API route missing (${status})`);
    this.name = "RouteMissingError";
    this.status = status;
  }
}

async function withFallback<T>(serverCall: () => Promise<T>, localCall: () => Promise<T> | T): Promise<T> {
  const preferServer = await detectServerSupport();
  if (!preferServer) {
    return await localCall();
  }

  try {
    return await serverCall();
  } catch (error) {
    if (error instanceof RouteMissingError || apiMode === "local") {
      return await localCall();
    }
    if (error instanceof TypeError) {
      apiMode = "local";
      return await localCall();
    }
    if (
      error instanceof Error &&
      (/route missing|request failed \(404\)/i.test(error.message) ||
        /session not found/i.test(error.message))
    ) {
      apiMode = "local";
      return await localCall();
    }
    throw error;
  }
}

export function startSession(input: {
  tuteeName: string;
  subject: string;
  topic: string;
  requestId?: string;
  teacherNotes?: string[];
}) {
  return withFallback(
    () =>
      api<TutorOsSession>("/tutoros/sessions/start", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    () => localTutorOs.startSession(input),
  );
}

export function listMySessions() {
  return withFallback(
    () => api<SessionListResponse>("/tutoros/sessions"),
    () => localTutorOs.listMySessions(),
  );
}

export function getSession(id: string) {
  return withFallback(
    () => api<TutorOsSession>(`/tutoros/sessions/${id}`),
    () => localTutorOs.getSession(id),
  );
}

export function beginSession(id: string) {
  return withFallback(
    () => api<TutorOsSession>(`/tutoros/sessions/${id}/begin`, { method: "POST", body: "{}" }),
    () => localTutorOs.beginSession(id),
  );
}

export function endSession(
  id: string,
  input: {
    tutorRubric: TutorRubric;
    sessionType: SessionType;
    durationMinutes?: number;
    tutorEvidence: TutorEvidence;
  },
) {
  return withFallback(
    () =>
      api<TutorOsSession>(`/tutoros/sessions/${id}/end`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    () => localTutorOs.endSession(id, input),
  );
}

export function purgeSessions(
  input: { tuteeName?: string; tuteeSlug?: string } = {},
) {
  return withFallback(
    () =>
      api<{ deleted: number; ids: string[] }>("/tutoros/sessions/purge", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    () => localTutorOs.purgeSessions(input),
  );
}

export function verifySession(
  id: string,
  input: { answer: string; studentEvidence: StudentEvidence },
) {
  return withFallback(
    () =>
      api<TutorOsSession>(`/tutoros/sessions/${id}/verify`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    () => localTutorOs.verifySession(id, input),
  );
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
  whatChangedToday?: string | null;
  status: TutoringRequestStatus;
  claimedByUsername?: string | null;
  claimedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listTutoringRequests(filter?: { status?: TutoringRequestStatus }) {
  const query = filter?.status ? `?status=${filter.status}` : "";
  return withFallback(
    () => api<{ requests: TutoringRequest[] }>(`/tutoros/requests${query}`),
    () => localTutorOs.listTutoringRequests(filter),
  );
}

export function createTutoringRequest(input: {
  studentName: string;
  grade: string;
  assignedBy: string;
  subject: string;
  topic: string;
  notes?: string;
}) {
  return withFallback(
    () =>
      api<TutoringRequest>("/tutoros/requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    () => localTutorOs.createTutoringRequest(input),
  );
}

export function claimTutoringRequest(id: string) {
  return withFallback(
    () =>
      api<TutoringRequest>(`/tutoros/requests/${id}/claim`, {
        method: "POST",
        body: "{}",
      }),
    () => localTutorOs.claimTutoringRequest(id),
  );
}

export function completeTutoringRequest(id: string, input: { whatChangedToday: string }) {
  return withFallback(
    () =>
      api<TutoringRequest>(`/tutoros/requests/${id}/complete`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    () => localTutorOs.completeTutoringRequest(id, input),
  );
}

export interface LearningMoment {
  id: string;
  sessionId: string;
  tuteeSlug: string;
  tuteeName: string;
  tutorUsername: string;
  subject: string;
  topic: string;
  score: number | null;
  headline: string | null;
  summary: string | null;
  practiceNext: string | null;
  everosSaved: boolean;
  learningMoment: boolean;
  mismatch: boolean;
  createdAt: string;
}

export function listLearningMoments() {
  return withFallback(
    () => api<{ moments: LearningMoment[] }>("/tutoros/learning-moments"),
    () => localTutorOs.listLearningMoments(),
  );
}

export function generatePracticeProblems(
  sessionId: string,
  options?: {
    difficultyMode?: PracticeDifficultyMode;
    avoidPrompts?: string[];
  },
) {
  return withFallback(
    () =>
      api<TutorOsSession>(`/tutoros/sessions/${sessionId}/practice-problems/generate`, {
        method: "POST",
        body: JSON.stringify({
          difficultyMode: options?.difficultyMode ?? "same",
          avoidPrompts: options?.avoidPrompts ?? [],
        }),
      }),
    () =>
      localTutorOs.generatePracticeProblems(sessionId, {
        difficultyMode: options?.difficultyMode ?? "same",
        avoidPrompts: options?.avoidPrompts ?? [],
      }),
  );
}

export function updatePracticeProblems(sessionId: string, practiceProblems: PracticeProblem[]) {
  return withFallback(
    () =>
      api<TutorOsSession>(`/tutoros/sessions/${sessionId}/practice-problems`, {
        method: "PATCH",
        body: JSON.stringify({ practiceProblems }),
      }),
    () => localTutorOs.updatePracticeProblems(sessionId, practiceProblems),
  );
}

export interface CourseMaterialUpload {
  id?: string;
  filename: string;
  subject?: string | null;
  topic?: string | null;
  teacherInstructions?: string | null;
  documentId?: string | null;
  storageObjectId?: string | null;
  contentType?: string | null;
  contentBase64?: string | null;
  status: "ingested" | "queued" | "local";
  preview?: string | null;
  createdAt?: string;
}

export function listCourseMaterials() {
  return withFallback(
    () => api<{ materials: CourseMaterialUpload[] }>("/tutoros/materials"),
    async () => {
      const raw = localStorage.getItem("tutoros-materials-v1");
      if (!raw) return { materials: [] as CourseMaterialUpload[] };
      try {
        return { materials: JSON.parse(raw) as CourseMaterialUpload[] };
      } catch {
        return { materials: [] as CourseMaterialUpload[] };
      }
    },
  );
}

export function uploadCourseMaterial(input: {
  filename: string;
  text?: string;
  subject?: string;
  topic?: string;
  teacherInstructions?: string;
  contentBase64?: string;
  contentType?: string;
}) {
  return withFallback(
    () =>
      api<CourseMaterialUpload>("/tutoros/materials", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    async () => {
      const isImage =
        (input.contentType ?? "").startsWith("image/") ||
        /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|svg)$/i.test(input.filename);
      const material: CourseMaterialUpload = {
        id: crypto.randomUUID(),
        filename: input.filename,
        subject: input.subject ?? null,
        topic: input.topic ?? null,
        teacherInstructions: input.teacherInstructions ?? null,
        contentType: input.contentType ?? null,
        contentBase64: isImage ? input.contentBase64 ?? null : null,
        status: "local",
        preview: (input.teacherInstructions || input.text || input.filename).slice(0, 180),
        createdAt: new Date().toISOString(),
      };
      const existing = await listCourseMaterials();
      const materials = [material, ...existing.materials].slice(0, 20);
      localStorage.setItem("tutoros-materials-v1", JSON.stringify(materials));
      return material;
    },
  );
}
