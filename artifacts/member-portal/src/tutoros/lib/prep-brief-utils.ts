import type { PrepBrief } from "./api";

export interface WorkedExampleStep {
  label: string;
  detail: string;
}

export interface NormalizedPrepBrief {
  contextTitle: string;
  contextBullets: string[];
  approachTitle: string;
  approachBullets: string[];
  workedExampleTitle: string;
  problemStatement: string;
  steps: WorkedExampleStep[];
  misconceptionTips: string[];
}

function splitIntoBullets(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseWorkedExampleSteps(workedExample: string): WorkedExampleStep[] {
  const arrowParts = workedExample.split(/\s*→\s*/);
  if (arrowParts.length > 1) {
    return arrowParts.map((part, i) => ({
      label: `Step ${i + 1}`,
      detail: part.trim(),
    }));
  }

  const numbered = workedExample.match(/(?:^|\s)(?:\d+[.)]|Step\s+\d+[:.]?)\s*[^0-9]+/gi);
  if (numbered && numbered.length > 1) {
    return numbered.map((part, i) => ({
      label: `Step ${i + 1}`,
      detail: part.replace(/^(?:\d+[.)]|Step\s+\d+[:.]?)\s*/i, "").trim(),
    }));
  }

  const sentences = splitIntoBullets(workedExample);
  if (sentences.length > 1) {
    return sentences.map((detail, i) => ({ label: `Step ${i + 1}`, detail }));
  }

  return [{ label: "Walk through", detail: workedExample }];
}

function extractProblemStatement(workedExample: string, topic: string): string {
  const colonMatch = workedExample.match(/^([^:]+:)/);
  if (colonMatch) return colonMatch[1].trim();

  const topicLower = topic.toLowerCase();
  if (topicLower.includes("linear") || topicLower.includes("equation")) {
    return "Example: Solve a linear equation step by step.";
  }
  if (topicLower.includes("factor")) {
    return "Example: Factor a quadratic expression.";
  }
  return `Example problem for ${topic}`;
}

export function normalizePrepBrief(brief: PrepBrief, topic: string): NormalizedPrepBrief {
  const contextTitle =
    brief.contextTitle && brief.contextTitle !== "What the teacher noted"
      ? brief.contextTitle
      : brief.isAdapted
        ? "Pick up where you left off"
        : "How to start";

  // Never fall back to teacherNotes here — those render in "From the teacher" once.
  const contextBullets =
    brief.contextBullets?.length
      ? brief.contextBullets
      : brief.isAdapted
        ? [...brief.struggles, ...brief.watchFors.slice(0, 2)]
        : brief.struggles.length > 0
          ? brief.struggles
          : [`Focus today: ${topic}`, "Check confidence, then one guided example."];

  const approachTitle = brief.isAdapted ? "Recommended approach today" : "How to teach it";
  const approachBullets =
    brief.approachBullets?.length
      ? brief.approachBullets
      : splitIntoBullets(brief.recommendedApproach);

  const steps =
    brief.workedExampleSteps?.length
      ? brief.workedExampleSteps
      : parseWorkedExampleSteps(brief.workedExample);

  const misconceptionTips =
    brief.misconceptionTips?.length ? brief.misconceptionTips : brief.watchFors;

  return {
    contextTitle,
    contextBullets,
    approachTitle,
    approachBullets,
    workedExampleTitle: "Worked example",
    problemStatement: extractProblemStatement(brief.workedExample, topic),
    steps,
    misconceptionTips,
  };
}
