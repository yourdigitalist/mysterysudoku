import { BoardIndex, cellKey, type ObjectBlockingMap } from "./board.js";
import { evaluate } from "./evaluate.js";
import type { CellCoord, Placement, Puzzle } from "./types.js";

export interface LogicalStep {
  technique: string;
  tier: 1 | 2 | 3 | 4 | 5;
  charId?: string;
  eliminated: CellCoord[];
  placed?: CellCoord;
}

export interface LogicalSolveResult {
  solved: boolean;
  steps: LogicalStep[];
  score: number;
  hardestTier: number;
}

const TIER_COST: Record<LogicalStep["tier"], number> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 8 };

/**
 * Human-style solver (spec section 6b). Applies deduction techniques in increasing tiers,
 * never guessing, and returns the step list that also drives the app's hint system. A puzzle
 * only ships if this fully solves it (docs/spec.md section 6b, last line).
 */
export function solveLogically(puzzle: Puzzle, blocking: ObjectBlockingMap = {}): LogicalSolveResult {
  const board = new BoardIndex(puzzle, blocking);
  const charIds = puzzle.characters.map((c) => c.id);
  const size = puzzle.size;

  const placement: Placement = {};
  const usedRows = new Set<number>();
  const usedCols = new Set<number>();
  // Cells no remaining character may occupy (room-counting, single-open-line: these are
  // genuinely global facts about the board, true for every character).
  const globalEliminated = new Set<string>();
  // Cells eliminated for one specific character only (subset-lock: a cell can be off-limits
  // for characters outside a locked subset while staying perfectly valid for the subset itself).
  const perCharEliminated = new Map<string, Set<string>>();
  const steps: LogicalStep[] = [];
  let emptyRoomsApplied = false;

  function unplacedIds(): string[] {
    return charIds.filter((id) => placement[id] === undefined);
  }

  function isLiveGlobal(c: CellCoord): boolean {
    if (!board.isOccupiable(c) || usedRows.has(c.row) || usedCols.has(c.col)) return false;
    return !globalEliminated.has(cellKey(c));
  }

  function isLive(charId: string, c: CellCoord): boolean {
    if (!isLiveGlobal(c)) return false;
    return !perCharEliminated.get(charId)?.has(cellKey(c));
  }

  function candidatesFor(charId: string): CellCoord[] {
    const out: CellCoord[] = [];
    for (const row of puzzle.cells) {
      for (const cell of row) {
        const c = { row: cell.row, col: cell.col };
        if (!isLive(charId, c)) continue;
        placement[charId] = c;
        const ok = puzzle.clues.every((clue) => evaluate(clue, placement, puzzle, board) !== "false");
        delete placement[charId];
        if (ok) out.push(c);
      }
    }
    return out;
  }

  function place(charId: string, cell: CellCoord, technique: string, tier: LogicalStep["tier"]): void {
    placement[charId] = cell;
    usedRows.add(cell.row);
    usedCols.add(cell.col);
    steps.push({ technique, tier, charId, eliminated: [], placed: cell });
  }

  function eliminateGlobally(cells: CellCoord[], technique: string, tier: LogicalStep["tier"]): boolean {
    const fresh = cells.filter((c) => board.isOccupiable(c) && !globalEliminated.has(cellKey(c)));
    if (fresh.length === 0) return false;
    for (const c of fresh) globalEliminated.add(cellKey(c));
    steps.push({ technique, tier, eliminated: fresh });
    return true;
  }

  function eliminateForCharacters(
    charAndCells: { charId: string; cell: CellCoord }[],
    technique: string,
    tier: LogicalStep["tier"],
  ): boolean {
    const fresh: CellCoord[] = [];
    for (const { charId, cell } of charAndCells) {
      if (!board.isOccupiable(cell)) continue;
      const set = perCharEliminated.get(charId) ?? new Set<string>();
      const key = cellKey(cell);
      if (set.has(key)) continue;
      set.add(key);
      perCharEliminated.set(charId, set);
      fresh.push(cell);
    }
    if (fresh.length === 0) return false;
    steps.push({ technique, tier, eliminated: fresh });
    return true;
  }

  // Tier 2: general clues that empty a whole room can be applied once, up front.
  function applyEmptyRooms(): boolean {
    if (emptyRoomsApplied) return false;
    emptyRoomsApplied = true;
    let any = false;
    for (const clue of puzzle.clues) {
      if (clue.kind !== "globalEmptyRoom") continue;
      const room = board.room(clue.roomId);
      if (!room) continue;
      if (eliminateGlobally(room.cells, "roomCounting", 2)) any = true;
    }
    return any;
  }

  // Tier 1: any unplaced character with exactly one live candidate gets placed.
  function applyDirectPlacement(): boolean {
    for (const charId of unplacedIds()) {
      const cands = candidatesFor(charId);
      if (cands.length === 1) {
        place(charId, cands[0], "directPlacement", 1);
        return true;
      }
      if (cands.length === 0) {
        // Contradiction: caller detects this via candidatesFor returning [] again next pass.
      }
    }
    return false;
  }

  // Tier 2: a row/column with exactly one live cell must hold whoever ends up there, so no
  // one else may use the crossing column/row at any other row/column.
  function applySingleOpenLine(): boolean {
    let any = false;
    for (let r = 0; r < size; r++) {
      if (usedRows.has(r)) continue;
      const open: CellCoord[] = [];
      for (let c = 0; c < size; c++) {
        const cell = { row: r, col: c };
        if (isLiveGlobal(cell)) open.push(cell);
      }
      if (open.length === 1) {
        const forced = open[0];
        const toEliminate: CellCoord[] = [];
        for (let r2 = 0; r2 < size; r2++) {
          if (r2 === r || usedRows.has(r2)) continue;
          toEliminate.push({ row: r2, col: forced.col });
        }
        if (eliminateGlobally(toEliminate, "singleOpenLine", 2)) any = true;
      }
    }
    for (let c = 0; c < size; c++) {
      if (usedCols.has(c)) continue;
      const open: CellCoord[] = [];
      for (let r = 0; r < size; r++) {
        const cell = { row: r, col: c };
        if (isLiveGlobal(cell)) open.push(cell);
      }
      if (open.length === 1) {
        const forced = open[0];
        const toEliminate: CellCoord[] = [];
        for (let c2 = 0; c2 < size; c2++) {
          if (c2 === c || usedCols.has(c2)) continue;
          toEliminate.push({ row: forced.row, col: c2 });
        }
        if (eliminateGlobally(toEliminate, "singleOpenLine", 2)) any = true;
      }
    }
    return any;
  }

  // Tier 3: overloaded rows/columns, generalized to K characters confined to K rows (or
  // columns) between them, including the K=1 "intersecting squares" case of one character
  // confined entirely to a single row or column.
  function applyOverloadedLines(): boolean {
    const remaining = unplacedIds();
    const n = remaining.length;
    if (n === 0 || n > 16) return false; // guard: bitmask subsets stay cheap
    const rowsOf = new Map<string, Set<number>>();
    const colsOf = new Map<string, Set<number>>();
    for (const id of remaining) {
      const cands = candidatesFor(id);
      rowsOf.set(id, new Set(cands.map((c) => c.row)));
      colsOf.set(id, new Set(cands.map((c) => c.col)));
    }

    for (const [dim, setOf] of [
      ["row", rowsOf],
      ["col", colsOf],
    ] as const) {
      for (let mask = 1; mask < 1 << n; mask++) {
        const subset: string[] = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(remaining[i]);
        const union = new Set<number>();
        for (const id of subset) for (const v of setOf.get(id)!) union.add(v);
        if (union.size === 0 || union.size !== subset.length) continue;

        const others = remaining.filter((id) => !subset.includes(id));
        const toEliminate: { charId: string; cell: CellCoord }[] = [];
        for (const other of others) {
          for (const cell of candidatesFor(other)) {
            const v = dim === "row" ? cell.row : cell.col;
            if (union.has(v)) toEliminate.push({ charId: other, cell });
          }
        }
        if (eliminateForCharacters(toEliminate, `overloaded${dim === "row" ? "Rows" : "Cols"}`, 3)) return true;
      }
    }
    return false;
  }

  // Tier 3: relational clues narrow once the character they refer to narrows, even before
  // that character is fully placed. E.g. "diagonal to C" only allows cells diagonal to one of
  // C's remaining candidates; cells outside that union can be ruled out for every other clue.
  function narrowByRef(
    charId: string,
    refId: string,
    cellsFromRef: (refCell: CellCoord) => CellCoord[],
  ): boolean {
    if (placement[charId] !== undefined || placement[refId] !== undefined) return false;
    const refCands = candidatesFor(refId);
    if (refCands.length === 0) return false;
    const allowed = new Set<string>();
    for (const rc of refCands) for (const c of cellsFromRef(rc)) allowed.add(cellKey(c));
    const toEliminate = candidatesFor(charId)
      .filter((c) => !allowed.has(cellKey(c)))
      .map((cell) => ({ charId, cell }));
    return eliminateForCharacters(toEliminate, "relationalNarrowing", 3);
  }

  function applyRelationalNarrowing(): boolean {
    let any = false;
    for (const clue of puzzle.clues) {
      if (clue.kind === "diagonalOf" && "charId" in clue.ref) {
        if (narrowByRef(clue.charId, clue.ref.charId, (rc) => board.diagonalCellsThrough(rc))) any = true;
      } else if (clue.kind === "direction" && "charId" in clue.ref) {
        if (narrowByRef(clue.charId, clue.ref.charId, (rc) => board.cellsInDirection(clue.dir, rc))) any = true;
      } else if (clue.kind === "besideCharacter") {
        if (narrowByRef(clue.charId, clue.otherId, (rc) => board.besideCells(rc))) any = true;
        if (narrowByRef(clue.otherId, clue.charId, (rc) => board.besideCells(rc))) any = true;
      } else if (clue.kind === "sameRoomAs") {
        const roomCells = (rc: CellCoord) => board.room(board.roomOf(rc)?.id ?? "")?.cells ?? [];
        if (narrowByRef(clue.charId, clue.otherId, roomCells)) any = true;
        if (narrowByRef(clue.otherId, clue.charId, roomCells)) any = true;
      }
    }
    return any;
  }

  let progressed = true;
  while (progressed && unplacedIds().length > 0) {
    progressed =
      applyEmptyRooms() ||
      applyDirectPlacement() ||
      applySingleOpenLine() ||
      applyOverloadedLines() ||
      applyRelationalNarrowing();
  }

  const solved = unplacedIds().length === 0;
  const hardestTier = steps.reduce((max, s) => Math.max(max, s.tier), 0);
  const score = steps.reduce((sum, s) => sum + TIER_COST[s.tier], 0);

  return { solved, steps, score, hardestTier };
}
