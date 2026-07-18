import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBackup, CURRENT_BACKUP_VERSION } from "@/lib/importBackup";

// Mock SPECIALTY_PACKS so parseBackup's purchasedAddOns filter (#312, #384) is deterministic.
// One ready:true and one ready:false entry — the filter must check REGISTRATION only
// (membership in SPECIALTY_PACKS); the mutable ready flag must never drop a paid purchase
// record from a restored backup (Task #384 data-loss fix).
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS: [
      { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true },
      { code: "it-legal",   baseLang: "it", name: "Legal Italian",   ready: false },
    ],
  };
});

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

  it("accepts a backup with an empty cards map", () => {
    // Renamed (Task #227): the original name/comment claimed "v0 backup... via migration
    // chain" and referenced an activeSession field, but BackupSrs has no activeSession
    // field and parseBackup() has no migration chain — this simply verifies an empty
    // cards map is accepted and streak/lastStudiedDate still pass through correctly.
    const r = parseBackup(validBackup({ srs: { cards: {}, streak: 3, lastStudiedDate: null } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.validCardCount).toBe(0);
    expect(r.srs.streak).toBe(3);
    expect(r.srs.lastStudiedDate).toBeNull();
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

  it("#390: rejects non-object entitlement field — truthy scalars are not a valid entitlement container", () => {
    // Before #390, entitlement was checked only by truthiness — entitlement:"corrupted"
    // or entitlement:5 passed the guard and every entitlement field was silently
    // defaulted instead of the backup being rejected like equally-malformed srs input.
    const srs = { cards: {}, streak: 0, lastStudiedDate: null };
    expect(parseBackup({ _version: 1, srs, entitlement: "corrupted" })).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup({ _version: 1, srs, entitlement: 5 })).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup({ _version: 1, srs, entitlement: true })).toEqual({ ok: false, error: expect.any(String) });
    expect(parseBackup({ _version: 1, srs, entitlement: [] })).toEqual({ ok: false, error: expect.any(String) });
  });

  it("skips a card with an invalid state and counts it in skippedCardCount", () => {
    const backup = validBackup();
    const expectedGoodCard = backup.srs.cards["a1-01"];
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
    // The valid neighbour must survive untouched — assert all 7 fields explicitly rather
    // than just that the key exists, so corruption confined to any single field during
    // the skip path would fail this test.
    const goodCard = r.srs.cards["a1-01"];
    expect(goodCard?.cardId).toBe(expectedGoodCard.cardId);
    expect(goodCard?.state).toBe(expectedGoodCard.state);
    expect(goodCard?.stability).toBe(expectedGoodCard.stability);
    expect(goodCard?.difficulty).toBe(expectedGoodCard.difficulty);
    expect(goodCard?.retrievability).toBe(expectedGoodCard.retrievability);
    expect(goodCard?.dueDate).toBe(expectedGoodCard.dueDate);
    expect(goodCard?.lapses).toBe(expectedGoodCard.lapses);
    expect(goodCard?.reps).toBe(expectedGoodCard.reps);
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

  it("defaults difficulty to 5 when value is not a finite number", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["d"] = {
      cardId: "d", state: "review", stability: 5,
      difficulty: "bad", retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["d"]?.difficulty).toBe(5);
  });

  it("defaults retrievability to 1 when value is not finite", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["rv"] = {
      cardId: "rv", state: "review", stability: 5,
      difficulty: 5, retrievability: Infinity, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["rv"]?.retrievability).toBe(1);
  });

  it("defaults dueDate to approximately now when value is not a finite number", () => {
    const backup = validBackup();
    const before = Date.now();
    (backup.srs.cards as Record<string, unknown>)["dd"] = {
      cardId: "dd", state: "review", stability: 5,
      difficulty: 5, retrievability: 0.9, dueDate: "invalid", lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    const after = Date.now();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const dueDate = r.srs.cards["dd"]?.dueDate ?? -1;
    // existence-check: dueDate fallback is Date.now() — exact value is non-deterministic at test time
    expect(dueDate).toBeGreaterThanOrEqual(before);
    expect(dueDate).toBeLessThanOrEqual(after);
  });

  it("defaults reps to 0 when value is not an integer", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["rp"] = {
      cardId: "rp", state: "review", stability: 5,
      difficulty: 5, retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 1.5,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["rp"]?.reps).toBe(0);
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

  it("#327: accepts hyphenated specialty-pack langPair (e.g. en-it-medical)", () => {
    // The old regex /^[a-z]{2}-[a-z]{2,5}$/ rejected "en-it-medical" because the
    // target segment "it-medical" contains a hyphen. getTargetLangCode was fixed for
    // this same class of truncation bug (Task #262/#294); importBackup must be consistent.
    const backup = validBackup({ langPair: "en-it-medical" });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.langPair).toBe("en-it-medical");
  });

  it("#327: accepts other hyphenated specialty-pack codes", () => {
    const backup = validBackup({ langPair: "en-it-business" });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.langPair).toBe("en-it-business");
  });

  it("#327: logs console.error when langPair is malformed and falls back to en-it", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const backup = validBackup({ langPair: "GARBAGE" });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) { errorSpy.mockRestore(); return; }
    expect(r.langPair).toBe("en-it");
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]!).toMatch(/ERR-IMPORT-LANG-PAIR/);
    errorSpy.mockRestore();
  });

  describe("#312 — purchasedAddOns validated against specialty-pack registry", () => {
    afterEach(() => { vi.clearAllMocks(); });

    it("#312: registered specialty codes pass through to entitlement", () => {
      // "it-medical" is registered in the mocked SPECIALTY_PACKS; "it-business" is not.
      const backup = validBackup({
        entitlement: {
          licenseKey: null, instanceId: null, licenseType: "free",
          unlockedPacks: ["it"], validUntil: null,
          purchasedAddOns: ["it-medical", "it-business"],
        },
      });
      const r = parseBackup(backup);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.entitlement.purchasedAddOns).toEqual(["it-medical"]);
    });

    it("#312: unregistered strings are filtered out regardless of content", () => {
      const backup = validBackup({
        entitlement: {
          licenseKey: null, instanceId: null, licenseType: "free",
          unlockedPacks: ["it"], validUntil: null,
          purchasedAddOns: ["not-a-pack", "GARBAGE"],
        },
      });
      const r = parseBackup(backup);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.entitlement.purchasedAddOns).toEqual([]);
    });

    it("#312: non-string elements are always filtered even when the code would be registered", () => {
      const backup = validBackup({
        entitlement: {
          licenseKey: null, instanceId: null, licenseType: "free",
          unlockedPacks: ["it"], validUntil: null,
          purchasedAddOns: [42, null, "it-medical", true],
        },
      });
      const r = parseBackup(backup);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.entitlement.purchasedAddOns).toEqual(["it-medical"]);
    });

    it("#384: a registered-but-not-ready code survives restore — the ready flag never drops a paid record", () => {
      // Data-loss regression guard (Task #384): "it-legal" is registered with ready:false —
      // the state a pack enters when deprecated or rolled back AFTER the backup was written
      // while it was ready:true. The old filter used isSpecialtyPackCode (registration AND
      // ready:true), which silently destroyed the paid purchase record on restore. The fixed
      // filter checks registration only.
      const backup = validBackup({
        entitlement: {
          licenseKey: null, instanceId: null, licenseType: "free",
          unlockedPacks: ["it"], validUntil: null,
          purchasedAddOns: ["it-legal"],
        },
      });
      const r = parseBackup(backup);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.entitlement.purchasedAddOns).toEqual(["it-legal"]);
    });
  });
});

describe("#354 — silently dropped backup entries are now logged", () => {
  afterEach(() => { vi.clearAllMocks(); });

  it("#354: logs IMPORT-SKIP-PACKS warning when unlockedPacks contains invalid entries", () => {
    // Before #354, invalid unlockedPacks entries were silently dropped via .filter() with no log.
    // Removing the console.warn call causes this test to fail (no warning emitted).
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const backup = validBackup({
      entitlement: {
        licenseKey: null, instanceId: null, licenseType: "free", validUntil: null,
        unlockedPacks: ["it", "xx-fake", null, 123],
      },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) { warnSpy.mockRestore(); return; }
    // 3 entries dropped: "xx-fake" (unregistered string), null, 123 (non-strings)
    expect(warnSpy).toHaveBeenCalled();
    const messages = warnSpy.mock.calls.map(args => args[0] as string);
    expect(messages.some(msg => msg.includes("IMPORT-SKIP-PACKS"))).toBe(true);
    warnSpy.mockRestore();
  });

  it("#354: logs IMPORT-SKIP-ADDONS warning when purchasedAddOns contains invalid entries", () => {
    // Before #354, invalid purchasedAddOns entries were silently dropped — same violation.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const backup = validBackup({
      entitlement: {
        licenseKey: null, instanceId: null, licenseType: "free", validUntil: null,
        unlockedPacks: ["it"], purchasedAddOns: ["it-medical", "garbage"],
      },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) { warnSpy.mockRestore(); return; }
    // "garbage" is dropped — not registered as a specialty pack
    const messages = warnSpy.mock.calls.map(args => args[0] as string);
    expect(messages.some(msg => msg.includes("IMPORT-SKIP-ADDONS"))).toBe(true);
    warnSpy.mockRestore();
  });

  it("#354: no warning logged when all unlockedPacks and purchasedAddOns entries are valid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const backup = validBackup({
      entitlement: {
        licenseKey: null, instanceId: null, licenseType: "free", validUntil: null,
        unlockedPacks: ["it"], purchasedAddOns: ["it-medical"],
      },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    // No entries dropped — no warning
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("handleImportFile error handling (Task #007)", () => {
  // reader.onerror and catch(e) logging are verified structurally — full integration coverage
  // is deferred to Batch 2 Task #020 (requires jsdom FileReader mocking).
  it("structural: app/settings/page.tsx has no bare catch {} blocks", () => {
    const source = readFileSync(resolve(process.cwd(), "app/settings/page.tsx"), "utf-8");
    expect(source).not.toMatch(/catch\s*\{/);
  });

  it("structural: hooks/useExportImport.ts defines reader.onerror", () => {
    // FileReader error handling was extracted from app/settings/page.tsx to
    // hooks/useExportImport.ts as part of Task #026 (settings page split).
    const source = readFileSync(resolve(process.cwd(), "hooks/useExportImport.ts"), "utf-8");
    expect(source).toContain("reader.onerror");
  });

  it("structural: FileReader.onerror reads DOMException from event.target.error (Task #007)", () => {
    // The ProgressEvent itself is opaque — the actual failure reason is the DOMException
    // on FileReader.error. Logging only the ProgressEvent discards the real error detail.
    // (Moved to hooks/useExportImport.ts as part of Task #026.)
    const source = readFileSync(resolve(process.cwd(), "hooks/useExportImport.ts"), "utf-8");
    expect(source).toContain("(event.target as FileReader).error");
  });
});

describe("import-graph: lib/importBackup.ts", () => {
  it("does not import from @/store (Rule 3 — utilities layer must not import services layer)", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/importBackup.ts"), "utf-8");
    expect(source).not.toContain("@/store");
  });
});
