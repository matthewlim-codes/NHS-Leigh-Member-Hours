import type { PracticeProblem, WorkedExampleStep } from "./api";

function id() {
  return crypto.randomUUID();
}

export function templatePracticeProblems(input: {
  subject: string;
  topic: string;
}): PracticeProblem[] {
  const topic = `${input.subject} ${input.topic}`.toLowerCase();

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
          { label: "Answer", detail: "(x − 5)(x + 4)." },
        ],
        discussionStems: [
          "What does the sign of the constant tell you about the factors?",
          "Talk me through why your two numbers work.",
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
      prompt: `Guided practice: apply ${input.topic} in ${input.subject}.`,
      steps: [
        { label: "Plan", detail: "Identify what the problem is asking." },
        { label: "Execute", detail: "Work the steps with tutor hints." },
      ],
      discussionStems: [
        "What is this problem really asking you to find?",
        "What would a partial attempt look like?",
      ],
    },
    {
      id: id(),
      difficulty: "independent",
      prompt: `Independent try: a near-transfer ${input.topic} problem.`,
      steps: [
        { label: "Set up", detail: "Student sets up without tutor writing." },
        { label: "Reflect", detail: "Student summarizes the strategy used." },
      ],
      discussionStems: [
        "What strategy from the last problem still applies?",
        "Where did you get stuck, and what helped?",
      ],
    },
  ];
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
  }));
}
