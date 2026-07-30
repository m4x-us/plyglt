// ============================================================
// tests/lintCardQuality.test.ts — regression coverage for scripts/lintCardQuality.ts
// ============================================================
// Born from the 2026-07-30 content audit: two independent reviews scored shipped A1/A2
// content 61/100 and 74/100, and every concrete defect found (empty hints, exact-duplicate
// cards, a whole unit missing its grammar tier) was something a mechanical gate should have
// caught before it shipped. Each test below targets exactly one such defect class — per the
// Deletion Test (AGENTS.md Rule 16), deleting the corresponding production check should make
// that specific test fail.

import { describe, it, expect } from "vitest";
import {
  checkTierBalance,
  checkDensityFloor,
  checkGlobalSentenceDuplicates,
  checkEmptyHints,
  checkTier1Context,
  checkTier4Passage,
  checkWithinUnitDuplicates,
  checkCrossUnitPhraseDuplicates,
  lintCardQuality,
  buildBaseline,
  EMPTY_BASELINE,
  type LintPack,
  type LintCard,
} from "@/scripts/lintCardQuality";

function card(overrides: Partial<LintCard> & { id: string }): LintCard {
  return {
    type: "produce",
    prompt: "hello",
    accepted: ["ciao"],
    hint: "a greeting",
    tier: 1,
    ...overrides,
  };
}

describe("checkTierBalance", () => {
  it("flags a unit missing tier 2 entirely — the exact A1 unit 08/09/10 bug", () => {
    const pack: LintPack = {
      units: [
        {
          id: "a1-unit-09-colors",
          cards: [
            card({ id: "c1", tier: 1 }),
            card({ id: "c2", tier: 3 }),
            card({ id: "c3", tier: 4 }),
          ],
        },
      ],
    };
    const violations = checkTierBalance(pack);
    expect(violations).toEqual([
      { rule: "tier-imbalance", gate: "hard", unitId: "a1-unit-09-colors", detail: "unit has zero tier-2 cards" },
    ]);
  });

  it("passes a unit with all 4 tiers present", () => {
    const pack: LintPack = {
      units: [
        {
          id: "a1-unit-01",
          cards: [1, 2, 3, 4].map((tier) => card({ id: `c${tier}`, tier })),
        },
      ],
    };
    expect(checkTierBalance(pack)).toEqual([]);
  });
});

describe("checkDensityFloor", () => {
  it("flags a unit below 70% of its level's median, computed from the pack not a hardcoded number", () => {
    const pack: LintPack = {
      units: [
        { id: "a1-unit-01-a", cards: Array.from({ length: 120 }, (_, i) => card({ id: `a${i}`, tier: (i % 4) + 1 })) },
        { id: "a1-unit-02-b", cards: Array.from({ length: 120 }, (_, i) => card({ id: `b${i}`, tier: (i % 4) + 1 })) },
        { id: "a1-unit-03-thin", cards: Array.from({ length: 50 }, (_, i) => card({ id: `t${i}`, tier: (i % 4) + 1 })) },
      ],
    };
    const violations = checkDensityFloor(pack);
    expect(violations).toEqual([
      { rule: "density-floor", gate: "hard", unitId: "a1-unit-03-thin", detail: "50 cards is below 70% of the a1 median (120, floor 84)" },
    ]);
  });

  it("passes when every unit is within the floor", () => {
    const pack: LintPack = {
      units: [
        { id: "a1-unit-01", cards: Array.from({ length: 120 }, (_, i) => card({ id: `a${i}`, tier: (i % 4) + 1 })) },
        { id: "a1-unit-02", cards: Array.from({ length: 100 }, (_, i) => card({ id: `b${i}`, tier: (i % 4) + 1 })) },
      ],
    };
    expect(checkDensityFloor(pack)).toEqual([]);
  });

  it("does not count a deprecated card toward a unit's density — a retired card is not live content", () => {
    // All three units have the same RAW card count (120) — a version of checkDensityFloor
    // that counted deprecated cards would see identical densities everywhere and flag
    // nothing. Only unit-c's LIVE count (50, the rest retired) is actually thin.
    const pack: LintPack = {
      units: [
        { id: "a1-unit-01-a", cards: Array.from({ length: 120 }, (_, i) => card({ id: `a${i}`, tier: (i % 4) + 1 })) },
        { id: "a1-unit-02-b", cards: Array.from({ length: 120 }, (_, i) => card({ id: `b${i}`, tier: (i % 4) + 1 })) },
        {
          id: "a1-unit-03-thin",
          cards: [
            ...Array.from({ length: 50 }, (_, i) => card({ id: `c${i}`, tier: (i % 4) + 1 })),
            ...Array.from({ length: 70 }, (_, i) => card({ id: `dep${i}`, tier: (i % 4) + 1, deprecated: true })),
          ],
        },
      ],
    };
    const violations = checkDensityFloor(pack);
    expect(violations).toEqual([
      { rule: "density-floor", gate: "hard", unitId: "a1-unit-03-thin", detail: "50 cards is below 70% of the a1 median (120, floor 84)" },
    ]);
  });
});

describe("checkGlobalSentenceDuplicates", () => {
  it("flags two fill_blank cards in different units sharing the exact same sentence", () => {
    const pack: LintPack = {
      units: [
        { id: "unit-a", cards: [card({ id: "a1", type: "fill_blank", prompt: "Ieri sono andato al ___.", tier: 2 })] },
        { id: "unit-b", cards: [card({ id: "b1", type: "fill_blank", prompt: "Ieri sono andato al ___.", tier: 2 })] },
      ],
    };
    const violations = checkGlobalSentenceDuplicates(pack);
    expect(violations).toEqual([
      { rule: "global-sentence-duplicate", gate: "hard", unitId: "unit-b", cardId: "b1", detail: 'duplicates a1 (unit-a): "Ieri sono andato al ___."' },
    ]);
  });

  it("does not flag a short tier-1 word pair recurring across units", () => {
    const pack: LintPack = {
      units: [
        { id: "unit-a", cards: [card({ id: "a1", type: "produce", prompt: "hello", tier: 1 })] },
        { id: "unit-b", cards: [card({ id: "b1", type: "produce", prompt: "hello", tier: 1 })] },
      ],
    };
    expect(checkGlobalSentenceDuplicates(pack)).toEqual([]);
  });
});

describe("checkEmptyHints", () => {
  it("flags a card with an empty-string hint and one with a whitespace-only hint, not one with a real hint", () => {
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", hint: "" }),
            card({ id: "c2", hint: "   " }),
            card({ id: "c3", hint: "a real hint" }),
          ],
        },
      ],
    };
    expect(checkEmptyHints(pack)).toEqual(["c1", "c2"]);
  });
});

describe("checkTier1Context", () => {
  it("flags a tier-1 word that never appears in any tier-2/3/4 card in its unit", () => {
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", type: "recognize", prompt: "rosso", accepted: ["red"], tier: 1 }),
            card({ id: "c2", type: "fill_blank", prompt: "La sciarpa è ___.", accepted: ["verde"], tier: 2 }),
          ],
        },
      ],
    };
    expect(checkTier1Context(pack)).toEqual(["c1"]);
  });

  it("does not flag a tier-1 word that appears in a same-unit tier-3 sentence", () => {
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", type: "recognize", prompt: "rosso", accepted: ["red"], tier: 1 }),
            card({ id: "c2", type: "produce", prompt: "traffic light color", accepted: ["Il semaforo è rosso."], tier: 3 }),
          ],
        },
      ],
    };
    expect(checkTier1Context(pack)).toEqual([]);
  });

  it("does not require a parenthetical preposition annotation to appear verbatim in a sentence", () => {
    // Real false negative caught during the 2026-07-30 wave-1 backfill: "innamorarsi (di)"
    // documents the governing preposition, but "(di)" can never appear as literal prose — a
    // sentence using "innamorarsi" naturally (e.g. "si sono innamorati subito") must satisfy
    // this check, not be permanently unfixable.
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", type: "recognize", prompt: "innamorarsi (di)", accepted: ["to fall in love (with)"], tier: 1 }),
            card({ id: "c2", type: "produce", prompt: "he didn't want to fall in love again", accepted: ["Non voleva innamorarsi di nuovo."], tier: 3 }),
          ],
        },
      ],
    };
    expect(checkTier1Context(pack)).toEqual([]);
  });

  it("strips an elided article (l'abbraccio) with no space after the apostrophe", () => {
    // Real bug caught during the 2026-07-30 wave-1 backfill: the old regex only matched
    // "l' " (with a following space), which a real elided article never has — "l'abbraccio"
    // silently required the article+noun as one un-splittable unit that could never match.
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", type: "recognize", prompt: "l'abbraccio", accepted: ["the hug"], tier: 1 }),
            card({ id: "c2", type: "produce", prompt: "the hug was long", accepted: ["L'abbraccio è stato lungo."], tier: 3 }),
          ],
        },
      ],
    };
    expect(checkTier1Context(pack)).toEqual([]);
  });

  it("finds a short 2-character word (il tè -> tè) that genuinely has context", () => {
    // Real bug caught during the 2026-07-30 passage backfill: "il tè" strips its article to
    // "tè" (2 chars) — a >=3 length floor silently excluded it from every search, flagging it
    // as missing context even when a real sentence like "Il tè nella tazza è già freddo."
    // already covered it. Short real Italian words must still be searched for.
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", type: "produce", prompt: "the tea", accepted: ["il tè"], tier: 1 }),
            card({ id: "c2", type: "produce", prompt: "the tea in the cup is cold", accepted: ["Il tè nella tazza è freddo."], tier: 3 }),
          ],
        },
      ],
    };
    expect(checkTier1Context(pack)).toEqual([]);
  });
});

describe("checkTier4Passage", () => {
  it("flags a tier-4 card that is a standalone produce sentence instead of passage_cloze", () => {
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", type: "produce", prompt: "I have to work today.", tier: 4 }),
            card({ id: "c2", type: "passage_cloze", prompt: "Marco è andato al mercato...", tier: 4 }),
          ],
        },
      ],
    };
    expect(checkTier4Passage(pack)).toEqual(["c1"]);
  });
});

describe("checkWithinUnitDuplicates", () => {
  it("flags the same prompt+accepted pair shelved under two different tiers in one unit", () => {
    const pack: LintPack = {
      units: [
        {
          id: "a1-unit-01",
          cards: [
            card({ id: "u01-t2-009", prompt: "how are you? (informal)", accepted: ["Come stai?"], tier: 2 }),
            card({ id: "u01-t3-001", prompt: "how are you? (informal)", accepted: ["Come stai?"], tier: 3 }),
          ],
        },
      ],
    };
    const violations = checkWithinUnitDuplicates(pack);
    expect(violations).toEqual([
      { key: "a1-unit-01::produce::how are you? (informal)::come stai?", unitId: "a1-unit-01", cardIds: ["u01-t2-009", "u01-t3-001"] },
    ]);
  });

  it("does not flag two different cards in the same unit", () => {
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [card({ id: "c1", prompt: "hello" }), card({ id: "c2", prompt: "goodbye", accepted: ["ciao"] })],
        },
      ],
    };
    expect(checkWithinUnitDuplicates(pack)).toEqual([]);
  });

  it("no longer flags a duplicate once the redundant twin is retired via deprecated: true", () => {
    // Proves the actual fix applied to the real corpus: retiring a duplicate (rather than
    // deleting it, per scripts/checkCardIds.ts) resolves this violation instead of leaving
    // it permanently baselined — liveCards() excludes deprecated cards from detection.
    const pack: LintPack = {
      units: [
        {
          id: "a1-unit-01",
          cards: [
            card({ id: "u01-t2-009", prompt: "how are you? (informal)", accepted: ["Come stai?"], tier: 2 }),
            card({ id: "u01-t3-001", prompt: "how are you? (informal)", accepted: ["Come stai?"], tier: 3, deprecated: true }),
          ],
        },
      ],
    };
    expect(checkWithinUnitDuplicates(pack)).toEqual([]);
  });

  it("does not flag a legitimate recognize/produce pair for a word spelled identically in both languages", () => {
    // Real false positive caught during the 2026-07-30 backfill: "no", "beige", and "zero"
    // are spelled the same in Italian and English, so a recognize card (Italian shown,
    // English typed) and a produce card (English shown, Italian typed) for the same word
    // end up with the SAME normalized prompt+accepted — a legitimate 1-recognize+1-produce
    // pair per CURRICULUM.md's Tier 1 rule, not a duplicate. `type` must be part of the key.
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", type: "produce", prompt: "no", accepted: ["no"], tier: 1 }),
            card({ id: "c2", type: "recognize", prompt: "no", accepted: ["no"], tier: 1 }),
          ],
        },
      ],
    };
    expect(checkWithinUnitDuplicates(pack)).toEqual([]);
  });
});

describe("checkCrossUnitPhraseDuplicates", () => {
  it("flags an identical tier-3 phrase card duplicated across two different units", () => {
    const pack: LintPack = {
      units: [
        { id: "unit-a", cards: [card({ id: "a1", prompt: "to change one's mind", accepted: ["cambiare idea"], tier: 3 })] },
        { id: "unit-b", cards: [card({ id: "b1", prompt: "to change one's mind", accepted: ["cambiare idea"], tier: 3 })] },
      ],
    };
    const violations = checkCrossUnitPhraseDuplicates(pack);
    expect(violations).toEqual([
      { key: "produce::to change one's mind::cambiare idea", unitIds: ["unit-a", "unit-b"], cardIds: ["a1", "b1"] },
    ]);
  });

  it("does not flag a tier-1 word pair recurring across units (only tier 3/4 are checked)", () => {
    const pack: LintPack = {
      units: [
        { id: "unit-a", cards: [card({ id: "a1", prompt: "hello", tier: 1 })] },
        { id: "unit-b", cards: [card({ id: "b1", prompt: "hello", tier: 1 })] },
      ],
    };
    expect(checkCrossUnitPhraseDuplicates(pack)).toEqual([]);
  });
});

describe("lintCardQuality — baseline ratchet behavior", () => {
  function distinctCard(tier: number, hint: string): LintCard {
    return card({
      id: `existing-${tier}`,
      tier,
      hint,
      type: tier === 4 ? "passage_cloze" : "produce",
      prompt: `distinct prompt for tier ${tier}`,
      accepted: [`distinct answer ${tier}`],
    });
  }

  const baseUnitCards: LintCard[] = [1, 2, 3, 4].map((tier) => distinctCard(tier, tier === 1 ? "" : "fine"));

  const packWithOneEmptyHint: LintPack = {
    units: [{ id: "unit-a", cards: baseUnitCards }],
  };

  it("does not fail on a baselined empty-hint card", () => {
    const baseline = { ...EMPTY_BASELINE, emptyHintCardIds: ["existing-1"], tier1NoContextCardIds: ["existing-1"] };
    const { violations } = lintCardQuality(packWithOneEmptyHint, baseline);
    expect(violations).toEqual([]);
  });

  it("fails on a NEW empty-hint card not present in the baseline", () => {
    const packWithNewViolation: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            ...baseUnitCards,
            card({ id: "brand-new-card", type: "fill_blank", prompt: "unrelated new sentence", tier: 2, hint: "" }),
          ],
        },
      ],
    };
    const baseline = { ...EMPTY_BASELINE, emptyHintCardIds: ["existing-1"], tier1NoContextCardIds: ["existing-1"] };
    const { violations } = lintCardQuality(packWithNewViolation, baseline);
    expect(violations).toEqual([
      { rule: "empty-hint", gate: "baseline-new", unitId: "unit-a", cardId: "brand-new-card", detail: "card has no hint and is not in the baseline — new cards must ship with a hint" },
    ]);
  });

  it("reports a resolved count when a previously-baselined violation no longer reproduces", () => {
    const fixedPack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [1, 2, 3, 4].map((tier) => distinctCard(tier, "fine")),
        },
      ],
    };
    const baseline = { ...EMPTY_BASELINE, emptyHintCardIds: ["existing-1"], tier1NoContextCardIds: ["existing-1"] };
    const { violations, resolvedCounts } = lintCardQuality(fixedPack, baseline);
    expect(violations).toEqual([]);
    expect(resolvedCounts.emptyHint).toBe(1);
  });
});

describe("buildBaseline", () => {
  it("captures the exact current violations so re-running --update-baseline is idempotent", () => {
    const pack: LintPack = {
      units: [
        {
          id: "unit-a",
          cards: [
            card({ id: "c1", tier: 1, hint: "" }),
            card({ id: "c2", type: "fill_blank", prompt: "La sciarpa è ___.", accepted: ["verde"], tier: 2 }),
            card({ id: "c3", tier: 3 }),
            card({ id: "c4", type: "produce", prompt: "standalone sentence", tier: 4 }),
          ],
        },
      ],
    };
    const baseline = buildBaseline(pack);
    expect(baseline.emptyHintCardIds).toEqual(["c1"]);
    expect(baseline.tier4NotPassageCardIds).toEqual(["c4"]);

    const { violations } = lintCardQuality(pack, baseline);
    expect(violations).toEqual([]);
  });
});
