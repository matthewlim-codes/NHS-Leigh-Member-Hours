import type { PracticeProblem, PracticeProblemDifficulty, WorkedExampleStep } from "./api";

export type PracticeDifficultyMode = "easier" | "same" | "harder";

export const PRACTICE_DIFFICULTIES: PracticeProblemDifficulty[] = [
  "basic",
  "easy",
  "medium",
  "challenging",
  "advanced",
];

export const DIFFICULTY_LABEL: Record<string, string> = {
  basic: "Basic",
  easy: "Easy",
  medium: "Medium",
  challenging: "Challenging",
  advanced: "Advanced",
  "warm-up": "Basic",
  guided: "Medium",
  independent: "Advanced",
};

function id() {
  return crypto.randomUUID();
}

function promptKey(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDifficulty(raw: string): PracticeProblemDifficulty {
  const value = raw.trim().toLowerCase();
  if (value === "warm-up" || value === "warmup") return "basic";
  if (value === "guided") return "medium";
  if (value === "independent") return "advanced";
  if ((PRACTICE_DIFFICULTIES as readonly string[]).includes(value)) {
    return value as PracticeProblemDifficulty;
  }
  return "medium";
}

function difficultyBand(mode: PracticeDifficultyMode): PracticeProblemDifficulty[] {
  if (mode === "easier") return ["basic", "easy", "medium"];
  if (mode === "harder") return ["medium", "challenging", "advanced"];
  return ["easy", "medium", "challenging"];
}

const FACTOR_VARIANTS: Array<
  Array<{ prompt: string; answer: string; nums: string }>
> = [
  [
    { prompt: "Factor: x² + 5x + 6", answer: "(x + 2)(x + 3)", nums: "2 and 3" },
    { prompt: "Factor: x² + 9x + 18", answer: "(x + 3)(x + 6)", nums: "3 and 6" },
    { prompt: "Factor: x² − 2x − 24", answer: "(x − 6)(x + 4)", nums: "−6 and 4" },
  ],
  [
    { prompt: "Factor: x² + 8x + 15", answer: "(x + 3)(x + 5)", nums: "3 and 5" },
    { prompt: "Factor: x² − 5x − 14", answer: "(x − 7)(x + 2)", nums: "−7 and 2" },
    { prompt: "Factor: x² + x − 30", answer: "(x + 6)(x − 5)", nums: "6 and −5" },
  ],
  [
    { prompt: "Factor: x² + 7x + 12", answer: "(x + 3)(x + 4)", nums: "3 and 4" },
    { prompt: "Factor: x² − 8x + 12", answer: "(x − 6)(x − 2)", nums: "−6 and −2" },
    { prompt: "Factor: x² − x − 20", answer: "(x − 5)(x + 4)", nums: "−5 and 4" },
  ],
  [
    { prompt: "Factor: x² + 6x + 8", answer: "(x + 2)(x + 4)", nums: "2 and 4" },
    { prompt: "Factor: x² − 3x − 10", answer: "(x − 5)(x + 2)", nums: "−5 and 2" },
    { prompt: "Factor: x² + 4x − 21", answer: "(x + 7)(x − 3)", nums: "7 and −3" },
  ],
  [
    { prompt: "Factor: x² + 11x + 24", answer: "(x + 3)(x + 8)", nums: "3 and 8" },
    { prompt: "Factor: x² − 7x + 10", answer: "(x − 5)(x − 2)", nums: "−5 and −2" },
    { prompt: "Factor: x² − 4x − 32", answer: "(x − 8)(x + 4)", nums: "−8 and 4" },
  ],
  [
    { prompt: "Factor: x² + 10x + 21", answer: "(x + 3)(x + 7)", nums: "3 and 7" },
    { prompt: "Factor: x² + 2x − 35", answer: "(x + 7)(x − 5)", nums: "7 and −5" },
    { prompt: "Factor: x² − 9x + 20", answer: "(x − 4)(x − 5)", nums: "−4 and −5" },
  ],
];

function pickVariantIndex(avoidPrompts: string[]): number {
  const avoid = new Set(avoidPrompts.map(promptKey));
  const scores = FACTOR_VARIANTS.map((variant, index) => {
    const overlap = variant.filter((item) => avoid.has(promptKey(item.prompt))).length;
    return { index, overlap };
  });
  scores.sort((a, b) => a.overlap - b.overlap || Math.random() - 0.5);
  return scores[0]?.index ?? Date.now() % FACTOR_VARIANTS.length;
}

export function templatePracticeProblems(input: {
  subject: string;
  topic: string;
  difficultyMode?: PracticeDifficultyMode;
  avoidPrompts?: string[];
}): PracticeProblem[] {
  const topic = `${input.subject} ${input.topic}`.toLowerCase();
  const mode = input.difficultyMode ?? "same";
  const band = difficultyBand(mode);
  const avoidPrompts = input.avoidPrompts ?? [];

  if (topic.includes("factor") || topic.includes("algebra") || topic.includes("im2")) {
    const variant = FACTOR_VARIANTS[pickVariantIndex(avoidPrompts)]!;
    return variant.map((item, i) => ({
      id: id(),
      difficulty: band[i] ?? "medium",
      prompt: item.prompt,
      steps: [
        { label: "Set up", detail: `Find two numbers that multiply and add correctly → ${item.nums}.` },
        { label: "Write", detail: `Answer: ${item.answer}.` },
        { label: "Check", detail: "Expand briefly to confirm the middle term." },
      ],
      discussionStems: [
        "What two numbers are you looking for?",
        "How will you check without fully expanding?",
      ],
    }));
  }

  const nonce = (Date.now() % 900) + 100;
  return band.map((d, i) => ({
    id: id(),
    difficulty: d,
    prompt: `Practice ${i + 1} (${d}) on ${input.topic} [#${nonce}]: write and solve one new problem that matches today's goal.`,
    steps: [
      { label: "Frame", detail: `Restate the ${input.topic} idea in one sentence.` },
      { label: "Try", detail: "Attempt the problem out loud, one step at a time." },
      { label: "Check", detail: "Explain why the answer makes sense." },
    ],
    discussionStems: [
      "What is the first move you would make?",
      "Where could a common mistake show up?",
    ],
  }));
}

export function normalizePracticeProblems(problems: PracticeProblem[]): PracticeProblem[] {
  return problems.map((p) => ({
    ...p,
    id: p.id || id(),
    prompt: p.prompt.trim(),
    steps: p.steps.map((s: WorkedExampleStep) => ({
      label: s.label.trim() || "Step",
      detail: s.detail.trim(),
    })),
    discussionStems: p.discussionStems.map((s) => s.trim()).filter(Boolean),
    difficulty: normalizeDifficulty(String(p.difficulty)),
  }));
}
