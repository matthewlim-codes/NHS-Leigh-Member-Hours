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

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUnique<T>(
  items: T[],
  count: number,
  rand: () => number,
  used: Set<string>,
  keyFn: (item: T) => string,
): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const out: T[] = [];
  for (const item of pool) {
    const key = keyFn(item);
    if (used.has(key)) continue;
    used.add(key);
    out.push(item);
    if (out.length >= count) break;
  }
  return out;
}

/** Always-fresh template problems — never returns avoided prompts. */
function synthesizeFreshProblems(input: {
  subject: string;
  topic: string;
  mode: PracticeDifficultyMode;
  seed: number;
  avoidPrompts: string[];
}): PracticeProblem[] {
  const topic = `${input.subject} ${input.topic}`.toLowerCase();
  const band = difficultyBand(input.mode);
  const avoid = new Set(input.avoidPrompts.map(promptKey));
  const rand = mulberry32(input.seed);
  const used = new Set(avoid);

  if (
    topic.includes("passive") ||
    topic.includes("active voice") ||
    topic.includes("essay") ||
    (topic.includes("english") && topic.includes("voice"))
  ) {
    const doers = [
      "Maya",
      "the peer tutor",
      "Ms. Rivera",
      "the class",
      "Jordan",
      "the editor",
      "Sam",
      "the writing center",
      "the student",
      "the group",
    ];
    const objects = [
      "essay",
      "draft",
      "outline",
      "thesis",
      "conclusion",
      "introduction",
      "paragraph",
      "claim",
      "counterargument",
      "works-cited page",
    ];
    const verbs: Array<{ past: string; participle: string }> = [
      { past: "wrote", participle: "written" },
      { past: "revised", participle: "revised" },
      { past: "submitted", participle: "submitted" },
      { past: "graded", participle: "graded" },
      { past: "supported", participle: "supported" },
      { past: "rewrote", participle: "rewritten" },
      { past: "published", participle: "published" },
      { past: "analyzed", participle: "analyzed" },
      { past: "cited", participle: "cited" },
      { past: "challenged", participle: "challenged" },
    ];

    const candidates: Array<{ prompt: string; answer: string }> = [];
    for (const doer of doers) {
      for (const obj of objects) {
        for (const verb of verbs) {
          candidates.push({
            prompt: `Rewrite in active voice: "The ${obj} was ${verb.participle} by ${doer}."`,
            answer: `${doer.charAt(0).toUpperCase()}${doer.slice(1)} ${verb.past} the ${obj}.`,
          });
          candidates.push({
            prompt: `Is this active or passive? "${doer.charAt(0).toUpperCase()}${doer.slice(1)} ${verb.past} the ${obj}." Explain why.`,
            answer: `Active — ${doer} (subject) performs the action.`,
          });
          candidates.push({
            prompt: `Rewrite in passive voice: "${doer.charAt(0).toUpperCase()}${doer.slice(1)} ${verb.past} the ${obj}."`,
            answer: `The ${obj} was ${verb.participle} by ${doer}.`,
          });
        }
      }
    }

    const picked = pickUnique(candidates, 3, rand, used, (c) => promptKey(c.prompt));
    while (picked.length < 3) {
      const n = Math.floor(rand() * 9000) + 1000;
      const prompt = `Rewrite in active voice (set ${n}): "The argument was weakened by vague evidence."`;
      if (used.has(promptKey(prompt))) continue;
      used.add(promptKey(prompt));
      picked.push({ prompt, answer: "Vague evidence weakened the argument." });
    }

    return picked.map((item, i) => ({
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
    const pairs = [
      ["Na", "Cl", "radius", "Na is larger — radius shrinks left→right."],
      ["O", "S", "electronegativity", "O is higher — EN rises up a group."],
      ["F", "N", "electronegativity", "F > N across period 2."],
      ["K", "Na", "ionization", "K is lower — valence electron is farther out."],
      ["Mg", "Al", "radius", "Mg is larger than Al in period 3."],
      ["C", "F", "electronegativity", "F is highest — far right of period 2."],
      ["Li", "F", "ionization", "F has higher IE — nuclear charge rises across the period."],
      ["P", "N", "electronegativity", "N is higher — same group, smaller up the column."],
      ["Ca", "Br", "radius", "Ca is larger — metals left, nonmetals right."],
      ["Be", "O", "ionization", "O has higher IE across period 2."],
    ] as const;

    const candidates = pairs.map(([a, b, kind, answer]) => ({
      prompt:
        kind === "radius"
          ? `Which has a larger atomic radius: ${a} or ${b}? Explain using periodic trends.`
          : kind === "electronegativity"
            ? `Which is more electronegative: ${a} or ${b}? Why?`
            : `Compare first ionization energy for ${a} vs ${b}. Which is higher and why?`,
      answer,
    }));

    const picked = pickUnique(candidates, 3, rand, used, (c) => promptKey(c.prompt));
    while (picked.length < 3) {
      const n = Math.floor(rand() * 90) + 10;
      const prompt = `Explain one periodic trend using elements in period ${n % 3 === 0 ? 2 : 3} (variant ${n}).`;
      if (used.has(promptKey(prompt))) continue;
      used.add(promptKey(prompt));
      picked.push({
        prompt,
        answer: "Across a period left→right: radius shrinks; EN and IE rise.",
      });
    }

    return picked.map((item, i) => ({
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

  if (topic.includes("factor") || topic.includes("algebra") || topic.includes("im2")) {
    const pairs: Array<[number, number]> = [];
    for (let p = -12; p <= 12; p++) {
      if (p === 0) continue;
      for (let q = p; q <= 12; q++) {
        if (q === 0) continue;
        pairs.push([p, q]);
      }
    }

    const candidates = pairs.map(([p, q]) => {
      const b = p + q;
      const c = p * q;
      const bTerm = b === 0 ? "" : b > 0 ? ` + ${b}x` : ` − ${Math.abs(b)}x`;
      const cTerm = c === 0 ? "" : c > 0 ? ` + ${c}` : ` − ${Math.abs(c)}`;
      const fmt = (n: number) => (n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`);
      return {
        prompt: `Factor: x²${bTerm}${cTerm}`,
        answer: `(x ${fmt(p)})(x ${fmt(q)})`,
        nums: `${p} and ${q}`,
      };
    });

    const picked = pickUnique(candidates, 3, rand, used, (c) => promptKey(c.prompt));
    while (picked.length < 3) {
      const p = Math.floor(rand() * 9) + 2;
      const q = Math.floor(rand() * 9) + 2;
      const prompt = `Factor: x² + ${p + q}x + ${p * q}`;
      if (used.has(promptKey(prompt))) continue;
      used.add(promptKey(prompt));
      picked.push({
        prompt,
        answer: `(x + ${p})(x + ${q})`,
        nums: `${p} and ${q}`,
      });
    }

    return picked.map((item, i) => ({
      id: id(),
      difficulty: band[i]!,
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

  const nonce = Math.floor(rand() * 9000) + 1000;
  return band.map((d, i) => {
    let prompt = "";
    let attempt = 0;
    do {
      prompt = `${input.subject} · ${input.topic} practice ${i + 1} (${d}) [#${nonce + attempt + i * 17}]: complete one concrete task for this subject/topic only.`;
      attempt++;
    } while (used.has(promptKey(prompt)) && attempt < 20);
    used.add(promptKey(prompt));
    return {
      id: id(),
      difficulty: d,
      prompt,
      steps: [
        { label: "Frame", detail: `Restate the ${input.topic} idea for ${input.subject} in one sentence.` },
        { label: "Try", detail: "Attempt the task out loud, one step at a time." },
        { label: "Check", detail: "Explain why the answer makes sense for this topic." },
      ],
      discussionStems: [
        "What is the first move you would make?",
        "Where could a common mistake show up for this topic?",
      ],
    };
  });
}

export function templatePracticeProblems(input: {
  subject: string;
  topic: string;
  difficultyMode?: PracticeDifficultyMode;
  avoidPrompts?: string[];
}): PracticeProblem[] {
  const mode = input.difficultyMode ?? "same";
  const avoidPrompts = input.avoidPrompts ?? [];
  const seed = Date.now() ^ (Math.floor(Math.random() * 1_000_000) << 1);
  return synthesizeFreshProblems({
    subject: input.subject,
    topic: input.topic,
    mode,
    seed,
    avoidPrompts,
  });
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
