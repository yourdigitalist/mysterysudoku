import { describe, expect, it } from "vitest";
import { countSolutions } from "../src/solver-exact.js";
import { solveLogically } from "../src/solver-logical.js";
import type { ObjectBlockingMap } from "../src/board.js";
import type { Puzzle } from "../src/types.js";
import theme from "../../../themes/murder-mystery/theme.json";
import pack from "../../../levels/prototype-pack.json";

const blocking: ObjectBlockingMap = {};
for (const obj of theme.objects) blocking[obj.type] = obj.blocking;

const puzzles = pack.puzzles as unknown as Puzzle[];

describe("prototype-pack.json fixtures (9 verified puzzles)", () => {
  it("loaded all 9 puzzles", () => {
    expect(puzzles.length).toBe(9);
  });

  for (const puzzle of puzzles) {
    describe(`${puzzle.id} (${puzzle.title}, ${puzzle.size}x${puzzle.size})`, () => {
      it("has exactly one solution", () => {
        expect(countSolutions(puzzle, blocking, 2)).toBe(1);
      });

      it("is fully solved by the logical solver", () => {
        const result = solveLogically(puzzle, blocking);
        expect(result.solved).toBe(true);
      });

      it("logical solver's placements match the recorded solution", () => {
        const result = solveLogically(puzzle, blocking);
        const placed: Record<string, { row: number; col: number }> = {};
        for (const step of result.steps) {
          if (step.placed && step.charId) placed[step.charId] = step.placed;
        }
        for (const char of puzzle.characters) {
          expect(placed[char.id]).toEqual(puzzle.solution[char.id]);
        }
      });
    });
  }
});
