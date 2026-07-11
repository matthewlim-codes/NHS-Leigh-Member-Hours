import {
  addMemories,
  flushMemories,
  searchMemories,
  tuteeUserId,
  type EverOSEpisode,
  type EverOSProfile,
  isEverOSConfigured,
} from "./everos-client";
import { queryCourseMaterials } from "./verify-agent";
import { materialsForSession } from "./materials-ingest";
import {
  buildPrepBrief as buildTemplateBrief,
  getTuteeMemory,
  type PrepBrief,
  type PrepMemoryBadge,
  type TuteeMemory,
} from "./tutoros-store";
import { uniqueNotes } from "./note-utils";

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;

function getApiKey(): string | undefined {
  return process.env.BUTTERBASE_API_KEY;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((s) => s.trim()).filter(Boolean);
}

function memoryContext(memory: TuteeMemory | null): string {
  if (!memory) return "No prior TutorOS memory for this tutee.";
  const struggles = Array.isArray(memory.profile.struggles)
    ? memory.profile.struggles.map(String).join("; ")
    : "n/a";
  const approach =
    typeof memory.profile.preferredApproach === "string"
      ? memory.profile.preferredApproach
      : "unknown";
  const episodes = memory.episodes
    .slice(0, 4)
    .map((e, i) => `${i + 1}. [${e.topic}] ${e.headline ?? e.summary}`)
    .join("\n");
  return [
    `Preferred approach: ${approach}`,
    `Known struggles: ${struggles}`,
    `Recent episodes:\n${episodes || "(none)"}`,
  ].join("\n");
}

function formatEverOSProfile(profile: EverOSProfile): string {
  const explicit = profile.profile_data?.explicit_info
    ? JSON.stringify(profile.profile_data.explicit_info)
    : "";
  const implicit = profile.profile_data?.implicit_traits
    ? JSON.stringify(profile.profile_data.implicit_traits)
    : "";
  const scenario = profile.scenario ?? "";
  return [scenario, explicit && `explicit: ${explicit}`, implicit && `traits: ${implicit}`]
    .filter(Boolean)
    .join(" · ");
}

function buildBadges(input: {
  usedAi: boolean;
  everosCount: number;
  episodeCount: number;
  hasMaterials: boolean;
  hasTeacherNotes: boolean;
}): PrepMemoryBadge[] {
  const badges: PrepMemoryBadge[] = [];
  if (input.usedAi) badges.push({ id: "ai", label: "AI prep", tone: "blue" });
  if (input.everosCount > 0) {
    badges.push({
      id: "everos",
      label: `EverOS · ${input.everosCount} recall`,
      tone: "emerald",
    });
  }
  if (input.episodeCount > 0) {
    badges.push({
      id: "episodes",
      label:
        input.episodeCount === 1
          ? "1 prior session"
          : `${input.episodeCount} prior sessions`,
      tone: "slate",
    });
  } else {
    badges.push({ id: "new", label: "New learner", tone: "amber" });
  }
  if (input.hasTeacherNotes) {
    badges.push({ id: "teacher", label: "Teacher notes", tone: "violet" });
  }
  if (input.hasMaterials) {
    badges.push({ id: "materials", label: "Course materials", tone: "sky" });
  }
  return badges;
}

async function chatCompletion(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model:
        process.env.TUTOROS_PREP_AI_MODEL ||
        process.env.TUTOROS_AI_MODEL ||
        "anthropic/claude-sonnet-4.6",
      temperature: 0.45,
      max_tokens: 2200,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Butterbase AI failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

export async function generatePrepBrief(input: {
  tuteeName: string;
  subject: string;
  topic: string;
  tuteeSlug: string;
  teacherNotes?: string[];
}): Promise<PrepBrief> {
  const memory = await getTuteeMemory(input.tuteeSlug);
  const teacherNotes = uniqueNotes([
    ...(input.teacherNotes ?? []),
    ...((memory && Array.isArray(memory.profile.teacherNotes)
      ? memory.profile.teacherNotes.map(String)
      : []) as string[]),
  ]);

  let everosNotes: string[] = [];
  let everosEpisodes: Array<{ topic: string; summary: string }> = [];
  if (isEverOSConfigured()) {
    try {
      const result = await searchMemories({
        userId: tuteeUserId(input.tuteeSlug),
        query: `${input.subject} ${input.topic} tutoring struggled succeeded approach what changed`,
        method: memory && memory.episodes.length > 0 ? "hybrid" : "hybrid",
        memoryTypes: ["episodic_memory", "profile"],
        topK: 6,
      });
      const episodes = result.data?.episodes ?? [];
      const profiles = result.data?.profiles ?? [];
      everosEpisodes = episodes
        .map((e: EverOSEpisode) => ({
          topic: e.subject ?? input.topic,
          summary: (e.summary ?? e.episode ?? "").trim(),
        }))
        .filter((e) => e.summary);
      everosNotes = [
        ...everosEpisodes.map((e) => e.summary),
        ...profiles.map((p: EverOSProfile) => formatEverOSProfile(p)).filter(Boolean),
      ].slice(0, 6);
    } catch {
      // ignore EverOS enrichment failures
    }
  }

  const materials = await queryCourseMaterials(`${input.subject} ${input.topic}`);
  const materialsToReview = await materialsForSession({
    subject: input.subject,
    topic: input.topic,
  });

  const template = buildTemplateBrief({
    tuteeName: input.tuteeName,
    subject: input.subject,
    topic: input.topic,
    memory,
    teacherNotes,
  });
  template.materialsToReview = materialsToReview.length ? materialsToReview : undefined;
  template.materialsCited = materials.slice(0, 2);

  const localEpisodes = (memory?.episodes ?? []).slice(0, 3).map((e) => ({
    topic: e.topic,
    summary: e.headline ?? e.summary,
  }));
  const memoryEpisodes =
    everosEpisodes.length > 0
      ? everosEpisodes.slice(0, 3)
      : localEpisodes;

  const episodeCount = Math.max(
    memory?.episodes.length ?? 0,
    everosEpisodes.length,
  );

  try {
    const content = await chatCompletion([
      {
        role: "system",
        content: [
          "You are TutorOS Prep Agent — an expert peer-tutoring coach for high-school NHS tutors.",
          "CRITICAL: Every bullet, step, example, and tip MUST be extremely specific to the given SUBJECT and TOPIC.",
          "Never invent math/algebra content for English, chemistry, biology, or other non-math subjects.",
          "Never invent English grammar content for math or science subjects.",
          "If the topic is passive vs active voice, use concrete sentence rewrites — not equations.",
          "If the topic is periodic trends, use electronegativity / radius / ionization examples — not grammar.",
          "If the topic is factoring, use quadratic factoring examples — not essays.",
          "Your job: make sure today's session starts exactly where the last one ended.",
          "Write practical, conversational coaching: specific, warm, actionable.",
          "Return ONLY valid JSON with keys:",
          '- contextTitle: string (e.g. "How to start" for first session, "Pick up where you left off" for follow-up)',
          "- contextBullets: string[] (3-5 bullets from LAST SESSION progress — do NOT repeat teacher assignment notes)",
          "- approachBullets: string[] (3-4 bullets for today's teaching approach — subject-specific techniques)",
          '- workedExampleSteps: array of { "label": string, "detail": string } (3-5 steps walking ONE concrete example from THIS topic)',
          "- misconceptionTips: string[] (2-4 misconceptions specific to this topic)",
          "- struggles: string[]",
          "- recommendedApproach: string",
          "- workedExample: string (one concrete example from this subject/topic)",
          "- watchFors: string[]",
          "- coachNote: string (1-2 sentences: what changed last time + what to do first today)",
          "Teacher notes are provided separately — do not copy them into contextBullets.",
          "No surveillance language. Tutor stays in control.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Tutee: ${input.tuteeName}`,
          `Subject: ${input.subject}`,
          `Topic: ${input.topic}`,
          "",
          "Hard constraint: every example and step must be about the subject/topic above — nothing else.",
          "",
          "TutorOS memory:",
          memoryContext(memory),
          teacherNotes.length
            ? `\nTeacher notes:\n${teacherNotes.map((n) => `- ${n}`).join("\n")}`
            : "",
          everosNotes.length
            ? `\nEverOS long-term memory:\n${everosNotes.map((n) => `- ${n}`).join("\n")}`
            : "",
          materials.length
            ? `\nCourse materials (RAG):\n${materials.map((n) => `- ${n.slice(0, 280)}`).join("\n")}`
            : "",
          materialsToReview.length
            ? `\nTeacher-uploaded worksheets to review with the student:\n${materialsToReview
                .map(
                  (m) =>
                    `- ${m.filename}${m.teacherInstructions ? ` — tutor note: ${m.teacherInstructions}` : ""}`,
                )
                .join("\n")}`
            : "",
          "",
          "Create a 2-minute pre-session instruction plan that continues from prior learning.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ]);

    if (!content) {
      return {
        ...template,
        teacherNotes: teacherNotes.length ? teacherNotes : template.teacherNotes,
        materialsCited: materials.slice(0, 2),
        materialsToReview: materialsToReview.length ? materialsToReview : undefined,
        memoryEpisodes,
        memoryBadges: buildBadges({
          usedAi: false,
          everosCount: everosNotes.length,
          episodeCount,
          hasMaterials: materials.length > 0 || materialsToReview.length > 0,
          hasTeacherNotes: teacherNotes.length > 0,
        }),
        memorySource: everosNotes.length ? "everos" : memory ? "demo" : "empty",
      };
    }

    const parsed = extractJsonObject(content);
    if (!parsed) {
      return {
        ...template,
        coachNote: content.trim(),
        teacherNotes: teacherNotes.length ? teacherNotes : undefined,
        materialsCited: materials.slice(0, 2),
        materialsToReview: materialsToReview.length ? materialsToReview : undefined,
        memoryEpisodes,
        memoryBadges: buildBadges({
          usedAi: true,
          everosCount: everosNotes.length,
          episodeCount,
          hasMaterials: materials.length > 0 || materialsToReview.length > 0,
          hasTeacherNotes: teacherNotes.length > 0,
        }),
        memorySource: everosNotes.length ? "everos" : "ai",
        isAdapted: episodeCount > 0,
      };
    }

    const struggles = asStringArray(parsed.struggles);
    const watchFors = asStringArray(parsed.watchFors);
    const contextBullets = asStringArray(parsed.contextBullets);
    const approachBullets = asStringArray(parsed.approachBullets);
    const misconceptionTips = asStringArray(parsed.misconceptionTips);
    const contextTitle =
      typeof parsed.contextTitle === "string" ? parsed.contextTitle.trim() : "";
    const recommendedApproach =
      typeof parsed.recommendedApproach === "string" ? parsed.recommendedApproach.trim() : "";
    const workedExample =
      typeof parsed.workedExample === "string" ? parsed.workedExample.trim() : "";
    const coachNote = typeof parsed.coachNote === "string" ? parsed.coachNote.trim() : "";

    const workedExampleSteps = Array.isArray(parsed.workedExampleSteps)
      ? parsed.workedExampleSteps
          .map((step) => {
            if (!step || typeof step !== "object") return null;
            const row = step as Record<string, unknown>;
            const label = typeof row.label === "string" ? row.label.trim() : "";
            const detail = typeof row.detail === "string" ? row.detail.trim() : "";
            if (!detail) return null;
            return { label: label || "Step", detail };
          })
          .filter((s): s is { label: string; detail: string } => Boolean(s))
      : [];

    const isAdapted = episodeCount > 0;

    return {
      struggles: struggles.length ? struggles : template.struggles,
      recommendedApproach: recommendedApproach || template.recommendedApproach,
      workedExample: workedExample || template.workedExample,
      watchFors: watchFors.length ? watchFors : template.watchFors,
      contextTitle: contextTitle || template.contextTitle,
      contextBullets: contextBullets.length ? contextBullets : template.contextBullets,
      approachBullets: approachBullets.length ? approachBullets : template.approachBullets,
      workedExampleSteps: workedExampleSteps.length
        ? workedExampleSteps
        : template.workedExampleSteps,
      misconceptionTips: misconceptionTips.length
        ? misconceptionTips
        : template.misconceptionTips,
      teacherNotes: teacherNotes.length ? teacherNotes : template.teacherNotes,
      materialsCited: materials.slice(0, 2),
      materialsToReview: materialsToReview.length ? materialsToReview : undefined,
      memoryEpisodes,
      memoryBadges: buildBadges({
        usedAi: true,
        everosCount: everosNotes.length,
        episodeCount,
        hasMaterials: materials.length > 0 || materialsToReview.length > 0,
        hasTeacherNotes: teacherNotes.length > 0,
      }),
      coachNote: coachNote || undefined,
      memorySource: everosNotes.length ? "everos" : "ai",
      isAdapted,
    };
  } catch {
    return {
      ...template,
      teacherNotes: teacherNotes.length ? teacherNotes : template.teacherNotes,
      materialsCited: materials.slice(0, 2),
      materialsToReview: materialsToReview.length ? materialsToReview : undefined,
      memoryEpisodes,
      memoryBadges: buildBadges({
        usedAi: false,
        everosCount: everosNotes.length,
        episodeCount,
        hasMaterials: materials.length > 0 || materialsToReview.length > 0,
        hasTeacherNotes: teacherNotes.length > 0,
      }),
      memorySource: everosNotes.length ? "everos" : memory ? "demo" : "empty",
      isAdapted: episodeCount > 0,
    };
  }
}

export { addMemories, flushMemories };
