#!/usr/bin/env tsx
// ============================================================
// lintCardQuality.ts — CI guard: enforces CURRICULUM.md's Card Quality Standards mechanically
// ============================================================
/**
 * scripts/lintCardQuality.ts — mechanical quality gate for compiled pack JSON.
 *
 * Born from the 2026-07-30 content audit (two independent adversarial reviews scored the
 * shipped A1/A2 content 61/100 and 74/100): every real defect found was something a script
 * could have caught before it shipped — empty hints, exact duplicate cards, a whole unit
 * missing its grammar tier. Prose review alone let quality drift unit-to-unit with no floor.
 *
 * Two tiers of rule:
 *
 *   HARD gates — zero tolerance, no exceptions, fail on ANY violation. Reserved for rules
 *   where the current corpus already has zero violations, so enforcing them going forward
 *   costs nothing and only prevents regression.
 *
 *   BASELINE (ratchet) gates — the corpus has real, large existing debt for these rules
 *   (e.g. 42% of tier-1 cards lack sentence context; 2,276 cards have no hint). Blocking on
 *   ALL of it today would halt the pipeline over a backlog, not a regression. Instead: every
 *   violation present at scripts/cardQualityBaseline.json's capture time is grandfathered;
 *   any violation NOT in the baseline (i.e. introduced by a card added or edited since) fails
 *   the gate. The baseline must only ever shrink — same ratchet convention as this project's
 *   coverage thresholds (AGENTS.md: "thresholds only ever increase — ratchet up, never down").
 *   Run `npx tsx scripts/lintCardQuality.ts <pack> <baseline> --update-baseline` after a
 *   content pass that fixes baselined debt to shrink the baseline file to match reality.
 *
 * Deliberately NOT a rule: "no exclamation marks" (BRAND.md's UI-copy voice rule). Checked
 * during design (2026-07-30): of 58 corpus-wide hits, the overwhelming majority are correct
 * Italian exclamatory content being taught ("Aiuto!", "Buongiorno!", "Che bella giornata!") —
 * genuinely different from an app writing chatty toast copy. A handful of hint-tone slips
 * ("same as English!") are real but not mechanically distinguishable from legitimate quoted
 * Italian without much higher false-positive risk. Left to human review; automating it here
 * would erode trust in the whole gate the first time it flags a correct card.
 *
 * Usage:
 *   npx tsx scripts/lintCardQuality.ts <pack.json> <baseline.json> [--update-baseline]
 *
 * Exit codes:
 *   0 — all hard gates clean, no new baseline violations
 *   1 — a hard-gate violation, or a NEW baseline violation, was found
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LintCard {
  id: string;
  type: string;
  prompt: string;
  accepted: string[];
  hint?: string;
  tier: number;
  deprecated?: boolean;
}

export interface LintUnit {
  id: string;
  level?: string;
  cards: LintCard[];
}

// A retired card (Card.deprecated === true — see lib/packTypes.ts's excludeDeprecatedCards)
// is never shown to a real user, so it should not count toward density, tier balance, hint
// coverage, or duplicate detection either — every rule below operates on liveCards(unit),
// never unit.cards directly. This also means retiring a duplicate (rather than deleting it,
// per scripts/checkCardIds.ts) actually resolves the within-unit-duplicate violation instead
// of leaving it permanently baselined.
function liveCards(unit: LintUnit): LintCard[] {
  return unit.cards.filter((c) => c.deprecated !== true);
}

export interface LintPack {
  units: LintUnit[];
}

export interface Baseline {
  emptyHintCardIds: string[];
  tier1NoContextCardIds: string[];
  tier4NotPassageCardIds: string[];
  withinUnitDuplicateGroupKeys: string[];
  crossUnitPhraseDuplicateGroupKeys: string[];
}

export const EMPTY_BASELINE: Baseline = {
  emptyHintCardIds: [],
  tier1NoContextCardIds: [],
  tier4NotPassageCardIds: [],
  withinUnitDuplicateGroupKeys: [],
  crossUnitPhraseDuplicateGroupKeys: [],
};

export interface Violation {
  rule: string;
  gate: "hard" | "baseline-new";
  unitId: string;
  cardId?: string;
  detail: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// `type` is part of the identity, not just prompt+accepted: a recognize card and a produce
// card for the same word have prompt/accepted swapped, so a word spelled identically in
// Italian and English (e.g. "no", "beige", "zero" — invariable borrowings or coincidental
// overlap) produces the SAME normalized (prompt, accepted) pair for two cards that are a
// legitimate recognize+produce pair, not a duplicate. Caught during the 2026-07-30 backfill:
// the first version of this key without `type` false-flagged 3 genuine recognize/produce
// pairs as "within-unit duplicates" alongside 4 real ones.
function normKey(type: string, prompt: string, accepted: string[]): string {
  return `${type}::${normalize(prompt)}::${accepted.map(normalize).sort().join("|")}`;
}

// ── HARD gate 1 — every unit must have cards in all 4 tiers ───────────────────
// The exact bug class this rule exists to prevent already happened: 3 A1 units (08, 09, 10)
// shipped for an unknown length of time with zero tier-2 (grammar) cards despite each unit's
// entire theme BEING a grammar point (modal verbs, adjective agreement, "mi fa male") —
// caught only by a manual per-unit density audit on 2026-07-30, not by any existing gate.

export function checkTierBalance(pack: LintPack): Violation[] {
  const violations: Violation[] = [];
  for (const unit of pack.units) {
    const present = new Set(liveCards(unit).map((c) => c.tier));
    for (const tier of [1, 2, 3, 4]) {
      if (!present.has(tier)) {
        violations.push({
          rule: "tier-imbalance",
          gate: "hard",
          unitId: unit.id,
          detail: `unit has zero tier-${tier} cards`,
        });
      }
    }
  }
  return violations;
}

// ── HARD gate 2 — no unit may fall below 70% of its level's median card count ─
// Threshold is computed from the CURRENT pack, never hardcoded, so it self-adjusts as the
// corpus grows (same reasoning AGENTS.md applies to "no parallel list that should be derived
// from a single source of truth" — the floor derives from the data, not a magic number).

export function checkDensityFloor(pack: LintPack): Violation[] {
  const violations: Violation[] = [];
  const byLevel = new Map<string, { unitId: string; count: number }[]>();
  for (const unit of pack.units) {
    const level = unit.id.split("-unit-")[0] ?? "unknown";
    const list = byLevel.get(level) ?? [];
    list.push({ unitId: unit.id, count: liveCards(unit).length });
    byLevel.set(level, list);
  }
  for (const [level, list] of byLevel) {
    const sorted = [...list].sort((a, b) => a.count - b.count);
    const median = sorted[Math.floor(sorted.length / 2)]?.count ?? 0;
    const floor = median * 0.7;
    for (const { unitId, count } of list) {
      if (count < floor) {
        violations.push({
          rule: "density-floor",
          gate: "hard",
          unitId,
          detail: `${count} cards is below 70% of the ${level} median (${median}, floor ${floor.toFixed(0)})`,
        });
      }
    }
  }
  return violations;
}

// ── HARD gate 3 — no duplicate sentence among fill_blank/passage_cloze cards ──
// This is CURRICULUM.md's literal "no duplicate sentences across the entire deck" rule,
// scoped to the card types that are actually authored, full sentences (fill_blank prompts
// embed a full sentence with a blank; passage_cloze embeds a 60-80 word passage chunk).
// Tier-1/2 short word/phrase drills legitimately recur across units (CURRICULUM.md: "short
// vocabulary-phrase overlaps between related units are fine") and are deliberately excluded.

export function checkGlobalSentenceDuplicates(pack: LintPack): Violation[] {
  const violations: Violation[] = [];
  const seen = new Map<string, { unitId: string; cardId: string }>();
  for (const unit of pack.units) {
    for (const card of liveCards(unit)) {
      if (card.type !== "fill_blank" && card.type !== "passage_cloze") continue;
      const key = normalize(card.prompt);
      const prior = seen.get(key);
      if (prior) {
        violations.push({
          rule: "global-sentence-duplicate",
          gate: "hard",
          unitId: unit.id,
          cardId: card.id,
          detail: `duplicates ${prior.cardId} (${prior.unitId}): "${card.prompt}"`,
        });
      } else {
        seen.set(key, { unitId: unit.id, cardId: card.id });
      }
    }
  }
  return violations;
}

// ── BASELINE gate 1 — every card must have a non-empty hint ───────────────────
// The hint field is the exact mechanism that differentiates a curated card from a bare
// bilingual word list — plyglt's entire paid-content premise. 2,276/8,119 cards (28%) lack
// one as of the 2026-07-30 baseline capture; heavily concentrated in specific units (up to
// 79% empty in one unit) while other units are 100% populated — grandfathered as debt, but
// no new card may ship without one.

export function checkEmptyHints(pack: LintPack): string[] {
  const ids: string[] = [];
  for (const unit of pack.units) {
    for (const card of liveCards(unit)) {
      if (!card.hint || card.hint.trim() === "") {
        ids.push(card.id);
      }
    }
  }
  return ids;
}

// ── BASELINE gate 2 — tier-1 word must appear in a same-unit tier-2/3/4 card ──
// CURRICULUM.md: "Never introduce a word in isolation. The sentence is the unit of
// learning." Deliberately implemented WITHOUT a schema change (no new "example sentence"
// field on tier-1 cards) or UI change — that's a materially bigger product decision this
// gate doesn't make unilaterally. Instead this checks the weaker, still-real reading of the
// same rule: the word must appear in a genuine sentence card SOMEWHERE in its own unit, not
// necessarily embedded in the tier-1 card itself. Heuristic term extraction (strip leading
// articles, split on "/" for gender/number variants) will have some false positives/negatives
// on unusual phrasing — acceptable for a debt-tracking heuristic, not for a hard gate.

function extractItalianTerms(card: LintCard): string[] {
  const raw = card.type === "recognize" ? card.prompt : card.accepted.join(" / ");
  // Strip parenthetical annotations (e.g. "innamorarsi (di)", "trovarsi (bene/male)") BEFORE
  // splitting on "/" — the parenthetical documents a grammatical detail (governing
  // preposition, register variant) that can never appear as literal text in natural prose.
  // Found during the 2026-07-30 wave-1 backfill: requiring it verbatim produced an unfixable
  // false negative — content agents correctly refused to write "innamorarsi (di)" into a
  // sentence rather than game the checker.
  const withoutParens = raw.replace(/\([^)]*\)/g, " ");
  return withoutParens
    .split(/\s*\/\s*/)
    .map((p) => p.trim().toLowerCase()
      // Elided articles (l'abbraccio, l'impegno) have NO space after the apostrophe, unlike
      // the other articles below — matched separately since "il|lo|la..." all require \s+.
      .replace(/^(il|lo|la|i|gli|le|un|uno|una)\s+|^l'/, ""))
    .filter((p) => p.length >= 3);
}

export function checkTier1Context(pack: LintPack): string[] {
  const ids: string[] = [];
  for (const unit of pack.units) {
    const contextCorpus = liveCards(unit)
      .filter((c) => c.tier !== 1)
      .map((c) => `${c.prompt} ${c.accepted.join(" ")}`.toLowerCase())
      .join(" ");
    for (const card of liveCards(unit)) {
      if (card.tier !== 1) continue;
      const terms = extractItalianTerms(card);
      const found = terms.some((t) => contextCorpus.includes(t));
      if (!found) ids.push(card.id);
    }
  }
  return ids;
}

// ── BASELINE gate 3 — tier-4 cards must be type "passage_cloze" ────────────────
// BRAND.md/CURRICULUM.md: Tier 4 is "60-80 word passages, chunked for 60-second sessions...
// a later chunk builds on an earlier one." 496/709 tier-4 cards (70%) corpus-wide are
// standalone 1-2 sentence produce/fill_blank cards instead — real passages exist in only 3
// of 20 A1 units. Grandfathered as debt; every new tier-4 card must be a real passage_cloze.

export function checkTier4Passage(pack: LintPack): string[] {
  const ids: string[] = [];
  for (const unit of pack.units) {
    for (const card of liveCards(unit)) {
      if (card.tier === 4 && card.type !== "passage_cloze") {
        ids.push(card.id);
      }
    }
  }
  return ids;
}

// ── BASELINE gate 4 — no duplicate LIVE card within the same unit (any tier) ───
// Found by the 2026-07-30 audit: 4 cards re-shelved verbatim under a different tier label
// (e.g. the identical "Come stai?" card exists as both a tier-2 AND a tier-3 card) — pure
// card-count padding with no new retrieval-angle variety. (The audit's first pass also
// flagged 3 "no"/"beige"/"zero" pairs as duplicates — those were a false positive in this
// function's own dedup key, since a recognize card and a produce card for a word spelled
// identically in both languages legitimately share prompt+accepted; `type` is now part of
// the key.) The 4 real duplicates were retired via Card.deprecated — safe to do only once
// lib/packTypes.ts's excludeDeprecatedCards actually filtered runtime consumption (until
// then, marking deprecated:true would not have stopped them from being shown). Operating on
// liveCards(unit) here means retiring a duplicate resolves this violation rather than
// leaving it permanently baselined forever.

export function checkWithinUnitDuplicates(pack: LintPack): { key: string; unitId: string; cardIds: string[] }[] {
  const results: { key: string; unitId: string; cardIds: string[] }[] = [];
  for (const unit of pack.units) {
    const seen = new Map<string, string[]>();
    for (const card of liveCards(unit)) {
      const key = normKey(card.type, card.prompt, card.accepted);
      const list = seen.get(key) ?? [];
      list.push(card.id);
      seen.set(key, list);
    }
    for (const [key, cardIds] of seen) {
      if (cardIds.length > 1) {
        results.push({ key: `${unit.id}::${key}`, unitId: unit.id, cardIds });
      }
    }
  }
  return results;
}

// ── BASELINE gate 5 — no duplicate tier-3/4 phrase across DIFFERENT units ──────
// Distinct from the HARD sentence-duplicate gate: this covers short tier-3 phrase cards
// (not full authored sentences) reused across two different units. CURRICULUM.md explicitly
// permits short vocabulary-phrase overlap between related units, so this is baselined as
// "known acceptable" rather than treated as a violation to eliminate — but it still ratchets
// (any brand NEW cross-unit phrase duplicate beyond the 2 known today must be deliberate).

export function checkCrossUnitPhraseDuplicates(pack: LintPack): { key: string; unitIds: string[]; cardIds: string[] }[] {
  const seen = new Map<string, { unitId: string; cardId: string }[]>();
  for (const unit of pack.units) {
    for (const card of liveCards(unit)) {
      if (card.tier !== 3 && card.tier !== 4) continue;
      const key = normKey(card.type, card.prompt, card.accepted);
      const list = seen.get(key) ?? [];
      list.push({ unitId: unit.id, cardId: card.id });
      seen.set(key, list);
    }
  }
  const results: { key: string; unitIds: string[]; cardIds: string[] }[] = [];
  for (const [key, entries] of seen) {
    const unitIds = new Set(entries.map((e) => e.unitId));
    if (unitIds.size > 1) {
      results.push({ key, unitIds: [...unitIds], cardIds: entries.map((e) => e.cardId) });
    }
  }
  return results;
}

// ── Orchestration ───────────────────────────────────────────────────────────

export function lintCardQuality(pack: LintPack, baseline: Baseline): { violations: Violation[]; resolvedCounts: Record<string, number> } {
  const violations: Violation[] = [];

  violations.push(...checkTierBalance(pack));
  violations.push(...checkDensityFloor(pack));
  violations.push(...checkGlobalSentenceDuplicates(pack));

  const idToUnit = new Map<string, string>();
  for (const unit of pack.units) for (const card of unit.cards) idToUnit.set(card.id, unit.id);

  const emptyHintNow = checkEmptyHints(pack);
  const emptyHintBaselineSet = new Set(baseline.emptyHintCardIds);
  for (const id of emptyHintNow) {
    if (!emptyHintBaselineSet.has(id)) {
      violations.push({ rule: "empty-hint", gate: "baseline-new", unitId: idToUnit.get(id) ?? "?", cardId: id, detail: "card has no hint and is not in the baseline — new cards must ship with a hint" });
    }
  }

  const tier1Now = checkTier1Context(pack);
  const tier1BaselineSet = new Set(baseline.tier1NoContextCardIds);
  for (const id of tier1Now) {
    if (!tier1BaselineSet.has(id)) {
      violations.push({ rule: "tier1-no-context", gate: "baseline-new", unitId: idToUnit.get(id) ?? "?", cardId: id, detail: "tier-1 word does not appear in any same-unit tier-2/3/4 card and is not in the baseline" });
    }
  }

  const tier4Now = checkTier4Passage(pack);
  const tier4BaselineSet = new Set(baseline.tier4NotPassageCardIds);
  for (const id of tier4Now) {
    if (!tier4BaselineSet.has(id)) {
      violations.push({ rule: "tier4-not-passage", gate: "baseline-new", unitId: idToUnit.get(id) ?? "?", cardId: id, detail: "tier-4 card is not type passage_cloze and is not in the baseline" });
    }
  }

  const withinDupNow = checkWithinUnitDuplicates(pack);
  const withinDupBaselineSet = new Set(baseline.withinUnitDuplicateGroupKeys);
  for (const { key, unitId, cardIds } of withinDupNow) {
    if (!withinDupBaselineSet.has(key)) {
      violations.push({ rule: "within-unit-duplicate", gate: "baseline-new", unitId, detail: `new duplicate group not in baseline: ${cardIds.join(", ")}` });
    }
  }

  const crossDupNow = checkCrossUnitPhraseDuplicates(pack);
  const crossDupBaselineSet = new Set(baseline.crossUnitPhraseDuplicateGroupKeys);
  for (const { key, unitIds, cardIds } of crossDupNow) {
    if (!crossDupBaselineSet.has(key)) {
      violations.push({ rule: "cross-unit-phrase-duplicate", gate: "baseline-new", unitId: unitIds.join(","), detail: `new cross-unit duplicate not in baseline: ${cardIds.join(", ")}` });
    }
  }

  const resolvedCounts = {
    emptyHint: baseline.emptyHintCardIds.filter((id) => !emptyHintNow.includes(id)).length,
    tier1NoContext: baseline.tier1NoContextCardIds.filter((id) => !tier1Now.includes(id)).length,
    tier4NotPassage: baseline.tier4NotPassageCardIds.filter((id) => !tier4Now.includes(id)).length,
    withinUnitDuplicate: baseline.withinUnitDuplicateGroupKeys.filter((k) => !withinDupNow.some((v) => v.key === k)).length,
    crossUnitPhraseDuplicate: baseline.crossUnitPhraseDuplicateGroupKeys.filter((k) => !crossDupNow.some((v) => v.key === k)).length,
  };

  return { violations, resolvedCounts };
}

export function buildBaseline(pack: LintPack): Baseline {
  return {
    emptyHintCardIds: checkEmptyHints(pack),
    tier1NoContextCardIds: checkTier1Context(pack),
    tier4NotPassageCardIds: checkTier4Passage(pack),
    withinUnitDuplicateGroupKeys: checkWithinUnitDuplicates(pack).map((v) => v.key),
    crossUnitPhraseDuplicateGroupKeys: checkCrossUnitPhraseDuplicates(pack).map((v) => v.key),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (isMainModule) {
  const [packPath, baselinePath, flag] = process.argv.slice(2);
  if (!packPath || !baselinePath) {
    console.error("Usage: lintCardQuality.ts <pack.json> <baseline.json> [--update-baseline]");
    process.exit(1);
  }

  const pack = JSON.parse(readFileSync(resolve(packPath), "utf8")) as LintPack;

  if (flag === "--update-baseline") {
    const fresh = buildBaseline(pack);
    writeFileSync(resolve(baselinePath), JSON.stringify(fresh, null, 2) + "\n");
    console.log(`✓ Baseline rewritten from current pack state: ${resolve(baselinePath)}`);
    console.log(`  emptyHint=${fresh.emptyHintCardIds.length} tier1NoContext=${fresh.tier1NoContextCardIds.length} tier4NotPassage=${fresh.tier4NotPassageCardIds.length} withinUnitDup=${fresh.withinUnitDuplicateGroupKeys.length} crossUnitDup=${fresh.crossUnitPhraseDuplicateGroupKeys.length}`);
    process.exit(0);
  }

  const baseline = JSON.parse(readFileSync(resolve(baselinePath), "utf8")) as Baseline;
  const { violations, resolvedCounts } = lintCardQuality(pack, baseline);

  const hard = violations.filter((v) => v.gate === "hard");
  const newBaseline = violations.filter((v) => v.gate === "baseline-new");

  console.log(`Card quality lint — ${pack.units.length} units, ${pack.units.reduce((s, u) => s + u.cards.length, 0)} cards\n`);

  if (hard.length > 0) {
    console.error(`✗ ${hard.length} HARD gate violation(s):`);
    for (const v of hard) console.error(`  • [${v.rule}] ${v.unitId}${v.cardId ? `:${v.cardId}` : ""} — ${v.detail}`);
  } else {
    console.log("✓ All hard gates clean (tier balance, density floor, global sentence duplicates)");
  }

  if (newBaseline.length > 0) {
    console.error(`\n✗ ${newBaseline.length} NEW baseline violation(s) (not present when the baseline was captured):`);
    for (const v of newBaseline) console.error(`  • [${v.rule}] ${v.unitId}${v.cardId ? `:${v.cardId}` : ""} — ${v.detail}`);
  } else {
    console.log("✓ No new baseline violations");
  }

  const totalResolved = Object.values(resolvedCounts).reduce((a, b) => a + b, 0);
  if (totalResolved > 0) {
    console.log(`\nℹ ${totalResolved} previously-baselined violation(s) no longer reproduce — consider running with --update-baseline to shrink the baseline file:`);
    for (const [k, n] of Object.entries(resolvedCounts)) {
      if (n > 0) console.log(`  ${k}: ${n} resolved`);
    }
  }

  process.exit(hard.length > 0 || newBaseline.length > 0 ? 1 : 0);
}
