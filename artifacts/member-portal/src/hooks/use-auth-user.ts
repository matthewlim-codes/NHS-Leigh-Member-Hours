import { useGetMe, getGetMeQueryKey, type AuthUser } from "@workspace/api-client-react";
import { useSyncExternalStore } from "react";
import {
  clearLocalTeacherUser,
  getLocalTeacherUser,
  resolveAuthUser,
} from "@/lib/local-teacher-auth";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return getLocalTeacherUser();
}

/** Notify React when local teacher session changes (same-tab). */
export function notifyLocalTeacherAuthChanged() {
  for (const listener of listeners) listener();
}

export function useAuthUser(): {
  user: AuthUser | null;
  serverUser: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isError: boolean;
} {
  const localTeacher = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const { data: serverUser, isSuccess, isError, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const user = resolveAuthUser(isSuccess ? serverUser : null) ?? localTeacher;

  return {
    user,
    serverUser,
    isLoading,
    isAuthenticated: Boolean(user),
    isError: isError && !user,
  };
}

export function logoutLocalTeacher() {
  clearLocalTeacherUser();
  notifyLocalTeacherAuthChanged();
}
