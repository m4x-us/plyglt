import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBackup, CURRENT_BACKUP_VERSION } from "@/lib/importBackup";

// Mock SPECIALTY_PACKS so parseBackup's purchasedAddOns filter (#312, #384) is deterministic.
// One ready:true and one ready:false entry — the filter must check REGISTRATION only
// (membership in SPECIALTY_PACKS); the mutable ready flag must never drop a paid purchase
// record from a restored backup (Task #384 data-loss fix).
const mockSpecialtyPacks = vi.hoisted(() => [
  { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true },
  { code: "it-legal",   baseLang: "it", name: "Legal Italian",   ready: false },
]);
vi.mock("@/lib/langRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/langRegistry")>();
  return {
    ...actual,
    SPECIALTY_PACKS: mockSpecialtyPacks,
    // Task #407: isRegisteredSpecialtyCode closes over the module-scope SPECIALTY_PACKS
    // binding, not the exported one — override it here so parseBackup's filter uses this
    // mock's fixture list (same reasoning as isSpecialtyPackCode's override elsewhere).
    isRegisteredSpecialtyCode: (s: string) => mockSpecialtyPacks.some(sp => sp.code === s),
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

  // Task #460: difficulty must be clamped to lib/srs.ts's FSRS range (D — 1 to 10), not
  // merely defaulted when non-finite. A crafted/corrupted backup with an in-range-typed but
  // out-of-bounds number would otherwise reach the scheduler unclamped.
  it("clamps an above-range difficulty down to 10", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["dhi"] = {
      cardId: "dhi", state: "review", stability: 5,
      difficulty: 99, retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["dhi"]?.difficulty).toBe(10);
  });

  it("clamps a below-range difficulty up to 1", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["dlo"] = {
      cardId: "dlo", state: "review", stability: 5,
      difficulty: -50, retrievability: 0.9, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["dlo"]?.difficulty).toBe(1);
  });

  // Task #460: retrievability must be clamped to lib/srs.ts's documented range (R — current
  // recall probability 0–1).
  it("clamps an above-range retrievability down to 1", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["rhi"] = {
      cardId: "rhi", state: "review", stability: 5,
      difficulty: 5, retrievability: 4.2, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["rhi"]?.retrievability).toBe(1);
  });

  it("clamps a below-range (negative) retrievability up to 0", () => {
    const backup = validBackup();
    (backup.srs.cards as Record<string, unknown>)["rlo"] = {
      cardId: "rlo", state: "review", stability: 5,
      difficulty: 5, retrievability: -0.5, dueDate: Date.now(), lapses: 0, reps: 1,
    };
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.srs.cards["rlo"]?.retrievability).toBe(0);
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

  it("#424: rejects an oversized licenseKey/instanceId (>200 chars) — dropped to null, not passed through", () => {
    const errorSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const oversized = "A".repeat(201);
    const backup = validBackup({
      entitlement: { licenseKey: oversized, instanceId: oversized, licenseType: "subscription", unlockedPacks: ["it"], validUntil: null },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entitlement.licenseKey).toBe(null);
    expect(r.entitlement.instanceId).toBe(null);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("IMPORT-SKIP-LICENSE-KEY"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("IMPORT-SKIP-INSTANCE-ID"));
    errorSpy.mockRestore();
  });

  it("#424: rejects a licenseKey/instanceId with invalid-charset content (bypassing the manual-entry format guard)", () => {
    // hooks/useLicenseActivation.ts:25 rejects this exact shape at manual entry
    // (/^[A-Za-z0-9-]+$/) — before #424, the restore path had no equivalent check, so a
    // hand-crafted backup JSON could smuggle arbitrary content (script tags, SQL-looking
    // strings, whitespace) straight into persisted entitlement state.
    const errorSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const backup = validBackup({
      entitlement: { licenseKey: "<script>alert(1)</script>", instanceId: "not valid; DROP TABLE", licenseType: "subscription", unlockedPacks: ["it"], validUntil: null },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entitlement.licenseKey).toBe(null);
    expect(r.entitlement.instanceId).toBe(null);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("IMPORT-SKIP-LICENSE-KEY"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("IMPORT-SKIP-INSTANCE-ID"));
    errorSpy.mockRestore();
  });

  it("#424: accepts a licenseKey/instanceId at exactly the 200-char boundary and preserves valid hyphenated content", () => {
    const exactly200 = "A".repeat(200);
    const backup = validBackup({
      entitlement: { licenseKey: exactly200, instanceId: "abc-123-DEF", licenseType: "subscription", unlockedPacks: ["it"], validUntil: null },
    });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entitlement.licenseKey).toBe(exactly200);
    expect(r.entitlement.instanceId).toBe("abc-123-DEF");
  });

  it("#424: a backup with no license (null licenseKey/instanceId) does not log a spurious drop warning", () => {
    // The common free-user case must stay silent — only a STRING that fails validation
    // should warn, not the normal null/absent shape.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = parseBackup(validBackup());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entitlement.licenseKey).toBe(null);
    expect(r.entitlement.instanceId).toBe(null);
    expect(warnSpy.mock.calls.some(args => String(args[0]).includes("IMPORT-SKIP-LICENSE-KEY"))).toBe(false);
    expect(warnSpy.mock.calls.some(args => String(args[0]).includes("IMPORT-SKIP-INSTANCE-ID"))).toBe(false);
    warnSpy.mockRestore();
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

  it("#477: rejects a numeric-string _version that looks like a plausible future version with the SPECIFIC newer-version message, not the generic one", () => {
    // Task #467 rejected every truthy non-number _version with the generic "missing
    // required fields" message — including a genuinely newer app version that ever
    // serializes _version as a string, exactly the scenario #467's own rationale cited.
    // #477 gives that specific case the same "update plyglt" message the numeric case gets.
    const backup = validBackup({ _version: "999" });
    const r = parseBackup(backup);
    expect(r).toEqual({
      ok: false,
      error: `This backup was created by a newer version of the app (backup v999, app supports v${CURRENT_BACKUP_VERSION}). Please update plyglt.`,
    });
  });

  it("#481: a numeric-string _version EQUAL to CURRENT_BACKUP_VERSION is accepted, symmetric with its numeric equivalent", () => {
    // Before #481, this exact case was REJECTED with the generic message even though the
    // numerically identical _version: CURRENT_BACKUP_VERSION (number) is accepted — an
    // unjustified asymmetry between two serializations of the same real version.
    const backup = validBackup({ _version: String(CURRENT_BACKUP_VERSION) });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
  });

  it("#481: a numeric-string _version strictly LOWER than CURRENT_BACKUP_VERSION is also accepted (not just the boundary-equal case)", () => {
    const backup = validBackup({ _version: "1" });
    const r = parseBackup(backup);
    expect(r.ok).toBe(true);
  });

  it("#477: a non-numeric string _version gets the generic message, not the newer-version one", () => {
    const backup = validBackup({ _version: "not-a-version" });
    const r = parseBackup(backup);
    expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
  });

  it("#467: rejects other non-number truthy _version shapes (object, array, boolean) with the generic message", () => {
    expect(parseBackup(validBackup({ _version: {} }))).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    expect(parseBackup(validBackup({ _version: [2] }))).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    expect(parseBackup(validBackup({ _version: true }))).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
  });

  describe("Task #479 — isFinite, not isNaN, rejects Infinity/hex/fractional _version values", () => {
    it("rejects a string _version of \"Infinity\" with the generic message, not the newer-version one", () => {
      // Number("Infinity") === Infinity, and the pre-#479 check was `!isNaN(parsedVersion)`
      // — isNaN(Infinity) is false, so this string passed straight into the newer-version
      // branch and produced the nonsensical "backup vInfinity...update plyglt" message.
      const r = parseBackup(validBackup({ _version: "Infinity" }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("rejects a raw JSON literal that overflows to numeric Infinity (e.g. 1e400), not just the string form", () => {
      // JSON.parse("1e400") is valid JSON syntax that produces the JS value Infinity
      // (typeof "number") — no string coercion involved at all. The sibling numeric branch
      // had the identical isFinite gap Task #467 left unfixed two waves ago.
      const backup = JSON.parse(`{"_version":1e400,"srs":{},"entitlement":{"licenseKey":null,"instanceId":null,"licenseType":"free","unlockedPacks":["it"],"validUntil":null}}`) as Record<string, unknown>;
      const r = parseBackup(backup);
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("rejects a numeric _version of -Infinity (truthy, so the old !data._version falsy check alone would not catch it)", () => {
      const r = parseBackup(validBackup({ _version: -Infinity }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("rejects a hex-looking string _version (\"0x10\") instead of silently coercing it to 16", () => {
      // Number("0x10") === 16 — a plain isFinite() check alone would NOT catch this (16 is
      // finite); the fix requires validating the string is digits-only BEFORE any numeric
      // coercion, not just checking the coerced result.
      const r = parseBackup(validBackup({ _version: "0x10" }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("rejects fractional string _version values (\"2.5\", \"999.5\") rather than treating them as plausible versions", () => {
      expect(parseBackup(validBackup({ _version: "2.5" }))).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
      expect(parseBackup(validBackup({ _version: "999.5" }))).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });
  });

  describe("Task #485 — string and numeric _version branches must agree on 0 and negative values", () => {
    // Before #485, the two branches implied "positive" two different, accidental ways: the
    // numeric branch used `!data._version` (JS truthiness — rejects exactly 0, but NOT
    // -1/-2/etc., which are truthy) while the string branch used a digits-only regex
    // (which can't syntactically represent a negative number at all, so "-1" was rejected
    // for a reason unrelated to its actual value). The two implicit floors disagreed on
    // both 0 and negative integers — string "0" was accepted while numeric 0 was rejected,
    // and numeric -1 was accepted while string "-1" was rejected.

    it("rejects _version: 0 (number) with the generic message", () => {
      const r = parseBackup(validBackup({ _version: 0 }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("rejects _version: \"0\" (string) with the generic message — must agree with the numeric case above", () => {
      const r = parseBackup(validBackup({ _version: "0" }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("rejects _version: -1 (number) with the generic message", () => {
      const r = parseBackup(validBackup({ _version: -1 }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("rejects _version: \"-1\" (string) with the generic message — must agree with the numeric case above", () => {
      const r = parseBackup(validBackup({ _version: "-1" }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("both serializations of the same nominal value always produce the SAME ok result, across a sweep of representative values", () => {
      // Direct proof of the symmetry property itself, not just spot-checked individual
      // values — the exact property whose violation was this finding.
      const values = [0, -1, -2, 1, 2, 3, 999, -Infinity, Infinity];
      for (const v of values) {
        const numResult = parseBackup(validBackup({ _version: v }));
        const strResult = parseBackup(validBackup({ _version: String(v) }));
        expect(strResult.ok, `_version ${v} vs "${String(v)}" disagree`).toBe(numResult.ok);
      }
    });
  });

  describe("Task #486 — numeric _version branch rejects fractional values", () => {
    // #485 deliberately left the shared predicate without a Number.isInteger check — a
    // fractional numeric _version (e.g. 1.5) was still silently accepted. #479's own inline
    // comment claimed the numeric branch got "the identical isFinite gap" fix as the string
    // branch and that this closed the gap; it ported isFinite but not the accompanying
    // digits-only shape constraint the string branch's regex enforces for free.

    it("rejects _version: 1.5 (number) with the generic message", () => {
      const r = parseBackup(validBackup({ _version: 1.5 }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("rejects _version: -0.0001 (number) with the generic message", () => {
      const r = parseBackup(validBackup({ _version: -0.0001 }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });

    it("string branch already rejects fractional _version values symmetrically — no code change needed there", () => {
      // The digits-only regex (/^\d+$/) has no decimal point, so it already rejects a
      // fractional numeric-looking string by construction. Verified explicitly rather than
      // assumed, per this task's acceptance criteria.
      const r = parseBackup(validBackup({ _version: "1.5" }));
      expect(r).toEqual({ ok: false, error: "Invalid backup file — missing required fields." });
    });
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
