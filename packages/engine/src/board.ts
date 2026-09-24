import type { Cell, CellCoord, ClueRef, ObjectType, Placement, PlacedObject, Puzzle, Room } from "./types.js";

/**
 * Whether each object type blocks a character from standing on it. This lives in the theme
 * (docs/spec.md section 9 ObjectDef.blocking), not in the puzzle JSON, so callers pass it in
 * rather than the engine reading theme files itself (packages/engine has zero fs imports).
 */
export type ObjectBlockingMap = Record<ObjectType, boolean>;

export function cellKey(c: CellCoord): string {
  return `${c.row},${c.col}`;
}

export function sameCell(a: CellCoord, b: CellCoord): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Precomputed lookups over a puzzle's static board (independent of any placement). */
export class BoardIndex {
  readonly puzzle: Puzzle;
  readonly blocking: ObjectBlockingMap;
  private readonly cellByKey = new Map<string, Cell>();
  private readonly roomById = new Map<string, Room>();
  private readonly roomIdByCellKey = new Map<string, string>();
  private readonly objectById = new Map<string, PlacedObject>();
  private readonly objectByCellKey = new Map<string, PlacedObject>();
  private readonly objectsByType = new Map<ObjectType, PlacedObject[]>();
  private readonly blockingCellKeys = new Set<string>();
  private readonly cornerCellKeys = new Set<string>();

  constructor(puzzle: Puzzle, blocking: ObjectBlockingMap = {}) {
    this.puzzle = puzzle;
    this.blocking = blocking;

    for (const row of puzzle.cells) {
      for (const cell of row) {
        this.cellByKey.set(cellKey(cell), cell);
      }
    }

    for (const room of puzzle.rooms) {
      this.roomById.set(room.id, room);
      for (const c of room.cells) this.roomIdByCellKey.set(cellKey(c), room.id);
    }

    for (const obj of puzzle.objects) {
      this.objectById.set(obj.id, obj);
      const list = this.objectsByType.get(obj.type) ?? [];
      list.push(obj);
      this.objectsByType.set(obj.type, list);
      for (const c of obj.cells) {
        this.objectByCellKey.set(cellKey(c), obj);
        if (blocking[obj.type]) this.blockingCellKeys.add(cellKey(c));
      }
    }

    for (const room of puzzle.rooms) {
      for (const c of room.cells) {
        if (this.isCornerOf(c, room)) this.cornerCellKeys.add(cellKey(c));
      }
    }
  }

  get size(): number {
    return this.puzzle.size;
  }

  cellAt(c: CellCoord): Cell | undefined {
    return this.cellByKey.get(cellKey(c));
  }

  inBounds(c: CellCoord): boolean {
    return c.row >= 0 && c.row < this.puzzle.size && c.col >= 0 && c.col < this.puzzle.size;
  }

  roomOf(c: CellCoord): Room | undefined {
    const id = this.roomIdByCellKey.get(cellKey(c));
    return id ? this.roomById.get(id) : undefined;
  }

  room(id: string): Room | undefined {
    return this.roomById.get(id);
  }

  objectAt(c: CellCoord): PlacedObject | undefined {
    return this.objectByCellKey.get(cellKey(c));
  }

  objectsOfType(type: ObjectType): PlacedObject[] {
    return this.objectsByType.get(type) ?? [];
  }

  isBlocking(c: CellCoord): boolean {
    return this.blockingCellKeys.has(cellKey(c));
  }

  isOccupiable(c: CellCoord): boolean {
    return this.inBounds(c) && !this.isBlocking(c);
  }

  isCorner(c: CellCoord): boolean {
    return this.cornerCellKeys.has(cellKey(c));
  }

  /** All cells that are open (occupiable) for someone to stand on. */
  allOccupiableCells(): CellCoord[] {
    const out: CellCoord[] = [];
    for (const row of this.puzzle.cells) {
      for (const cell of row) {
        if (this.isOccupiable(cell)) out.push({ row: cell.row, col: cell.col });
      }
    }
    return out;
  }

  /**
   * A cell is a corner of its room when two perpendicular room boundaries meet there:
   * the neighbour on one of {north,south} is outside the room AND the neighbour on one
   * of {east,west} is outside the room (grid edges count as walls).
   */
  private isCornerOf(c: CellCoord, room: Room): boolean {
    const inRoom = (nc: CellCoord) => this.roomIdByCellKey.get(cellKey(nc)) === room.id;
    const north = inRoom({ row: c.row - 1, col: c.col });
    const south = inRoom({ row: c.row + 1, col: c.col });
    const west = inRoom({ row: c.row, col: c.col - 1 });
    const east = inRoom({ row: c.row, col: c.col + 1 });
    const verticalWall = !north || !south;
    const horizontalWall = !west || !east;
    return verticalWall && horizontalWall;
  }

  /**
   * Cells orthogonally adjacent to `c` AND in the same room. Per spec section 3: "beside" is
   * same-room only, no diagonals, and a wall (room boundary) between two cells breaks it.
   */
  besideCells(c: CellCoord): CellCoord[] {
    const room = this.roomOf(c);
    if (!room) return [];
    const candidates: CellCoord[] = [
      { row: c.row - 1, col: c.col },
      { row: c.row + 1, col: c.col },
      { row: c.row, col: c.col - 1 },
      { row: c.row, col: c.col + 1 },
    ];
    return candidates.filter((nc) => this.inBounds(nc) && this.roomOf(nc)?.id === room.id);
  }

  isBeside(a: CellCoord, b: CellCoord): boolean {
    return this.besideCells(a).some((c) => sameCell(c, b));
  }

  /**
   * Cells beside `c` that hold `objectType`, excluding cells that belong to the SAME object
   * instance as the one `c` itself sits on (docs/decisions.md: sitting on one cell of an
   * object doesn't count as beside another cell of that same object).
   */
  besideObjectCells(c: CellCoord, objectType: ObjectType): CellCoord[] {
    const ownObject = this.objectAt(c);
    return this.besideCells(c).filter((nc) => {
      const obj = this.objectByCellKey.get(cellKey(nc));
      if (!obj || obj.type !== objectType) return false;
      if (ownObject && obj.id === ownObject.id) return false;
      return true;
    });
  }

  /** All cells on either diagonal line through `c`, across the whole grid, walls ignored. */
  diagonalCellsThrough(c: CellCoord): CellCoord[] {
    const out: CellCoord[] = [];
    for (const row of this.puzzle.cells) {
      for (const cell of row) {
        if (sameCell(cell, c)) continue;
        const dr = cell.row - c.row;
        const dc = cell.col - c.col;
        if (Math.abs(dr) === Math.abs(dc)) out.push({ row: cell.row, col: cell.col });
      }
    }
    return out;
  }

  /** Cells strictly in the given compass direction from `c`, any row/column past it. */
  cellsInDirection(dir: "north" | "south" | "east" | "west", c: CellCoord): CellCoord[] {
    const out: CellCoord[] = [];
    for (const row of this.puzzle.cells) {
      for (const cell of row) {
        switch (dir) {
          case "north":
            if (cell.row < c.row) out.push({ row: cell.row, col: cell.col });
            break;
          case "south":
            if (cell.row > c.row) out.push({ row: cell.row, col: cell.col });
            break;
          case "west":
            if (cell.col < c.col) out.push({ row: cell.row, col: cell.col });
            break;
          case "east":
            if (cell.col > c.col) out.push({ row: cell.row, col: cell.col });
            break;
        }
      }
    }
    return out;
  }

  isEdge(c: CellCoord, side: "top" | "bottom" | "left" | "right"): boolean {
    switch (side) {
      case "top":
        return c.row === 0;
      case "bottom":
        return c.row === this.puzzle.size - 1;
      case "left":
        return c.col === 0;
      case "right":
        return c.col === this.puzzle.size - 1;
    }
  }

  /**
   * Resolves a ClueRef against a placement. A character ref resolves to that character's cell
   * (or undefined if not yet placed). An object-type ref resolves to the single cell of that
   * object type, per docs/decisions.md: direction/diagonal refs only ever name characters or
   * single-cell objects that appear once on the map, so this is unambiguous when it applies.
   */
  resolveRefCell(ref: ClueRef, placement: Placement): CellCoord | undefined {
    if ("charId" in ref) {
      return placement[ref.charId];
    }
    const objs = this.objectsOfType(ref.objectType);
    if (objs.length !== 1 || objs[0].cells.length !== 1) return undefined;
    return objs[0].cells[0];
  }
}

export function charactersInRoom(placement: Placement, roomId: string, board: BoardIndex): string[] {
  const out: string[] = [];
  for (const [charId, cell] of Object.entries(placement)) {
    if (!cell) continue;
    if (board.roomOf(cell)?.id === roomId) out.push(charId);
  }
  return out;
}
