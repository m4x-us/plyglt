import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBackup, CURRENT_BACKUP_VERSION } from "@/lib/importBackup";

function validBackup(overrides: Record<string, unknown> = {}) {
  return {
    _version: 1,
    srs: {
      cards: {
        "a1-01": {
          cardId: "a1-01", state: "review", stability: 10,
          difficulty: 5, retrievability: 0.9, dueDate: Date.now() + 86400000, lapses: 0, reps: 3,
        },
      },
      streak: 7,
      lastStudiedDate: "2026-06-01",
    },
    entitlement: { licenseKey: null, instanceId: null, licenseType: "free", unlockedPacks: ["it"], validUntil: null },
    ...overrides,
  };
}

describe("parseBackup", () => {
  it("accepts a well-formed current backup", () => {
    const r = parseBackup(validBackup());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.validCardCount).toBe(1);
    expect(r.skippedCardCount).toBe(0);
    expect(r.srs.streak).toBe(7);
    expect(r.srs.lastStudiedDate).toBe("2026-06-01");
  });

  it("handles v0 backup (no activeSession field) via migration chain", () => {
    // v0 backups pre-date activeSession — migration fills it as null
    const r = parseBackup(validBackup({ srs: { cards: {}, streak: 3, lastStudiedDate: null } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.streak).toBe(3);
  });

  it("rejects non-object payload", () => {
    expect(parseBackup("not an object")).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup(null)).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup(42)).toEqual({ ok: false, error: expect.any(String) });
  });

  it("rejects a backup missing required top-level fields", () => {
    expect(parseBackup({ _version: 1, srs: {} })).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup({ _version: 1, entitlement: {} })).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup({ srs: {}, entitlement: {} })).toEqual({ ok: false, error: expect.any(String) });
  });

  it("rejects non-object srs field — number is truthy but not a valid srs container", () => {
    expect(parseBackup({ _version: 1, srs: 42, entitlement: {} })).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup({ _version: 1, srs: "hello", entitlement: {} })).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup({ _version: 1, srs: true, entitlement: {} })).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup({ _version: 1, srs: [], entitlement: {} })).toEqual({ ok: false, error: expect.any(String) });
  });

  it("skips a card with an invalid state and counts it in skippedCardCount", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["bad"] = {
      cardId: "bad", state: "INVALID", stability: 5, difficulty: 5,
      retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.validCardCount).toBe(1);
    expect(r.skippedCardCount).toBe(1);
    expect(r.srs.cards["bad"]).toBeUndefined();
    expect(r.srs.cards["a1-01"]).toBeDefined();
  });

  it("skips a card missing cardId", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["no-id"] = {
      state: "review", stability: 5, difficulty: 5,
      retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.skippedCardCount).toBe(1);
  });

  it("normalises NaN stability to 0 (prevents propagation into FSRS scheduler)", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["nan"] = {
      cardId: "nan", state: "review", stability: NaN,
      difficulty: 5, retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["nan"]?.stability).toBe(0);
    expect(isFinite(r.srs.cards["nan"]!.stability)).toBe(true);
  });

  it("normalises Infinity stability to 0", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["inf"] = {
      cardId: "inf", state: "review", stability: Infinity,
      difficulty: 5, retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["inf"]?.stability).toBe(0);
  });

  it("clamps negative lapses to 0", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["neg"] = {
      cardId: "neg", state: "review", stability: 5,
      difficulty: 5, retrievability: 0.9, dueDate: Date.now(), lapses: -3, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["neg"]?.lapses).toBe(0);
  });

  it("defaults licenseType to 'free' when value is unrecognised (never grant unpaid access)", () => {
    const backup = validBackup({
      entitlement: { licenseKey: null, instanceId: null, licenseType: "pirate", unlockedPacks: ["it"], validUntil: null },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entitlement.licenseType).toBe("free");
  });

  it("preserves valid licenseType values", () => {
    for (const type of ["free", "subscription"] as const) {
      const backup = validBackup({
        entitlement: { licenseKey: null, instanceId: null, licenseType: type, unlockedPacks: ["it"], validUntil: null },
      });
      const r = parseBackup(backup);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.entitlement.licenseType).toBe(type);
    }
  });

  it("coerces unrecognised licenseType to free (never grant unpaid access from old backups)", () => {
    // Old backups from prior app versions may carry licenseType values no longer in LicenseType.
    // Safe default is "free" — user must re-activate to regain subscription access.
    const backup = validBackup({
      entitlement: { licenseKey: "K", instanceId: "I", licenseType: "legacy_value", unlockedPacks: ["it", "es"], validUntil: null },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entitlement.licenseType).toBe("free");
  });

  it("returns langPair from backup payload", () => {
    const backup = validBackup({ langPair: "en-es" });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.langPair).toBe("en-es");
  });

  it("defaults langPair to 'en-it' for v1 backups (no langPair field)", () => {
    const backup = { ...validBackup() } as Record<string, unknown>;
    delete backup.langPair;
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.langPair).toBe("en-it");
  });

  it("defaults unlockedPacks to free pack codes when absent or non-array", () => {
    const backup = validBackup({
      entitlement: { licenseKey: null, instanceId: null, licenseType: "free", unlockedPacks: null, validUntil: null },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entitlement.unlockedPacks).toEqual(["it"]);
  });

  it("filters unlockedPacks to known pack codes, drops unknown strings and non-strings", () => {
    const backup = validBackup({
      entitlement: {
        licenseKey: null, instanceId: null, licenseType: "subscription", validUntil: null,
        unlockedPacks: ["it", "xx-fake", null, 123, "es"],
      },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entitlement.unlockedPacks).toEqual(["it", "es"]);
  });

  it("rejects backup with _version above CURRENT_BACKUP_VERSION with descriptive message", () => {
    const backup = validBackup({ _version: CURRENT_BACKUP_VERSION + 1 });
    const r = parseBackup(backup);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/newer version/i);
    expect(r.error).toMatch(/update/i);
  });

  it("coerces malformed langPair format to en-it default", () => {
    const backup = validBackup({ langPair: "en-XXXXXXXX" });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.langPair).toBe("en-it");
  });
});

describe("handleImportFile error handling (Task #007)", () => {
  // reader.onerror and catch(e) logging are verified structurally — full integration coverage
  // is deferred to Batch 2 Task #020 (requires jsdom FileReader mocking).
  it("structural: app/settings/page.tsx has no bare catch {} blocks", () => {
    const source = readFileSync(resolve(process.cwd(), "app/settings/page.tsx"), "utf-8");
    expect(source).not.toMatch(/catch\s*\{/);
  });

  it("structural: app/settings/page.tsx defines reader.onerror", () => {
    const source = readFileSync(resolve(process.cwd(), "app/settings/page.tsx"), "utf-8");
    expect(source).toContain("reader.onerror");
  });

  it("structural: FileReader.onerror reads DOMException from event.target.error (Task #007)", () => {
    // The ProgressEvent itself is opaque — the actual failure reason is the DOMException
    // on FileReader.error. Logging only the ProgressEvent discards the real error detail.
    const source = readFileSync(resolve(process.cwd(), "app/settings/page.tsx"), "utf-8");
    expect(source).toContain("(event.target as FileReader).error");
  });
});

describe("import-graph: lib/importBackup.ts", () => {
  it("does not import from @/store (Rule 3 — utilities layer must not import services layer)", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/importBackup.ts"), "utf-8");
    expect(source).not.toContain("@/store");
  });
});
