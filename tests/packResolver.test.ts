// === tests/packResolver.test.ts ===
// Unit tests for lib/packResolver.ts — the pure specialty base-resolution orchestrator.
// Plain injected fakes, node environment — no React, no module mocks (the io parameter is
// the whole point of the design: this logic is testable without renderHook).

import { describe, it, expect, vi } from "vitest";
import { resolveTargetPack, type PackResolverIO } from "@/lib/packResolver";
import type { LoadPackResult } from "@/lib/packTypes";

// Registry note: lib/langRegistry's real SPECIALTY_PACKS has one entry (it-medical,
// ready:false). These tests mock the registry with ready entries for both branch shapes.
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS: [
      ...actual.SPECIALTY_PACKS,
      { code: "it-legal", baseLang: "it", name: "Legal Italian", ready: true },
      { code: "es-business", baseLang: "es", name: "Business Spanish", ready: true },
    ],
  };
});

const OK = (id: string): LoadPackResult => ({ ok: true, pack: { units: [{ id }] } as never });
const FAIL = (error: "download_failed" | "invalid_lang"): LoadPackResult => ({ ok: false, error });
const STATIC_IT = { it: { units: [] as never[], unitMap: {} } };
const OPTS = { purchasedAddOns: [], unlockedLangs: ["it"] };

function fakeIO(loadImpl: (lang: string) => Promise<LoadPackResult>): PackResolverIO & { loads: string[]; seeds: string[] } {
  const loads: string[] = [];
  const seeds: string[] = [];
  return {
    loads,
    seeds,
    loadPack: (lang) => { loads.push(lang); return loadImpl(lang); },
    seedMemCache: (lang) => { seeds.push(lang); return true; },
  };
}

describe("resolveTargetPack", () => {
  it("non-specialty target: single load, no seeding, baseFailed false", async () => {
    const io = fakeIO(async () => OK("es-u01"));
    const resolved = await resolveTargetPack("es", null, OPTS, STATIC_IT, io);
    expect(io.loads).toEqual(["es"]);
    expect(io.seeds).toEqual([]);
    expect(resolved).toEqual({ result: OK("es-u01"), baseFailed: false });
  });

  it("static-base specialty: seeds the base BEFORE the single specialty load", async () => {
    const io = fakeIO(async () => OK("legal-u01"));
    const resolved = await resolveTargetPack("it-legal", null, OPTS, STATIC_IT, io);
    expect(io.seeds).toEqual(["it"]);
    expect(io.loads).toEqual(["it-legal"]);
    expect(resolved.baseFailed).toBe(false);
    if (resolved.result.ok) expect(resolved.result.pack.units[0]!.id).toBe("legal-u01");
  });

  it("a REFUSED static-base seed maps to base_pack_not_loaded with baseFailed true — the specialty load never fires", async () => {
    // seedMemCache fails closed for non-free/unready langs; its boolean return exists so
    // this exact refusal is surfaced immediately instead of resurfacing later as a
    // causally-distant loadSpecialtyPack failure. Deleting the `if (!io.seedMemCache...)`
    // check makes the resolver call loadPack and this fails on both assertions.
    const io = fakeIO(async () => OK("legal-u01"));
    io.seedMemCache = (lang) => { io.seeds.push(lang); return false; };
    const resolved = await resolveTargetPack("it-legal", null, OPTS, STATIC_IT, io);
    expect(io.loads).toEqual([]);
    expect(resolved).toEqual({ result: { ok: false, error: "base_pack_not_loaded" }, baseFailed: true });
  });

  it("network-base specialty: base loaded first, specialty second, in strict order", async () => {
    const io = fakeIO(async (lang) => (lang === "es" ? OK("es-base") : OK("biz-u01")));
    const resolved = await resolveTargetPack("es-business", null, OPTS, STATIC_IT, io);
    expect(io.loads).toEqual(["es", "es-business"]);
    expect(io.seeds).toEqual([]);
    if (resolved.result.ok) expect(resolved.result.pack.units[0]!.id).toBe("biz-u01");
    expect(resolved.baseFailed).toBe(false);
  });

  it("network-base failure propagates with baseFailed true and the specialty code is NEVER requested", async () => {
    const io = fakeIO(async () => FAIL("download_failed"));
    const resolved = await resolveTargetPack("es-business", null, OPTS, STATIC_IT, io);
    expect(io.loads).toEqual(["es"]);
    expect(resolved).toEqual({ result: FAIL("download_failed"), baseFailed: true });
  });

  it("an UNREADY specialty code (real it-medical entry) is treated as a plain target — no seeding, no base load", async () => {
    const io = fakeIO(async () => FAIL("invalid_lang"));
    const resolved = await resolveTargetPack("it-medical", null, OPTS, STATIC_IT, io);
    expect(io.seeds).toEqual([]);
    expect(io.loads).toEqual(["it-medical"]);
    expect(resolved.baseFailed).toBe(false);
  });

  it("the specialty load's own failure keeps baseFailed false (purchase-prompt path stays reachable)", async () => {
    const io = fakeIO(async (lang) => (lang === "es" ? OK("es-base") : FAIL("invalid_lang")));
    const resolved = await resolveTargetPack("es-business", null, OPTS, STATIC_IT, io);
    expect(io.loads).toEqual(["es", "es-business"]);
    expect(resolved).toEqual({ result: FAIL("invalid_lang"), baseFailed: false });
  });
});
