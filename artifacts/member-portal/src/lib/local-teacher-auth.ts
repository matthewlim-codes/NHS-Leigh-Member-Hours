import type { AuthUser } from "@workspace/api-client-react";

const LOCAL_TEACHER_KEY = "tutoros-local-teacher-v1";
export const TEACHER_ACCESS_CODE = "teacher";

export const LOCAL_TEACHER_USER: AuthUser = {
  id: -1,
  username: "Teacher",
  role: "teacher",
};

export function normalizeTeacherCode(code: string): string {
  return code.trim().toLowerCase();
}

export function isValidTeacherCode(code: string): boolean {
  return normalizeTeacherCode(code) === TEACHER_ACCESS_CODE;
}

export function getLocalTeacherUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(LOCAL_TEACHER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed?.role === "teacher" && typeof parsed.username === "string") {
      return {
        id: typeof parsed.id === "number" ? parsed.id : -1,
        username: parsed.username,
        role: "teacher",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function setLocalTeacherUser(user: AuthUser = LOCAL_TEACHER_USER): AuthUser {
  const next: AuthUser = {
    id: user.id,
    username: user.username,
    role: "teacher",
  };
  sessionStorage.setItem(LOCAL_TEACHER_KEY, JSON.stringify(next));
  return next;
}

export function clearLocalTeacherUser(): void {
  sessionStorage.removeItem(LOCAL_TEACHER_KEY);
}

/** Prefer server user; fall back to local teacher session when API isn't deployed. */
export function resolveAuthUser(serverUser: AuthUser | null | undefined): AuthUser | null {
  if (serverUser) return serverUser;
  return getLocalTeacherUser();
}
