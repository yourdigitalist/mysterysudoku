import { BoardIndex, type ObjectBlockingMap } from "../src/board.js";
import type { Cell, Character, PlacedObject, Puzzle, Room } from "../src/types.js";

/**
 * A small 4x4 hand-built board reused across evaluate() unit tests, chosen to exercise every
 * keyword ruling from docs/spec.md section 3 and docs/decisions.md:
 *
 *   Top (row 0, wood): a 1x4 strip room, so (0,0)/(0,3) are corners and (0,1)/(0,2) aren't.
 *   Mid (row 1, tile): holds two chairs so beside-object counts can hit 0, 1 and 2.
 *   BL  (rows 2-3, cols 0-1, stone): holds a 2-cell bed, for the "not beside your own object" rule.
 *   BR  (rows 2-3, cols 2-3, grass): holds a blocking plant, used for room/alone/global clues.
 *
 * Top and Mid share no room, so cells that are physically adjacent across that boundary are
 * NOT "beside" each other (room walls block it), which several tests rely on.
 */

export const BLOCKING: ObjectBlockingMap = { shelf: true, plant: true, chair: false, bed: false };

const rooms: Room[] = [
  {
    id: "Top",
    name: "Top",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ],
  },
  {
    id: "Mid",
    name: "Mid",
    cells: [
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
    ],
  },
  {
    id: "BL",
    name: "BL",
    cells: [
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
    ],
  },
  {
    id: "BR",
    name: "BR",
    cells: [
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
    ],
  },
];

const objects: PlacedObject[] = [
  { id: "shelf1", type: "shelf", cells: [{ row: 0, col: 0 }] },
  { id: "chair1", type: "chair", cells: [{ row: 1, col: 1 }] },
  { id: "chair2", type: "chair", cells: [{ row: 1, col: 3 }] },
  {
    id: "bed1",
    type: "bed",
    cells: [
      { row: 2, col: 0 },
      { row: 2, col: 1 },
    ],
  },
  { id: "plant1", type: "plant", cells: [{ row: 3, col: 3 }] },
];

const objectAt = new Map<string, string>();
for (const o of objects) for (const c of o.cells) objectAt.set(`${c.row},${c.col}`, o.id);
const roomAt = new Map<string, { id: string; floor: string }>();
const floorByRoom: Record<string, string> = { Top: "wood", Mid: "tile", BL: "stone", BR: "grass" };
for (const r of rooms) for (const c of r.cells) roomAt.set(`${c.row},${c.col}`, { id: r.id, floor: floorByRoom[r.id] });

const cells: Cell[][] = [];
for (let row = 0; row < 4; row++) {
  const rowCells: Cell[] = [];
  for (let col = 0; col < 4; col++) {
    const key = `${row},${col}`;
    const r = roomAt.get(key)!;
    rowCells.push({ row, col, roomId: r.id, floor: r.floor, objectId: objectAt.get(key) ?? null });
  }
  cells.push(rowCells);
}

function makeCharacters(ids: string[]): Character[] {
  return ids.map((id, i) => ({ id, name: id, isTarget: i === ids.length - 1 }));
}

/** Builds a fresh puzzle (with the given roster of character ids) and its BoardIndex. */
export function fixture(charIds: string[]): { puzzle: Puzzle; board: BoardIndex } {
  const puzzle: Puzzle = {
    id: "fixture",
    size: 4,
    themeId: "test",
    cells,
    rooms,
    objects,
    characters: makeCharacters(charIds),
    clues: [],
    solution: {},
    answerCharId: charIds[0] ?? "",
    difficulty: { tier: 1 },
    meta: { generatorVersion: "test" },
  };
  const board = new BoardIndex(puzzle, BLOCKING);
  return { puzzle, board };
}
