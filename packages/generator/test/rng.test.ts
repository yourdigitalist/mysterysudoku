import { describe, expect, it } from "vitest";
import { Rng } from "../src/rng.js";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng("abc");
    const b = new Rng("abc");
    const seqA = Array.from({ length: 20 }, () => a.float());
    const seqB = Array.from({ length: 20 }, () => b.float());
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds", () => {
    const a = new Rng("abc");
    const b = new Rng("xyz");
    const seqA = Array.from({ length: 20 }, () => a.float());
    const seqB = Array.from({ length: 20 }, () => b.float());
    expect(seqA).not.toEqual(seqB);
  });

  it("int() stays within bounds", () => {
    const r = new Rng("bounds");
    for (let i = 0; i < 500; i++) {
      const v = r.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it("range() is inclusive on both ends", () => {
    const r = new Rng("range");
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.range(3, 5));
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it("shuffle() is a permutation and deterministic per seed", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = new Rng("shuffle-seed").shuffle(input);
    const b = new Rng("shuffle-seed").shuffle(input);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(input);
  });

  it("pick() only returns items from the array", () => {
    const items = ["a", "b", "c"];
    const r = new Rng("pick");
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(r.pick(items));
    }
  });
});
