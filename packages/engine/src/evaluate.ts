import { BoardIndex, sameCell } from "./board.js";
import type { Clue, Placement, Puzzle, TriState } from "./types.js";

function isFullyPlaced(placement: Placement, puzzle: Puzzle): boolean {
  return puzzle.characters.every((c) => placement[c.id] !== undefined);
}

function otherCharactersInRoom(
  placement: Placement,
  roomId: string,
  excludeCharId: string,
  board: BoardIndex,
): string[] {
  const out: string[] = [];
  for (const [charId, cell] of Object.entries(placement)) {
    if (!cell || charId === excludeCharId) continue;
    if (board.roomOf(cell)?.id === roomId) out.push(charId);
  }
  return out;
}

/**
 * Evaluates a single clue against a (possibly partial) placement. Returns "unknown" when the
 * placement doesn't yet contain enough information to decide true or false. See
 * docs/spec.md section 5 and docs/decisions.md for the rulings this must respect.
 */
export function evaluate(clue: Clue, placement: Placement, puzzle: Puzzle, board: BoardIndex): TriState {
  switch (clue.kind) {
    case "inRow": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return cell.row === clue.row ? "true" : "false";
    }

    case "inCol": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return cell.col === clue.col ? "true" : "false";
    }

    case "inRoom": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.roomOf(cell)?.id === clue.roomId ? "true" : "false";
    }

    case "notInRoom": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.roomOf(cell)?.id !== clue.roomId ? "true" : "false";
    }

    case "onObject": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.objectAt(cell)?.type === clue.objectType ? "true" : "false";
    }

    case "besideObject": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.besideObjectCells(cell, clue.objectType).length > 0 ? "true" : "false";
    }

    case "notBesideObject": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.besideObjectCells(cell, clue.objectType).length === 0 ? "true" : "false";
    }

    case "onlyOneBesideObject": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.besideObjectCells(cell, clue.objectType).length === 1 ? "true" : "false";
    }

    case "onFloor": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.cellAt(cell)?.floor === clue.floor ? "true" : "false";
    }

    case "besideCharacter": {
      const a = placement[clue.charId];
      const b = placement[clue.otherId];
      if (!a || !b) return "unknown";
      return board.isBeside(a, b) ? "true" : "false";
    }

    case "sameRoomAs": {
      const a = placement[clue.charId];
      const b = placement[clue.otherId];
      if (!a || !b) return "unknown";
      return board.roomOf(a)?.id === board.roomOf(b)?.id ? "true" : "false";
    }

    case "aloneInRoom": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      const roomId = board.roomOf(cell)!.id;
      const others = otherCharactersInRoom(placement, roomId, clue.charId, board);
      if (others.length > 0) return "false";
      return isFullyPlaced(placement, puzzle) ? "true" : "unknown";
    }

    case "aloneWith": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      const roomId = board.roomOf(cell)!.id;
      const otherCell = placement[clue.otherId];
      if (otherCell && board.roomOf(otherCell)?.id !== roomId) return "false";
      const others = otherCharactersInRoom(placement, roomId, clue.charId, board);
      if (others.some((id) => id !== clue.otherId)) return "false";
      if (others.length === 1) {
        return isFullyPlaced(placement, puzzle) ? "true" : "unknown";
      }
      return "unknown";
    }

    case "inCorner": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.isCorner(cell) ? "true" : "false";
    }

    case "notInCorner": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.isCorner(cell) ? "false" : "true";
    }

    case "diagonalOf": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      const refCell = board.resolveRefCell(clue.ref, placement);
      if (!refCell) return "unknown";
      return board.diagonalCellsThrough(refCell).some((c) => sameCell(c, cell)) ? "true" : "false";
    }

    case "direction": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      const refCell = board.resolveRefCell(clue.ref, placement);
      if (!refCell) return "unknown";
      return board.cellsInDirection(clue.dir, refCell).some((c) => sameCell(c, cell)) ? "true" : "false";
    }

    case "edge": {
      const cell = placement[clue.charId];
      if (!cell) return "unknown";
      return board.isEdge(cell, clue.side) ? "true" : "false";
    }

    case "globalCountOnObject": {
      let count = 0;
      for (const cell of Object.values(placement)) {
        if (cell && board.objectAt(cell)?.type === clue.objectType) count++;
      }
      if (count > clue.count) return "false";
      if (!isFullyPlaced(placement, puzzle)) return "unknown";
      return count === clue.count ? "true" : "false";
    }

    case "globalCountInRoom": {
      let count = 0;
      for (const cell of Object.values(placement)) {
        if (cell && board.roomOf(cell)?.id === clue.roomId) count++;
      }
      if (count > clue.count) return "false";
      if (!isFullyPlaced(placement, puzzle)) return "unknown";
      return count === clue.count ? "true" : "false";
    }

    case "globalEmptyRoom": {
      for (const cell of Object.values(placement)) {
        if (cell && board.roomOf(cell)?.id === clue.roomId) return "false";
      }
      return isFullyPlaced(placement, puzzle) ? "true" : "unknown";
    }
  }
}
