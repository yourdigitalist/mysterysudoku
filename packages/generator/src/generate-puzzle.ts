import { BoardIndex, type ObjectBlockingMap, type Puzzle } from "@mysterysudoku/engine";
import { buildMap } from "./map-builder.js";
import { buildCluePool } from "./clue-pool.js";
import { selectClues } from "./clue-select.js";
import { gradeDifficulty } from "./grading.js";
import { Rng } from "./rng.js";
import { characterIdsFor, placeSolution } from "./solution-placer.js";
import type { Theme } from "./theme.js";
import { objectBlockingMap } from "./theme.js";

function pickCharacterNames(rng: Rng, theme: Theme, characterIds: string[]): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const id of characterIds) {
    const pool = theme.characterNames[id];
    if (!pool || pool.length === 0) throw new Error(`No character names in theme for letter "${id}"`);
    const available = pool.filter((n) => !used.has(n));
    const name = rng.pick(available.length > 0 ? available : pool);
    used.add(name);
    names.set(id, name);
  }
  return names;
}

export interface GeneratedPuzzle {
  puzzle: Puzzle;
  twoClueCharIds: string[];
  mapRegenerations: number;
}

export interface GenerateOptions {
  size: number;
  theme: Theme;
  seed: string;
  /** How many fresh maps to try before giving up on this seed entirely. */
  maxMapAttempts?: number;
  /** Wall-clock budget for the whole call, across every map attempt. A handful of seeds turn out
   * to need combinatorially many solver checks to find any working 1-2-clue combination (or to
   * prove none exists); rather than let one seed run for tens of seconds, this bails out (like
   * any other failed seed) once the budget is spent, so the caller can just move on to the next
   * seed. Default matches spec section 2's ~2s/puzzle target with slack for slower machines. */
  budgetMs?: number;
}

/**
 * Runs the full generator pipeline for one puzzle (spec section 7): build a map, place a
 * solution with the victim/murderer twist, pick clues that are unique and logically solvable.
 * If clue selection fails for a map, builds a fresh map from the same seed's RNG stream and
 * tries again, up to `maxMapAttempts` (spec: "retry up to K times, then regenerate the map").
 * Reproducible: the same seed always walks the same sequence of attempts.
 */
export function generatePuzzle(options: GenerateOptions): GeneratedPuzzle | null {
  const { size, theme, seed, maxMapAttempts = 60, budgetMs = 3000 } = options;
  const blocking: ObjectBlockingMap = objectBlockingMap(theme);
  const rng = new Rng(seed);
  const characterIds = characterIdsFor(size);
  // One shared deadline for the whole call: a typical map's clue selection finishes in well
  // under a second, so most calls never come close to this and get to try several maps if the
  // first ones fail outright (e.g. no valid solution placement). A genuinely hard map can still
  // only consume what's left of the budget, not run unbounded — spec section 2's ~2s/puzzle
  // target with slack for slower machines and harder grid sizes.
  const overallDeadline = Date.now() + budgetMs;

  for (let mapAttempt = 0; mapAttempt < maxMapAttempts; mapAttempt++) {
    if (Date.now() > overallDeadline) return null;
    const map = buildMap(rng, theme, size);

    const shellForSolving: Puzzle = {
      id: seed,
      size,
      themeId: theme.id,
      cells: map.cells,
      rooms: map.rooms,
      objects: map.objects,
      characters: characterIds.map((id) => ({ id, name: id, isTarget: false })),
      clues: [],
      solution: {},
      answerCharId: "",
      difficulty: { tier: 1 },
      meta: { generatorVersion: "0.1.0", seed },
    };
    const board = new BoardIndex(shellForSolving, blocking);

    const placed = placeSolution(rng, board, size, characterIds);
    if (!placed) continue;

    const { byChar, global } = buildCluePool(board, map.objects, characterIds, placed.solution);

    const puzzleShell: Omit<Puzzle, "clues"> = {
      id: seed,
      size,
      themeId: theme.id,
      cells: map.cells,
      rooms: map.rooms,
      objects: map.objects,
      characters: characterIds.map((id) => ({ id, name: id, isTarget: id === placed.targetCharId })),
      solution: placed.solution,
      answerCharId: placed.answerCharId,
      difficulty: { tier: 1 },
      meta: { generatorVersion: "0.1.0", seed },
    };

    const selection = selectClues(
      rng,
      puzzleShell,
      blocking,
      byChar,
      global,
      placed.targetCharId,
      placed.answerCharId,
      overallDeadline,
    );
    if (!selection) continue;

    const names = pickCharacterNames(rng, theme, characterIds);
    const difficulty = gradeDifficulty(selection.logical, size, selection.twoClueCharIds.length);

    const puzzle: Puzzle = {
      ...puzzleShell,
      characters: puzzleShell.characters.map((c) => ({ ...c, name: names.get(c.id)! })),
      clues: selection.clues,
      difficulty,
    };
    return { puzzle, twoClueCharIds: selection.twoClueCharIds, mapRegenerations: mapAttempt };
  }
  return null;
}
