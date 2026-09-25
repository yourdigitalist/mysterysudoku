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

## M2 generator decisions (this session)

- **Theme content additions.** `theme.json` had no room-type→floor/object mapping and no object footprint/allowedFloors data (spec section 9's example theme has both; the actual file didn't). Added `roomTypes` (14 types, one per floor, covering all 51 object types with sensible allowedFloors) and per-object `footprints`/`allowedFloors`, plus a `characterNames` pool (themed given names per letter A-N) since the generator needs real names, not bare letters, for display text. These are content additions, not rules changes — logged here rather than as an open question since they were necessary to unblock the build, not ambiguous.
- **Generator-emitted clue kinds are a subset of the engine's.** The candidate pool only ever produces `onObject`, `besideObject`, `notBesideObject`, `inRoom`, `inCorner`, `besideCharacter`, `diagonalOf`, `direction` (plus the fixed `aloneWith` and global `globalEmptyRoom`) — the kinds with display templates in `theme.json` and the kinds the 9 prototype-pack puzzles actually use. `inRow`, `inCol`, `onFloor`, `sameRoomAs`, `aloneInRoom`, `notInCorner`, `edge`, `globalCountOnObject`, `globalCountInRoom` remain fully supported by the engine (for hand-authored puzzles) but the generator won't emit them without new display templates and copy review.
- **Clue selection: greedy reduction from the maximal true clue set, not random sampling.** Random single-clue-per-character sampling (the obvious first approach) has a near-zero success rate on some room layouts — a 5x5 map with few rooms can have a 0% chance across thousands of random draws, because the ambiguity needs *specific combinations* across multiple characters' clues, not just a lucky single clue. Instead, `selectClues` starts every character at their full candidate pool (already unique almost by construction, since it's every true fact about the solution) and greedily shrinks each character down to 1 clue (falling back to 2, and retrying a few processing orders before conceding — docs already allowed 2 clues on Hard; this session found it sometimes takes 2 *different* characters getting 2 clues each, matching "Case 09 does this for two suspects").
- **A puzzle attempt gets a hard wall-clock budget (`generatePuzzle`'s `budgetMs`, default 6s — see timing note below), shared across every map attempt for that seed.** Earlier versions had no cap: a handful of seeds (usually 8x8/9x9, rarely 6x6) turn out to need combinatorially many solver checks to find a working clue combination, or to prove none exists, and would otherwise run for 10-25+ seconds on a single seed. Since regenerating the map and trying a fresh seed is nearly free (`buildMap` is a few ms) and a different random layout is often much easier, capping the time per seed and moving on (same as any other rejected seed) is far more productive than letting one hard seed grind. `maxMapAttempts` is set high (60) and effectively unused as a real limit — the deadline is what actually bounds the work.
- **Engine-level fix found while chasing generator slowness: `BoardIndex.diagonalCellsThrough`/`cellsInDirection` now memoize per reference cell.** Both previously rescanned the whole board (O(size²)) on every call; clue evaluation calls them repeatedly for the same reference cell (once per candidate cell, per character, per solver pass), and puzzles with several `diagonalOf`/`direction` clues made this the dominant cost. Caching is safe because `BoardIndex` is built once per static board and never mutated. This is a `packages/engine` change (`board.ts`), not generator-only, so it also speeds up the app's future in-game solver calls (hints) on any puzzle with these clue kinds.
- **Generation timing: not fully at spec's "under 2s per 9x9 puzzle" target, and honestly, it isn't close for 8x8/9x9 specifically.** After the fixes above, a 30-puzzle mixed-size (5x5-9x9) batch ran in 120s total (~4s/puzzle average, 62 attempts for 30 successes — 32 rejected, overwhelmingly 7x7-9x9 seeds hitting the 6s per-seed budget). 5x5/6x6 puzzles generate in well under a second almost always; 7x7 is usually a couple seconds; 8x8/9x9 fail their first seed roughly half the time (hit the budget, get skipped, next seed tried) before succeeding on a later one. The full 500-puzzle acceptance run (spec section 12's M2 criteria) took about [FILL IN: elapsed] for [FILL IN: N] puzzles across 5x5-9x9; see `gen:stats` output below for the tier/size spread. Two honest paths to actually hitting 2s/9x9: (1) speed up the underlying solver further (the diagonal/direction cache above was one such win; `countSolutions`/`solveLogically`'s per-candidate clue scan is still O(clues) per cell per character and could use similar per-clue-kind indexing), or (2) tune the clue-pool weighting so 8x8/9x9 puzzles lean on cheaper-to-evaluate clue kinds (onObject/besideObject/inRoom) more and diagonal/direction less. Neither attempted this session given the time already spent; flagging for the next one.
