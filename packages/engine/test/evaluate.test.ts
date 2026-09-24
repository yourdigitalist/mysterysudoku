import { describe, expect, it } from "vitest";
import { evaluate } from "../src/evaluate.js";
import type { CellCoord, Clue, Placement, TriState } from "../src/types.js";
import { fixture } from "./fixtures.js";

interface Case {
  name: string;
  charIds: string[];
  clue: Clue;
  placement: Record<string, CellCoord>;
  expected: TriState;
}

function run(cases: Case[]) {
  for (const c of cases) {
    it(c.name, () => {
      const { puzzle, board } = fixture(c.charIds);
      const placement: Placement = c.placement;
      expect(evaluate(c.clue, placement, puzzle, board)).toBe(c.expected);
    });
  }
}

describe("inRow", () => {
  run([
    { name: "true: row 0", charIds: ["A"], clue: { kind: "inRow", charId: "A", row: 0 }, placement: { A: { row: 0, col: 2 } }, expected: "true" },
    { name: "true: row 1", charIds: ["A"], clue: { kind: "inRow", charId: "A", row: 1 }, placement: { A: { row: 1, col: 0 } }, expected: "true" },
    { name: "true: row 3", charIds: ["A"], clue: { kind: "inRow", charId: "A", row: 3 }, placement: { A: { row: 3, col: 3 } }, expected: "true" },
    { name: "false: wrong row", charIds: ["A"], clue: { kind: "inRow", charId: "A", row: 1 }, placement: { A: { row: 0, col: 0 } }, expected: "false" },
    { name: "false: wrong row 2", charIds: ["A"], clue: { kind: "inRow", charId: "A", row: 0 }, placement: { A: { row: 2, col: 2 } }, expected: "false" },
    { name: "false: wrong row 3", charIds: ["A"], clue: { kind: "inRow", charId: "A", row: 3 }, placement: { A: { row: 1, col: 1 } }, expected: "false" },
    { name: "unknown: unplaced", charIds: ["A"], clue: { kind: "inRow", charId: "A", row: 0 }, placement: {}, expected: "unknown" },
  ]);
});

describe("inCol", () => {
  run([
    { name: "true: col 0", charIds: ["A"], clue: { kind: "inCol", charId: "A", col: 0 }, placement: { A: { row: 2, col: 0 } }, expected: "true" },
    { name: "true: col 1", charIds: ["A"], clue: { kind: "inCol", charId: "A", col: 1 }, placement: { A: { row: 0, col: 1 } }, expected: "true" },
    { name: "true: col 3", charIds: ["A"], clue: { kind: "inCol", charId: "A", col: 3 }, placement: { A: { row: 1, col: 3 } }, expected: "true" },
    { name: "false: wrong col", charIds: ["A"], clue: { kind: "inCol", charId: "A", col: 1 }, placement: { A: { row: 0, col: 0 } }, expected: "false" },
    { name: "false: wrong col 2", charIds: ["A"], clue: { kind: "inCol", charId: "A", col: 0 }, placement: { A: { row: 2, col: 2 } }, expected: "false" },
    { name: "false: wrong col 3", charIds: ["A"], clue: { kind: "inCol", charId: "A", col: 3 }, placement: { A: { row: 1, col: 1 } }, expected: "false" },
    { name: "unknown: unplaced", charIds: ["A"], clue: { kind: "inCol", charId: "A", col: 0 }, placement: {}, expected: "unknown" },
  ]);
});

describe("inRoom", () => {
  run([
    { name: "true: Top", charIds: ["A"], clue: { kind: "inRoom", charId: "A", roomId: "Top" }, placement: { A: { row: 0, col: 1 } }, expected: "true" },
    { name: "true: BR", charIds: ["A"], clue: { kind: "inRoom", charId: "A", roomId: "BR" }, placement: { A: { row: 2, col: 2 } }, expected: "true" },
    { name: "true: BL", charIds: ["A"], clue: { kind: "inRoom", charId: "A", roomId: "BL" }, placement: { A: { row: 3, col: 0 } }, expected: "true" },
    { name: "false: wrong room", charIds: ["A"], clue: { kind: "inRoom", charId: "A", roomId: "Mid" }, placement: { A: { row: 0, col: 1 } }, expected: "false" },
    { name: "false: wrong room 2", charIds: ["A"], clue: { kind: "inRoom", charId: "A", roomId: "BL" }, placement: { A: { row: 2, col: 2 } }, expected: "false" },
    { name: "false: wrong room 3", charIds: ["A"], clue: { kind: "inRoom", charId: "A", roomId: "BR" }, placement: { A: { row: 1, col: 0 } }, expected: "false" },
    { name: "unknown: unplaced", charIds: ["A"], clue: { kind: "inRoom", charId: "A", roomId: "Top" }, placement: {}, expected: "unknown" },
  ]);
});

describe("notInRoom", () => {
  run([
    { name: "true", charIds: ["A"], clue: { kind: "notInRoom", charId: "A", roomId: "Mid" }, placement: { A: { row: 0, col: 1 } }, expected: "true" },
    { name: "true 2", charIds: ["A"], clue: { kind: "notInRoom", charId: "A", roomId: "BL" }, placement: { A: { row: 2, col: 2 } }, expected: "true" },
    { name: "true 3", charIds: ["A"], clue: { kind: "notInRoom", charId: "A", roomId: "BR" }, placement: { A: { row: 1, col: 0 } }, expected: "true" },
    { name: "false", charIds: ["A"], clue: { kind: "notInRoom", charId: "A", roomId: "Top" }, placement: { A: { row: 0, col: 1 } }, expected: "false" },
    { name: "false 2", charIds: ["A"], clue: { kind: "notInRoom", charId: "A", roomId: "BR" }, placement: { A: { row: 2, col: 2 } }, expected: "false" },
    { name: "false 3", charIds: ["A"], clue: { kind: "notInRoom", charId: "A", roomId: "BL" }, placement: { A: { row: 3, col: 0 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "notInRoom", charId: "A", roomId: "Top" }, placement: {}, expected: "unknown" },
  ]);
});

describe("onObject", () => {
  run([
    { name: "true: bed cell 1", charIds: ["A"], clue: { kind: "onObject", charId: "A", objectType: "bed" }, placement: { A: { row: 2, col: 0 } }, expected: "true" },
    { name: "true: bed cell 2", charIds: ["A"], clue: { kind: "onObject", charId: "A", objectType: "bed" }, placement: { A: { row: 2, col: 1 } }, expected: "true" },
    { name: "true: chair", charIds: ["A"], clue: { kind: "onObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 1 } }, expected: "true" },
    { name: "false: empty cell", charIds: ["A"], clue: { kind: "onObject", charId: "A", objectType: "bed" }, placement: { A: { row: 2, col: 2 } }, expected: "false" },
    { name: "false: no chair here", charIds: ["A"], clue: { kind: "onObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 0 } }, expected: "false" },
    { name: "false: shelf not bed", charIds: ["A"], clue: { kind: "onObject", charId: "A", objectType: "bed" }, placement: { A: { row: 0, col: 0 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "onObject", charId: "A", objectType: "bed" }, placement: {}, expected: "unknown" },
  ]);
});

describe("besideObject", () => {
  run([
    { name: "true: beside chair across mid room", charIds: ["A"], clue: { kind: "besideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 0 } }, expected: "true" },
    { name: "true: beside shelf", charIds: ["A"], clue: { kind: "besideObject", charId: "A", objectType: "shelf" }, placement: { A: { row: 0, col: 1 } }, expected: "true" },
    { name: "true: beside two chairs", charIds: ["A"], clue: { kind: "besideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 2 } }, expected: "true" },
    { name: "false: no bed nearby (different room across wall)", charIds: ["A"], clue: { kind: "besideObject", charId: "A", objectType: "bed" }, placement: { A: { row: 2, col: 2 } }, expected: "false" },
    { name: "false: no chair nearby", charIds: ["A"], clue: { kind: "besideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 3, col: 0 } }, expected: "false" },
    { name: "false: sitting on the object doesn't count as beside it", charIds: ["A"], clue: { kind: "besideObject", charId: "A", objectType: "bed" }, placement: { A: { row: 2, col: 0 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "besideObject", charId: "A", objectType: "bed" }, placement: {}, expected: "unknown" },
  ]);
});

describe("notBesideObject", () => {
  run([
    { name: "true: not beside bed across the room wall", charIds: ["A"], clue: { kind: "notBesideObject", charId: "A", objectType: "bed" }, placement: { A: { row: 2, col: 2 } }, expected: "true" },
    { name: "true: not beside chair", charIds: ["A"], clue: { kind: "notBesideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 3, col: 0 } }, expected: "true" },
    { name: "true: own bed cell doesn't count", charIds: ["A"], clue: { kind: "notBesideObject", charId: "A", objectType: "bed" }, placement: { A: { row: 2, col: 0 } }, expected: "true" },
    { name: "false: is beside chair", charIds: ["A"], clue: { kind: "notBesideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 0 } }, expected: "false" },
    { name: "false: is beside shelf", charIds: ["A"], clue: { kind: "notBesideObject", charId: "A", objectType: "shelf" }, placement: { A: { row: 0, col: 1 } }, expected: "false" },
    { name: "false: is beside two chairs", charIds: ["A"], clue: { kind: "notBesideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 2 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "notBesideObject", charId: "A", objectType: "bed" }, placement: {}, expected: "unknown" },
  ]);
});

describe("onlyOneBesideObject", () => {
  run([
    { name: "true: exactly one chair beside", charIds: ["A"], clue: { kind: "onlyOneBesideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 0 } }, expected: "true" },
    { name: "true: exactly one shelf beside", charIds: ["A"], clue: { kind: "onlyOneBesideObject", charId: "A", objectType: "shelf" }, placement: { A: { row: 0, col: 1 } }, expected: "true" },
    { name: "true: exactly one bed beside", charIds: ["A"], clue: { kind: "onlyOneBesideObject", charId: "A", objectType: "bed" }, placement: { A: { row: 3, col: 0 } }, expected: "true" },
    { name: "false: two chairs beside", charIds: ["A"], clue: { kind: "onlyOneBesideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 2 } }, expected: "false" },
    { name: "false: zero beds beside", charIds: ["A"], clue: { kind: "onlyOneBesideObject", charId: "A", objectType: "bed" }, placement: { A: { row: 2, col: 2 } }, expected: "false" },
    { name: "false: zero chairs beside", charIds: ["A"], clue: { kind: "onlyOneBesideObject", charId: "A", objectType: "chair" }, placement: { A: { row: 1, col: 1 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "onlyOneBesideObject", charId: "A", objectType: "chair" }, placement: {}, expected: "unknown" },
  ]);
});

describe("onFloor", () => {
  run([
    { name: "true: wood", charIds: ["A"], clue: { kind: "onFloor", charId: "A", floor: "wood" }, placement: { A: { row: 0, col: 0 } }, expected: "true" },
    { name: "true: tile", charIds: ["A"], clue: { kind: "onFloor", charId: "A", floor: "tile" }, placement: { A: { row: 1, col: 0 } }, expected: "true" },
    { name: "true: stone", charIds: ["A"], clue: { kind: "onFloor", charId: "A", floor: "stone" }, placement: { A: { row: 2, col: 0 } }, expected: "true" },
    { name: "false: not tile", charIds: ["A"], clue: { kind: "onFloor", charId: "A", floor: "tile" }, placement: { A: { row: 0, col: 0 } }, expected: "false" },
    { name: "false: not stone", charIds: ["A"], clue: { kind: "onFloor", charId: "A", floor: "stone" }, placement: { A: { row: 3, col: 3 } }, expected: "false" },
    { name: "false: not grass", charIds: ["A"], clue: { kind: "onFloor", charId: "A", floor: "grass" }, placement: { A: { row: 1, col: 1 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "onFloor", charId: "A", floor: "wood" }, placement: {}, expected: "unknown" },
  ]);
});

describe("besideCharacter", () => {
  run([
    { name: "true: adjacent in Top", charIds: ["A", "B"], clue: { kind: "besideCharacter", charId: "A", otherId: "B" }, placement: { A: { row: 0, col: 0 }, B: { row: 0, col: 1 } }, expected: "true" },
    { name: "true: adjacent in Mid", charIds: ["A", "B"], clue: { kind: "besideCharacter", charId: "A", otherId: "B" }, placement: { A: { row: 1, col: 0 }, B: { row: 1, col: 1 } }, expected: "true" },
    { name: "true: adjacent in BL", charIds: ["A", "B"], clue: { kind: "besideCharacter", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 0 }, B: { row: 3, col: 0 } }, expected: "true" },
    { name: "false: adjacent cells but different rooms", charIds: ["A", "B"], clue: { kind: "besideCharacter", charId: "A", otherId: "B" }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 } }, expected: "false" },
    { name: "false: same room not adjacent", charIds: ["A", "B"], clue: { kind: "besideCharacter", charId: "A", otherId: "B" }, placement: { A: { row: 0, col: 0 }, B: { row: 0, col: 2 } }, expected: "false" },
    { name: "false: diagonal not beside", charIds: ["A", "B"], clue: { kind: "besideCharacter", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 2 }, B: { row: 3, col: 3 } }, expected: "false" },
    { name: "unknown: other unplaced", charIds: ["A", "B"], clue: { kind: "besideCharacter", charId: "A", otherId: "B" }, placement: { A: { row: 0, col: 0 } }, expected: "unknown" },
  ]);
});

describe("sameRoomAs", () => {
  run([
    { name: "true: both Top", charIds: ["A", "B"], clue: { kind: "sameRoomAs", charId: "A", otherId: "B" }, placement: { A: { row: 0, col: 0 }, B: { row: 0, col: 3 } }, expected: "true" },
    { name: "true: both BL", charIds: ["A", "B"], clue: { kind: "sameRoomAs", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 0 }, B: { row: 3, col: 1 } }, expected: "true" },
    { name: "true: both BR", charIds: ["A", "B"], clue: { kind: "sameRoomAs", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 2 }, B: { row: 3, col: 3 } }, expected: "true" },
    { name: "false: Top vs Mid", charIds: ["A", "B"], clue: { kind: "sameRoomAs", charId: "A", otherId: "B" }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 } }, expected: "false" },
    { name: "false: BL vs BR", charIds: ["A", "B"], clue: { kind: "sameRoomAs", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 0 }, B: { row: 2, col: 2 } }, expected: "false" },
    { name: "false: Mid vs BR", charIds: ["A", "B"], clue: { kind: "sameRoomAs", charId: "A", otherId: "B" }, placement: { A: { row: 1, col: 0 }, B: { row: 3, col: 3 } }, expected: "false" },
    { name: "unknown: other unplaced", charIds: ["A", "B"], clue: { kind: "sameRoomAs", charId: "A", otherId: "B" }, placement: { A: { row: 0, col: 0 } }, expected: "unknown" },
  ]);
});

describe("aloneInRoom", () => {
  run([
    { name: "true: alone in BR", charIds: ["A", "B", "C"], clue: { kind: "aloneInRoom", charId: "A" }, placement: { A: { row: 2, col: 2 }, B: { row: 0, col: 0 }, C: { row: 1, col: 0 } }, expected: "true" },
    { name: "true: alone in BL", charIds: ["A", "B", "C"], clue: { kind: "aloneInRoom", charId: "A" }, placement: { A: { row: 3, col: 0 }, B: { row: 0, col: 1 }, C: { row: 2, col: 2 } }, expected: "true" },
    { name: "true: alone in Top", charIds: ["A", "B", "C"], clue: { kind: "aloneInRoom", charId: "A" }, placement: { A: { row: 0, col: 2 }, B: { row: 1, col: 0 }, C: { row: 2, col: 0 } }, expected: "true" },
    { name: "false: shares room", charIds: ["A", "B", "C"], clue: { kind: "aloneInRoom", charId: "A" }, placement: { A: { row: 2, col: 2 }, B: { row: 2, col: 3 }, C: { row: 0, col: 0 } }, expected: "false" },
    { name: "false: shares room 2", charIds: ["A", "B", "C"], clue: { kind: "aloneInRoom", charId: "A" }, placement: { A: { row: 0, col: 0 }, B: { row: 0, col: 1 }, C: { row: 1, col: 0 } }, expected: "false" },
    { name: "unknown: others unplaced", charIds: ["A", "B", "C"], clue: { kind: "aloneInRoom", charId: "A" }, placement: { A: { row: 2, col: 2 } }, expected: "unknown" },
  ]);
});

describe("aloneWith", () => {
  run([
    { name: "true: alone with B in BR", charIds: ["A", "B", "C"], clue: { kind: "aloneWith", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 2 }, B: { row: 2, col: 3 }, C: { row: 0, col: 0 } }, expected: "true" },
    { name: "true: alone with B in BL", charIds: ["A", "B", "C"], clue: { kind: "aloneWith", charId: "A", otherId: "B" }, placement: { A: { row: 3, col: 0 }, B: { row: 3, col: 1 }, C: { row: 0, col: 0 } }, expected: "true" },
    { name: "true: alone with B in Top", charIds: ["A", "B", "C"], clue: { kind: "aloneWith", charId: "A", otherId: "B" }, placement: { A: { row: 0, col: 0 }, B: { row: 0, col: 1 }, C: { row: 1, col: 0 } }, expected: "true" },
    { name: "false: B is elsewhere", charIds: ["A", "B", "C"], clue: { kind: "aloneWith", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 2 }, B: { row: 0, col: 0 }, C: { row: 1, col: 0 } }, expected: "false" },
    { name: "false: a third character joins", charIds: ["A", "B", "C"], clue: { kind: "aloneWith", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 2 }, B: { row: 2, col: 3 }, C: { row: 3, col: 2 } }, expected: "false" },
    { name: "false: someone other than B is present, B unplaced", charIds: ["A", "B", "C"], clue: { kind: "aloneWith", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 2 }, C: { row: 2, col: 3 } }, expected: "false" },
    { name: "unknown: nobody else placed yet", charIds: ["A", "B", "C"], clue: { kind: "aloneWith", charId: "A", otherId: "B" }, placement: { A: { row: 2, col: 2 } }, expected: "unknown" },
  ]);
});

describe("inCorner", () => {
  run([
    { name: "true: left end of Top strip", charIds: ["A"], clue: { kind: "inCorner", charId: "A" }, placement: { A: { row: 0, col: 0 } }, expected: "true" },
    { name: "true: right end of Top strip", charIds: ["A"], clue: { kind: "inCorner", charId: "A" }, placement: { A: { row: 0, col: 3 } }, expected: "true" },
    { name: "true: 2x2 room cell", charIds: ["A"], clue: { kind: "inCorner", charId: "A" }, placement: { A: { row: 2, col: 0 } }, expected: "true" },
    { name: "false: middle of Top strip", charIds: ["A"], clue: { kind: "inCorner", charId: "A" }, placement: { A: { row: 0, col: 1 } }, expected: "false" },
    { name: "false: middle of Top strip 2", charIds: ["A"], clue: { kind: "inCorner", charId: "A" }, placement: { A: { row: 0, col: 2 } }, expected: "false" },
    { name: "false: middle of Mid strip", charIds: ["A"], clue: { kind: "inCorner", charId: "A" }, placement: { A: { row: 1, col: 1 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "inCorner", charId: "A" }, placement: {}, expected: "unknown" },
  ]);
});

describe("notInCorner", () => {
  run([
    { name: "true: middle of Top strip", charIds: ["A"], clue: { kind: "notInCorner", charId: "A" }, placement: { A: { row: 0, col: 1 } }, expected: "true" },
    { name: "true: middle of Top strip 2", charIds: ["A"], clue: { kind: "notInCorner", charId: "A" }, placement: { A: { row: 0, col: 2 } }, expected: "true" },
    { name: "true: middle of Mid strip", charIds: ["A"], clue: { kind: "notInCorner", charId: "A" }, placement: { A: { row: 1, col: 1 } }, expected: "true" },
    { name: "false: left end of Top strip", charIds: ["A"], clue: { kind: "notInCorner", charId: "A" }, placement: { A: { row: 0, col: 0 } }, expected: "false" },
    { name: "false: right end of Top strip", charIds: ["A"], clue: { kind: "notInCorner", charId: "A" }, placement: { A: { row: 0, col: 3 } }, expected: "false" },
    { name: "false: 2x2 room cell", charIds: ["A"], clue: { kind: "notInCorner", charId: "A" }, placement: { A: { row: 2, col: 0 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "notInCorner", charId: "A" }, placement: {}, expected: "unknown" },
  ]);
});

describe("diagonalOf", () => {
  run([
    { name: "true: character ref, up-left", charIds: ["A", "B"], clue: { kind: "diagonalOf", charId: "A", ref: { charId: "B" } }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 1 } }, expected: "true" },
    { name: "true: character ref, down-right", charIds: ["A", "B"], clue: { kind: "diagonalOf", charId: "A", ref: { charId: "B" } }, placement: { A: { row: 2, col: 2 }, B: { row: 1, col: 1 } }, expected: "true" },
    { name: "true: object ref", charIds: ["A"], clue: { kind: "diagonalOf", charId: "A", ref: { objectType: "shelf" } }, placement: { A: { row: 3, col: 3 } }, expected: "true" },
    { name: "false: same row, character ref", charIds: ["A", "B"], clue: { kind: "diagonalOf", charId: "A", ref: { charId: "B" } }, placement: { A: { row: 0, col: 1 }, B: { row: 1, col: 1 } }, expected: "false" },
    { name: "false: object ref", charIds: ["A"], clue: { kind: "diagonalOf", charId: "A", ref: { objectType: "shelf" } }, placement: { A: { row: 2, col: 0 } }, expected: "false" },
    { name: "false: same col, character ref", charIds: ["A", "B"], clue: { kind: "diagonalOf", charId: "A", ref: { charId: "B" } }, placement: { A: { row: 1, col: 0 }, B: { row: 1, col: 1 } }, expected: "false" },
    { name: "unknown: ref character unplaced", charIds: ["A", "B"], clue: { kind: "diagonalOf", charId: "A", ref: { charId: "B" } }, placement: { A: { row: 0, col: 0 } }, expected: "unknown" },
  ]);
});

describe("direction", () => {
  run([
    { name: "true: east of character ref", charIds: ["A", "B"], clue: { kind: "direction", charId: "A", dir: "east", ref: { charId: "B" } }, placement: { A: { row: 1, col: 3 }, B: { row: 1, col: 1 } }, expected: "true" },
    { name: "true: east of character ref, any row", charIds: ["A", "B"], clue: { kind: "direction", charId: "A", dir: "east", ref: { charId: "B" } }, placement: { A: { row: 0, col: 3 }, B: { row: 1, col: 1 } }, expected: "true" },
    { name: "true: west of object ref", charIds: ["A"], clue: { kind: "direction", charId: "A", dir: "west", ref: { objectType: "plant" } }, placement: { A: { row: 3, col: 0 } }, expected: "true" },
    { name: "false: not east of character ref", charIds: ["A", "B"], clue: { kind: "direction", charId: "A", dir: "east", ref: { charId: "B" } }, placement: { A: { row: 1, col: 0 }, B: { row: 1, col: 1 } }, expected: "false" },
    { name: "false: not north of object ref", charIds: ["A"], clue: { kind: "direction", charId: "A", dir: "north", ref: { objectType: "shelf" } }, placement: { A: { row: 3, col: 3 } }, expected: "false" },
    { name: "false: not south of character ref", charIds: ["A", "B"], clue: { kind: "direction", charId: "A", dir: "south", ref: { charId: "B" } }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 1 } }, expected: "false" },
    { name: "unknown: ref character unplaced", charIds: ["A", "B"], clue: { kind: "direction", charId: "A", dir: "east", ref: { charId: "B" } }, placement: { A: { row: 1, col: 3 } }, expected: "unknown" },
  ]);
});

describe("edge", () => {
  run([
    { name: "true: top", charIds: ["A"], clue: { kind: "edge", charId: "A", side: "top" }, placement: { A: { row: 0, col: 2 } }, expected: "true" },
    { name: "true: bottom", charIds: ["A"], clue: { kind: "edge", charId: "A", side: "bottom" }, placement: { A: { row: 3, col: 1 } }, expected: "true" },
    { name: "true: left", charIds: ["A"], clue: { kind: "edge", charId: "A", side: "left" }, placement: { A: { row: 2, col: 0 } }, expected: "true" },
    { name: "false: not top", charIds: ["A"], clue: { kind: "edge", charId: "A", side: "top" }, placement: { A: { row: 1, col: 2 } }, expected: "false" },
    { name: "false: not bottom", charIds: ["A"], clue: { kind: "edge", charId: "A", side: "bottom" }, placement: { A: { row: 2, col: 3 } }, expected: "false" },
    { name: "false: not right", charIds: ["A"], clue: { kind: "edge", charId: "A", side: "right" }, placement: { A: { row: 1, col: 1 } }, expected: "false" },
    { name: "unknown", charIds: ["A"], clue: { kind: "edge", charId: "A", side: "top" }, placement: {}, expected: "unknown" },
  ]);
});

describe("globalCountOnObject", () => {
  run([
    { name: "true: exactly 1 on chair", charIds: ["A", "B", "C"], clue: { kind: "globalCountOnObject", objectType: "chair", count: 1 }, placement: { A: { row: 1, col: 1 }, B: { row: 0, col: 0 }, C: { row: 2, col: 2 } }, expected: "true" },
    { name: "true: exactly 2 on chair", charIds: ["A", "B", "C"], clue: { kind: "globalCountOnObject", objectType: "chair", count: 2 }, placement: { A: { row: 1, col: 1 }, B: { row: 1, col: 3 }, C: { row: 0, col: 0 } }, expected: "true" },
    { name: "true: exactly 0 on bed", charIds: ["A", "B", "C"], clue: { kind: "globalCountOnObject", objectType: "bed", count: 0 }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 }, C: { row: 2, col: 2 } }, expected: "true" },
    { name: "false: too many, detected early", charIds: ["A", "B", "C"], clue: { kind: "globalCountOnObject", objectType: "chair", count: 1 }, placement: { A: { row: 1, col: 1 }, B: { row: 1, col: 3 } }, expected: "false" },
    { name: "false: full placement, wrong count", charIds: ["A", "B", "C"], clue: { kind: "globalCountOnObject", objectType: "bed", count: 1 }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 }, C: { row: 2, col: 2 } }, expected: "false" },
    { name: "false: full placement, expected some but got none", charIds: ["A", "B", "C"], clue: { kind: "globalCountOnObject", objectType: "chair", count: 1 }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 }, C: { row: 2, col: 2 } }, expected: "false" },
    { name: "unknown: partial, count so far within bound", charIds: ["A", "B", "C"], clue: { kind: "globalCountOnObject", objectType: "chair", count: 1 }, placement: { A: { row: 1, col: 1 } }, expected: "unknown" },
  ]);
});

describe("globalCountInRoom", () => {
  run([
    { name: "true: exactly 1 in BR", charIds: ["A", "B", "C"], clue: { kind: "globalCountInRoom", roomId: "BR", count: 1 }, placement: { A: { row: 2, col: 2 }, B: { row: 0, col: 0 }, C: { row: 1, col: 0 } }, expected: "true" },
    { name: "true: exactly 2 in BR", charIds: ["A", "B", "C"], clue: { kind: "globalCountInRoom", roomId: "BR", count: 2 }, placement: { A: { row: 2, col: 2 }, B: { row: 2, col: 3 }, C: { row: 0, col: 0 } }, expected: "true" },
    { name: "true: exactly 0 in BL", charIds: ["A", "B", "C"], clue: { kind: "globalCountInRoom", roomId: "BL", count: 0 }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 }, C: { row: 2, col: 2 } }, expected: "true" },
    { name: "false: too many, detected early", charIds: ["A", "B", "C"], clue: { kind: "globalCountInRoom", roomId: "BR", count: 1 }, placement: { A: { row: 2, col: 2 }, B: { row: 2, col: 3 } }, expected: "false" },
    { name: "false: full placement, wrong count", charIds: ["A", "B", "C"], clue: { kind: "globalCountInRoom", roomId: "Top", count: 1 }, placement: { A: { row: 1, col: 0 }, B: { row: 2, col: 0 }, C: { row: 3, col: 2 } }, expected: "false" },
    { name: "false: full placement, expected some but got none", charIds: ["A", "B", "C"], clue: { kind: "globalCountInRoom", roomId: "BL", count: 1 }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 }, C: { row: 2, col: 2 } }, expected: "false" },
    { name: "unknown: partial", charIds: ["A", "B", "C"], clue: { kind: "globalCountInRoom", roomId: "BR", count: 1 }, placement: { A: { row: 2, col: 2 } }, expected: "unknown" },
  ]);
});

describe("globalEmptyRoom", () => {
  run([
    { name: "true: BL stays empty", charIds: ["A", "B", "C"], clue: { kind: "globalEmptyRoom", roomId: "BL" }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 }, C: { row: 2, col: 2 } }, expected: "true" },
    { name: "true: Top stays empty", charIds: ["A", "B", "C"], clue: { kind: "globalEmptyRoom", roomId: "Top" }, placement: { A: { row: 1, col: 0 }, B: { row: 2, col: 0 }, C: { row: 3, col: 2 } }, expected: "true" },
    { name: "true: BR stays empty", charIds: ["A", "B", "C"], clue: { kind: "globalEmptyRoom", roomId: "BR" }, placement: { A: { row: 0, col: 0 }, B: { row: 1, col: 0 }, C: { row: 2, col: 0 } }, expected: "true" },
    { name: "false: someone is in BL, detected early", charIds: ["A", "B", "C"], clue: { kind: "globalEmptyRoom", roomId: "BL" }, placement: { A: { row: 2, col: 0 } }, expected: "false" },
    { name: "false: someone is in Top", charIds: ["A", "B", "C"], clue: { kind: "globalEmptyRoom", roomId: "Top" }, placement: { B: { row: 0, col: 1 } }, expected: "false" },
    { name: "false: someone is in BR", charIds: ["A", "B", "C"], clue: { kind: "globalEmptyRoom", roomId: "BR" }, placement: { C: { row: 3, col: 3 } }, expected: "false" },
    { name: "unknown: nobody placed yet", charIds: ["A", "B", "C"], clue: { kind: "globalEmptyRoom", roomId: "BL" }, placement: {}, expected: "unknown" },
  ]);
});
