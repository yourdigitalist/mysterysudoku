# Logic deduction puzzle game

Mobile logic puzzle game. Launch theme: murder mystery. Players place N characters on an N x N floor plan using clues. Every puzzle has one solution and is solvable without guessing.

## Read first

1. `docs/spec.md`: the full build spec (engine, generator, app, monetization).
2. `docs/decisions.md`: decisions from the prototype. **Overrides the spec where they differ.**
3. `prototype/casebook.dc.html`: the clickable prototype (look, controls, flows). It is a Claude Design canvas file and won't run on its own; read it as a reference for UI, copy, colours and interaction logic.
4. `levels/prototype-pack.json`: 9 verified puzzles in the spec's data model (plus display clue text, hint steps, win text). Use them as engine test fixtures and as the first level pack.
5. `themes/murder-mystery/theme.json`: floors, objects, emojis, colours and clue templates from the prototype.
6. `reference/generator-prototype/`: Python used to find and verify the prototype puzzles. Reference only; the real generator is TypeScript.

## Rules

- Build in milestone order (spec section 12). No app scaffolding before the generator passes M2.
- `packages/engine` has zero dependencies and no React, Node or file-system imports.
- Keyword definitions and rulings in spec section 3 plus `docs/decisions.md` are law. Engine, generator and help screen must agree. If something is ambiguous, add it to "Open questions" in `docs/decisions.md` instead of guessing.
- Every generator run is reproducible from its seed. Log seed and reason for every rejected puzzle.
- The victim's clue is always "alone with the murderer". Names are alphabetical from A; the victim is the last letter.
- Player-facing copy: no em dashes, short plain sentences, no salesy tone.
- Write tests alongside each module. Run the full suite before calling a milestone done.
