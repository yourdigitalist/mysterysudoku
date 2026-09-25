import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Puzzle } from "@mysterysudoku/engine";
import { renderCharacterClue, renderGlobalClue } from "./clue-text.js";
import type { Theme } from "./theme.js";

/** The shape a level pack ships (spec section 4, extended to match levels/prototype-pack.json:
 * display text alongside the raw clue data, so the app never has to re-derive copy). */
export interface ExportedPuzzle extends Puzzle {
  caseNumber: string;
  title: string;
  characters: (Puzzle["characters"][number] & { displayClue: string })[];
  generalClueText: string[];
  winText: string;
}

export function finalizePuzzle(
  theme: Theme,
  puzzle: Puzzle,
  caseNumber: string,
  title: string,
): ExportedPuzzle {
  const cluesByChar = new Map<string, Puzzle["clues"]>();
  const globalClues: Puzzle["clues"] = [];
  for (const clue of puzzle.clues) {
    if ("charId" in clue) {
      const list = cluesByChar.get(clue.charId) ?? [];
      list.push(clue);
      cluesByChar.set(clue.charId, list);
    } else {
      globalClues.push(clue);
    }
  }

  const characters = puzzle.characters.map((c) => ({
    ...c,
    displayClue: renderCharacterClue(theme, puzzle, cluesByChar.get(c.id) ?? []),
  }));

  const targetChar = puzzle.characters.find((c) => c.isTarget)!;
  const targetRoom = puzzle.rooms.find(
    (r) => r.cells.some((cell) => cell.row === puzzle.solution[targetChar.id].row && cell.col === puzzle.solution[targetChar.id].col),
  )!;
  const answerName = puzzle.characters.find((c) => c.id === puzzle.answerCharId)!.name;
  const winText = `${targetChar.name} was alone with ${answerName} in the ${targetRoom.name}. Nobody else was in the room.`;

  return {
    ...puzzle,
    caseNumber,
    title,
    characters,
    generalClueText: globalClues.map((c) => renderGlobalClue(theme, puzzle, c)),
    winText,
  };
}

export interface LevelPack {
  version: 1;
  puzzles: ExportedPuzzle[];
}

export function writeLevelPack(pack: LevelPack, outPath: string): void {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(pack, null, 1) + "\n", "utf-8");
}

export interface ManifestEntry {
  file: string;
  count: number;
  sizes: number[];
  tiers: Record<number, number>;
}

export function writeManifest(entries: ManifestEntry[], outPath: string, generatorVersion: string): void {
  mkdirSync(path.dirname(outPath), { recursive: true });
  const manifest = { version: 1, generatorVersion, packs: entries };
  writeFileSync(outPath, JSON.stringify(manifest, null, 1) + "\n", "utf-8");
}
