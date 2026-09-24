# Handing off to Claude Code

1. Unzip this folder somewhere you want the project to live, for example `~/Projects/puzzle-game`.
2. Open a terminal in that folder and run `git init`, then `claude`.
3. Paste the kickoff prompt below.

## Kickoff prompt

```
Read CLAUDE.md, then docs/spec.md and docs/decisions.md in full. decisions.md overrides the spec.

Set up the pnpm monorepo from spec section 2 and build milestone M1 (engine) only:
- Types from spec section 4, extended to match levels/prototype-pack.json (objects as cell lists, display clue text).
- evaluate() for every clue kind, with the rulings in both docs.
- countSolutions() exact solver.
- solveLogically() with the tier 1 to 3 techniques and a step list that can drive hints.
- Vitest tests: every clue kind with 3 true and 3 false cases, plus all 9 puzzles in levels/prototype-pack.json must have exactly 1 solution and be fully solved by the logical solver.

Before writing code, show me a short plan and list anything in the docs you find ambiguous. Stop after M1 and report.
```

## After M1

Go one milestone per session: M2 generator, then M3 Expo app using `prototype/casebook.dc.html` as the UI reference. Ask Claude Code to update `docs/decisions.md` whenever a new decision is made, so the next session starts with it.
