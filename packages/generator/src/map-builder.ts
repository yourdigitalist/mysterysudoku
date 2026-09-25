import type { Cell, CellCoord, PlacedObject, Room } from "@mysterysudoku/engine";
import { Rng } from "./rng.js";
import type { Theme, ThemeRoomType } from "./theme.js";

export interface BuiltMap {
  cells: Cell[][];
  rooms: Room[];
  objects: PlacedObject[];
}

const MIN_ROOM_CELLS = 3;

/**
 * Builds a random floor plan for an N x N grid (spec section 7 step 1): irregular connected
 * rooms via region growing, floor types and objects from the theme, and a validity check that
 * every row and column keeps at least one non-blocking cell. Retries internally on failure.
 */
export function buildMap(rng: Rng, theme: Theme, size: number, maxAttempts = 40): BuiltMap {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const map = tryBuildMap(rng, theme, size);
    if (map) return map;
  }
  throw new Error(`buildMap: failed to build a valid ${size}x${size} map after ${maxAttempts} attempts`);
}

function tryBuildMap(rng: Rng, theme: Theme, size: number): BuiltMap | null {
  // Spec says "roughly N/2 to N"; bias toward the top of that range so clues like "in the X
  // room" stay informative and no single room ends up dominating the board (see decisions.md).
  const roomCount = rng.range(Math.max(3, Math.ceil(size * 0.7)), Math.max(3, size));
  const roomIdxGrid = growRooms(rng, size, roomCount);
  const cellsByRoom = groupCellsByRoom(roomIdxGrid, size, roomCount);

  if (cellsByRoom.some((cells) => cells.length < MIN_ROOM_CELLS)) return null;

  const chosenTypes = pickRoomTypes(rng, theme, cellsByRoom.length);
  const usedNames = new Set<string>();
  const rooms: Room[] = cellsByRoom.map((cells, i) => {
    const rt = chosenTypes[i];
    const name = pickRoomName(rng, rt, usedNames);
    usedNames.add(name);
    return { id: `R${i}`, name, cells };
  });

  const floorOf: string[] = chosenTypes.map((rt) => rt.floor);
  const cells: Cell[][] = [];
  for (let r = 0; r < size; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < size; c++) {
      const roomIdx = roomIdxGrid[r][c];
      row.push({ row: r, col: c, roomId: rooms[roomIdx].id, floor: floorOf[roomIdx], objectId: null });
    }
    cells.push(row);
  }

  const objects = placeObjects(rng, theme, cells, rooms, chosenTypes);

  if (!hasOpenLineInEveryRowAndCol(cells, objects, theme, size)) return null;

  return { cells, rooms, objects };
}

/**
 * Multi-source random region growing. Starts from `roomCount` random seed cells and, at every
 * step, grows whichever room is currently SMALLEST (random tie-break) by one random cell off its
 * own frontier. Always advancing the smallest room keeps sizes naturally balanced — like a
 * simultaneous flood fill — without a magic cap that a landlocked room's neighbors could still
 * blow through; boundaries stay irregular because of the random tie-breaks and cell choices.
 */
function growRooms(rng: Rng, size: number, roomCount: number): number[][] {
  const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));
  const seeds: CellCoord[] = [];
  while (seeds.length < roomCount) {
    const cell = { row: rng.int(size), col: rng.int(size) };
    if (!seeds.some((s) => s.row === cell.row && s.col === cell.col)) seeds.push(cell);
  }
  const frontiers: CellCoord[][] = seeds.map((s) => [s]);
  const roomSize = Array(roomCount).fill(1);
  seeds.forEach((seed, i) => {
    grid[seed.row][seed.col] = i;
  });

  const neighbors = (c: CellCoord): CellCoord[] =>
    [
      { row: c.row - 1, col: c.col },
      { row: c.row + 1, col: c.col },
      { row: c.row, col: c.col - 1 },
      { row: c.row, col: c.col + 1 },
    ].filter((n) => n.row >= 0 && n.row < size && n.col >= 0 && n.col < size);
  const hasUnassignedNeighbor = (c: CellCoord) => neighbors(c).some((n) => grid[n.row][n.col] === -1);

  let remaining = size * size - roomCount;
  while (remaining > 0) {
    const active: number[] = [];
    for (let i = 0; i < roomCount; i++) {
      frontiers[i] = frontiers[i].filter(hasUnassignedNeighbor);
      if (frontiers[i].length > 0) active.push(i);
    }
    if (active.length === 0) break; // unreachable pockets shouldn't happen on a connected grid

    const minSize = Math.min(...active.map((i) => roomSize[i]));
    const roomIdx = rng.pick(active.filter((i) => roomSize[i] === minSize));
    const cell = rng.pick(frontiers[roomIdx]);
    const unassigned = neighbors(cell).filter((n) => grid[n.row][n.col] === -1);
    const next = rng.pick(unassigned);

    grid[next.row][next.col] = roomIdx;
    roomSize[roomIdx]++;
    frontiers[roomIdx].push(next);
    remaining--;
  }

  return grid;
}

function groupCellsByRoom(grid: number[][], size: number, roomCount: number): CellCoord[][] {
  const out: CellCoord[][] = Array.from({ length: roomCount }, () => []);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      out[grid[r][c]].push({ row: r, col: c });
    }
  }
  return out;
}

function pickRoomTypes(rng: Rng, theme: Theme, count: number): ThemeRoomType[] {
  const out: ThemeRoomType[] = [];
  while (out.length < count) {
    const batch = rng.shuffle(theme.roomTypes);
    for (const rt of batch) {
      if (out.length >= count) break;
      out.push(rt);
    }
  }
  return rng.shuffle(out);
}

function pickRoomName(rng: Rng, rt: ThemeRoomType, used: Set<string>): string {
  const available = rt.names.filter((n) => !used.has(n));
  if (available.length > 0) return rng.pick(available);
  let i = 2;
  let candidate = `${rt.names[0]} ${i}`;
  while (used.has(candidate)) {
    i++;
    candidate = `${rt.names[0]} ${i}`;
  }
  return candidate;
}

function placeObjects(
  rng: Rng,
  theme: Theme,
  cells: Cell[][],
  rooms: Room[],
  chosenTypes: ThemeRoomType[],
): PlacedObject[] {
  const objects: PlacedObject[] = [];
  let nextId = 0;

  rooms.forEach((room, roomIdx) => {
    const rt = chosenTypes[roomIdx];
    const floor = rt.floor;
    const candidateTypes = rt.objects
      .map((type) => theme.objects.find((o) => o.type === type)!)
      .filter((def) => !def.allowedFloors || def.allowedFloors.includes(floor));
    if (candidateTypes.length === 0) return;

    const targetCount = rng.range(0, Math.min(3, Math.max(1, Math.floor(room.cells.length / 3))));
    const roomCellSet = new Set(room.cells.map((c) => `${c.row},${c.col}`));

    for (let placed = 0; placed < targetCount; placed++) {
      const def = rng.pick(candidateTypes);
      const orientations = def.footprints.flatMap((fp) =>
        fp.w === fp.h ? [fp] : [fp, { w: fp.h, h: fp.w }],
      );

      let didPlace = false;
      for (let attempt = 0; attempt < 15 && !didPlace; attempt++) {
        const fp = rng.pick(orientations);
        const anchor = rng.pick(room.cells);
        const footprintCells: CellCoord[] = [];
        for (let dr = 0; dr < fp.h; dr++) {
          for (let dc = 0; dc < fp.w; dc++) {
            footprintCells.push({ row: anchor.row + dr, col: anchor.col + dc });
          }
        }
        const fits = footprintCells.every((c) => {
          const key = `${c.row},${c.col}`;
          if (!roomCellSet.has(key)) return false;
          return cells[c.row][c.col].objectId === null;
        });
        if (!fits) continue;

        const id = `o${nextId++}`;
        for (const c of footprintCells) cells[c.row][c.col].objectId = id;
        objects.push({ id, type: def.type, cells: footprintCells });
        didPlace = true;
      }
    }
  });

  return objects;
}

function hasOpenLineInEveryRowAndCol(
  cells: Cell[][],
  objects: PlacedObject[],
  theme: Theme,
  size: number,
): boolean {
  const blockingTypes = new Set(theme.objects.filter((o) => o.blocking).map((o) => o.type));
  const blockingByObjectId = new Map<string, boolean>();
  for (const obj of objects) blockingByObjectId.set(obj.id, blockingTypes.has(obj.type));

  const isBlocking = (cell: Cell): boolean => (cell.objectId ? (blockingByObjectId.get(cell.objectId) ?? false) : false);

  for (let r = 0; r < size; r++) {
    if (!cells[r].some((cell) => !isBlocking(cell))) return false;
  }
  for (let c = 0; c < size; c++) {
    if (!cells.some((row) => !isBlocking(row[c]))) return false;
  }
  return true;
}
