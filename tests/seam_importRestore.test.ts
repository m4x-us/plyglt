// @vitest-environment jsdom
// ===========================================
// SEAM TEST — parseBackup → setState → getDueCards
// ===========================================
// Covers the backup restore path end-to-end, crossing the lib/importBackup.ts
// seam into store/srsStore.ts. Guards against: parseBackup returning valid data
// that nonetheless corrupts store state (e.g. wrong dueDate types), and
// getDueCards silently returning wrong results after a restore.
//
// Task #393: also covers the entitlement-restore seam through
// hooks/useExportImport.ts's readFile — a license-less backup must never
// downgrade an active subscription (Task #391), and the success message must
// say so. jsdom environment is required here for FileReader/File and the
// useRef/useState hooks inside useExportImport.
// ===========================================

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Card } from "@/content/types";
import { parseBackup } from "@/lib/importBackup";
import { useSRSStore } from "@/store/srsStore";
import { useEntitlementStore } from "@/store/entitlementStore";
import { useExportImport } from "@/hooks/useExportImport";
import type { PackCode } from "@/lib/langRegistry";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAST_DATE = 1_000_000;           // Unix ms — safely in the past
const FUTURE_DATE = 99_999_999_999_999; // Unix ms — safely in the future

function makeBackupJson(overrides: Record<string, unknown> = {}): unknown {
  return {
    _version: 2,
    langPair: "en-it",
    srs: {
      cards: {
        "card-due": {
          cardId: "card-due",
          state: "review",
          stability: 1.5,
          difficulty: 5,
          retrievability: 0.9,
          dueDate: PAST_DATE,
          lapses: 0,
          reps: 3,
        },
        "card-not-due": {
          cardId: "card-not-due",
          state: "review",
          stability: 2,
          difficulty: 5,
          retrievability: 0.95,
          dueDate: FUTURE_DATE,
          lapses: 0,
          reps: 1,
        },
      },
      streak: 5,
      lastStudiedDate: "2026-06-25",
    },
    entitlement: {
      licenseKey: null,
      instanceId: null,
      licenseType: "free",
      unlockedPacks: [],
      validUntil: null,
    },
    ...overrides,
  };
}

function makeCard(id: string): Card {
  return {
    id,
    type: "produce",
    prompt: "test",
    accepted: ["risposta"],
    tags: [],
    tier: 1,
  };
}

function resetEntitlementState() {
  useEntitlementStore.setState({
    licenseKey: null,
    instanceId: null,
    licenseType: "free",
    unlockedPacks: [],
    purchasedAddOns: [],
    lastValidated: 0,
    validUntil: null,
  });
}

/** Wraps JSON in a real File so FileReader (used by readFile) can read it. */
function makeBackupFile(backup: unknown): File {
  return new File([JSON.stringify(backup)], "backup.json", { type: "application/json" });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset store to empty state before each test
  useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null });
  resetEntitlementState();
  // getLangPair() falls back to "en-it" when unset, matching makeBackupJson's default
  // langPair — clear any value a prior test left behind so that fallback is deterministic.
  window.localStorage.clear();
});

describe("seam: parseBackup → setState → getDueCards", () => {
  // Step 1–2: parseBackup accepts a valid backup and returns ok:true
  it("parseBackup returns ok:true for a valid backup", () => {
    const result = parseBackup(makeBackupJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.srs.cards["card-due"]?.dueDate).toBe(PAST_DATE);
    expect(result.srs.cards["card-due"]?.stability).toBe(1.5);
    expect(result.srs.cards["card-due"]?.state).toBe("review");
    expect(result.srs.cards["card-not-due"]?.dueDate).toBe(FUTURE_DATE);
    expect(result.srs.cards["card-not-due"]?.stability).toBe(2);
    expect(result.srs.cards["card-not-due"]?.state).toBe("review");
    expect(result.srs.streak).toBe(5);
  });

  // Step 3: useSRSStore.setState accepts BackupSrs.cards without TypeScript/runtime error
  it("useSRSStore.setState applies backup card progress without error", () => {
    const result = parseBackup(makeBackupJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(() =>
      useSRSStore.setState({
        cards: result.srs.cards,
        streak: result.srs.streak,
        lastStudiedDate: result.srs.lastStudiedDate,
      })
    ).not.toThrow();

    const { cards } = useSRSStore.getState();
    expect(cards["card-due"]?.reps).toBe(3);
    expect(cards["card-not-due"]?.reps).toBe(1);
  });

  // Step 4–5: getDueCards returns the due card and excludes the non-due card
  it("getDueCards returns the due card and not the non-due card after restore", () => {
    const result = parseBackup(makeBackupJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    useSRSStore.setState({
      cards: result.srs.cards,
      streak: result.srs.streak,
      lastStudiedDate: result.srs.lastStudiedDate,
    });

    const mockCards: Card[] = [
      makeCard("card-due"),
      makeCard("card-not-due"),
    ];

    const due = useSRSStore.getState().getDueCards(mockCards);
    expect(due).toContain("card-due");
    expect(due).not.toContain("card-not-due");
  });

  // Step 6: getDueCards does not throw when a card ID is absent from the restored store
  it("getDueCards does not throw for card IDs not present in the backup", () => {
    const result = parseBackup(makeBackupJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    useSRSStore.setState({ cards: result.srs.cards, streak: 0, lastStudiedDate: null });

    const unknownCards: Card[] = [
      makeCard("card-not-in-backup"),
      makeCard("another-unknown-id"),
    ];

    let due: string[] | undefined;
    expect(() => {
      due = useSRSStore.getState().getDueCards(unknownCards);
    }).not.toThrow();
    // Cards with no progress (reps=0 / undefined) are never due
    expect(due).toEqual([]);
  });

  // Additional guard: due card has dueDate in past (sanity check on normalizeCardProgress)
  it("restored due card has dueDate in the past (normalizeCardProgress preserved the value)", () => {
    const result = parseBackup(makeBackupJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dueCard = result.srs.cards["card-due"];
    expect(dueCard?.dueDate).toBe(PAST_DATE);
    expect(dueCard?.stability).toBe(1.5);
    expect(dueCard?.reps).toBe(3);
    expect(dueCard!.dueDate).toBeLessThan(Date.now());
  });

  // Regression guard: parseBackup rejects an invalid backup gracefully
  it("parseBackup returns ok:false for a backup missing required fields", () => {
    const result = parseBackup({ _version: 2 }); // no srs, no entitlement
    expect(result.ok).toBe(false);
  });
});

describe("seam: entitlement restore via useExportImport.readFile (Task #393)", () => {
  // Task #391: a backup missing licenseKey or instanceId must never touch the session's
  // current entitlement — setEntitlement's contract requires both fields, and an unsigned
  // backup must not be able to downgrade or wipe an active license.
  it("leaves an active subscription's entitlement state untouched when the backup has no license", async () => {
    const activeSubscription = {
      licenseKey: "EXISTING-KEY",
      instanceId: "EXISTING-INSTANCE",
      licenseType: "subscription" as const,
      unlockedPacks: ["it", "es"] as PackCode[],
      purchasedAddOns: ["it-medical"],
      lastValidated: 123456,
      validUntil: FUTURE_DATE,
    };
    useEntitlementStore.setState(activeSubscription);

    const { result } = renderHook(() => useExportImport());
    const file = makeBackupFile(makeBackupJson()); // default entitlement: licenseKey/instanceId both null

    await act(async () => {
      await result.current.readFile(file);
    });

    const stateAfter = useEntitlementStore.getState();
    expect(stateAfter.licenseKey).toBe("EXISTING-KEY");
    expect(stateAfter.instanceId).toBe("EXISTING-INSTANCE");
    expect(stateAfter.licenseType).toBe("subscription");
    expect(stateAfter.unlockedPacks).toEqual(["it", "es"]);
    expect(stateAfter.purchasedAddOns).toEqual(["it-medical"]);
    expect(stateAfter.validUntil).toBe(FUTURE_DATE);
    expect(stateAfter.lastValidated).toBe(123456);
  });

  it("reports the exact license-unchanged success message for a license-less backup", async () => {
    const { result } = renderHook(() => useExportImport());
    const file = makeBackupFile(makeBackupJson());

    await act(async () => {
      await result.current.readFile(file);
    });

    expect(result.current.dataStatus).toEqual({
      type: "success",
      message: "Restored 2 card(s) of progress. No license in backup — license unchanged.",
    });
  });

  it("restores the license and reports no license note when both licenseKey and instanceId are present", async () => {
    const { result } = renderHook(() => useExportImport());
    const backup = makeBackupJson({
      entitlement: {
        licenseKey: "NEW-KEY",
        instanceId: "NEW-INSTANCE",
        licenseType: "subscription",
        unlockedPacks: ["it"],
        validUntil: FUTURE_DATE,
      },
    });
    const file = makeBackupFile(backup);

    await act(async () => {
      await result.current.readFile(file);
    });

    const stateAfter = useEntitlementStore.getState();
    expect(stateAfter.licenseKey).toBe("NEW-KEY");
    expect(stateAfter.instanceId).toBe("NEW-INSTANCE");
    expect(stateAfter.licenseType).toBe("subscription");
    expect(stateAfter.unlockedPacks).toEqual(["it"]);
    expect(stateAfter.validUntil).toBe(FUTURE_DATE);
    // Task #342: purchasedAddOns is excluded from setEntitlement's parameter type — a
    // backup can never restore add-on purchases, only a real receipt via purchaseAddOn().
    expect(stateAfter.purchasedAddOns).toEqual([]);

    expect(result.current.dataStatus).toEqual({
      type: "success",
      message: "Restored 2 card(s) of progress.",
    });
  });

  // Task #426: the two tests above only ever restore into an entitlement whose
  // purchasedAddOns already starts at [] — a setEntitlement that explicitly reset
  // purchasedAddOns to [] as part of a "full replace" of the entitlement (instead of
  // omitting it, which preserves whatever was already there) would produce the exact
  // same observed [] and pass unnoticed. Seeding a genuinely non-empty purchasedAddOns
  // before restoring closes that gap.
  it("preserves a non-empty purchasedAddOns across a license restore (#426)", async () => {
    useEntitlementStore.setState({ purchasedAddOns: ["it-medical", "it-legal"] });

    const { result } = renderHook(() => useExportImport());
    const backup = makeBackupJson({
      entitlement: {
        licenseKey: "NEW-KEY",
        instanceId: "NEW-INSTANCE",
        licenseType: "subscription",
        unlockedPacks: ["it"],
        validUntil: FUTURE_DATE,
      },
    });
    const file = makeBackupFile(backup);

    await act(async () => {
      await result.current.readFile(file);
    });

    const stateAfter = useEntitlementStore.getState();
    expect(stateAfter.licenseKey).toBe("NEW-KEY");
    expect(stateAfter.purchasedAddOns).toEqual(["it-medical", "it-legal"]);
  });
});
