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
