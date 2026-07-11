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

  if (
    topic.includes("passive") ||
    topic.includes("active voice") ||
    topic.includes("essay") ||
    (topic.includes("english") && topic.includes("voice"))
  ) {
    return [
      {
        id: id(),
        difficulty: band[0] ?? "basic",
        prompt: 'Rewrite in active voice: "The essay was written by Maya overnight."',
        steps: [
          { label: "Find the doer", detail: "Maya is performing the action." },
          { label: "Rewrite", detail: "Maya wrote the essay overnight." },
        ],
        discussionStems: ["Who is doing the action?", "Why is active voice stronger in essays?"],
      },
      {
        id: id(),
        difficulty: band[1] ?? "medium",
        prompt: 'Rewrite in active voice: "The draft was revised by the peer tutor."',
        steps: [
          { label: "Find the doer", detail: "The peer tutor." },
          { label: "Rewrite", detail: "The peer tutor revised the draft." },
        ],
        discussionStems: ["What changes when the subject becomes the doer?"],
      },
      {
        id: id(),
        difficulty: band[2] ?? "challenging",
        prompt:
          'Fix the weak passive: "It was decided that the conclusion needed more evidence." Make it active and specific.',
        steps: [
          { label: "Name the doer", detail: "Infer a concrete subject (the student / Maya)." },
          {
            label: "Rewrite",
            detail: "The student decided the conclusion needed more evidence.",
          },
        ],
        discussionStems: ["Why is 'it was decided' weak in academic writing?"],
      },
    ];
  }

  if (topic.includes("periodic") || topic.includes("electronegativity") || topic.includes("ionization")) {
    return [
      {
        id: id(),
        difficulty: band[0] ?? "basic",
        prompt: "Which has a larger atomic radius: Na or Cl? Explain using periodic trends.",
        steps: [
          { label: "Locate", detail: "Na is left of Cl in period 3." },
          { label: "Trend", detail: "Radius shrinks left→right — Na is larger." },
        ],
        discussionStems: ["What causes radius to shrink across a period?"],
      },
      {
        id: id(),
        difficulty: band[1] ?? "medium",
        prompt: "Which is more electronegative: O or S? Why?",
        steps: [
          { label: "Same group", detail: "O is above S." },
          { label: "Trend", detail: "Electronegativity rises up a group — O is higher." },
        ],
        discussionStems: ["How does distance from the nucleus affect attraction?"],
      },
      {
        id: id(),
        difficulty: band[2] ?? "challenging",
        prompt: "Why does ionization energy generally increase left→right across a period?",
        steps: [
          {
            label: "Explain",
            detail: "Increasing nuclear charge holds electrons more tightly.",
          },
        ],
        discussionStems: ["Can you use a specific pair of elements as an example?"],
      },
    ];
  }

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
    prompt: `${input.subject} · ${input.topic} practice ${i + 1} (${d}) [#${nonce}]: complete one concrete task for this subject/topic only.`,
    steps: [
      { label: "Frame", detail: `Restate the ${input.topic} idea for ${input.subject} in one sentence.` },
      { label: "Try", detail: "Attempt the task out loud, one step at a time." },
      { label: "Check", detail: "Explain why the answer makes sense for this topic." },
    ],
    discussionStems: [
      "What is the first move you would make?",
      "Where could a common mistake show up for this topic?",
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
