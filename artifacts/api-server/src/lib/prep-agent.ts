import {
  addMemories,
  flushMemories,
  searchMemories,
  tuteeUserId,
  type EverOSEpisode,
  type EverOSProfile,
  isEverOSConfigured,
} from "./everos-client";
import {
  buildPrepBrief as buildTemplateBrief,
  getTuteeMemory,
  type PrepBrief,
  type TuteeMemory,
} from "./tutoros-store";

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
    .map((e, i) => `${i + 1}. [${e.topic}] ${e.summary}`)
    .join("\n");
  return [
    `Preferred approach: ${approach}`,
    `Known struggles: ${struggles}`,
    `Recent episodes:\n${episodes || "(none)"}`,
  ].join("\n");
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
      model: process.env.TUTOROS_AI_MODEL || "anthropic/claude-sonnet-4",
      temperature: 0.7,
      max_tokens: 1200,
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
}): Promise<PrepBrief> {
  const memory = await getTuteeMemory(input.tuteeSlug);

  let everosNotes: string[] = [];
  if (isEverOSConfigured()) {
    try {
      const result = await searchMemories({
        userId: tuteeUserId(input.tuteeSlug),
        query: `${input.topic} tutoring struggled succeeded approach`,
        method: "hybrid",
        memoryTypes: ["episodic_memory", "profile"],
        topK: 5,
      });
      const episodes = result.data?.episodes ?? [];
      const profiles = result.data?.profiles ?? [];
      everosNotes = [
        ...episodes.map((e: EverOSEpisode) => e.summary ?? e.episode ?? "").filter(Boolean),
        ...profiles.map((p: EverOSProfile) => p.scenario ?? "").filter(Boolean),
      ].slice(0, 5);
    } catch {
      // ignore EverOS enrichment failures
    }
  }

  const template = buildTemplateBrief({
    tuteeName: input.tuteeName,
    subject: input.subject,
    topic: input.topic,
    memory,
  });

  try {
    const content = await chatCompletion([
      {
        role: "system",
        content: [
          "You are TutorOS Prep Agent — an expert peer-tutoring coach for high-school NHS tutors.",
          "Write practical, conversational coaching like ChatGPT/Claude would: specific, warm, actionable.",
          "Return ONLY valid JSON with keys:",
          '- contextTitle: string (e.g. "What they need help with" for first session, "Last session review" for follow-up)',
          "- contextBullets: string[] (3-5 bullets: teacher notes for first session, or last-session review for follow-up)",
          "- approachBullets: string[] (3-4 bullets for recommended teaching approach today)",
          '- workedExampleSteps: array of { "label": string, "detail": string } (3-5 steps with math/work shown)',
          "- misconceptionTips: string[] (2-4 common mistakes to watch for)",
          '- struggles: string[] (legacy — same as key stuck points)',
          "- recommendedApproach: string (legacy summary paragraph)",
          "- workedExample: string (legacy one-line summary joining steps with →)",
          "- watchFors: string[] (legacy — same as misconceptionTips)",
          "- coachNote: string (optional 1-2 sentence skim summary)",
          "Do not wrap keys in markdown except optional ```json fences.",
          "No surveillance language. No audio/transcript assumptions. Tutor stays in control.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Tutee: ${input.tuteeName}`,
          `Subject: ${input.subject}`,
          `Topic: ${input.topic}`,
          "",
          "TutorOS memory:",
          memoryContext(memory),
          everosNotes.length ? `\nEverOS notes:\n${everosNotes.map((n) => `- ${n}`).join("\n")}` : "",
          "",
          "Create a 2-minute pre-session instruction plan for the tutor.",
        ].join("\n"),
      },
    ]);

    if (!content) {
      return { ...template, memorySource: memory ? "demo" : "empty" };
    }

    const parsed = extractJsonObject(content);
    if (!parsed) {
      return {
        ...template,
        coachNote: content.trim(),
        memorySource: "ai",
        isAdapted: Boolean(memory && memory.episodes.length > 0),
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

    const isAdapted = Boolean(memory && memory.episodes.length > 0) || everosNotes.length > 0;

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
      coachNote: coachNote || undefined,
      memorySource: "ai",
      isAdapted,
    };
  } catch {
    return template;
  }
}

// Keep EverOS helpers imported for memory write path reuse elsewhere
export { addMemories, flushMemories };
