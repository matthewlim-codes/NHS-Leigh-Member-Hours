/**
 * Butterbase AI verify + exit-problem agents, with soft RAG retrieval.
 */

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;

function getApiKey(): string | undefined {
  return process.env.BUTTERBASE_API_KEY;
}

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${API_BASE}/fn/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export async function queryCourseMaterials(query: string): Promise<string[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const response = await fetch(`${API_BASE}/rag/course-materials/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, top_k: 3 }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      chunks?: Array<{ text?: string; content?: string }>;
      results?: Array<{ text?: string; content?: string }>;
    };
    const chunks = data.chunks ?? data.results ?? [];
    return chunks
      .map((c) => (c.text ?? c.content ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export interface VerifyScoreResult {
  score: number;
  mismatch: boolean;
  learningMoment: boolean;
  notes: string;
  practiceNext: string;
  aiSummary: string;
  source: "ai" | "fallback" | "heuristic";
}

export async function scoreVerificationWithAi(input: {
  subject: string;
  topic: string;
  explanation: string;
  answer: string;
  tutorRubric: string;
  exitProblem?: string | null;
  studentWhatChanged?: string;
}): Promise<VerifyScoreResult> {
  try {
    const result = await callFunction<VerifyScoreResult>("verify-score", {
      subject: input.subject,
      topic: input.topic,
      explanation: input.explanation,
      answer: input.answer,
      tutorRubric: input.tutorRubric,
      exitProblem: input.exitProblem ?? "",
      studentWhatChanged: input.studentWhatChanged ?? "",
    });
    if (result && typeof result.score === "number") {
      return {
        score: Math.max(1, Math.min(5, result.score)),
        mismatch: Boolean(result.mismatch),
        learningMoment: Boolean(result.learningMoment),
        notes: result.notes || "",
        practiceNext: result.practiceNext || `Review ${input.topic} with one similar problem.`,
        aiSummary: result.aiSummary || "",
        source: result.source === "fallback" ? "fallback" : "ai",
      };
    }
  } catch {
    // fall through
  }

  // Local heuristic fallback (keeps demo alive without AI key)
  const explanation = (input.explanation || input.studentWhatChanged || "").trim();
  const answer = input.answer.trim().toLowerCase();
  let score = 1 + (explanation.length > 40 ? 2 : explanation.length > 15 ? 1 : 0);
  score += answer.length > 2 ? 2 : answer.length > 0 ? 1 : 0;
  score = Math.max(1, Math.min(5, score));
  const tutorHigh = input.tutorRubric === "independent";
  const tutorLow = input.tutorRubric === "not_yet";
  const mismatch = (tutorHigh && score <= 2) || (tutorLow && score >= 4);
  return {
    score,
    mismatch,
    learningMoment: score >= 3 && !mismatch,
    notes: "Heuristic verify (AI unavailable).",
    practiceNext: `Review ${input.topic} with one similar problem.`,
    aiSummary: "Session recorded.",
    source: "heuristic",
  };
}

export async function generateExitProblem(input: {
  tuteeName: string;
  subject: string;
  topic: string;
  materials?: string[];
}): Promise<string> {
  try {
    const result = await callFunction<{ exitProblem?: string }>("exit-problem", {
      tuteeName: input.tuteeName,
      subject: input.subject,
      topic: input.topic,
      materials: input.materials ?? [],
    });
    if (result?.exitProblem?.trim()) return result.exitProblem.trim();
  } catch {
    // fall through
  }
  return `Write one sentence explaining today's idea for ${input.topic}, then solve a similar practice problem.`;
}
