import { getTuteeMemory, type PrepBrief, type TuteeMemory, type WorkedExampleStep } from "./tutoros-store";

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;

export const PRACTICE_DIFFICULTIES = [
  "basic",
  "easy",
  "medium",
  "challenging",
  "advanced",
] as const;

export type PracticeProblemDifficulty = (typeof PRACTICE_DIFFICULTIES)[number];

export type PracticeDifficultyMode = "easier" | "same" | "harder";

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
    process.env.TUTOROS_PREP_AI_MODEL ||
    process.env.TUTOROS_AI_MODEL ||
    "anthropic/claude-sonnet-4.6"
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

function memorySummary(memory: TuteeMemory | null): string {
  if (!memory) return "No prior TutorOS memory.";
  const struggles = Array.isArray(memory.profile.struggles)
    ? memory.profile.struggles.map(String).join("; ")
    : "";
  const approach =
    typeof memory.profile.preferredApproach === "string"
      ? memory.profile.preferredApproach
      : "";
  const episodes = memory.episodes
    .slice(0, 3)
    .map((e, i) => `${i + 1}. [${e.topic}] ${e.headline ?? e.summary}`)
    .join("\n");
  const practiced = Array.isArray(memory.profile.practicedPrompts)
    ? memory.profile.practicedPrompts.map(String).slice(0, 8).join(" | ")
    : "";
  return [
    approach && `Preferred approach: ${approach}`,
    struggles && `Struggles: ${struggles}`,
    practiced && `Already practiced: ${practiced}`,
    episodes && `Recent episodes:\n${episodes}`,
  ]
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

function difficultyBand(mode: PracticeDifficultyMode): PracticeProblemDifficulty[] {
  if (mode === "easier") return ["basic", "easy", "medium"];
  if (mode === "harder") return ["medium", "challenging", "advanced"];
  return ["easy", "medium", "challenging"];
}

function promptKey(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksOffSubject(prompt: string, subject: string, topic: string): boolean {
  const hay = `${subject} ${topic}`.toLowerCase();
  const p = prompt.toLowerCase();
  const isEnglish =
    hay.includes("english") || hay.includes("passive") || hay.includes("active voice") || hay.includes("essay");
  const isChem = hay.includes("chem") || hay.includes("periodic") || hay.includes("electronegativity");
  const isMath =
    hay.includes("factor") ||
    hay.includes("algebra") ||
    hay.includes("im2") ||
    hay.includes("geometry") ||
    hay.includes("precalc") ||
    hay.includes("sat math");

  if (isEnglish && (p.includes("factor:") || /x\s*²/.test(p) || p.includes("x^2"))) return true;
  if (isChem && (p.includes("factor:") || p.includes("passive voice") || p.includes("active voice"))) return true;
  if (isMath && (p.includes("passive voice") || p.includes("active voice") || p.includes("rewrite in"))) return true;
  return false;
}

function filterFreshProblems(
  problems: PracticeProblem[],
  avoidPrompts: string[],
  subject?: string,
  topic?: string,
): PracticeProblem[] {
  const avoid = new Set(avoidPrompts.map(promptKey).filter(Boolean));
  return problems.filter((p) => {
    if (avoid.has(promptKey(p.prompt))) return false;
    if (subject && topic && looksOffSubject(p.prompt, subject, topic)) return false;
    return true;
  });
}

function templateProblems(input: {
  subject: string;
  topic: string;
  mode: PracticeDifficultyMode;
  variant: number;
  avoidPrompts?: string[];
}): PracticeProblem[] {
  const topic = `${input.subject} ${input.topic}`.toLowerCase();
  const id = () => crypto.randomUUID();
  const band = difficultyBand(input.mode);
  const avoid = new Set((input.avoidPrompts ?? []).map(promptKey));

  if (
    topic.includes("passive") ||
    topic.includes("active voice") ||
    topic.includes("essay") ||
    (topic.includes("english") && topic.includes("voice"))
  ) {
    const voiceSets = [
      [
        {
          prompt: 'Rewrite in active voice: "The essay was written by Maya overnight."',
          answer: "Maya wrote the essay overnight.",
        },
        {
          prompt: 'Rewrite in active voice: "The draft was revised by the peer tutor."',
          answer: "The peer tutor revised the draft.",
        },
        {
          prompt:
            'Rewrite in active voice and keep the meaning: "Mistakes were made in the thesis statement."',
          answer: "The student made mistakes in the thesis statement. (doer may be inferred)",
        },
      ],
      [
        {
          prompt: 'Is this active or passive? "Ms. Rivera graded the essays." Explain why.',
          answer: "Active — Ms. Rivera (subject) does the grading.",
        },
        {
          prompt: 'Rewrite in passive voice: "Students submitted their outlines on Friday."',
          answer: "The outlines were submitted by students on Friday.",
        },
        {
          prompt:
            'Fix the weak passive: "It was decided that the conclusion needed more evidence." Make it active and specific.',
          answer: "The student decided the conclusion needed more evidence.",
        },
      ],
      [
        {
          prompt: 'Rewrite in active voice: "The claim was supported by three quotes."',
          answer: "Three quotes supported the claim. / The writer supported the claim with three quotes.",
        },
        {
          prompt: 'Spot the passive verbs: "The paragraph was rewritten after feedback was given."',
          answer: "was rewritten; was given",
        },
        {
          prompt:
            'Turn this into a strong active essay sentence: "Research was done on climate change by the class."',
          answer: "The class researched climate change.",
        },
      ],
    ];
    let best = voiceSets[input.variant % voiceSets.length]!;
    let bestOverlap = Infinity;
    for (let i = 0; i < voiceSets.length; i++) {
      const set = voiceSets[(input.variant + i) % voiceSets.length]!;
      const overlap = set.filter((item) => avoid.has(promptKey(item.prompt))).length;
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = set;
        if (overlap === 0) break;
      }
    }
    return best.map((item, i) => ({
      id: id(),
      difficulty: band[i]!,
      prompt: item.prompt,
      steps: [
        { label: "Find the doer", detail: "Ask who is performing the action." },
        { label: "Rewrite", detail: `Model answer: ${item.answer}` },
        { label: "Check", detail: "Confirm meaning stayed the same and the sentence is clearer." },
      ],
      discussionStems: [
        "Who is doing the action in this sentence?",
        "How does the active rewrite change the tone of the essay?",
      ],
    }));
  }

  if (topic.includes("periodic") || topic.includes("electronegativity") || topic.includes("ionization")) {
    const chemSets = [
      [
        {
          prompt: "Which has a larger atomic radius: Na or Cl? Explain using periodic trends.",
          answer: "Na — fewer protons pull less tightly across the period.",
        },
        {
          prompt: "Which is more electronegative: O or S? Why?",
          answer: "O — same group, smaller radius / higher attraction higher up.",
        },
        {
          prompt: "Why does ionization energy generally increase left→right across a period?",
          answer: "Increasing nuclear charge holds electrons more tightly.",
        },
      ],
      [
        {
          prompt: "Rank F, N, and C from lowest to highest electronegativity.",
          answer: "C < N < F",
        },
        {
          prompt: "Explain why K has a lower first ionization energy than Na.",
          answer: "K’s valence electron is farther from the nucleus (more shells).",
        },
        {
          prompt: "Predict which is smaller: Mg²⁺ or Na⁺. Explain.",
          answer: "Mg²⁺ — same electron count, more protons → smaller radius.",
        },
      ],
    ];
    const set = chemSets[input.variant % chemSets.length]!;
    return set.map((item, i) => ({
      id: id(),
      difficulty: band[i]!,
      prompt: item.prompt,
      steps: [
        { label: "Locate", detail: "Find the elements on the periodic table." },
        { label: "Apply trend", detail: item.answer },
        { label: "Say why", detail: "Tie the answer to protons, shells, or attraction." },
      ],
      discussionStems: [
        "What trend are we using?",
        "Can you explain the trend without memorizing the answer?",
      ],
    }));
  }

  const factorSets = [
    [
      { d: band[0], prompt: "Factor: x² + 5x + 6", a: "(x + 2)(x + 3)", nums: "2 and 3" },
      { d: band[1], prompt: "Factor: x² + 9x + 18", a: "(x + 3)(x + 6)", nums: "3 and 6" },
      { d: band[2], prompt: "Factor: x² − 2x − 24", a: "(x − 6)(x + 4)", nums: "−6 and 4" },
    ],
    [
      { d: band[0], prompt: "Factor: x² + 8x + 15", a: "(x + 3)(x + 5)", nums: "3 and 5" },
      { d: band[1], prompt: "Factor: x² − 5x − 14", a: "(x − 7)(x + 2)", nums: "−7 and 2" },
      { d: band[2], prompt: "Factor: x² + x − 30", a: "(x + 6)(x − 5)", nums: "6 and −5" },
    ],
    [
      { d: band[0], prompt: "Factor: x² + 7x + 12", a: "(x + 3)(x + 4)", nums: "3 and 4" },
      { d: band[1], prompt: "Factor: x² − 8x + 12", a: "(x − 6)(x − 2)", nums: "−6 and −2" },
      { d: band[2], prompt: "Factor: x² − x − 20", a: "(x − 5)(x + 4)", nums: "−5 and 4" },
    ],
    [
      { d: band[0], prompt: "Factor: x² + 6x + 8", a: "(x + 2)(x + 4)", nums: "2 and 4" },
      { d: band[1], prompt: "Factor: x² − 3x − 10", a: "(x − 5)(x + 2)", nums: "−5 and 2" },
      { d: band[2], prompt: "Factor: x² + 4x − 21", a: "(x + 7)(x − 3)", nums: "7 and −3" },
    ],
    [
      { d: band[0], prompt: "Factor: x² + 11x + 24", a: "(x + 3)(x + 8)", nums: "3 and 8" },
      { d: band[1], prompt: "Factor: x² − 7x + 10", a: "(x − 5)(x − 2)", nums: "−5 and −2" },
      { d: band[2], prompt: "Factor: x² − 4x − 32", a: "(x − 8)(x + 4)", nums: "−8 and 4" },
    ],
    [
      { d: band[0], prompt: "Factor: x² + 10x + 21", a: "(x + 3)(x + 7)", nums: "3 and 7" },
      { d: band[1], prompt: "Factor: x² + 2x − 35", a: "(x + 7)(x − 5)", nums: "7 and −5" },
      { d: band[2], prompt: "Factor: x² − 9x + 20", a: "(x − 4)(x − 5)", nums: "−4 and −5" },
    ],
  ];

  if (topic.includes("factor") || topic.includes("algebra") || topic.includes("im2")) {
    let best = factorSets[input.variant % factorSets.length]!;
    let bestOverlap = Infinity;
    for (let i = 0; i < factorSets.length; i++) {
      const set = factorSets[(input.variant + i) % factorSets.length]!;
      const overlap = set.filter((item) => avoid.has(promptKey(item.prompt))).length;
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = set;
        if (overlap === 0) break;
      }
    }
    return best.map((item) => ({
      id: id(),
      difficulty: item.d!,
      prompt: item.prompt,
      steps: [
        { label: "Set up", detail: `Find two numbers that multiply and add correctly → ${item.nums}.` },
        { label: "Write", detail: `Answer: ${item.a}.` },
        { label: "Check", detail: "Expand briefly to confirm the middle term." },
      ],
      discussionStems: [
        "What two numbers are you looking for?",
        "How will you check without fully expanding?",
      ],
    }));
  }

  const nonce = (input.variant % 900) + 100;
  return band.map((d, i) => ({
    id: id(),
    difficulty: d,
    prompt: `${input.subject} · ${input.topic} practice ${i + 1} (${d}) [#${nonce}]: create and complete one concrete task that matches today's goal — stay on this subject/topic only.`,
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
      temperature: 0.7,
      max_tokens: 2200,
      messages,
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

function parsePracticeProblems(value: unknown): PracticeProblem[] {
  if (!Array.isArray(value)) return [];
  const results: PracticeProblem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    if (!prompt) continue;
    const difficultyRaw = typeof row.difficulty === "string" ? row.difficulty : "medium";
    results.push({
      id: crypto.randomUUID(),
      prompt,
      steps: parseSteps(row.steps),
      discussionStems: asStringArray(row.discussionStems),
      difficulty: normalizeDifficulty(difficultyRaw),
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
  avoidPrompts?: string[];
  difficultyMode?: PracticeDifficultyMode;
}): Promise<PracticeProblem[]> {
  const memory = await getTuteeMemory(input.tuteeSlug);
  const mode = input.difficultyMode ?? "same";
  const avoidPrompts = input.avoidPrompts ?? [];
  const memoryAvoid = Array.isArray(memory?.profile.practicedPrompts)
    ? memory.profile.practicedPrompts.map(String)
    : [];
  const avoidPromptsMerged = [...new Set([...avoidPrompts, ...memoryAvoid])];
  const band = difficultyBand(mode);
  const variant = Date.now() % 1000;
  const fallback = templateProblems({
    subject: input.subject,
    topic: input.topic,
    mode,
    variant,
    avoidPrompts: avoidPromptsMerged,
  });

  try {
    const content = await chatCompletion([
      {
        role: "system",
        content: [
          "You are TutorOS Practice Problem Generator for high-school peer tutoring.",
          "Generate NEW practice problems that are NOT duplicates of previous ones.",
          "CRITICAL: Every prompt must be extremely specific to the given SUBJECT and TOPIC.",
          "Never generate algebra/factoring problems for English. Never generate grammar for chemistry or math.",
          "For English passive vs active voice: use concrete sentence rewrite / classify tasks.",
          "For chemistry periodic trends: use radius / electronegativity / ionization comparisons.",
          "For factoring: use quadratic factoring prompts only.",
          "Return ONLY valid JSON:",
          '{ "practiceProblems": [',
          "  {",
          '    "prompt": "student-facing problem text",',
          '    "difficulty": "basic" | "easy" | "medium" | "challenging" | "advanced",',
          '    "steps": [{ "label": "short step name", "detail": "tutor-facing solution walkthrough" }],',
          '    "discussionStems": ["question tutor can ask", "..."]',
          "  }",
          "] }",
          "Rules:",
          `- Exactly 3 problems with difficulties roughly: ${band.join(", ")} (in that order).`,
          "- Prompts must be brand-new — never reuse avoided prompts or near-paraphrases.",
          "- Use prior memory: if the student struggled, scaffold; if they improved, push transfer.",
          "- Steps: 2-5 per problem. Discussion stems: 2-4 open questions.",
          "- Match high-school level. No surveillance language.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Tutee: ${input.tuteeName}`,
          `Subject: ${input.subject}`,
          `Topic: ${input.topic}`,
          "Hard constraint: stay on this subject/topic only.",
          `Difficulty mode: ${mode} (target band: ${band.join(" → ")})`,
          `Freshness nonce: ${variant}`,
          memorySummary(memory),
          briefSummary(input.prepBrief),
          avoidPromptsMerged.length
            ? `DO NOT generate these (or close variants):\n${avoidPromptsMerged.map((p) => `- ${p}`).join("\n")}`
            : "No prior prompts to avoid.",
          "",
          "Generate three fresh practice problems for this session.",
        ].join("\n"),
      },
    ]);

    if (!content) {
      return filterFreshProblems(fallback, avoidPromptsMerged, input.subject, input.topic).length
        ? filterFreshProblems(fallback, avoidPromptsMerged, input.subject, input.topic)
        : fallback;
    }

    const parsed = extractJsonObject(content);
    let problems = filterFreshProblems(
      parsePracticeProblems(parsed?.practiceProblems),
      avoidPromptsMerged,
      input.subject,
      input.topic,
    );
    if (problems.length < 3) {
      const extras = filterFreshProblems(
        fallback,
        [...avoidPromptsMerged, ...problems.map((p) => p.prompt)],
        input.subject,
        input.topic,
      );
      problems = [...problems, ...extras].slice(0, 3);
    }
    if (problems.length === 0) return fallback;
    return problems.slice(0, 3);
  } catch {
    return filterFreshProblems(fallback, avoidPromptsMerged, input.subject, input.topic).length
      ? filterFreshProblems(fallback, avoidPromptsMerged, input.subject, input.topic)
      : fallback;
  }
}

export function normalizePracticeProblems(
  problems: Array<{
    id?: string;
    prompt: string;
    steps: WorkedExampleStep[];
    discussionStems: string[];
    difficulty: string;
  }>,
): PracticeProblem[] {
  return problems.map((p) => ({
    ...p,
    id: p.id || crypto.randomUUID(),
    prompt: p.prompt.trim(),
    steps: p.steps.map((s) => ({ label: s.label.trim() || "Step", detail: s.detail.trim() })),
    discussionStems: p.discussionStems.map((s) => s.trim()).filter(Boolean),
    difficulty: normalizeDifficulty(String(p.difficulty)),
  }));
}
