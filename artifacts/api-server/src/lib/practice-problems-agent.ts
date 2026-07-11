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


function fmtSigned(n: number): string {
  return n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`;
}

function factorPrompt(p: number, q: number, a = 1): { prompt: string; answer: string; nums: string } {
  const b = a * (p + q);
  const c = a * p * q;
  const aTerm = a === 1 ? "x²" : `${a}x²`;
  const bTerm = b === 0 ? "" : b > 0 ? ` + ${b}x` : ` − ${Math.abs(b)}x`;
  const cTerm = c === 0 ? "" : c > 0 ? ` + ${c}` : ` − ${Math.abs(c)}`;
  const answer =
    a === 1
      ? `(x ${fmtSigned(p)})(x ${fmtSigned(q)})`
      : `(${a}x ${fmtSigned(p)})(x ${fmtSigned(q)})`;
  return {
    prompt: `Factor: ${aTerm}${bTerm}${cTerm}`,
    answer,
    nums: `${p} and ${q}`,
  };
}

/** Always-fresh template problems — difficulty mode changes content complexity. */
function synthesizeFreshProblems(input: {
  subject: string;
  topic: string;
  mode: PracticeDifficultyMode;
  seed: number;
  avoidPrompts: string[];
}): PracticeProblem[] {
  const topic = `${input.subject} ${input.topic}`.toLowerCase();
  const band = difficultyBand(input.mode);
  const used = new Set(input.avoidPrompts.map(promptKey));
  const rand = mulberry32(input.seed);

  const pickTier = <T extends { prompt: string }>(
    pools: Record<PracticeProblemDifficulty, T[]>,
    build: (item: T, difficulty: PracticeProblemDifficulty) => PracticeProblem,
  ): PracticeProblem[] =>
    band.map((difficulty) => {
      const pool = pools[difficulty] ?? pools.medium;
      const fresh = pool.filter((item) => !used.has(promptKey(item.prompt)));
      const source = fresh.length > 0 ? fresh : pool;
      let chosen = source[Math.floor(rand() * source.length)];
      if (!chosen || used.has(promptKey(chosen.prompt))) {
        const nonce = Math.floor(rand() * 9000) + 1000;
        chosen = {
          ...((chosen ?? pool[0]) as T),
          prompt: `${(chosen ?? pool[0])?.prompt ?? `${input.topic} practice`} [${difficulty} #${nonce}]`,
        };
      }
      used.add(promptKey(chosen.prompt));
      return build(chosen, difficulty);
    });

  if (
    topic.includes("passive") ||
    topic.includes("active voice") ||
    topic.includes("essay") ||
    (topic.includes("english") && topic.includes("voice"))
  ) {
    const pools: Record<PracticeProblemDifficulty, Array<{ prompt: string; answer: string }>> = {
      basic: [
        { prompt: 'Rewrite in active voice: "The essay was written by Maya."', answer: "Maya wrote the essay." },
        { prompt: 'Rewrite in active voice: "The draft was revised by Sam."', answer: "Sam revised the draft." },
        { prompt: 'Is this active or passive? "Maya wrote the conclusion." Explain why.', answer: "Active — Maya performs the action." },
      ],
      easy: [
        { prompt: 'Rewrite in active voice: "The thesis was supported by clear evidence."', answer: "Clear evidence supported the thesis." },
        { prompt: 'Rewrite in passive voice: "The peer tutor graded the paragraph."', answer: "The paragraph was graded by the peer tutor." },
        { prompt: 'Is this active or passive? "The claim was challenged by the editor." Explain why.', answer: "Passive — the claim receives the action." },
      ],
      medium: [
        { prompt: 'Rewrite in active voice: "It was decided that the conclusion needed stronger evidence."', answer: "The student decided the conclusion needed stronger evidence." },
        { prompt: 'Fix the weak passive: "Mistakes were made in the works-cited page." Make it active and specific.', answer: "The writer made mistakes in the works-cited page." },
        { prompt: 'Is this stronger active or passive for an essay claim? "The data was interpreted by the author as proof." Rewrite the better version.', answer: "Active is stronger: The author interpreted the data as proof." },
      ],
      challenging: [
        { prompt: 'Rewrite in active voice without losing meaning: "The counterargument was weakened by vague evidence that had been selected by the writer."', answer: "Vague evidence the writer selected weakened the counterargument." },
        { prompt: 'Identify voice, then rewrite: "After the draft was submitted by Maya, feedback was provided by the writing center."', answer: "After Maya submitted the draft, the writing center provided feedback." },
        { prompt: 'Make this academic sentence active and precise: "It can be seen that the thesis is supported by two examples."', answer: "Two examples support the thesis." },
      ],
      advanced: [
        { prompt: 'Revise for clarity and active voice: "It was believed by the class that the conclusion had been weakened by unsupported claims that were written overnight."', answer: "The class believed unsupported claims written overnight weakened the conclusion." },
        { prompt: 'Diagnose voice shifts, then rewrite in consistent active voice: "When the outline was finished, Maya revised the thesis and the draft was submitted."', answer: "When Maya finished the outline, she revised the thesis and submitted the draft." },
        { prompt: 'Choose the stronger academic version and explain why: A) "The evidence was analyzed." B) "Maya analyzed the evidence for bias."', answer: "B is stronger — names the doer and the purpose." },
      ],
    };

    return pickTier(pools, (item, difficulty) => ({
      id: crypto.randomUUID(),
      difficulty,
      prompt: item.prompt,
      steps: [
        { label: "Find the doer", detail: "Ask who is performing the action." },
        { label: "Rewrite", detail: `Model answer: ${item.answer}` },
        { label: "Check", detail: "Confirm meaning stayed the same and clarity improved." },
      ],
      discussionStems: [
        "Who is doing the action in this sentence?",
        "How does voice change the tone of the essay?",
      ],
    }));
  }

  if (topic.includes("periodic") || topic.includes("electronegativity") || topic.includes("ionization")) {
    const pools: Record<PracticeProblemDifficulty, Array<{ prompt: string; answer: string }>> = {
      basic: [
        { prompt: "Which has a larger atomic radius: Na or Cl? Explain using periodic trends.", answer: "Na is larger — radius shrinks left→right." },
        { prompt: "Which is more electronegative: O or F? Why?", answer: "F is higher — EN rises across a period." },
        { prompt: "Which has higher first ionization energy: Li or F?", answer: "F — nuclear charge rises across period 2." },
      ],
      easy: [
        { prompt: "Which is more electronegative: O or S? Why?", answer: "O is higher — EN rises up a group." },
        { prompt: "Compare atomic radius for Mg vs Al.", answer: "Mg is larger than Al in period 3." },
        { prompt: "Which has lower ionization energy: K or Na?", answer: "K — valence electron is farther out." },
      ],
      medium: [
        { prompt: "Compare first ionization energy for Be vs O. Which is higher and why?", answer: "O has higher IE across period 2." },
        { prompt: "Which has a larger atomic radius: Ca or Br? Explain using metals vs nonmetals.", answer: "Ca is larger — metals left, nonmetals right." },
        { prompt: "Rank electronegativity: N vs P. Explain the group trend.", answer: "N is higher — same group, EN rises up the column." },
      ],
      challenging: [
        { prompt: "Explain why F has both high electronegativity and high ionization energy compared with N.", answer: "Across period 2, nuclear charge rises while shell stays the same." },
        { prompt: "A student says S is more electronegative than O because it has more electrons. Correct the misconception.", answer: "EN rises up a group — O is higher despite fewer electrons." },
        { prompt: "Compare radius and ionization energy for Na vs Cl in one explanation.", answer: "Na larger radius / lower IE; Cl smaller radius / higher IE across period 3." },
      ],
      advanced: [
        { prompt: "Predict which is larger and which has higher IE: Mg or S. Defend both answers with the same trend story.", answer: "Mg larger radius; S higher IE — left→right nuclear charge rises." },
        { prompt: "Why can ionization energy dip from Be to B even though the general period trend rises?", answer: "B starts a p subshell; removing that electron is easier than Be's filled s." },
        { prompt: "Design a 2-step comparison: radius for K vs Br, then electronegativity for O vs S.", answer: "K>Br radius (left/right); O>S EN (up group)." },
      ],
    };

    return pickTier(pools, (item, difficulty) => ({
      id: crypto.randomUUID(),
      difficulty,
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
    const pools: Record<
      PracticeProblemDifficulty,
      Array<{ prompt: string; answer: string; nums: string }>
    > = {
      basic: [factorPrompt(2, 3), factorPrompt(1, 4), factorPrompt(2, 2)],
      easy: [factorPrompt(3, 5), factorPrompt(2, 6), factorPrompt(4, 5)],
      medium: [factorPrompt(-3, 5), factorPrompt(-4, 6), factorPrompt(3, -7)],
      challenging: [factorPrompt(-6, -2), factorPrompt(-5, 8), factorPrompt(-7, -3)],
      advanced: [factorPrompt(2, 3, 2), factorPrompt(-3, 4, 3), factorPrompt(2, -5, 2)],
    };

    return pickTier(pools, (item, difficulty) => ({
      id: crypto.randomUUID(),
      difficulty,
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
      prompt = `${input.subject} · ${input.topic} · ${d.toUpperCase()} practice ${i + 1} [#${nonce + attempt + i * 17}]: complete one concrete ${d}-level task for this subject/topic only.`;
      attempt++;
    } while (used.has(promptKey(prompt)) && attempt < 20);
    used.add(promptKey(prompt));
    return {
      id: crypto.randomUUID(),
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
          `- Exactly 3 problems with difficulties exactly: ${band.join(", ")} (in that order).`,
          "- Prompts must be brand-new — never reuse avoided prompts or near-paraphrases.",
          "- DIFFICULTY MUST CHANGE THE TASK COMPLEXITY, not just the label:",
          "  basic/easy = short single-step; medium = standard; challenging/advanced = multi-clause, multi-step, or trickier cases.",
          "- For harder mode, use advanced sentence structures / harder element comparisons / a≠1 factoring.",
          "- For easier mode, use short direct tasks with small numbers or simple sentences.",
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

    // Enforce visible difficulty band on every returned set.
    return problems.slice(0, 3).map((problem, index) => ({
      ...problem,
      difficulty: band[index] ?? problem.difficulty,
    }));
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
