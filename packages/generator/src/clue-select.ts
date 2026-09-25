import {
  countSolutions,
  solveLogically,
  type Clue,
  type LogicalSolveResult,
  type ObjectBlockingMap,
  type Puzzle,
} from "@mysterysudoku/engine";
import { Rng } from "./rng.js";
import type { ClueCandidate } from "./clue-pool.js";

export interface ClueSelection {
  clues: Clue[];
  logical: LogicalSolveResult;
  /** Non-target characters that ended up needing a 2nd clue to keep the puzzle uniquely and
   * logically solvable (docs/decisions.md: the Hard-tier exception, "Case 09 does this for two
   * suspects"). Empty for a clean one-clue-per-character puzzle. */
  twoClueCharIds: string[];
}

/**
 * Selects clues by greedy reduction rather than random resampling (spec section 7 step 4):
 * starts from the maximal true clue set (every candidate, for every character, plus every
 * global candidate) — which is unique almost by definition, since it's every true fact about the
 * solution — then, per character, tries to shrink down to a single clue (falling back to two)
 * while re-checking uniqueness and logical solvability after every change. This finds a valid
 * one-clue-per-character puzzle in far fewer solver calls than random sampling, which matters
 * once a room's shape makes many single clues individually ambiguous. Returns null only when
 * even the maximal set isn't unique, meaning this map/solution can't support these clue kinds at
 * all — the caller should regenerate the map (spec section 7 step 4.2).
 */
export function selectClues(
  rng: Rng,
  puzzleShell: Omit<Puzzle, "clues">,
  blocking: ObjectBlockingMap,
  byChar: Map<string, ClueCandidate[]>,
  global: ClueCandidate[],
  targetCharId: string,
  answerCharId: string,
  deadline: number = Date.now() + 4000,
): ClueSelection | null {
  const victimClue: Clue = { kind: "aloneWith", charId: targetCharId, otherId: answerCharId };
  const others = [...byChar.keys()].filter((id) => id !== targetCharId);

  const build = (byCharClues: Map<string, Clue[]>, globals: Clue[]): Puzzle => ({
    ...puzzleShell,
    clues: [victimClue, ...others.flatMap((id) => byCharClues.get(id) ?? []), ...globals],
  });

  const isValid = (puzzle: Puzzle): boolean =>
    countSolutions(puzzle, blocking, 2) === 1 && solveLogically(puzzle, blocking).solved;

  // Cap each character's usable pool up front. buildCluePool already caps per clue kind, but a
  // 9x9 board with several object/relational kinds can still leave 20-30 candidates per
  // character, and both the "everything at once" uniqueness check below and the reduction loop's
  // solver calls scale with total clue count across ALL characters at once — the engine's
  // direction/diagonal evaluation in particular rescans the whole board per clue per candidate
  // cell, so trimming this matters more than it looks.
  const MAX_POOL = 20;
  const pools = new Map<string, Clue[]>(
    others.map((id) => [id, rng.shuffle(byChar.get(id)!.map((c) => c.clue)).slice(0, MAX_POOL)]),
  );

  const initialChosen = new Map<string, Clue[]>(others.map((id) => [id, pools.get(id)!]));
  const maximalGlobals = global.map((c) => c.clue);

  if (!isValid(build(initialChosen, maximalGlobals))) return null;

  // Caps keep this O(characters) instead of O(characters x poolSize^2).
  const MAX_SINGLE_TRIES = 8;
  const MAX_PAIR_TRIES = 15;
  // Which character gets processed last has the least support left to reduce against (everyone
  // else has already shrunk down), so a character that can't reach 1-2 clues in one processing
  // order might well succeed in another. Retry a few orders before conceding — never ship a
  // character stuck at its full candidate pool (see docs/decisions.md: 1 clue, 2 on Hard, never
  // more).
  const MAX_ORDER_ATTEMPTS = 2;

  for (let orderAttempt = 0; orderAttempt < MAX_ORDER_ATTEMPTS; orderAttempt++) {
    if (Date.now() > deadline) return null;

    const chosenByChar = new Map<string, Clue[]>(others.map((id) => [id, pools.get(id)!]));
    const twoClueCharIds: string[] = [];
    let allReduced = true;

    for (const charId of rng.shuffle(others)) {
      if (Date.now() > deadline) return null;
      const pool = rng.shuffle(pools.get(charId)!);
      let reduced = false;

      for (const candidate of pool.slice(0, MAX_SINGLE_TRIES)) {
        const trial = new Map(chosenByChar);
        trial.set(charId, [candidate]);
        if (isValid(build(trial, maximalGlobals))) {
          chosenByChar.set(charId, [candidate]);
          reduced = true;
          break;
        }
      }
      if (reduced) continue;

      for (let attempt = 0; attempt < MAX_PAIR_TRIES && pool.length >= 2; attempt++) {
        if (attempt % 4 === 0 && Date.now() > deadline) return null;
        const i = rng.int(pool.length);
        let j = rng.int(pool.length - 1);
        if (j >= i) j++;
        const trial = new Map(chosenByChar);
        trial.set(charId, [pool[i], pool[j]]);
        if (isValid(build(trial, maximalGlobals))) {
          chosenByChar.set(charId, [pool[i], pool[j]]);
          twoClueCharIds.push(charId);
          reduced = true;
          break;
        }
      }
      if (!reduced) {
        allReduced = false;
        break;
      }
    }

    if (!allReduced) continue;

    const minimizedGlobals = minimizeGlobals(blocking, build, chosenByChar, maximalGlobals);
    const finalPuzzle = build(chosenByChar, minimizedGlobals);
    const finalLogical = solveLogically(finalPuzzle, blocking);
    return { clues: finalPuzzle.clues, logical: finalLogical, twoClueCharIds };
  }

  return null;
}

function minimizeGlobals(
  blocking: ObjectBlockingMap,
  build: (byCharClues: Map<string, Clue[]>, globals: Clue[]) => Puzzle,
  chosenByChar: Map<string, Clue[]>,
  globals: Clue[],
): Clue[] {
  let kept = [...globals];
  for (const g of globals) {
    const without = kept.filter((c) => c !== g);
    const test = build(chosenByChar, without);
    if (countSolutions(test, blocking, 2) === 1 && solveLogically(test, blocking).solved) {
      kept = without;
    }
  }
  return kept;
}
