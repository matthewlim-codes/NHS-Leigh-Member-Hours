import { getTuteeMemory, type PrepBrief, type TuteeMemory, type WorkedExampleStep } from "./tutoros-store";

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;

export type PracticeProblemDifficulty = "warm-up" | "guided" | "independent";

export interface PracticeProblem {
  id: string;
  prompt: string;
  steps: WorkedExampleStep[];
  discussionStems: string[];
  difficulty: PracticeProblemDifficulty;
}

function getApiKey(): string | undefined {
  return process.env.BUTTERBASE_API_KEY;
}

function practiceModel(): string {
  return (
    process.env.TUTOROS_PRACTICE_AI_MODEL ||
    process.env.TUTOROS_AI_MODEL ||
    "anthropic/claude-sonnet-4"
  );
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

function parseSteps(value: unknown): WorkedExampleStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step) => {
      if (!step || typeof step !== "object") return null;
      const row = step as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const detail = typeof row.detail === "string" ? row.detail.trim() : "";
      if (!detail) return null;
      return { label: label || "Step", detail };
    })
    .filter((s): s is WorkedExampleStep => Boolean(s));
}

function memorySummary(memory: TuteeMemory | null): string {
  if (!memory) return "No prior TutorOS memory.";
  const notes = Array.isArray(memory.profile.teacherNotes)
    ? memory.profile.teacherNotes.map(String).join("; ")
    : "";
  const struggles = Array.isArray(memory.profile.struggles)
    ? memory.profile.struggles.map(String).join("; ")
    : "";
  return [notes && `Teacher notes: ${notes}`, struggles && `Struggles: ${struggles}`]
    .filter(Boolean)
    .join("\n");
}

function briefSummary(brief?: PrepBrief): string {
  if (!brief) return "";
  const bullets = brief.contextBullets?.slice(0, 3).join("; ") ?? "";
  const approach = brief.approachBullets?.slice(0, 2).join("; ") ?? brief.recommendedApproach;
  return [bullets && `Context: ${bullets}`, approach && `Approach: ${approach}`]
    .filter(Boolean)
    .join("\n");
}

function templateProblems(input: {
  subject: string;
  topic: string;
}): PracticeProblem[] {
  const topic = `${input.subject} ${input.topic}`.toLowerCase();
  const id = () => crypto.randomUUID();

  if (topic.includes("factor") || topic.includes("algebra") || topic.includes("im2")) {
    return [
      {
        id: id(),
        difficulty: "warm-up",
        prompt: "Factor: x² + 5x + 6",
        steps: [
          { label: "Set up", detail: "Find two numbers that multiply to 6 and add to 5." },
          { label: "Choose factors", detail: "Use 2 and 3." },
          { label: "Write", detail: "Answer: (x + 2)(x + 3)." },
        ],
        discussionStems: [
          "What two numbers multiply to the constant term?",
          "Do those same numbers add to the middle coefficient?",
        ],
      },
      {
        id: id(),
        difficulty: "guided",
        prompt: "Factor: x² + 7x + 12",
        steps: [
          { label: "Multiply & add", detail: "Need factors of 12 that sum to 7 → 3 and 4." },
          { label: "Write binomials", detail: "(x + 3)(x + 4)." },
          { label: "Check", detail: "Expand quickly to verify the middle term is 7x." },
        ],
        discussionStems: [
          "Before you write anything, what pattern are we looking for?",
          "How can you check your factors without fully expanding?",
        ],
      },
      {
        id: id(),
        difficulty: "independent",
        prompt: "Factor: x² − x − 20",
        steps: [
          { label: "Signs", detail: "Product negative → one factor positive, one negative." },
          { label: "Factors", detail: "Use −5 and 4 (multiply to −20, add to −1)." },
          { label: "Answer", detail: "(x − 5)(x + 4)." },
        ],
        discussionStems: [
          "What does the sign of the constant tell you about the factors?",
          "Talk me through why your two numbers work.",
        ],
      },
    ];
  }

  if (topic.includes("chemistry") || topic.includes("periodic")) {
    return [
      {
        id: id(),
        difficulty: "warm-up",
        prompt: "Which is larger, atomic radius: sodium (Na) or chlorine (Cl)?",
        steps: [
          { label: "Trend", detail: "Atomic radius decreases across a period (left → right)." },
          { label: "Compare", detail: "Na is left of Cl in period 3." },
          { label: "Answer", detail: "Sodium has the larger atomic radius." },
        ],
        discussionStems: [
          "Across a period, what happens to the pull on valence electrons?",
          "Where would each atom sit on the periodic table?",
        ],
      },
      {
        id: id(),
        difficulty: "guided",
        prompt: "Rank fluorine, bromine, and iodine by electronegativity (highest first).",
        steps: [
          { label: "Group trend", detail: "Electronegativity decreases down a group." },
          { label: "Order", detail: "F > Br > I." },
          { label: "Why", detail: "Outer electrons are farther from the nucleus down the group." },
        ],
        discussionStems: [
          "Are these elements in the same group or period?",
          "What happens to nuclear attraction as you move down a group?",
        ],
      },
      {
        id: id(),
        difficulty: "independent",
        prompt: "Explain why ionization energy increases across period 3.",
        steps: [
          { label: "Definition", detail: "Energy to remove an outer electron." },
          { label: "Nuclear charge", detail: "Proton count rises across the period." },
          { label: "Shielding", detail: "Similar shielding → stronger pull on valence electrons." },
        ],
        discussionStems: [
          "In your own words, what is ionization energy measuring?",
          "What two competing effects matter across a period?",
        ],
      },
    ];
  }

  if (topic.includes("english") || topic.includes("passive") || topic.includes("voice")) {
    return [
      {
        id: id(),
        difficulty: "warm-up",
        prompt: 'Rewrite in active voice: "The essay was written by Maria."',
        steps: [
          { label: "Find actor", detail: "Maria is doing the action." },
          { label: "Rebuild", detail: '"Maria wrote the essay."' },
        ],
        discussionStems: [
          "Who is performing the action in this sentence?",
          "How does the sentence change when the subject acts?",
        ],
      },
      {
        id: id(),
        difficulty: "guided",
        prompt: 'Rewrite: "Mistakes were made during the lab."',
        steps: [
          { label: "Identify vagueness", detail: "Passive hides who made mistakes." },
          { label: "Add actor", detail: 'If unknown: "We made mistakes during the lab."' },
        ],
        discussionStems: [
          "What information does the passive version hide?",
          "Can you name a reasonable subject for this sentence?",
        ],
      },
      {
        id: id(),
        difficulty: "independent",
        prompt: "Rewrite your last passive sentence from your essay in active voice.",
        steps: [
          { label: "Locate", detail: "Circle the be-verb + past participle." },
          { label: "Actor first", detail: "Move the doer to the subject position." },
          { label: "Trim", detail: "Remove unnecessary “by ___” phrases." },
        ],
        discussionStems: [
          "Read your original sentence aloud — who is doing what?",
          "Does the active version sound clearer to a reader?",
        ],
      },
    ];
  }

  return [
    {
      id: id(),
      difficulty: "warm-up",
      prompt: `Warm-up: explain one core idea for ${input.topic} in ${input.subject}.`,
      steps: [
        { label: "Recall", detail: "Name the key vocabulary for today's topic." },
        { label: "Model", detail: "Walk one simple example together." },
      ],
      discussionStems: [
        "What do you already know about this topic?",
        "Can you describe the first step in your own words?",
      ],
    },
    {
      id: id(),
      difficulty: "guided",
      prompt: `Guided practice: apply ${input.topic} to a standard ${input.subject} problem.`,
      steps: [
        { label: "Plan", detail: "Identify what the problem is asking." },
        { label: "Execute", detail: "Work the steps with tutor hints." },
        { label: "Check", detail: "Verify the answer fits the question." },
      ],
      discussionStems: [
        "What is this problem really asking you to find?",
        "What would a partial attempt look like?",
      ],
    },
    {
      id: id(),
      difficulty: "independent",
      prompt: `Independent try: a near-transfer ${input.topic} problem in ${input.subject}.`,
      steps: [
        { label: "Set up", detail: "Student sets up without tutor writing." },
        { label: "Coach", detail: "Tutor asks hint questions only." },
        { label: "Reflect", detail: "Student summarizes the strategy used." },
      ],
      discussionStems: [
        "What strategy from the last problem still applies?",
        "Where did you get stuck, and what helped?",
      ],
    },
  ];
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
      model: practiceModel(),
      temperature: 0.65,
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

function parsePracticeProblems(raw: unknown): PracticeProblem[] {
  if (!Array.isArray(raw)) return [];
  const difficulties: PracticeProblemDifficulty[] = ["warm-up", "guided", "independent"];
  const results: PracticeProblem[] = [];

  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    if (!prompt) continue;
    const difficultyRaw = typeof row.difficulty === "string" ? row.difficulty.trim() : "";
    const difficulty = difficulties.includes(difficultyRaw as PracticeProblemDifficulty)
      ? (difficultyRaw as PracticeProblemDifficulty)
      : difficulties[Math.min(index, difficulties.length - 1)];
    results.push({
      id: crypto.randomUUID(),
      prompt,
      steps: parseSteps(row.steps),
      discussionStems: asStringArray(row.discussionStems),
      difficulty,
    });
  }

  return results;
}

export async function generatePracticeProblems(input: {
  tuteeName: string;
  tuteeSlug: string;
  subject: string;
  topic: string;
  prepBrief?: PrepBrief;
}): Promise<PracticeProblem[]> {
  const memory = await getTuteeMemory(input.tuteeSlug);
  const fallback = templateProblems({ subject: input.subject, topic: input.topic });

  try {
    const content = await chatCompletion([
      {
        role: "system",
        content: [
          "You are TutorOS Practice Problem Generator — an expert high-school tutor coach.",
          "Generate practice problems for ANY subject (math, science, English, SAT, etc.).",
          "Return ONLY valid JSON:",
          '{ "practiceProblems": [',
          '  {',
          '    "prompt": "student-facing problem text",',
          '    "difficulty": "warm-up" | "guided" | "independent",',
          '    "steps": [{ "label": "short step name", "detail": "tutor-facing solution walkthrough" }],',
          '    "discussionStems": ["question tutor can ask", "..."]',
          "  }",
          "] }",
          "Rules:",
          "- Exactly 3 problems: one warm-up, one guided, one independent (in that order).",
          "- Prompts are what the tutor gives the student; steps/stems are tutor-only reference.",
          "- Steps: 2-5 per problem with concrete math/work/text as appropriate to the subject.",
          "- Discussion stems: 2-4 open questions that promote thinking, not yes/no.",
          "- Match reading level to high school. No surveillance language.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Tutee: ${input.tuteeName}`,
          `Subject: ${input.subject}`,
          `Topic: ${input.topic}`,
          memorySummary(memory),
          briefSummary(input.prepBrief),
          "",
          "Generate fresh practice problems for this tutoring session.",
        ].join("\n"),
      },
    ]);

    if (!content) return fallback;

    const parsed = extractJsonObject(content);
    const problems = parsePracticeProblems(parsed?.practiceProblems);
    if (problems.length === 0) return fallback;
    return problems;
  } catch {
    return fallback;
  }
}

export function normalizePracticeProblems(problems: PracticeProblem[]): PracticeProblem[] {
  return problems.map((p) => ({
    ...p,
    id: p.id || crypto.randomUUID(),
    prompt: p.prompt.trim(),
    steps: p.steps.map((s) => ({ label: s.label.trim() || "Step", detail: s.detail.trim() })),
    discussionStems: p.discussionStems.map((s) => s.trim()).filter(Boolean),
  }));
}
