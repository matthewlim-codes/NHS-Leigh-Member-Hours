import {
  addMemories,
  flushMemories,
  searchMemories,
  tuteeUserId,
  type EverOSEpisode,
  type EverOSProfile,
} from "./everos-client";

export interface RecordTutoringSessionInput {
  tuteeId: string;
  sessionId: string;
  subject: string;
  topic: string;
  tutorReflection: string;
  understandingScore?: number;
  durationMinutes?: number;
  location?: "hw_center" | "tutorial";
}

export interface TutoringContext {
  userId: string;
  topic: string;
  episodeSummaries: string[];
  profileNotes: string[];
  prepHints: string[];
}

function formatEpisode(episode: EverOSEpisode): string | null {
  return episode.summary ?? episode.episode ?? null;
}

function formatProfile(profile: EverOSProfile): string | null {
  const explicit = profile.profile_data?.explicit_info;
  if (!explicit || typeof explicit !== "object") {
    return profile.scenario ?? null;
  }

  const parts = Object.entries(explicit)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`);

  return parts.length > 0 ? parts.join("; ") : profile.scenario ?? null;
}

export async function recordTutoringSession(input: RecordTutoringSessionInput) {
  const userId = tuteeUserId(input.tuteeId);
  const nowMs = Date.now();

  const scoreLine =
    input.understandingScore !== undefined
      ? ` Understanding score: ${input.understandingScore}/5.`
      : "";

  const meta: string[] = [];
  if (input.durationMinutes !== undefined) {
    meta.push(`Duration: ${input.durationMinutes} minutes.`);
  }
  if (input.location) {
    meta.push(`Location: ${input.location}.`);
  }

  const userContent = [
    `Tutoring session on ${input.subject} — topic: ${input.topic}.`,
    `Tutor reflection: ${input.tutorReflection}`,
    ...meta,
  ].join(" ");

  const needsFollowUp =
    input.understandingScore !== undefined && input.understandingScore < 3;

  const assistantContent = [
    `Recorded ${input.subject} tutoring on ${input.topic} for future prep.`,
    scoreLine,
    needsFollowUp ? "Needs follow-up." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const addResult = await addMemories({
    userId,
    sessionId: input.sessionId,
    messages: [
      { role: "user", timestamp: nowMs, content: userContent },
      { role: "assistant", timestamp: nowMs + 1000, content: assistantContent },
    ],
  });

  const flushResult = await flushMemories({
    userId,
    sessionId: input.sessionId,
  });

  return {
    userId,
    sessionId: input.sessionId,
    addStatus: addResult.data?.status ?? "unknown",
    flushStatus: flushResult.data?.status ?? "unknown",
  };
}

export async function getTutoringContext(tuteeId: string, topic: string): Promise<TutoringContext> {
  const userId = tuteeUserId(tuteeId);

  const [profileResult, progressResult] = await Promise.all([
    searchMemories({
      userId,
      query: `learning style preferences ${topic}`,
      method: "hybrid",
      memoryTypes: ["profile"],
      topK: 5,
    }),
    searchMemories({
      userId,
      query: `${topic} tutoring struggled succeeded approach`,
      method: "hybrid",
      memoryTypes: ["episodic_memory"],
      topK: 5,
    }),
  ]);

  const episodes = progressResult.data?.episodes ?? [];
  const profiles = profileResult.data?.profiles ?? [];

  const episodeSummaries = episodes
    .map(formatEpisode)
    .filter((value): value is string => Boolean(value));

  const profileNotes = profiles
    .map(formatProfile)
    .filter((value): value is string => Boolean(value));

  const prepHints: string[] = [];
  if (episodeSummaries.length > 0) {
    prepHints.push(`Prior sessions: ${episodeSummaries[0]}`);
  }
  if (profileNotes.length > 0) {
    prepHints.push(`Learner profile: ${profileNotes[0]}`);
  }
  if (prepHints.length === 0) {
    prepHints.push("No prior memory for this tutee — start with a confidence-building warm-up.");
  }

  return {
    userId,
    topic,
    episodeSummaries,
    profileNotes,
    prepHints,
  };
}
