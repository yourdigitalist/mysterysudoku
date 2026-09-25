import { BoardIndex, type CellCoord, type Clue, type PlacedObject } from "@mysterysudoku/engine";

export interface ClueCandidate {
  clue: Clue;
  /** Higher is "nicer" (spec section 7 step 3): object/relational clues beat row/col ones. */
  weight: number;
}

/**
 * The generator only ever emits clue kinds that have display templates in theme.json's
 * clueTemplates (plus the fixed victim clue and globalEmptyRoom). This matches every clue kind
 * actually used across the 9 prototype-pack puzzles. Other engine clue kinds (inRow, onFloor,
 * sameRoomAs, edge, ...) are left for hand-authored puzzles or a future theme content pass —
 * see docs/decisions.md.
 */
const WEIGHTS = {
  onObject: 4,
  besideObject: 4,
  notBesideObject: 1,
  inRoom: 2,
  inCorner: 2,
  besideCharacter: 3,
  diagonalOf: 4,
  direction: 4,
} as const;

/** Object types eligible as a diagonalOf/direction ref: exactly one instance, and it's 1x1
 * (docs/decisions.md: "never a multi-cell object... since west of the sofa is ambiguous"). */
function eligibleObjectRefTypes(objects: PlacedObject[]): string[] {
  const byType = new Map<string, PlacedObject[]>();
  for (const obj of objects) {
    const list = byType.get(obj.type) ?? [];
    list.push(obj);
    byType.set(obj.type, list);
  }
  const out: string[] = [];
  for (const [type, list] of byType) {
    if (list.length === 1 && list[0].cells.length === 1) out.push(type);
  }
  return out;
}

/**
 * Caps how many candidates of each kind survive per character (first-found, deterministic).
 * diagonalOf/direction especially can enumerate a candidate per other character per reference,
 * which both bloats the pool without adding meaningfully different puzzle text and is expensive
 * to re-check repeatedly during selection (the engine's direction/diagonal evaluation scans the
 * whole board per call). 4 of a kind is still plenty of variety for weighted selection.
 */
function capPerKind(candidates: ClueCandidate[], perKind: number): ClueCandidate[] {
  const counts = new Map<string, number>();
  const out: ClueCandidate[] = [];
  for (const c of candidates) {
    const n = counts.get(c.clue.kind) ?? 0;
    if (n >= perKind) continue;
    counts.set(c.clue.kind, n + 1);
    out.push(c);
  }
  return out;
}

export function buildCluePool(
  board: BoardIndex,
  objects: PlacedObject[],
  characterIds: string[],
  solution: Record<string, CellCoord>,
): { byChar: Map<string, ClueCandidate[]>; global: ClueCandidate[] } {
  const allObjectTypes = [...new Set(objects.map((o) => o.type))];
  const objectRefTypes = eligibleObjectRefTypes(objects);
  const byChar = new Map<string, ClueCandidate[]>();

  for (const charId of characterIds) {
    const cell = solution[charId];
    const candidates: ClueCandidate[] = [];

    const ownObject = board.objectAt(cell);
    if (ownObject) {
      candidates.push({ clue: { kind: "onObject", charId, objectType: ownObject.type }, weight: WEIGHTS.onObject });
    }

    const besideTypes = new Set(
      board
        .besideCells(cell)
        .map((c) => board.objectAt(c))
        .filter((o): o is PlacedObject => o !== undefined)
        .map((o) => o.type),
    );
    for (const type of besideTypes) {
      if (board.besideObjectCells(cell, type).length > 0) {
        candidates.push({ clue: { kind: "besideObject", charId, objectType: type }, weight: WEIGHTS.besideObject });
      }
    }
    for (const type of allObjectTypes) {
      if (!besideTypes.has(type) && board.besideObjectCells(cell, type).length === 0) {
        candidates.push({
          clue: { kind: "notBesideObject", charId, objectType: type },
          weight: WEIGHTS.notBesideObject,
        });
      }
    }

    candidates.push({
      clue: { kind: "inRoom", charId, roomId: board.roomOf(cell)!.id },
      weight: WEIGHTS.inRoom,
    });

    if (board.isCorner(cell)) {
      candidates.push({ clue: { kind: "inCorner", charId }, weight: WEIGHTS.inCorner });
    }

    for (const otherId of characterIds) {
      if (otherId === charId) continue;
      const otherCell = solution[otherId];
      if (board.isBeside(cell, otherCell)) {
        candidates.push({
          clue: { kind: "besideCharacter", charId, otherId },
          weight: WEIGHTS.besideCharacter,
        });
      }
    }

    const diagonalCells = new Set(board.diagonalCellsThrough(cell).map((c) => `${c.row},${c.col}`));
    for (const otherId of characterIds) {
      if (otherId === charId) continue;
      if (diagonalCells.has(`${solution[otherId].row},${solution[otherId].col}`)) {
        candidates.push({
          clue: { kind: "diagonalOf", charId, ref: { charId: otherId } },
          weight: WEIGHTS.diagonalOf,
        });
      }
    }
    for (const type of objectRefTypes) {
      const refCell = board.objectsOfType(type)[0].cells[0];
      if (diagonalCells.has(`${refCell.row},${refCell.col}`)) {
        candidates.push({
          clue: { kind: "diagonalOf", charId, ref: { objectType: type } },
          weight: WEIGHTS.diagonalOf,
        });
      }
    }

    for (const dir of ["north", "south", "east", "west"] as const) {
      for (const otherId of characterIds) {
        if (otherId === charId) continue;
        const otherCell = solution[otherId];
        if (board.cellsInDirection(dir, otherCell).some((c) => c.row === cell.row && c.col === cell.col)) {
          candidates.push({
            clue: { kind: "direction", charId, dir, ref: { charId: otherId } },
            weight: WEIGHTS.direction,
          });
        }
      }
      for (const type of objectRefTypes) {
        const refCell = board.objectsOfType(type)[0].cells[0];
        if (board.cellsInDirection(dir, refCell).some((c) => c.row === cell.row && c.col === cell.col)) {
          candidates.push({
            clue: { kind: "direction", charId, dir, ref: { objectType: type } },
            weight: WEIGHTS.direction,
          });
        }
      }
    }

    byChar.set(charId, capPerKind(candidates, 4));
  }

  const global: ClueCandidate[] = [];
  for (const room of board.puzzle.rooms) {
    const occupied = characterIds.some((id) => board.roomOf(solution[id])!.id === room.id);
    if (!occupied) global.push({ clue: { kind: "globalEmptyRoom", roomId: room.id }, weight: 2 });
  }

  return { byChar, global };
}
