# Logic Deduction Puzzle Game: Build Spec for Cursor

Working title: TBD. Launch theme: **murder mystery** (suspects, victim, murderer, house floor plans). More themes ship later as paid bundles (see section 15). All theme words (suspects, victim, rooms, furniture names) live in config files so new themes need zero changes to game logic.

---

## 1. What we're building

A mobile puzzle game where the player places N characters on an N x N floor plan using logic clues. Every puzzle has exactly one solution and can be solved by pure deduction, without guessing.

Two separate deliverables share one core engine:

1. **Level generator** (offline, Node CLI). Generates, verifies, grades, and exports puzzles as JSON level packs.
2. **Mobile app** (iOS + Android). Loads the JSON packs and lets people play them.

Build order: engine first, generator second, app third. Do not start the app until the generator reliably outputs valid puzzles.

---

## 2. Tech stack

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript (strict mode) | One language across engine, generator, and app |
| Core engine | Pure TS package, zero dependencies, no UI code | Shared by generator and app, easy to unit test |
| Generator | Node CLI (`tsx` or compiled) | Runs offline, can generate thousands of levels |
| App | Expo (React Native) | One codebase for iOS and Android, fast iteration |
| Grid rendering | `react-native-skia` or plain RN Views | Skia if we want animation later |
| Local storage | `react-native-mmkv` | Fast progress saving |
| Tests | Vitest | Engine and generator tests |

Repo layout (monorepo, pnpm workspaces):

```
/packages
  /engine        # types, rules, clue evaluation, solvers
  /generator     # map builder, clue builder, CLI, level pack export
  /app           # Expo app
/themes
  /murder-mystery  # launch theme config JSON + art assets
/levels          # generated level packs (JSON), committed
```

---

## 3. Core rules (the game logic)

These rules are universal. Themes only rename things.

1. The board is an N x N grid (N from 4 to 9).
2. There are N characters. Each gets placed on exactly one cell.
3. **Exactly one character per row and one per column.**
4. The grid is divided into **rooms** (irregular regions of connected cells). Rooms can hold any number of characters, including zero.
5. Cells can contain **objects**. Objects are either:
   - **Blocking**: a character cannot stand there (e.g. table, shelf, plant, TV).
   - **Occupiable**: a character can stand there and counts as "on" it (e.g. chair, bed, carpet).
6. Every character has one or more **clues** about where they are.
7. There may also be **general clues** that apply to the whole board.
8. **Special character rule (the twist):** one character is the "target". The target was alone in a room with exactly one other character. That other character is the answer the player must identify. (In a murder theme: victim + murderer.)
9. The puzzle is solved when all N characters are placed correctly.

### Keywords (must be implemented exactly and consistently)

Every keyword below appears in clue text and in the in-app "Keywords" help tab (section 11). The engine and the help screen must use the same definitions.

| Keyword | Definition |
|---|---|
| **beside** | The cell directly left, right, above or below, **and in the same room**. No diagonals. A wall between two cells means they are not beside each other. |
| **on / in / sitting in** | The character's cell contains that occupiable object or floor type. |
| **beside an object** | At least one cell that is beside the character (per the rule above) contains that object. |
| **alone** | Nobody else was in the room. That includes the victim. |
| **alone with (X)** | Only the character and X were in the room. |
| **empty area** | A room where nobody was, including the victim. |
| **corner** | A cell where two walls of its room meet at a right angle (the cell has a room boundary on two perpendicular sides). Grid edges count as walls. |
| **diagonal of (X)** | Any cell on either diagonal line passing through X's cell, across the whole grid. Room walls don't matter. |
| **row** | A horizontal line of cells across the whole grid. |
| **column** | A vertical line of cells across the whole grid. |
| **west of (X)** | Any cell in a column to the left of X, in any row. |
| **east of (X)** | Any cell in a column to the right of X, in any row. |
| **north of (X)** | Any cell in a row above X, in any column. |
| **south of (X)** | Any cell in a row below X, in any column. |

`X` can be a character or an object type, unless the clue kind says otherwise.

### Rulings (these answer the in-app FAQ and must match engine behavior)

- "Someone", "person" and "nobody" **include the victim**.
- Clues are always true. There is always exactly one solution. The player never has to guess.
- Portraits carry no information. Deductions come from clues only. (Pronouns he/she in clue text are just grammar, the generator never relies on them.)
- "Beside a shelf" means **at least one**. The character can be beside several shelves.
- Every floor type is occupiable unless the theme marks it blocking (so water, grass, tile etc. are all fine by default).
- Multi-cell objects (bed, car, boat, long table) count as **several cells**. Each cell is "on" the object. Being beside any cell of it counts as being beside it.
- A character sitting in a chair **does not** count as beside that same chair. They count as beside a chair only if a neighboring cell (same room) holds a chair. The chair they sit in is not their neighbor.
- A character "beside a chair" may also be sitting in a different chair, as long as a neighboring chair exists.

---

## 4. Data model

```ts
type CellCoord = { row: number; col: number };

type ObjectType = string;           // "chair", "bed", "plant"... defined by theme
type FloorType = string;            // "wood", "tile", "carpet"... defined by theme

interface ObjectDef {
  type: ObjectType;
  blocking: boolean;
  footprint: { w: number; h: number } | { cells: [number, number][] }; // rectangle, or custom shape like an L-carpet
  allowedFloors?: FloorType[];   // e.g. boat: ["water"]
  emoji: string;                 // placeholder art
  color?: string;                // shape fill for occupiable multi-tile objects
}

interface FloorDef {
  type: FloorType;
  color: string;
  pattern?: "planks" | "checker" | "waves" | "dots" | "grid" | "blocks";
  blocking?: boolean;            // default false
}

interface PlacedObject {
  id: string;
  type: ObjectType;
  origin: CellCoord;
  rotation: 0 | 90;
}

interface Cell {
  row: number;
  col: number;
  roomId: string;
  floor: FloorType;
  objectId: string | null;
}

interface Room {
  id: string;
  name: string;          // from theme
  cells: CellCoord[];
}

interface Character {
  id: string;
  name: string;          // from theme
  isTarget: boolean;
}

type Clue =
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
  | { kind: "aloneWith"; charId: string; otherId: string } // victim + murderer is the default use
  | { kind: "inCorner"; charId: string }
  | { kind: "notInCorner"; charId: string }
  | { kind: "diagonalOf"; charId: string; ref: { charId: string } | { objectType: ObjectType } }
  | { kind: "direction"; charId: string; dir: "west" | "east" | "north" | "south"; ref: { charId: string } | { objectType: ObjectType } }
  | { kind: "edge"; charId: string; side: "top" | "bottom" | "left" | "right" }
  | { kind: "globalCountOnObject"; objectType: ObjectType; count: number }
  | { kind: "globalCountInRoom"; roomId: string; count: number }
  | { kind: "globalEmptyRoom"; roomId: string };

interface Puzzle {
  id: string;
  size: number;
  themeId: string;
  cells: Cell[][];
  rooms: Room[];
  objects: PlacedObject[];
  characters: Character[];
  clues: Clue[];
  solution: Record<string, CellCoord>; // charId -> cell
  answerCharId: string;                // who was alone with the target
  difficulty: { tier: 1 | 2 | 3 | 4 | 5; score: number };
  meta: { seed: string; generatorVersion: string; createdAt: string };
}
```

Clues store data only. Display text is rendered from templates in the theme file (see section 9). This keeps translation and re-theming easy.

---

## 5. Engine: clue evaluation

For each clue kind, implement:

```ts
evaluate(clue: Clue, placement: Partial<Record<string, CellCoord>>, puzzle: Puzzle): "true" | "false" | "unknown"
```

- Returns `"unknown"` when the placement isn't complete enough to decide.
- Needed by both solvers and by the app's "check" button.
- Unit test every clue kind with at least 3 true and 3 false cases.

---

## 6. Engine: two solvers

### 6a. Exact solver (uniqueness check)

- Backtracking search with constraint propagation.
- Represent each character's possible cells as a bitmask (81 bits max, use two 64-bit numbers or a `BigInt`, or a `Uint32Array`).
- Pre-filter candidates per character using single-character clues (row, col, room, onObject, besideObject, edge, floor, blocking cells).
- Search: pick the character with fewest candidates, try each, enforce row/col uniqueness, re-check multi-character clues.
- API: `countSolutions(puzzle, limit = 2): number`. Stop at 2. We only care about 0, 1, or "more than 1".
- Target: under 50 ms for a 9x9 on a laptop.

### 6b. Logical solver (difficulty + hints)

A human-style solver that applies deduction techniques in order of difficulty and never guesses. Each technique has a cost.

| Tier | Technique | Example |
|---|---|---|
| 1 | Direct placement | Only one cell matches a character's clues |
| 1 | Row/column elimination | Character placed, remove its row and column from everyone else |
| 2 | Single open cell in a row or column | Column 1 has objects everywhere except one cell, so *someone* stands there even if we don't know who yet. Mark that cell as occupied-by-unknown and eliminate the rest of its row. |
| 2 | Room counting | General clue says a room is empty, eliminate its cells |
| 3 | Overloaded rows/columns (pairs, triples) | A can only be in row 1 cols 1-2, B only in row 2 cols 1-2. A and B fill columns 1 and 2 between them, so nobody else can be in those columns. Generalize to K characters locked into K rows or K columns. |
| 3 | Intersecting squares | If every candidate cell of A lines up (same row or column) with a cell Z, nobody else can stand on Z. Classic case: A has two candidates at opposite corners of a rectangle, so the other two corners are blocked. Also applies when a character is confined to one of two multi-cell objects that cross. |
| 3 | Relational clues | "Beside X", "west of X", "diagonal of X" narrow once X's candidates narrow |
| 4 | Target-rule deduction | Using "alone" / "alone with" / "empty area" to lock down a room |
| 5 | Contradiction chains | "If A goes here, B has no cell left" (limited depth, max 2) |

Tiers 1 to 3 are exactly the techniques explained in the in-app "Advanced" tab. Tier 4 and 5 puzzles should be rare and only appear in Hard/Expert packs.

API:
```ts
solveLogically(puzzle): {
  solved: boolean;
  steps: { technique: string; charId?: string; eliminated: CellCoord[]; placed?: CellCoord }[];
  score: number;          // sum of technique costs
  hardestTier: number;
}
```

This same step list powers the **hint system** in the app: a hint shows the next step.

A puzzle ships only if the logical solver fully solves it. If only the exact solver can solve it, the puzzle requires guessing and is rejected.

---

## 7. Generator pipeline

Run per puzzle with a seeded RNG (use `seedrandom` or a small mulberry32) so every puzzle is reproducible from its seed.

### Step 1: Build the map
1. Split the grid into R rooms (R roughly N/2 to N) using random region growing from seed cells. Rooms must be connected and at least 3 cells.
2. Assign floor types per room from the theme (e.g. bathroom gets tile).
3. Place objects room by room using theme rules (e.g. beds only in bedrooms, 1 to 2 per bedroom). Respect footprints, no overlaps.
4. Validity check: every row and every column must keep at least one non-blocking cell. If not, retry.

### Step 2: Place the solution
1. Generate a random permutation for columns (row i gets column p[i]), skipping blocking cells. Retry until valid.
2. Randomly assign characters to those cells.
3. Pick a target character. Check the twist holds: exactly one other character shares the target's room and nobody else is in it. If no room works, re-place.

### Step 3: Build the clue pool
For every character, generate every true clue about them from the solution (all clue kinds). Also generate true global clues. This is the candidate pool, often 100+ clues.

Weight clues by how "nice" they read. Row/column clues are weak and boring, use them sparingly. Object and relational clues are preferred.

### Step 4: Select clues
1. Rule: every character gets exactly one clue (matches the reference game's feel). Global clues: 0 to 2. Make this configurable (`cluesPerCharacter: 1 | "1-2"`).
2. Randomly choose one clue per character plus optional globals.
3. Run exact solver.
   - 1 solution: continue.
   - More than 1: swap the weakest clue for a stronger one, or add a global clue. Retry up to K times, then regenerate the map.
   - 0 solutions: bug. Log and throw.
4. Run logical solver. If it can't finish, swap clues and retry.
5. Minimize: try removing each global clue. If still unique and logically solvable, drop it.

### Step 5: Grade
- Difficulty score from the logical solver.
- Map to tier 1 to 5 using thresholds that also factor grid size. Tune thresholds after generating ~500 puzzles and looking at the distribution.

### Step 6: Export
- Write puzzles into level packs: `/levels/pack-01.json` etc. Each pack is sorted by difficulty.
- Include a `manifest.json` listing packs, counts, and version.

### CLI
```
pnpm gen --size 6 --count 200 --tier 2 --seed abc --out levels/pack-02.json
pnpm gen:stats levels/pack-02.json      # difficulty histogram, clue type mix, rejection rate
pnpm gen:render levels/pack-02.json 14  # render puzzle #14 as ASCII in terminal for QA
```

---

## 8. Level progression (initial proposal, tune later)

| Stage | Grid | Tiers | Levels |
|---|---|---|---|
| Tutorial | 4x4 | 1 | 5 (hand-picked, one new concept each) |
| Easy | 5x5 | 1 to 2 | 30 |
| Medium | 6x6 | 2 to 3 | 40 |
| Hard | 7x7 | 3 to 4 | 40 |
| Expert | 8x8, 9x9 | 4 to 5 | 40 |
| Daily puzzle | rotating | mixed | generated in advance, 365 per year |

---

## 9. Theme layer

All theme content in `/themes/<themeId>/theme.json` plus an `/assets` folder.

Launch theme folder: `/themes/murder-mystery`. Future themes (heist, cat café, office, haunted mansion, wedding, spy hotel) each get their own folder. A theme can also mix content from others (e.g. a haunted heist), so the generator must accept a list of theme ids and merge their rooms, objects and characters.

```json
{
  "id": "murder-mystery",
  "characterRoleNames": { "target": "Victim", "answer": "Murderer" },
  "rooms": [
    { "type": "bedroom", "names": ["Main Bedroom", "Guest Bedroom"], "floors": ["wood"], "objects": ["bed", "plant", "shelf", "chair"] }
  ],
  "floors": [
    { "type": "wood", "color": "#E6C9A0", "pattern": "planks" }
  ],
  "objects": [
    { "type": "bed", "blocking": false, "footprint": { "w": 1, "h": 2 }, "emoji": "🛏️", "color": "#9FB8E0" },
    { "type": "plant", "blocking": true, "footprint": { "w": 1, "h": 1 }, "emoji": "🪴" }
  ],
  "characters": [
    { "id": "c1", "name": "Angelo", "portrait": "assets/portraits/c1.png" }
  ],
  "clueTemplates": {
    "onObject": "{name} was on a {object}.",
    "besideObject": "{name} was beside a {object}.",
    "aloneWith": "{name} was alone with the {answerRole}."
  }
}
```

The app and generator both read this file. Changing theme = new folder, no code changes.

---

## 10. Art

### 10a. Placeholder art (v1, build this first)

No image files needed to start. The board is drawn entirely in code from colours and emojis defined in `theme.json`. Final art replaces it later with no logic changes (section 10b).

**Floors: one flat colour per floor type**, plus an optional subtle pattern drawn in code so players can tell floor types apart without relying on colour alone.

| Floor | Colour | Pattern (optional, drawn in code) | Typical rooms |
|---|---|---|---|
| wood | `#E6C9A0` warm tan | thin horizontal plank lines | bedrooms, living room, office |
| tile | `#DCE6EE` pale blue-grey | 2x2 checker per cell, slightly darker squares | bathroom, kitchen |
| water | `#7EC8E3` blue | 2 small wave lines | pool, lake, river |
| grass | `#9BD48A` green | tiny scattered dots | garden, park |
| pavement | `#BDBDBD` grey | faint square grid | street, parking, patio |
| sand | `#F2DFA7` pale yellow | fine dots | beach |
| stone | `#A9A29A` warm grey | irregular block lines | cellar, castle |

Colours live in `theme.json`, so they can be tuned without code changes.

**Walls:** thick dark line (4 px at 1x) on room boundaries, thin light line (1 px) between cells in the same room. Room name label drawn on the room's largest edge, like the reference.

**Objects: emojis, three render styles**

1. **Blocking object** (nobody can stand here): cell gets a darker overlay of the floor colour + diagonal hatch lines, emoji centred at 70% of cell size. The hatch is what tells players "not allowed".
2. **Occupiable 1x1 object** (chair, stool, puddle): emoji centred at 55% of cell size and 60% opacity, so a placed character token sits clearly on top of it.
3. **Occupiable multi-tile object** (carpet, bed, car, boat, horse, sofa, big puddle): a **rounded rectangle** spanning the whole footprint, inset 6 px from the cell edges, filled with the object's colour, 2 px darker border. The emoji appears **once**, small (40% of a cell), in the top-left corner of the shape. Thin cell grid lines still show through the shape at low opacity so players can count squares. Characters stand on any cell of it.

Multi-tile blocking objects (long table, piano, wardrobe) use style 1 across the full footprint with one emoji in the centre.

**Starter object list**

| Object | Emoji | Blocking | Footprint | Shape colour |
|---|---|---|---|---|
| plant | 🪴 | yes | 1x1 | |
| tree | 🌳 | yes | 1x1 | |
| shelf | 📚 | yes | 1x1 | |
| TV | 📺 | yes | 1x1 | |
| table | 🍽️ | yes | 1x1, 2x1, 2x2 | |
| piano | 🎹 | yes | 2x1 | |
| chair | 🪑 | no | 1x1 | |
| sofa | 🛋️ | no | 2x1 | `#C9A7D8` |
| bed | 🛏️ | no | 1x2 | `#9FB8E0` |
| carpet | 🟪 | no | 2x2, 3x2, 3x3, L-shape | `#C7BDF2` |
| bathtub | 🛁 | no | 1x2 | `#BFE3F0` |
| puddle | 💧 | no | 1x1, 2x1 | `#8FC9E8` |
| car | 🚗 | no | 1x2 | `#F2A7A7` |
| boat | ⛵ | no | 1x2, 2x1 (only on water) | `#F5E6C8` |
| horse | 🐎 | no | 2x1 | `#D9B48F` |
| bench | 🪵 | no | 2x1 | `#C8A27A` |

Carpets can be L-shaped (like the reference). Support `footprint` as either `{w, h}` or a list of cell offsets: `"cells": [[0,0],[1,0],[1,1]]`. Rounded-rectangle rendering then becomes a merged outline of those cells.

Objects can only be placed on floors they make sense on (boat only on water, car only on pavement, horse on grass or pavement). Put this as `"allowedFloors"` on each object in `theme.json`.

**Characters (placeholder):** coloured circle with the character's initial, one distinct colour per character. Notes are the same initial in small text in the cell corner.

**Accessibility:** every floor type has a pattern as well as a colour, and blocking cells have hatching, so the board works for colour-blind players. Verify contrast of initials on every floor colour.

### 10b. Final art spec (for the designer)

- Tile base size: 128 x 128 px, exported @2x and @3x.
- Objects: separate PNGs on transparent background, sized to their footprint (1x2 bed = 128 x 256 at 1x).
- Floors: seamless tileable textures per floor type.
- Room walls: drawn by code from room boundaries (thick line), so no wall art needed.
- Character portraits: square, 512 x 512.
- Placed-character token: small version of the portrait, circular crop, 96 x 96.
- Naming: `obj_bed.png`, `floor_wood.png`, `char_c1.png`, `token_c1.png`.

---

## 11. App: MVP features

### Screens
1. Home: continue, level select, daily puzzle, settings.
2. Level select: packs, locked/unlocked, stars or checkmarks.
3. Game screen:
   - Board (scales to screen width, pinch-zoom optional for 9x9).
   - Character cards with clue text (scrollable row or bottom sheet on phone).
   - General clues banner.
   - Tools: place, mark X, eraser, undo, clear all (hold to confirm), hint.
   - Timer.
   - Submit (enabled when all placed).
4. Win screen: time, hints used, reveal who the answer character was.
5. Settings: sound, haptics, reset progress.
6. How to Play (modal, reachable from game screen and home). Four tabs:
   - **How to Play:** goal, the 2 core rules (one per row and column; only occupiable cells), controls, tools. Each rule has a small diagram.
   - **Keywords:** one card per keyword from section 3, each with a short definition and a mini-grid diagram showing valid cells (green circle / check) and invalid ones (X).
   - **Advanced:** the tier 2 and 3 techniques from section 6b, each with 1 to 2 before/after mini-grids.
   - **FAQ:** accordion list built from the rulings in section 3.
   - All help text is written from scratch in our own words, stored in the theme/locale files. Mini-grid diagrams are rendered by code from small JSON grid specs (same board renderer, simplified style), so they stay consistent and translatable.

### Controls
- **Tap a character card:** select that character.
- **Tap a cell:** add or remove a **note** (the selected character's initial, small, in the corner of the cell). A cell can hold several notes.
- **Press and hold a cell:** **place** the selected character (big token). A quick tap only makes a note.
- **Drag across cells:** paint notes on every cell the finger passes over.
- Placing a character clears that character's notes elsewhere.
- Illegal placement (blocking cell) gives a shake and haptic buzz.

### Tools
- **X tool:** toggle mode. Taps mark cells as impossible for everyone.
- **Eraser:** tap a cell to clear it. **Hold the eraser button** to clear the whole board (with a short hold progress ring, no confirm dialog).
- **Undo:** reverts the last action (placement, note, X, erase). Unlimited history per session.
- **Auto-X option** (setting, default on): when a character is placed, grey out its row and column.

### Hints
- Hint 1: highlight the character to look at next.
- Hint 2: show which cells can be ruled out.
- Hint 3: place it.
- Source: next step from the logical solver, run on the player's current board state.

### Persistence
- Save per level: placements, X marks, time, hints used, completed flag.
- Save on every move (MMKV is fast enough).

### Not in MVP
- Accounts, cloud sync, leaderboards, level editor, multiplayer. Ads and bundles come in M5 (see section 15), after the core loop is proven.

---

## 12. Milestones and acceptance criteria

**M1: Engine**
- All types, clue evaluators, exact solver.
- 100% of clue kinds unit tested.
- Solver finds the known solution on 5 hand-written test puzzles.

**M2: Generator**
- CLI generates 500 puzzles across 5x5 to 9x9.
- Every exported puzzle: exactly 1 solution (exact solver) AND fully solved by logical solver.
- `gen:stats` shows a spread across all 5 tiers.
- Average generation time under 2 s per 9x9 puzzle.

**M3: Playable prototype**
- Expo app loads a level pack, renders board with placeholder art per section 10a (floor colours, emojis, rounded shapes for multi-tile objects), full place/note/X/undo/submit loop works.
- Progress saves and restores.

**M4: Hints + polish**
- 3-level hint system working.
- How to Play modal with all 4 tabs, diagrams rendered from JSON grid specs.
- Theme art swapped in from `/themes/murder-mystery`.
- Tutorial levels.

**M5: Monetization**
- Ads integrated per section 15, with test ad units.
- One paid bundle purchasable in sandbox, unlocks correctly, survives reinstall via restore purchases.
- "Remove ads" purchase works.

**M6: Store-ready**
- App icons, splash, store screenshots.
- Analytics (level start, complete, quit, hints used, ad shown, purchase).
- Privacy policy, App Tracking Transparency prompt (iOS), Google UMP consent form (EU/GDPR).
- TestFlight + Play internal testing build.

---

## 13. Open decisions (owner to confirm)

- [x] Launch theme: murder mystery
- [x] Monetization: ads + paid puzzle bundles
- [ ] Working title
- [x] Adjacency: orthogonal only, same room only (see Keywords, section 3)
- [x] Keywords, rulings, controls and solving techniques (sections 3, 6b, 11)
- [ ] Confirm the chair ruling in section 3 (sitting in a chair does not count as beside that chair)
- [ ] Exactly one clue per character, or allow two on harder levels
- [ ] Daily puzzle at launch or later
- [ ] Bundle pricing and how many free levels in the base game

---

## 14. Notes for Cursor

- Build strictly in milestone order. Do not scaffold the app before M2 passes.
- Keep `/packages/engine` free of any React, Node, or file-system imports.
- Every generator run must be reproducible from its seed.
- When a puzzle fails validation, log the seed and the reason. Never silently skip.
- Write tests alongside each module. Run the full test suite before marking a milestone done.
- Use the definitions in section 3 exactly. If something is ambiguous, add it to section 13 instead of guessing.

---

## 15. Monetization: ads + paid bundles

### Libraries
- Ads: `react-native-google-mobile-ads` (AdMob). Requires an Expo dev build, not Expo Go.
- Purchases: RevenueCat (`react-native-purchases`). Handles App Store + Google Play receipts, restore purchases, and entitlements in one place.

### Ad placements
| Placement | Format | Rule |
|---|---|---|
| After completing a level | Interstitial | Max once every 3 completed levels, never on tutorial levels |
| Extra hint when out of free hints | Rewarded | Player chooses to watch, gets 1 hint |
| Retry a daily puzzle | Rewarded | Optional |
| Game screen | None | No banners on the board. Puzzle players hate clutter mid-solve |

- Free hints: 3 per day, refilled at local midnight.
- Never show an ad during an active puzzle.

### Products
| Product ID | Type | Unlocks |
|---|---|---|
| `remove_ads` | Non-consumable | Removes interstitials. Rewarded ads stay optional |
| `bundle_<id>` (e.g. `bundle_mansion_2`) | Non-consumable | One level pack (40 to 60 levels) |
| `bundle_all_current` | Non-consumable | Every bundle released so far |
| `hints_10` | Consumable | 10 hints |

### Bundle model
- Base game (free): tutorial + Easy + Medium + part of Hard, murder mystery theme.
- Paid bundles: more murder mystery packs (new houses, harder tiers) or new themes (heist, cat café, office, haunted mansion, wedding, spy hotel, or mixes).
- Each bundle = one level pack JSON + one theme folder (if new art).
- Level packs ship inside the app binary for v1. Later: download new bundles from a CDN so new content doesn't need an app update.
- Level select shows locked bundles with one free preview puzzle each.

### Entitlement logic
- RevenueCat entitlement per bundle id.
- App checks entitlements on launch and caches them locally so locked/unlocked state works offline.
- "Restore purchases" button in settings (required by Apple).
