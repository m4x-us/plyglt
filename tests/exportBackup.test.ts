import { describe, it, expect } from "vitest";
import { exportBackup } from "@/lib/exportBackup";
import { CURRENT_BACKUP_VERSION } from "@/lib/importBackup";
import type { BackupSrs, BackupEntitlement } from "@/lib/importBackup";

const baseSrs: BackupSrs = {
  cards: {
    "it-a1-01-vocabolario-001": {
      cardId: "it-a1-01-vocabolario-001",
      state: "review",
      stability: 14,
      difficulty: 4.5,
      retrievability: 0.92,
      dueDate: 1_700_000_000_000,
      lapses: 0,
      reps: 5,
    },
  },
  streak: 3,
  lastStudiedDate: "2026-06-27",
};

const baseEntitlement: BackupEntitlement = {
  licenseKey: "TEST-ABCD-1234-EFGH",
  instanceId: "inst-00001",
  licenseType: "subscription",
  unlockedPacks: ["it"],
  validUntil: 1_800_000_000_000,
};

describe("exportBackup()", () => {
  it("returns parseable JSON", () => {
    const result = exportBackup(baseSrs, baseEntitlement, "en-it");
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("contains _version: CURRENT_BACKUP_VERSION", () => {
    const parsed = JSON.parse(exportBackup(baseSrs, baseEntitlement, "en-it"));
    expect(parsed._version).toBe(CURRENT_BACKUP_VERSION);
  });

  it("contains the supplied langPair", () => {
    const parsed = JSON.parse(exportBackup(baseSrs, baseEntitlement, "en-it"));
    expect(parsed.langPair).toBe("en-it");
  });

  it("contains srs.cards key", () => {
    const parsed = JSON.parse(exportBackup(baseSrs, baseEntitlement, "en-it"));
    expect(parsed.srs).toBeDefined();
    expect(parsed.srs.cards).toBeDefined();
  });

  it("srs payload matches input — cards, streak, lastStudiedDate", () => {
    const parsed = JSON.parse(exportBackup(baseSrs, baseEntitlement, "en-it"));
    expect(parsed.srs.streak).toBe(3);
    expect(parsed.srs.lastStudiedDate).toBe("2026-06-27");
    expect(Object.keys(parsed.srs.cards)).toHaveLength(1);
  });

  it("entitlement payload matches input", () => {
    const parsed = JSON.parse(exportBackup(baseSrs, baseEntitlement, "en-it"));
    expect(parsed.entitlement.licenseKey).toBe("TEST-ABCD-1234-EFGH");
    expect(parsed.entitlement.licenseType).toBe("subscription");
  });

  it("different langPairs produce different outputs", () => {
    const a = JSON.parse(exportBackup(baseSrs, baseEntitlement, "en-it"));
    const b = JSON.parse(exportBackup(baseSrs, baseEntitlement, "en-fr"));
    expect(a.langPair).toBe("en-it");
    expect(b.langPair).toBe("en-fr");
  });
});
