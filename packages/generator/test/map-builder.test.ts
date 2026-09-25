import { describe, expect, it } from "vitest";
import { BoardIndex, type ObjectBlockingMap } from "@mysterysudoku/engine";
import { buildMap } from "../src/map-builder.js";
import { Rng } from "../src/rng.js";
import { loadTheme, objectBlockingMap } from "../src/theme.js";
import { themePath } from "./paths.js";

const theme = loadTheme(themePath);
const blocking: ObjectBlockingMap = objectBlockingMap(theme);

describe("buildMap", () => {
  it("is reproducible from the same seed", () => {
    const a = buildMap(new Rng("map-seed-1"), theme, 6);
    const b = buildMap(new Rng("map-seed-1"), theme, 6);
    expect(a).toEqual(b);
  });

  it("covers every cell with a room and gives every room at least 3 cells", () => {
    for (const size of [5, 6, 7, 8, 9]) {
      const map = buildMap(new Rng(`cover-${size}`), theme, size);
      const seen = new Set<string>();
      for (const row of map.cells) {
        for (const cell of row) {
          expect(cell.roomId).toBeTruthy();
          seen.add(`${cell.row},${cell.col}`);
        }
      }
      expect(seen.size).toBe(size * size);
      const countByRoom = new Map<string, number>();
      for (const room of map.rooms) countByRoom.set(room.id, room.cells.length);
      for (const count of countByRoom.values()) expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps rooms connected (every room cell reaches every other via same-room orthogonal steps)", () => {
    const map = buildMap(new Rng("connected"), theme, 8);
    for (const room of map.rooms) {
      const cellSet = new Set(room.cells.map((c) => `${c.row},${c.col}`));
      const start = room.cells[0];
      const seen = new Set([`${start.row},${start.col}`]);
      const queue = [start];
      while (queue.length) {
        const c = queue.pop()!;
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const n = { row: c.row + dr, col: c.col + dc };
          const key = `${n.row},${n.col}`;
          if (cellSet.has(key) && !seen.has(key)) {
            seen.add(key);
            queue.push(n);
          }
        }
      }
      expect(seen.size).toBe(room.cells.length);
    }
  });

  it("every row and column keeps at least one non-blocking cell", () => {
    const map = buildMap(new Rng("open-lines"), theme, 7);
    const board = new BoardIndex(
      { id: "t", size: 7, themeId: "t", cells: map.cells, rooms: map.rooms, objects: map.objects, characters: [], clues: [], solution: {}, answerCharId: "", difficulty: { tier: 1 }, meta: { generatorVersion: "test" } },
      blocking,
    );
    for (let r = 0; r < 7; r++) {
      expect(map.cells[r].some((cell) => board.isOccupiable({ row: cell.row, col: cell.col }))).toBe(true);
    }
    for (let c = 0; c < 7; c++) {
      expect(map.cells.some((row) => board.isOccupiable({ row: row[c].row, col: c }))).toBe(true);
    }
  });

  it("object footprints stay within their room and never overlap", () => {
    const map = buildMap(new Rng("footprints"), theme, 9);
    const roomOfCell = new Map<string, string>();
    for (const room of map.rooms) for (const c of room.cells) roomOfCell.set(`${c.row},${c.col}`, room.id);

    const seenCells = new Set<string>();
    for (const obj of map.objects) {
      const rooms = new Set(obj.cells.map((c) => roomOfCell.get(`${c.row},${c.col}`)));
      expect(rooms.size).toBe(1);
      for (const c of obj.cells) {
        const key = `${c.row},${c.col}`;
        expect(seenCells.has(key)).toBe(false);
        seenCells.add(key);
      }
    }
  });
});
