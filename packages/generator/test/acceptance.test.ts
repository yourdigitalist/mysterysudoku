import { describe, expect, it } from "vitest";
import { countSolutions, solveLogically, type ObjectBlockingMap } from "@mysterysudoku/engine";
import { generatePuzzle } from "../src/generate-puzzle.js";
import { loadTheme, objectBlockingMap } from "../src/theme.js";
import { themePath } from "./paths.js";

const theme = loadTheme(themePath);
const blocking: ObjectBlockingMap = objectBlockingMap(theme);

/**
 * A smaller, CI-friendly version of the M2 milestone acceptance check (spec section 12): every
 * exported puzzle has exactly one solution and is fully solved by the logical solver, across the
 * 5x5-9x9 range. The full 500-puzzle run (and its timing/tier-spread numbers) is a one-off CLI
 * run recorded in docs/decisions.md rather than something this suite re-runs on every test pass.
 */
describe("M2 acceptance sample", () => {
  it("every generated puzzle across 5x5-9x9 has exactly one solution and solves logically", () => {
    const sizes = [5, 6, 7, 8, 9];
    let produced = 0;
    for (const size of sizes) {
      for (let i = 0; i < 3; i++) {
        let generated = null;
        for (let attempt = 0; attempt < 4 && !generated; attempt++) {
          generated = generatePuzzle({ size, theme, seed: `accept-${size}-${i}-${attempt}` });
        }
        expect(generated, `size ${size} attempt ${i} never produced a puzzle`).not.toBeNull();
        const puzzle = generated!.puzzle;
        expect(countSolutions(puzzle, blocking, 2)).toBe(1);
        expect(solveLogically(puzzle, blocking).solved).toBe(true);
        produced++;
      }
    }
    expect(produced).toBe(sizes.length * 3);
  });
});
