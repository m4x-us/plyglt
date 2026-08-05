#!/usr/bin/env tsx
// ============================================================
// checkCardIds.ts — CI guard: detects card ID changes that would corrupt user progress
// ============================================================
/**
 * scripts/checkCardIds.ts — CI guard for card ID stability.
 *
 * Card IDs are permanent once published: all user FSRS progress is keyed by ID.
 * Removing or renaming an ID silently orphans the user's review history.
 *
 * Usage:
 *   npx tsx scripts/checkCardIds.ts <baseline.json> <current.json>
 *
 * Exit 0 = OK.  Exit 1 = removed IDs found (CI fails).  Exit 2 = bad usage.
 *
 * Adding new cards is always safe. To retire a card, mark it deprecated:true
 * and keep its ID in the pack — never remove the entry outright.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "node:url";

interface CardLike { id: string }
interface UnitLike { id: string; cards: CardLike[] }
interface PackLike { lang?: string; units: UnitLike[] }

// content/index.ts's top-of-file NOTE comment documents the convention every language after
// Italian must use:
// "{lang}-{level}u{unit}-t{tier}-{seq}" (e.g. "es-a1u01-t1-001"). Italian's own IDs are the
// legacy unnamespaced format ("u01-t1-001") and are explicitly frozen — migrating them
// would require a store migration risking corruption of live user progress, so Italian is
// deliberately exempt here, not an oversight. Until now this convention existed only as a
// comment; nothing mechanically enforced it (multi-language architecture prep).
export function findPrefixViolations(lang: string, addedIds: string[]): string[] {
  if (lang === "it") return [];
  const prefix = `${lang}-`;
  return addedIds.filter((id) => !id.startsWith(prefix));
}

function extractIds(filePath: string): { ids: Map<string, string>; lang: string } {
  const raw = readFileSync(filePath, "utf8");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`❌ Cannot parse JSON from: ${filePath}`);
    process.exit(2);
  }

  const pack = data as PackLike;
  if (!Array.isArray(pack.units)) {
    console.error(`❌ File is not a valid pack (missing "units" array): ${filePath}`);
    process.exit(2);
  }

  const ids = new Map<string, string>();
  for (const unit of pack.units) {
    if (!Array.isArray(unit.cards)) continue;
    for (const card of unit.cards) {
      if (typeof card.id === "string") {
        ids.set(card.id, unit.id);
      }
    }
  }
  // Default "it" matches the rest of this codebase's convention (exportPack.ts,
  // lintCardQuality.ts) for packs predating the `lang` field.
  return { ids, lang: typeof pack.lang === "string" ? pack.lang : "it" };
}

const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (isMainModule) {
  const [, , rawBaseline, rawCurrent] = process.argv;

  if (!rawBaseline || !rawCurrent) {
    console.error("Usage: checkCardIds.ts <baseline.json> <current.json>");
    console.error("");
    console.error("  baseline.json  Previously-published pack (the immutable reference).");
    console.error("  current.json   New pack being validated.");
    process.exit(2);
  }

  const baselinePath = resolve(rawBaseline);
  const currentPath  = resolve(rawCurrent);

  console.log(`Baseline: ${baselinePath}`);
  console.log(`Current:  ${currentPath}`);
  console.log("");

  const { ids: baselineIds } = extractIds(baselinePath);
  const { ids: currentIds, lang: currentLang } = extractIds(currentPath);

  const removed = [...baselineIds.keys()].filter((id) => !currentIds.has(id));
  const added   = [...currentIds.keys()].filter((id)  => !baselineIds.has(id));

  console.log(`Baseline: ${baselineIds.size} card(s)`);
  console.log(`Current:  ${currentIds.size} card(s)  (+${added.length} added, -${removed.length} removed)`);
  console.log("");

  if (removed.length > 0) {
    console.error(`❌ ${removed.length} card ID(s) were removed from the pack:`);
    for (const id of removed) {
      const unit = baselineIds.get(id) ?? "unknown-unit";
      console.error(`   - ${id}  (was in unit: ${unit})`);
    }
    console.error("");
    console.error("Card IDs are permanent once published.");
    console.error("To retire a card, mark it { deprecated: true } — never delete the entry.");
    console.error("User FSRS progress is keyed by card ID; removal silently orphans it.");
    process.exit(1);
  }

  const prefixViolations = findPrefixViolations(currentLang, added);
  if (prefixViolations.length > 0) {
    console.error(`❌ ${prefixViolations.length} newly-added card ID(s) don't follow the "${currentLang}-..." namespaced convention (see content/index.ts's top-of-file NOTE comment):`);
    for (const id of prefixViolations) {
      console.error(`   - ${id}  (expected to start with "${currentLang}-")`);
    }
    console.error("");
    console.error(`Every language after Italian uses "{lang}-{level}u{unit}-t{tier}-{seq}" IDs (e.g. "es-a1u01-t1-001") — a plain "u01-t1-001"-style ID from a non-Italian pack can collide with Italian's own legacy-format IDs or another language's.`);
    process.exit(1);
  }

  if (added.length > 0) {
    console.log(`ℹ️  ${added.length} new card ID(s) — these are safe to add.`);
  }
  console.log("✅ Card ID stability check passed.");
  process.exit(0);

}
