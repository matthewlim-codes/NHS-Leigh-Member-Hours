import { localTutorOs } from "./local-store";

export type SessionStatus = "prep" | "active" | "awaiting_verify" | "verified" | "logged";
export type TutorRubric = "independent" | "with_hints" | "not_yet";
export type SessionType = "hw_center" | "tutorial";

export interface PrepBrief {
  struggles: string[];
  recommendedApproach: string;
  workedExample: string;
  watchFors: string[];
  memorySource: "everos" | "demo" | "empty";
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
  startedAt: string;
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

export interface CommandResponse {
  label: string;
  sessionsCount: number;
  verifiedCount: number;
  hours: number;
  flaggedCount: number;
  flagged: Array<{
    id: string;
    tuteeName: string;
    subject: string;
    topic: string;
    tutorUsername: string;
    verifyScore?: number | null;
    tutorRubric?: string | null;
  }>;
  sessions: Array<{
    id: string;
    tuteeName: string;
    subject: string;
    topic: string;
    tutorUsername: string;
    status: SessionStatus;
    learningMoment?: boolean;
    verifyScore?: number | null;
    verifyMismatch?: boolean;
    durationMinutes?: number | null;
    sessionType?: SessionType | null;
  }>;
}

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
    // fall through — try the real request path
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

async function withFallback<T>(serverCall: () => Promise<T>, localCall: () => T): Promise<T> {
  const preferServer = await detectServerSupport();
  if (!preferServer) {
    return localCall();
  }

  try {
    return await serverCall();
  } catch (error) {
    if (error instanceof RouteMissingError || apiMode === "local") {
      return localCall();
    }
    // If the server literally doesn't have TutorOS yet, Express returns HTML 404
    // and JSON parse yields {} — RouteMissingError covers that. Network failures
    // also fall back so demos keep working.
    if (error instanceof TypeError) {
      apiMode = "local";
      return localCall();
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

export function getCommandView() {
  return withFallback(
    () => api<CommandResponse>("/tutoros/command"),
    () => localTutorOs.getCommandView(),
  );
}
