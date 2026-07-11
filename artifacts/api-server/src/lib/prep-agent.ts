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
          '- struggles: string[] (2-4 concrete prior stuck points)',
          "- recommendedApproach: string (how to teach today, 2-4 sentences)",
          "- workedExample: string (one fully worked example with step-by-step teaching notes)",
          "- watchFors: string[] (2-4 live-session cues)",
          "- coachNote: string (a natural paragraph the tutor can skim in ~30 seconds — coaching voice, not a bullet list)",
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
    const recommendedApproach =
      typeof parsed.recommendedApproach === "string" ? parsed.recommendedApproach.trim() : "";
    const workedExample =
      typeof parsed.workedExample === "string" ? parsed.workedExample.trim() : "";
    const coachNote = typeof parsed.coachNote === "string" ? parsed.coachNote.trim() : "";

    return {
      struggles: struggles.length ? struggles : template.struggles,
      recommendedApproach: recommendedApproach || template.recommendedApproach,
      workedExample: workedExample || template.workedExample,
      watchFors: watchFors.length ? watchFors : template.watchFors,
      coachNote: coachNote || undefined,
      memorySource: "ai",
      isAdapted: Boolean(memory && memory.episodes.length > 0) || everosNotes.length > 0,
    };
  } catch {
    return template;
  }
}

// Keep EverOS helpers imported for memory write path reuse elsewhere
export { addMemories, flushMemories };
