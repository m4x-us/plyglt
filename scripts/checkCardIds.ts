#!/usr/bin/env tsx
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

interface CardLike { id: string }
interface UnitLike { id: string; cards: CardLike[] }
interface PackLike { units: UnitLike[] }

function extractIds(filePath: string): Map<string, string> {
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
  return ids;
}

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

const baselineIds = extractIds(baselinePath);
const currentIds  = extractIds(currentPath);

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

if (added.length > 0) {
  console.log(`ℹ️  ${added.length} new card ID(s) — these are safe to add.`);
}
console.log("✅ Card ID stability check passed.");
process.exit(0);
