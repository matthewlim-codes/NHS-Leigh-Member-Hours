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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `Request failed (${response.status})`,
    );
  }
  return data as T;
}

export function startSession(input: {
  tuteeName: string;
  subject: string;
  topic: string;
}) {
  return api<TutorOsSession>("/tutoros/sessions/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMySessions() {
  return api<SessionListResponse>("/tutoros/sessions");
}

export function getSession(id: string) {
  return api<TutorOsSession>(`/tutoros/sessions/${id}`);
}

export function beginSession(id: string) {
  return api<TutorOsSession>(`/tutoros/sessions/${id}/begin`, { method: "POST", body: "{}" });
}

export function endSession(
  id: string,
  input: { tutorRubric: TutorRubric; sessionType: SessionType; durationMinutes?: number },
) {
  return api<TutorOsSession>(`/tutoros/sessions/${id}/end`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifySession(id: string, input: { explanation: string; answer: string }) {
  return api<TutorOsSession>(`/tutoros/sessions/${id}/verify`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCommandView() {
  return api<CommandResponse>("/tutoros/command");
}
