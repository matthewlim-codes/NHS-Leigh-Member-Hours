import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tutoros-bookmarks-v1";

function readBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readBookmarks(),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const isBookmarked = useCallback(
    (courseId: string) => bookmarks.includes(courseId),
    [bookmarks],
  );

  const toggleBookmark = useCallback((courseId: string) => {
    setBookmarks((current) =>
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId],
    );
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark };
}
