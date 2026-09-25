import type { LogicalSolveResult } from "@mysterysudoku/engine";

export interface Difficulty {
  tier: 1 | 2 | 3 | 4 | 5;
  score: number;
  label: "Easy" | "Medium" | "Hard" | "Expert" | "Master";
}

const LABELS: Record<Difficulty["tier"], Difficulty["label"]> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
  4: "Expert",
  5: "Master",
};

/**
 * Maps the logical solver's score to a 1-5 tier (spec section 7 step 5). Thresholds are scaled
 * by grid size (a score of 20 means something different on a 5x5 than a 9x9) and by how many
 * characters needed a 2nd clue (docs/decisions.md's Hard-tier exception is itself a difficulty
 * signal). Initial thresholds — spec says to tune these after looking at a real distribution
 * (spec section 7 step 5); see docs/decisions.md for the distribution this session tuned against.
 */
export function gradeDifficulty(logical: LogicalSolveResult, size: number, twoClueCharCount: number): Difficulty {
  const sizeFactor = size / 6;
  const score = logical.score + logical.hardestTier * 2 + twoClueCharCount * 6;
  const normalized = score / sizeFactor;

  let tier: Difficulty["tier"];
  if (normalized < 10) tier = 1;
  else if (normalized < 18) tier = 2;
  else if (normalized < 28) tier = 3;
  else if (normalized < 40) tier = 4;
  else tier = 5;

  return { tier, score, label: LABELS[tier] };
}
