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

/** Always Claude Sonnet for practice regeneration. */
function practiceModel(): string {
  return process.env.TUTOROS_PRACTICE_AI_MODEL || "anthropic/claude-sonnet-4.6";
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

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUnique<T>(items: T[], count: number, rand: () => number, used: Set<string>, keyFn: (item: T) => string): T[] {
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
  const id = () => crypto.randomUUID();
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
      temperature: 0.95,
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
  const seed = Date.now() ^ (Math.floor(Math.random() * 1_000_000) << 1);

  const freshTemplates = () =>
    synthesizeFreshProblems({
      subject: input.subject,
      topic: input.topic,
      mode,
      seed: seed + Math.floor(Math.random() * 10_000),
      avoidPrompts: avoidPromptsMerged,
    });

  try {
    const content = await chatCompletion([
      {
        role: "system",
        content: [
          "You are TutorOS Practice Problem Generator powered by Claude Sonnet.",
          "Generate brand-new practice problems that are NEVER duplicates of avoided prompts.",
          "CRITICAL: Every prompt must be extremely specific to the given SUBJECT and TOPIC.",
          "Never generate algebra/factoring problems for English. Never generate grammar for chemistry or math.",
          "For English passive vs active voice: use concrete sentence rewrite / classify tasks with NEW sentences each time.",
          "For chemistry periodic trends: use radius / electronegativity / ionization comparisons with NEW element pairs.",
          "For factoring: use NEW quadratic expressions each time (different coefficients).",
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
          "- Change numbers, sentences, or element pairs so regenerate always feels fresh.",
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
          `Freshness nonce: ${seed}`,
          memorySummary(memory),
          briefSummary(input.prepBrief),
          avoidPromptsMerged.length
            ? `DO NOT generate these (or close variants):\n${avoidPromptsMerged.map((p) => `- ${p}`).join("\n")}`
            : "No prior prompts to avoid.",
          "",
          "Generate three completely fresh practice problems now.",
        ].join("\n"),
      },
    ]);

    if (!content) return freshTemplates();

    const parsed = extractJsonObject(content);
    let problems = filterFreshProblems(
      parsePracticeProblems(parsed?.practiceProblems),
      avoidPromptsMerged,
      input.subject,
      input.topic,
    );

    if (problems.length < 3) {
      const extras = filterFreshProblems(
        freshTemplates(),
        [...avoidPromptsMerged, ...problems.map((p) => p.prompt)],
        input.subject,
        input.topic,
      );
      problems = [...problems, ...extras].slice(0, 3);
    }

    if (problems.length < 3) {
      problems = [
        ...problems,
        ...synthesizeFreshProblems({
          subject: input.subject,
          topic: input.topic,
          mode,
          seed: seed + 99,
          avoidPrompts: [...avoidPromptsMerged, ...problems.map((p) => p.prompt)],
        }),
      ].slice(0, 3);
    }

    return problems.slice(0, 3);
  } catch {
    return freshTemplates();
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
