import type { PracticeProblem, PracticeProblemDifficulty, WorkedExampleStep } from "./api";

export type PracticeDifficultyMode = "easier" | "same" | "harder";

export const PRACTICE_DIFFICULTIES: PracticeProblemDifficulty[] = [
  "basic",
  "easy",
  "medium",
  "challenging",
  "advanced",
];

type CoreDifficulty = "basic" | "easy" | "medium" | "challenging" | "advanced";

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

export const DIFFICULTY_BADGE_CLASS: Record<string, string> = {
  basic: "bg-emerald-50 text-emerald-800",
  easy: "bg-sky-50 text-sky-800",
  medium: "bg-amber-50 text-amber-900",
  challenging: "bg-orange-50 text-orange-900",
  advanced: "bg-rose-50 text-rose-900",
  "warm-up": "bg-emerald-50 text-emerald-800",
  guided: "bg-amber-50 text-amber-900",
  independent: "bg-rose-50 text-rose-900",
};

export const MODE_LABEL: Record<PracticeDifficultyMode, string> = {
  easier: "Easier",
  same: "Same difficulty",
  harder: "Harder",
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
    pools: Record<CoreDifficulty, T[]>,
    build: (item: T, difficulty: CoreDifficulty) => PracticeProblem,
  ): PracticeProblem[] =>
    band.map((difficulty) => {
      const pool = pools[difficulty as CoreDifficulty] ?? pools.medium;
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
      return build(chosen, difficulty as CoreDifficulty);
    });

  if (
    topic.includes("passive") ||
    topic.includes("active voice") ||
    topic.includes("essay") ||
    (topic.includes("english") && topic.includes("voice"))
  ) {
    const pools: Record<CoreDifficulty, Array<{ prompt: string; answer: string }>> = {
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
      id: id(),
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
    const pools: Record<CoreDifficulty, Array<{ prompt: string; answer: string }>> = {
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
      id: id(),
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
      CoreDifficulty,
      Array<{ prompt: string; answer: string; nums: string }>
    > = {
      basic: [factorPrompt(2, 3), factorPrompt(1, 4), factorPrompt(2, 2)],
      easy: [factorPrompt(3, 5), factorPrompt(2, 6), factorPrompt(4, 5)],
      medium: [factorPrompt(-3, 5), factorPrompt(-4, 6), factorPrompt(3, -7)],
      challenging: [factorPrompt(-6, -2), factorPrompt(-5, 8), factorPrompt(-7, -3)],
      advanced: [factorPrompt(2, 3, 2), factorPrompt(-3, 4, 3), factorPrompt(2, -5, 2)],
    };

    return pickTier(pools, (item, difficulty) => ({
      id: id(),
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
