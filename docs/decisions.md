# Decisions from the prototype

These were settled while building the clickable prototype in Cowork. They extend or override `spec.md`. Where the two disagree, this file wins.

## Content rules

- **Victim clue is fixed.** The victim's card always reads "{name} was alone with the murderer." Nothing else. The victim never gets a normal clue.
- **Character names follow the alphabet.** In every puzzle, names start with A and continue in order (A, B, C...). The victim is always the last letter. Initials are the token letters, so they must be unique per puzzle.
- **One clue per character** on Easy and Medium. Hard levels may give a character two clues when the generator can't find a one-clue solution (Case 09 does this for two suspects). The card shows both in one sentence: "was on a sun lounger, and north of the luggage cart."
- **General clues** ("Nobody was in the X") are shown in a banner above the board, one per line.
- **No em dashes** in any player-facing copy. Keep copy short and plain.

## Keyword rulings added

- **North / south / east / west of X** means any row or column past X, not just the next one. Direction clues only reference characters or single-cell objects that appear once on the map (never a multi-cell object like a sofa, since "west of the sofa" is ambiguous).
- **Beside an object** does not count other cells of the object the character is standing on. Someone on a bench cell is not "beside a bench" because of the other bench cell. This generalises the chair ruling in spec section 3.
- **Diagonal to** covers both diagonals across the whole board, walls ignored.

## Controls (changed from spec section 11)

- **Place mode is the default tool.** Tap a cell to place the selected suspect. Tap again to pick them up. Press and hold still places in any mode. Playtesting showed hold-only placement was undiscoverable.
- Tools row: Place, Note, Mark X, Erase (hold to clear board), Undo, Hint.
- **Auto-X** (default on): placing someone draws a faint X on every open cell in their row and column. Manual X marks are darker so both read differently.
- **Notes are cleared** when a cell gets crossed out: placing someone wipes notes in that row and column; marking a cell X wipes its notes.
- Tapping a blocked cell shakes it and vibrates.

## Checking and winning

- "Close the case" is enabled once everyone is placed.
- Wrong: an "INCORRECT" stamp lands on the board for ~1.8 s plus a message with how many are misplaced.
- Right: a red "CASE CLOSED" stamp lands, then the win card opens after ~1.4 s (murderer reveal, time, hints). The board locks and the stamp stays when the case is reopened.

## Hints

Three levels per step, as in the spec: 1) name the suspect to look at, 2) explain why, 3) place them. If a placed suspect is wrong, the hint says so first. Hint text for Cases 01 to 03 is hand-written; 04 to 09 is generated from the solver trace and reads plainer. The real app should generate this text from the logical solver's step list.

## Casebook (level select)

- Home screen lists all cases as cards: mini floor-plan thumbnail, case number, title, difficulty pill, grid size, suspect count, status (New / In progress with time / Closed with time). Solved cases get a small "Closed" stamp on the thumbnail.
- Filters: Difficulty (All, Easy, Medium, Hard) and Status (All, Unsolved, Solved). Empty state with "Clear filters".
- Progress bar: X of Y cases closed.
- **Progress persists** per case: placements, notes, X marks, time, hints used, solved flag. The prototype used localStorage; the app uses MMKV per spec.

## Visual direction ("cosy noir")

- Background #17141C, surfaces #221D28 / #1E1A24, borders #342C3B, paper #F1E8D8, text #EDE6DA, muted #A59CAE, brass accent #D4A55A, stamp red #A8322A.
- Type: Fraunces (display) over Manrope (body).
- Floors add metal, carpet, marble, snow and sand to the spec list. Every floor has a pattern so colour is never the only cue.
- Board is ~350 px wide on a 390 px phone. 12x12 cells get tight (~29 px); plan pinch-zoom for 9x9 and up.

## Open questions for Marina

- Keep the two-clue exception on Hard, or push the generator harder for one-clue 12x12 puzzles?
- Grid ceiling: the spec says 4 to 9, the prototype has a 12x12. Confirm the max.
- Should the hint also highlight ruled-out cells on the board (spec's hint 2), or is the explanation text enough?
- **`onlyOneBesideObject` clue meaning.** Spec section 4 lists this clue kind but never defines it in section 3's keyword table, and it doesn't appear in any of the 9 prototype-pack puzzles. The engine (M1) implements it as "exactly one beside cell has that object type", the natural counterpart to "beside" meaning "at least one". Confirm this reading before the generator ever emits it.

## M1 engine decisions (this session)

- **Blocking is theme data, not puzzle data.** `levels/prototype-pack.json` puzzles store objects as `{id, type, cells}` with no `blocking` flag; that flag only lives in `theme.json`'s object defs. So `packages/engine`'s solvers (`countSolutions`, `solveLogically`) take an `ObjectBlockingMap` (`{[objectType]: boolean}`) as an explicit parameter instead of reading a theme file (keeps the engine at zero dependencies, no fs imports). The generator and app build this map once from the loaded theme and pass it in. `evaluate()` itself never needs it.
- **Grid ceiling left open in the engine.** Since `docs/decisions.md` already flags the 4-9 vs 12x12 question as unresolved, the engine does not hardcode a max size; `BoardIndex` and both solvers work for any N x N puzzle, including the 12x12 fixture.
- **Logical solver technique set (tier 1-3).** Implemented: direct placement, row/column elimination, single-open-line (a row/column with exactly one structurally open cell forces its crossing line closed for everyone else), room counting (`globalEmptyRoom`), a generalized overloaded-rows/columns technique (bitmask subset lock over any K characters, which also covers the K=1 "one character confined to a single row/column" case of "intersecting squares"), and relational narrowing (a clue like "diagonal to C" restricts the clue-holder to cells reachable from any of C's *remaining candidates*, not just C's final cell, once C is unplaced but narrowed). This combination fully solves all 9 prototype-pack puzzles, including the three tier-4-labeled ones (their difficulty comes from grid size/clue count, not from needing genuine tier-4/5 "alone"-based room-locking beyond what room counting + relational narrowing already give). Classic "intersecting squares" via two crossing multi-cell objects and tier 4/5 contradiction-chain search are not separately implemented; if a future generator run produces a puzzle these 9 fixtures don't exercise and `solveLogically` can't finish it, that's the first place to extend.
- **`solveLogically`'s per-technique cell elimination is scoped per character where it must be.** Early version used one global "no longer possible" cell set applied uniformly to every character; that's correct for room-counting and single-open-line (genuinely global facts) but wrong for the overloaded-rows/columns and relational-narrowing techniques, which only rule a cell out for characters *outside* a locked subset while it stays valid for the subset itself. Fixed by splitting into `globalEliminated` (everyone) and `perCharEliminated` (named characters only).
