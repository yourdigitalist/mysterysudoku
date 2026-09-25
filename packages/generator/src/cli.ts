#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import type { Puzzle } from "@mysterysudoku/engine";
import { finalizePuzzle, writeLevelPack, writeManifest, type ExportedPuzzle, type LevelPack } from "./export.js";
import { generatePuzzle } from "./generate-puzzle.js";
import { loadTheme } from "./theme.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const GENERATOR_VERSION = "0.1.0";

interface Args {
  [key: string]: string | boolean;
}

function parseArgs(argv: string[]): { positional: string[]; flags: Args } {
  const flags: Args = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function cmdGen(flags: Args): void {
  const sizesArg = String(flags.size ?? flags.sizes ?? "5,6,7,8,9");
  const sizes = sizesArg.split(",").map((s) => parseInt(s.trim(), 10));
  const count = parseInt(String(flags.count ?? "50"), 10);
  const seedBase = String(flags.seed ?? "seed");
  const tierFilter = flags.tier !== undefined ? parseInt(String(flags.tier), 10) : undefined;
  const outArg = String(flags.out ?? "levels/pack.json");
  const outPath = path.isAbsolute(outArg) ? outArg : path.join(repoRoot, outArg);
  const themePath = path.join(repoRoot, "themes/murder-mystery/theme.json");
  const theme = loadTheme(themePath);

  const puzzles: ExportedPuzzle[] = [];
  let attempts = 0;
  let mapRegenerationsTotal = 0;
  let rejected = 0;
  const maxAttempts = count * 30;

  const start = Date.now();
  while (puzzles.length < count && attempts < maxAttempts) {
    const size = sizes[attempts % sizes.length];
    const seed = `${seedBase}-${attempts}`;
    attempts++;

    const generated = generatePuzzle({ size, theme, seed });
    if (!generated) {
      rejected++;
      console.error(`gen: seed "${seed}" (size ${size}) failed after map retries, skipping`);
      continue;
    }
    mapRegenerationsTotal += generated.mapRegenerations;

    if (tierFilter !== undefined && generated.puzzle.difficulty.tier !== tierFilter) {
      rejected++;
      continue;
    }

    const idx = puzzles.length + 1;
    const caseNumber = String(idx).padStart(2, "0");
    const title = `Case ${caseNumber}`;
    puzzles.push(finalizePuzzle(theme, generated.puzzle, caseNumber, title));
  }

  puzzles.sort((a, b) => a.difficulty.tier - b.difficulty.tier || a.size - b.size);
  puzzles.forEach((p, i) => {
    p.caseNumber = String(i + 1).padStart(2, "0");
  });

  const pack: LevelPack = { version: 1, puzzles };
  writeLevelPack(pack, outPath);

  const elapsed = Date.now() - start;
  console.log(
    `gen: wrote ${puzzles.length}/${count} puzzles to ${path.relative(repoRoot, outPath)} ` +
      `(${attempts} attempts, ${rejected} rejected, ${mapRegenerationsTotal} map regenerations, ` +
      `${elapsed}ms total, ${(elapsed / Math.max(1, puzzles.length)).toFixed(0)}ms/puzzle avg)`,
  );

  const manifestPath = path.join(repoRoot, "levels/manifest.json");
  const tiers: Record<number, number> = {};
  for (const p of puzzles) tiers[p.difficulty.tier] = (tiers[p.difficulty.tier] ?? 0) + 1;
  writeManifest(
    [{ file: path.relative(path.join(repoRoot, "levels"), outPath), count: puzzles.length, sizes, tiers }],
    manifestPath,
    GENERATOR_VERSION,
  );
}

function loadPack(file: string): LevelPack {
  const p = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  return JSON.parse(readFileSync(p, "utf-8")) as LevelPack;
}

function cmdStats(positional: string[]): void {
  const file = positional[0];
  if (!file) {
    console.error("gen:stats requires a level pack path, e.g. levels/pack-01.json");
    process.exit(1);
  }
  const pack = loadPack(file);

  const tierCounts: Record<number, number> = {};
  const sizeCounts: Record<number, number> = {};
  const clueKindCounts: Record<string, number> = {};
  let twoClueCharacters = 0;

  for (const puzzle of pack.puzzles) {
    tierCounts[puzzle.difficulty.tier] = (tierCounts[puzzle.difficulty.tier] ?? 0) + 1;
    sizeCounts[puzzle.size] = (sizeCounts[puzzle.size] ?? 0) + 1;
    const perChar = new Map<string, number>();
    for (const clue of puzzle.clues) {
      clueKindCounts[clue.kind] = (clueKindCounts[clue.kind] ?? 0) + 1;
      if ("charId" in clue) perChar.set(clue.charId, (perChar.get(clue.charId) ?? 0) + 1);
    }
    for (const n of perChar.values()) if (n >= 2) twoClueCharacters++;
  }

  console.log(`Level pack: ${pack.puzzles.length} puzzles\n`);
  console.log("Difficulty tiers:");
  for (let t = 1; t <= 5; t++) console.log(`  tier ${t}: ${tierCounts[t] ?? 0}`);
  console.log("\nGrid sizes:");
  for (const size of Object.keys(sizeCounts).sort((a, b) => Number(a) - Number(b))) {
    console.log(`  ${size}x${size}: ${sizeCounts[Number(size)]}`);
  }
  console.log("\nClue kind mix:");
  for (const [kind, n] of Object.entries(clueKindCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kind}: ${n}`);
  }
  console.log(`\nCharacters with 2 clues (Hard-tier exception): ${twoClueCharacters}`);
}

function cmdRender(positional: string[]): void {
  const file = positional[0];
  const which = positional[1];
  if (!file || which === undefined) {
    console.error("gen:render requires a level pack path and a puzzle index or case number");
    process.exit(1);
  }
  const pack = loadPack(file);
  const puzzle: Puzzle | undefined =
    pack.puzzles.find((p) => p.caseNumber === which) ?? pack.puzzles[parseInt(which, 10) - 1];
  if (!puzzle) {
    console.error(`No puzzle matching "${which}" in ${file}`);
    process.exit(1);
  }
  renderAscii(puzzle);
}

function renderAscii(puzzle: Puzzle): void {
  const objectTypeById = new Map(puzzle.objects.map((o) => [o.id, o.type]));
  const charAt = new Map<string, string>();
  for (const [charId, cell] of Object.entries(puzzle.solution)) charAt.set(`${cell.row},${cell.col}`, charId);

  console.log(`Case ${(puzzle as ExportedPuzzle).caseNumber ?? puzzle.id} — ${puzzle.size}x${puzzle.size}\n`);
  for (const row of puzzle.cells) {
    const line = row
      .map((cell) => {
        const key = `${cell.row},${cell.col}`;
        if (charAt.has(key)) return ` ${charAt.get(key)} `;
        if (cell.objectId) return `[${objectTypeById.get(cell.objectId)?.[0]?.toUpperCase() ?? "?"}]`;
        return ` . `;
      })
      .join("");
    console.log(line);
  }
  console.log("\nRooms:");
  for (const room of puzzle.rooms) console.log(`  ${room.id} ${room.name} (${room.cells.length} cells)`);
  console.log("\nClues:");
  for (const c of puzzle.characters) console.log(`  ${c.name}${c.isTarget ? " (victim)" : ""}`);
  console.log(`\nDifficulty: ${puzzle.difficulty.label ?? puzzle.difficulty.tier} (score ${puzzle.difficulty.score})`);
}

function main(): void {
  const [, , command, ...rest] = process.argv;
  const { positional, flags } = parseArgs(rest);

  switch (command) {
    case "gen":
      cmdGen(flags);
      break;
    case "stats":
      cmdStats(positional);
      break;
    case "render":
      cmdRender(positional);
      break;
    default:
      console.error("Usage: mysterysudoku-gen <gen|stats|render> [options]");
      process.exit(1);
  }
}

main();
