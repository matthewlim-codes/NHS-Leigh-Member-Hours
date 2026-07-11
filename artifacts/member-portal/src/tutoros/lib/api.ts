export type SessionStatus = "prep" | "active" | "awaiting_verify" | "verified" | "logged";
export type TutorRubric = "independent" | "with_hints" | "not_yet";
export type SessionType = "hw_center" | "tutorial";

export interface WorkedExampleStep {
  label: string;
  detail: string;
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
  if (apiMode === "server") return true;
  if (apiMode === "local") return false;

  try {
    const response = await fetch("/api/tutoros/meta", { credentials: "include" });
    if (response.ok) {
      apiMode = "server";
      return true;
    }
    if (isMissingRouteStatus(response.status)) {
      apiMode = "local";
      return false;
    }
  } catch {
    // fall through
  }
  return true;
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
    throw error;
  }
}

export function startSession(input: {
  tuteeName: string;
  subject: string;
  topic: string;
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
  input: { tutorRubric: TutorRubric; sessionType: SessionType; durationMinutes?: number },
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

export function verifySession(id: string, input: { explanation: string; answer: string }) {
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
