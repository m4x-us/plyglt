// === tests/generationGuard.test.ts ===
// Unit tests for lib/generationGuard.ts — the shared snapshot/bump/isStale primitive
// backing basePackLoader's eviction guard (and, via carry-forward, specialtyPackLoader's
// deactivation guard).

import { describe, it, expect } from "vitest";
import { createGenerationGuard } from "@/lib/generationGuard";

describe("createGenerationGuard", () => {
  it("a snapshot taken before a bump is stale; one taken after is fresh", () => {
    const guard = createGenerationGuard();
    const before = guard.snapshot();
    expect(guard.isStale(before)).toBe(false);

    guard.bump();

    expect(guard.isStale(before)).toBe(true);
    const after = guard.snapshot();
    expect(guard.isStale(after)).toBe(false);
  });

  it("every bump invalidates all outstanding snapshots, not just the latest", () => {
    const guard = createGenerationGuard();
    const s1 = guard.snapshot();
    guard.bump();
    const s2 = guard.snapshot();
    guard.bump();

    expect(guard.isStale(s1)).toBe(true);
    expect(guard.isStale(s2)).toBe(true);
    expect(guard.isStale(guard.snapshot())).toBe(false);
  });

  it("independent guards do not share state", () => {
    const a = createGenerationGuard();
    const b = createGenerationGuard();
    const snapA = a.snapshot();

    b.bump();

    expect(a.isStale(snapA)).toBe(false);
  });
});
