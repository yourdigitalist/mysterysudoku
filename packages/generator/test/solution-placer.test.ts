import { describe, expect, it } from "vitest";
import { BoardIndex, type ObjectBlockingMap } from "@mysterysudoku/engine";
import { buildMap } from "../src/map-builder.js";
import { Rng } from "../src/rng.js";
import { characterIdsFor, placeSolution } from "../src/solution-placer.js";
import { loadTheme, objectBlockingMap } from "../src/theme.js";
import { themePath } from "./paths.js";

const theme = loadTheme(themePath);
const blocking: ObjectBlockingMap = objectBlockingMap(theme);

function boardFor(size: number, seed: string) {
  const map = buildMap(new Rng(seed), theme, size);
  const puzzleShell = {
    id: "t",
    size,
    themeId: "t",
    cells: map.cells,
    rooms: map.rooms,
    objects: map.objects,
    characters: [],
    clues: [],
    solution: {},
    answerCharId: "",
    difficulty: { tier: 1 as const },
    meta: { generatorVersion: "test" },
  };
  return new BoardIndex(puzzleShell, blocking);
}

describe("characterIdsFor", () => {
  it("is alphabetical starting at A", () => {
    expect(characterIdsFor(5)).toEqual(["A", "B", "C", "D", "E"]);
  });
});

describe("placeSolution", () => {
  it("places one character per row and column, all on occupiable cells", () => {
    const size = 6;
    const board = boardFor(size, "solution-1");
    const ids = characterIdsFor(size);
    const result = placeSolution(new Rng("place-1"), board, size, ids)!;
    expect(result).not.toBeNull();

    const rows = new Set<number>();
    const cols = new Set<number>();
    for (const id of ids) {
      const cell = result.solution[id];
      expect(cell).toBeDefined();
      expect(board.isOccupiable(cell)).toBe(true);
      rows.add(cell.row);
      cols.add(cell.col);
    }
    expect(rows.size).toBe(size);
    expect(cols.size).toBe(size);
  });

  it("the target is the last alphabetical character", () => {
    const size = 5;
    const board = boardFor(size, "solution-2");
    const ids = characterIdsFor(size);
    const result = placeSolution(new Rng("place-2"), board, size, ids)!;
    expect(result.targetCharId).toBe("E");
  });

  it("the target is alone with exactly the answer character in their room", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const size = 6;
      const board = boardFor(size, `twist-${seed}`);
      const ids = characterIdsFor(size);
      const result = placeSolution(new Rng(`place-${seed}`), board, size, ids)!;
      expect(result).not.toBeNull();

      const targetCell = result.solution[result.targetCharId];
      const targetRoomId = board.roomOf(targetCell)!.id;
      const othersInRoom = ids.filter(
        (id) => id !== result.targetCharId && board.roomOf(result.solution[id])!.id === targetRoomId,
      );
      expect(othersInRoom).toEqual([result.answerCharId]);
    }
  });

  it("is reproducible from the same seed", () => {
    const size = 7;
    const board = boardFor(size, "solution-3");
    const ids = characterIdsFor(size);
    const a = placeSolution(new Rng("place-3"), board, size, ids);
    const b = placeSolution(new Rng("place-3"), board, size, ids);
    expect(a).toEqual(b);
  });
});
