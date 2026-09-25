import type { Clue, Puzzle } from "@mysterysudoku/engine";
import { objectDef, type Theme } from "./theme.js";

function article(theme: Theme, objectType: string, instanceCount: number): string {
  if (instanceCount === 1) return "the";
  const label = objectDef(theme, objectType).label;
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

function countOfType(puzzle: Puzzle, type: string): number {
  return puzzle.objects.filter((o) => o.type === type).length;
}

function refText(theme: Theme, puzzle: Puzzle, ref: { charId: string } | { objectType: string }): string {
  if ("charId" in ref) {
    return puzzle.characters.find((c) => c.id === ref.charId)!.name;
  }
  const def = objectDef(theme, ref.objectType);
  return `${article(theme, ref.objectType, countOfType(puzzle, ref.objectType))} ${def.label}`;
}

/** Renders the predicate only (no leading "{name} was", no trailing period) so two clues for one
 * character can be joined into one sentence per docs/decisions.md ("was on a sun lounger, and
 * north of the luggage cart."). */
export function renderPredicate(theme: Theme, puzzle: Puzzle, clue: Clue): string {
  switch (clue.kind) {
    case "onObject":
      return `on ${article(theme, clue.objectType, countOfType(puzzle, clue.objectType))} ${objectDef(theme, clue.objectType).label}`;
    case "besideObject":
      return `beside ${article(theme, clue.objectType, countOfType(puzzle, clue.objectType))} ${objectDef(theme, clue.objectType).label}`;
    case "notBesideObject":
      return `not beside ${article(theme, clue.objectType, countOfType(puzzle, clue.objectType))} ${objectDef(theme, clue.objectType).label}`;
    case "inRoom":
      return `in the ${puzzle.rooms.find((r) => r.id === clue.roomId)!.name}`;
    case "inCorner":
      return "in a corner of a room";
    case "besideCharacter":
      return `beside ${puzzle.characters.find((c) => c.id === clue.otherId)!.name}`;
    case "diagonalOf":
      return `diagonal to ${refText(theme, puzzle, clue.ref)}`;
    case "direction":
      return `${clue.dir} of ${refText(theme, puzzle, clue.ref)}`;
    case "aloneWith":
      return `alone with the ${theme.characterRoleNames.answer.toLowerCase()}`;
    default:
      throw new Error(`renderPredicate: no display text for clue kind "${clue.kind}"`);
  }
}

/** Combines a character's clues (1, or 2 on Hard) into the single sentence the app shows on
 * their card (docs/decisions.md). */
export function renderCharacterClue(theme: Theme, puzzle: Puzzle, clues: Clue[]): string {
  const name = puzzle.characters.find((c) => c.id === (clues[0] as { charId: string }).charId)!.name;
  const predicates = clues.map((c) => renderPredicate(theme, puzzle, c));
  return `${name} was ${predicates.join(", and ")}.`;
}

export function renderGlobalClue(theme: Theme, puzzle: Puzzle, clue: Clue): string {
  if (clue.kind === "globalEmptyRoom") {
    return `Nobody was in the ${puzzle.rooms.find((r) => r.id === clue.roomId)!.name}.`;
  }
  if (clue.kind === "globalCountOnObject") {
    return `${clue.count} of them were on ${objectDef(theme, clue.objectType).label}s.`;
  }
  if (clue.kind === "globalCountInRoom") {
    return `${clue.count} of them were in the ${puzzle.rooms.find((r) => r.id === clue.roomId)!.name}.`;
  }
  throw new Error(`renderGlobalClue: no display text for clue kind "${clue.kind}"`);
}

