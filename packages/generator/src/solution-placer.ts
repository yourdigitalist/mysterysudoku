import { BoardIndex, type CellCoord, type ObjectBlockingMap } from "@mysterysudoku/engine";
import { Rng } from "./rng.js";

export interface PlacedSolution {
  solution: Record<string, CellCoord>;
  targetCharId: string;
  answerCharId: string;
}

/**
 * Names are alphabetical starting at A, the last letter is always the victim/target (spec
 * section 7 step 2's "pick a target character" plus docs/decisions.md, which fixes that choice
 * rather than leaving it random).
 */
export function characterIdsFor(count: number): string[] {
  if (count < 2 || count > 26) throw new Error(`characterIdsFor: unsupported count ${count}`);
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

/**
 * Finds a random row/column permutation over occupiable cells, then places characters so the
 * fixed target (last letter) ends up "alone with" exactly one other character (the answer) in
 * their room, and nobody else. Retries internally; returns null if this map can't support the
 * twist after `maxAttempts`, so the caller can regenerate the map (spec section 7 step 2.3).
 */
export function placeSolution(
  rng: Rng,
  board: BoardIndex,
  size: number,
  characterIds: string[],
  maxAttempts = 200,
): PlacedSolution | null {
  const occupiableColsByRow: number[][] = [];
  for (let r = 0; r < size; r++) {
    const cols: number[] = [];
    for (let c = 0; c < size; c++) {
      if (board.isOccupiable({ row: r, col: c })) cols.push(c);
    }
    occupiableColsByRow.push(cols);
  }

  const targetCharId = characterIds[characterIds.length - 1];
  const others = characterIds.slice(0, -1);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const perm = randomRowColPermutation(rng, occupiableColsByRow, size);
    if (!perm) return null; // no permutation exists at all for this map; no point retrying

    const roomIdOf = perm.map((cell) => board.roomOf(cell)!.id);
    const mateIndex: number[] = perm.map((_, i) => {
      const mates = perm.reduce<number[]>((acc, _c, j) => {
        if (j !== i && roomIdOf[j] === roomIdOf[i]) acc.push(j);
        return acc;
      }, []);
      return mates.length === 1 ? mates[0] : -1;
    });

    const candidateIndices = mateIndex.map((m, i) => (m >= 0 ? i : -1)).filter((i) => i >= 0);
    if (candidateIndices.length === 0) continue;

    const targetIdx = rng.pick(candidateIndices);
    const mateIdx = mateIndex[targetIdx];

    const shuffledOthers = rng.shuffle(others);

    const solution: Record<string, CellCoord> = { [targetCharId]: perm[targetIdx] };
    let answerCharId = "";
    let ri = 0;
    perm.forEach((cell, i) => {
      if (i === targetIdx) return;
      const charId = shuffledOthers[ri++];
      solution[charId] = cell;
      if (i === mateIdx) answerCharId = charId;
    });

    return { solution, targetCharId, answerCharId };
  }
  return null;
}

function randomRowColPermutation(rng: Rng, occupiableColsByRow: number[][], size: number): CellCoord[] | null {
  const rowOrder = rng.shuffle(Array.from({ length: size }, (_, i) => i));
  const assignedCol: number[] = Array(size).fill(-1);
  const usedCols = new Set<number>();

  function backtrack(i: number): boolean {
    if (i === rowOrder.length) return true;
    const row = rowOrder[i];
    const cols = rng.shuffle(occupiableColsByRow[row]);
    for (const col of cols) {
      if (usedCols.has(col)) continue;
      assignedCol[row] = col;
      usedCols.add(col);
      if (backtrack(i + 1)) return true;
      usedCols.delete(col);
      assignedCol[row] = -1;
    }
    return false;
  }

  if (!backtrack(0)) return null;
  return assignedCol.map((col, row) => ({ row, col }));
}
