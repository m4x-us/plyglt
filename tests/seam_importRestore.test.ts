// ===========================================
// SEAM TEST — parseBackup → setState → getDueCards
// ===========================================
// Covers the backup restore path end-to-end, crossing the lib/importBackup.ts
// seam into store/srsStore.ts. Guards against: parseBackup returning valid data
// that nonetheless corrupts store state (e.g. wrong dueDate types), and
// getDueCards silently returning wrong results after a restore.
// ===========================================

import { describe, it, expect, beforeEach } from "vitest";
import type { Card } from "@/content/types";
import { parseBackup } from "@/lib/importBackup";
import { useSRSStore } from "@/store/srsStore";

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

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset store to empty state before each test
  useSRSStore.setState({ cards: {}, streak: 0, lastStudiedDate: null, activeSession: null });
});

describe("seam: parseBackup → setState → getDueCards", () => {
  // Step 1–2: parseBackup accepts a valid backup and returns ok:true
  it("parseBackup returns ok:true for a valid backup", () => {
    const result = parseBackup(makeBackupJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.srs.cards["card-due"]).toBeDefined();
    expect(result.srs.cards["card-not-due"]).toBeDefined();
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
    expect(dueCard).toBeDefined();
    expect(dueCard!.dueDate).toBe(PAST_DATE);
    expect(dueCard!.dueDate).toBeLessThan(Date.now());
  });

  // Regression guard: parseBackup rejects an invalid backup gracefully
  it("parseBackup returns ok:false for a backup missing required fields", () => {
    const result = parseBackup({ _version: 2 }); // no srs, no entitlement
    expect(result.ok).toBe(false);
  });
});
