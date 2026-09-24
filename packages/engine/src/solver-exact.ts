import { BoardIndex, type ObjectBlockingMap } from "./board.js";
import { evaluate } from "./evaluate.js";
import type { CellCoord, Placement, Puzzle } from "./types.js";

/**
 * Backtracking uniqueness solver (spec section 6a). Enforces exactly one character per row
 * and column plus every clue, and counts solutions up to `limit` (default 2, since callers
 * only ever care about 0, 1, or "more than 1").
 */
export function countSolutions(puzzle: Puzzle, blocking: ObjectBlockingMap = {}, limit = 2): number {
  const board = new BoardIndex(puzzle, blocking);
  const occupiable = board.allOccupiableCells();
  const allCharIds = puzzle.characters.map((c) => c.id);

  const placement: Placement = {};
  const usedRows = new Set<number>();
  const usedCols = new Set<number>();
  let count = 0;

  function candidatesFor(charId: string): CellCoord[] {
    const out: CellCoord[] = [];
    for (const cell of occupiable) {
      if (usedRows.has(cell.row) || usedCols.has(cell.col)) continue;
      placement[charId] = cell;
      const ok = puzzle.clues.every((clue) => evaluate(clue, placement, puzzle, board) !== "false");
      delete placement[charId];
      if (ok) out.push(cell);
    }
    return out;
  }

  function backtrack(remaining: string[]): void {
    if (count >= limit) return;

    if (remaining.length === 0) {
      const allTrue = puzzle.clues.every((clue) => evaluate(clue, placement, puzzle, board) === "true");
      if (allTrue) count++;
      return;
    }

    let bestIdx = 0;
    let bestCands: CellCoord[] | null = null;
    for (let i = 0; i < remaining.length; i++) {
      const cands = candidatesFor(remaining[i]);
      if (bestCands === null || cands.length < bestCands.length) {
        bestCands = cands;
        bestIdx = i;
        if (cands.length === 0) break; // dead end, stop looking for a "better" pick
      }
    }
    const charId = remaining[bestIdx];
    const rest = [...remaining.slice(0, bestIdx), ...remaining.slice(bestIdx + 1)];

    for (const cell of bestCands ?? []) {
      if (usedRows.has(cell.row) || usedCols.has(cell.col)) continue;
      placement[charId] = cell;
      usedRows.add(cell.row);
      usedCols.add(cell.col);

      backtrack(rest);

      delete placement[charId];
      usedRows.delete(cell.row);
      usedCols.delete(cell.col);
      if (count >= limit) return;
    }
  }

  backtrack(allCharIds);
  return count;
}
