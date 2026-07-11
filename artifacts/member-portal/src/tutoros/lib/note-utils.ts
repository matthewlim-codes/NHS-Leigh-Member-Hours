/** Shared note helpers for TutorOS prep / teacher context */

export function normalizeNoteKey(note: string): string {
  return note.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deduplicate teacher/context notes while preserving order. */
export function uniqueNotes(notes: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of notes) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normalizeNoteKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function filterNotesNotIn(notes: string[], exclude: string[]): string[] {
  const excluded = new Set(exclude.map(normalizeNoteKey));
  return notes.filter((n) => !excluded.has(normalizeNoteKey(n)));
}
