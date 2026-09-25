import { describe, expect, it } from "vitest";
import { countSolutions, solveLogically, type ObjectBlockingMap, type Puzzle } from "@mysterysudoku/engine";
import { generatePuzzle } from "../src/generate-puzzle.js";
import { loadTheme, objectBlockingMap } from "../src/theme.js";
import { themePath } from "./paths.js";

const theme = loadTheme(themePath);
const blocking: ObjectBlockingMap = objectBlockingMap(theme);

/**
 * Not every individual seed produces a workable puzzle — a particular room layout can be
 * structurally too symmetric for 1-2 clues per character to pin down (see docs/decisions.md).
 * The real CLI (src/cli.ts cmdGen) handles this by moving on to the next seed, so tests do the
 * same rather than demanding any one fixed seed succeeds.
 */
function generateWithRetries(size: number, baseSeed: string, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const result = generatePuzzle({ size, theme, seed: `${baseSeed}-${i}` });
    if (result) return result;
  }
  return null;
}

describe("generatePuzzle (map -> solution -> clue pool -> selection)", () => {
  it("produces a uniquely-solvable, fully-logical puzzle for several seeds and sizes", () => {
    for (const [size, seed] of [
      [5, "sel-a"],
      [6, "sel-b"],
      [7, "sel-c"],
      [5, "sel-a-again"],
    ] as const) {
      const generated = generateWithRetries(size, seed);
      expect(generated).not.toBeNull();
      const puzzle: Puzzle = generated!.puzzle;

      expect(countSolutions(puzzle, blocking, 2)).toBe(1);
      expect(solveLogically(puzzle, blocking).solved).toBe(true);

      const cluesByChar = new Map<string, number>();
      for (const clue of puzzle.clues) {
        if ("charId" in clue) cluesByChar.set(clue.charId, (cluesByChar.get(clue.charId) ?? 0) + 1);
      }
      const targetCharId = puzzle.characters.find((c) => c.isTarget)!.id;
      for (const char of puzzle.characters) {
        if (char.id === targetCharId) {
          expect(cluesByChar.get(char.id)).toBe(1);
        } else {
          expect(cluesByChar.get(char.id)).toBeGreaterThanOrEqual(1);
        }
      }

      const victimClues = puzzle.clues.filter((c) => "charId" in c && c.charId === targetCharId);
      expect(victimClues).toEqual([{ kind: "aloneWith", charId: targetCharId, otherId: puzzle.answerCharId }]);
    }
  });

  it("is reproducible from the same seed", () => {
    const a = generatePuzzle({ size: 6, theme, seed: "repro-seed" });
    const b = generatePuzzle({ size: 6, theme, seed: "repro-seed" });
    expect(a).toEqual(b);
  });
});
