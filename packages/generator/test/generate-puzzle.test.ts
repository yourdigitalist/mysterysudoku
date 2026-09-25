import { describe, expect, it } from "vitest";
import { finalizePuzzle } from "../src/export.js";
import { generatePuzzle } from "../src/generate-puzzle.js";
import { loadTheme } from "../src/theme.js";
import { themePath } from "./paths.js";

const theme = loadTheme(themePath);

function generateWithRetries(size: number, baseSeed: string, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const result = generatePuzzle({ size, theme, seed: `${baseSeed}-${i}` });
    if (result) return result;
  }
  return null;
}

describe("finalizePuzzle (display text)", () => {
  it("gives every character a real theme name and a non-empty display clue", () => {
    const generated = generateWithRetries(6, "display-text")!;
    const exported = finalizePuzzle(theme, generated.puzzle, "01", "Case 01");

    for (const c of exported.characters) {
      expect(c.name).not.toBe(c.id);
      expect(c.displayClue.length).toBeGreaterThan(0);
      expect(c.displayClue.startsWith(c.name)).toBe(true);
    }

    const target = exported.characters.find((c) => c.isTarget)!;
    expect(target.displayClue).toBe(`${target.name} was alone with the murderer.`);
    expect(exported.winText).toContain(target.name);
    expect(exported.winText).toContain("Nobody else was in the room.");
  });

  it("renders general clue text for every global clue", () => {
    // Try a few seeds since not every puzzle picks up a global clue.
    for (const seed of ["gc-1", "gc-2"]) {
      const generated = generatePuzzle({ size: 7, theme, seed });
      if (!generated) continue;
      const exported = finalizePuzzle(theme, generated.puzzle, "01", "Case 01");
      const globalCount = generated.puzzle.clues.filter((c) => !("charId" in c)).length;
      expect(exported.generalClueText.length).toBe(globalCount);
      for (const text of exported.generalClueText) {
        expect(text.startsWith("Nobody was in the ")).toBe(true);
      }
    }
  });
});
