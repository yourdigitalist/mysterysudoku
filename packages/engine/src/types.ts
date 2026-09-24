// Core data model. See docs/spec.md section 4, overridden where docs/decisions.md differs.
// Matches the shape used by levels/prototype-pack.json: objects carry an explicit cell list
// (not a footprint), and puzzles carry pre-rendered display text alongside the raw clue data.

export interface CellCoord {
  row: number;
  col: number;
}

export type ObjectType = string;
export type FloorType = string;

export interface Cell {
  row: number;
  col: number;
  roomId: string;
  floor: FloorType;
  objectId: string | null;
}

export interface PlacedObject {
  id: string;
  type: ObjectType;
  cells: CellCoord[];
}

export interface Room {
  id: string;
  name: string;
  cells: CellCoord[];
}

export interface Character {
  id: string;
  name: string;
  isTarget: boolean;
  color?: string;
  displayClue?: string;
}

export type ClueRef = { charId: string } | { objectType: ObjectType };

export type Clue =
  | { kind: "inRow"; charId: string; row: number }
  | { kind: "inCol"; charId: string; col: number }
  | { kind: "inRoom"; charId: string; roomId: string }
  | { kind: "notInRoom"; charId: string; roomId: string }
  | { kind: "onObject"; charId: string; objectType: ObjectType }
  | { kind: "besideObject"; charId: string; objectType: ObjectType }
  | { kind: "notBesideObject"; charId: string; objectType: ObjectType }
  | { kind: "onlyOneBesideObject"; charId: string; objectType: ObjectType }
  | { kind: "onFloor"; charId: string; floor: FloorType }
  | { kind: "besideCharacter"; charId: string; otherId: string }
  | { kind: "sameRoomAs"; charId: string; otherId: string }
  | { kind: "aloneInRoom"; charId: string }
  | { kind: "aloneWith"; charId: string; otherId: string }
  | { kind: "inCorner"; charId: string }
  | { kind: "notInCorner"; charId: string }
  | { kind: "diagonalOf"; charId: string; ref: ClueRef }
  | { kind: "direction"; charId: string; dir: "west" | "east" | "north" | "south"; ref: ClueRef }
  | { kind: "edge"; charId: string; side: "top" | "bottom" | "left" | "right" }
  | { kind: "globalCountOnObject"; objectType: ObjectType; count: number }
  | { kind: "globalCountInRoom"; roomId: string; count: number }
  | { kind: "globalEmptyRoom"; roomId: string };

export interface PuzzleMeta {
  seed?: string;
  generatorVersion: string;
  createdAt?: string;
  source?: string;
}

export interface Puzzle {
  id: string;
  caseNumber?: string;
  title?: string;
  size: number;
  themeId: string;
  cells: Cell[][];
  rooms: Room[];
  objects: PlacedObject[];
  characters: Character[];
  clues: Clue[];
  generalClueText?: string[];
  solution: Record<string, CellCoord>;
  answerCharId: string;
  winText?: string;
  hintSteps?: unknown[];
  difficulty: { tier: 1 | 2 | 3 | 4 | 5; score?: number; label?: string };
  meta: PuzzleMeta;
}

/** A partial or full placement of characters onto cells, keyed by character id. */
export type Placement = Partial<Record<string, CellCoord>>;

export type TriState = "true" | "false" | "unknown";
