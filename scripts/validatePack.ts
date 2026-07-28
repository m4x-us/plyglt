// ============================================================
// validatePack.ts — CI validator: schema-checks compiled pack JSON before deployment
// ============================================================
/**
 * validatePack.ts — CI schema validator for compiled pack JSON files.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/validatePack.ts public/packs/it.json
 *
 * Exit codes:
 *   0 — pack is valid
 *   1 — validation failed (errors printed to stderr)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ── Type guards ───────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

function isString(v: unknown): v is string { return typeof v === "string"; }
function isNumber(v: unknown): v is number { return typeof v === "number"; }
function isArray(v: unknown): v is unknown[] { return Array.isArray(v); }
function isObj(v: unknown): v is Json { return typeof v === "object" && v !== null && !Array.isArray(v); }

const VALID_CARD_TYPES = new Set(["recognize", "produce", "conjugate", "fill_blank", "passage_cloze"]);
const VALID_LEVELS = new Set(["A1", "A2", "B1", "B2"]);
const VALID_TIERS = new Set([1, 2, 3, 4]);

// ── Validation ────────────────────────────────────────────────────────────────

export function validateCard(card: unknown, path: string): string[] {
  const errors: string[] = [];

  if (!isObj(card)) { return [`${path}: not an object`]; }

  if (!isString(card["id"]) || card["id"].trim() === "") {
    errors.push(`${path}.id: missing or empty string`);
  }
  if (!isString(card["type"]) || !VALID_CARD_TYPES.has(card["type"] as string)) {
    errors.push(`${path}.type: invalid "${String(card["type"])}" — must be one of ${[...VALID_CARD_TYPES].join(", ")}`);
  }
  if (!isString(card["prompt"]) || card["prompt"].trim() === "") {
    errors.push(`${path}.prompt: missing or empty`);
  }
  if (!isArray(card["accepted"]) || (card["accepted"] as unknown[]).length === 0) {
    errors.push(`${path}.accepted: must be a non-empty array`);
  } else {
    for (const [i, a] of (card["accepted"] as unknown[]).entries()) {
      if (!isString(a) || a.trim() === "") {
        errors.push(`${path}.accepted[${i}]: must be a non-empty string`);
      }
    }
  }
  if (!isNumber(card["tier"]) || !VALID_TIERS.has(card["tier"] as number)) {
    errors.push(`${path}.tier: must be 1, 2, 3, or 4`);
  }
  if (!isArray(card["tags"])) {
    errors.push(`${path}.tags: must be an array`);
  }
  // Task #459 (F5): mirrors lib/packTypes.ts's hasValidUnitsArray — prerequisites is
  // OPTIONAL (undefined is valid), but when present must be an array of strings.
  // lib/srs.ts's prerequisitesMet has no Array.isArray guard of its own before calling
  // .every() on it, so a pack with prerequisites: "c0" (a truthy non-array, which also
  // passes a naive `?.length` truthiness check) passes CI and throws a TypeError at
  // runtime in the live FSRS new-card queue and introduction engine.
  if (card["prerequisites"] !== undefined) {
    if (!isArray(card["prerequisites"]) || !(card["prerequisites"] as unknown[]).every(isString)) {
      errors.push(`${path}.prerequisites: when present, must be an array of strings`);
    }
  }

  // Direction-specific field checks
  const type = card["type"];
  if (type === "produce") {
    // prompt is the canonical English source text — validated above
    // accepted must be target-language answers
    if (card["translations"] !== undefined) {
      errors.push(`${path}: "produce" cards must not have translations (use prompts for source-lang overrides)`);
    }
  }
  if (type === "recognize") {
    // accepted is the canonical English translation
    // prompt must be in the target language
    if (card["prompts"] !== undefined) {
      errors.push(`${path}: "recognize" cards must not have prompts (use translations for source-lang overrides)`);
    }
  }

  return errors;
}

export function validateUnit(unit: unknown, path: string): string[] {
  const errors: string[] = [];

  if (!isObj(unit)) { return [`${path}: not an object`]; }

  if (!isString(unit["id"]) || unit["id"].trim() === "") {
    errors.push(`${path}.id: missing or empty`);
  }
  if (!isString(unit["name"]) || unit["name"].trim() === "") {
    errors.push(`${path}.name: missing or empty`);
  }
  if (!isString(unit["level"]) || !VALID_LEVELS.has(unit["level"] as string)) {
    errors.push(`${path}.level: invalid "${String(unit["level"])}" — must be A1, A2, B1, or B2`);
  }
  if (!isString(unit["theme"])) {
    errors.push(`${path}.theme: must be a string`);
  }
  if (!isString(unit["emoji"])) {
    errors.push(`${path}.emoji: must be a string`);
  }
  if (!isArray(unit["prerequisiteUnits"])) {
    errors.push(`${path}.prerequisiteUnits: must be an array`);
  }
  if (!isArray(unit["cards"]) || (unit["cards"] as unknown[]).length === 0) {
    errors.push(`${path}.cards: must be a non-empty array`);
  } else {
    for (const [i, card] of (unit["cards"] as unknown[]).entries()) {
      errors.push(...validateCard(card, `${path}.cards[${i}]`));
    }
  }

  return errors;
}

export function validatePack(raw: unknown): string[] {
  const errors: string[] = [];

  if (!isObj(raw)) return ["Pack root: not an object"];

  if (raw["_version"] !== 1) {
    errors.push(`Pack._version: expected 1, got ${String(raw["_version"])}`);
  }
  if (!isString(raw["lang"]) || raw["lang"].trim() === "") {
    errors.push("Pack.lang: missing or empty");
  }
  if (!isString(raw["packVersion"])) {
    errors.push("Pack.packVersion: must be a semver string");
  }
  if (!isString(raw["canonicalSource"])) {
    errors.push("Pack.canonicalSource: must be a language code string");
  }
  if (!isArray(raw["units"]) || (raw["units"] as unknown[]).length === 0) {
    errors.push("Pack.units: must be a non-empty array");
  } else {
    for (const [i, unit] of (raw["units"] as unknown[]).entries()) {
      errors.push(...validateUnit(unit, `units[${i}]`));
    }
  }

  // Task #459 (F5): mirrors lib/packTypes.ts's hasValidUnitsArray — unitCount must equal
  // the real units.length and cardCount must equal the real total cards across all units.
  // Before this, validatePack echoed cardCount in a log line but never validated either
  // declared count against reality; lib/specialtyPackLoader.ts's _mergeFromJson
  // arithmetically SUMS these two declared fields when merging a specialty pack into its
  // base, so a declared count that doesn't match the real array lengths produces an
  // arithmetically wrong but type-safe merged total with no caller ever catching it.
  if (!isNumber(raw["unitCount"])) {
    errors.push("Pack.unitCount: must be a number");
  } else if (isArray(raw["units"]) && raw["unitCount"] !== (raw["units"] as unknown[]).length) {
    errors.push(`Pack.unitCount: declared ${raw["unitCount"]} does not match actual units.length ${(raw["units"] as unknown[]).length}`);
  }
  if (!isNumber(raw["cardCount"])) {
    errors.push("Pack.cardCount: must be a number");
  } else if (isArray(raw["units"])) {
    const totalCards = (raw["units"] as unknown[]).reduce<number>((sum, u) => {
      if (!isObj(u) || !isArray(u["cards"])) return sum;
      return sum + (u["cards"] as unknown[]).length;
    }, 0);
    if (raw["cardCount"] !== totalCards) {
      errors.push(`Pack.cardCount: declared ${raw["cardCount"]} does not match actual total cards ${totalCards}`);
    }
  }

  // Card ID uniqueness
  // Task #468: mirrors validateUnit's own isObj(unit)/isArray(unit["cards"]) guards
  // (lines 98/118 above) before ever touching unit.cards — this loop previously cast
  // straight to Json[] with no guard at all, so a unit with a malformed cards field (e.g.
  // cards: null) threw an uncaught TypeError instead of returning the accumulated
  // errors[] this function's own `(raw): string[]` contract promises, crashing the CI
  // validator process. A malformed unit/cards shape is already reported by validateUnit's
  // own errors above (the loop at line ~149) — skipping it here just avoids re-processing
  // already-broken input a second time, not losing any error reporting.
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  if (isArray(raw["units"])) {
    for (const unit of (raw["units"] as Json[])) {
      if (!isObj(unit) || !isArray(unit["cards"])) continue;
      for (const card of (unit["cards"] as Json[])) {
        if (!isObj(card)) continue;
        // Task #478 (C8-F05) → #480: unguarded `card["id"] as string` let two cards both
        // missing/with a non-string id collide as the same dedup key, producing a
        // garbled "Duplicate card IDs: " (blank after the colon) — confusing CI noise.
        // #478's fix (`!isString(id)`) closed the non-string case but missed that two
        // cards both with id:"" (or id:" ", whitespace-only) both pass isString() and
        // still collide — reproducing the exact same garbled output. Mirrors
        // validateCard's own compound check (line 39 above) exactly, not just its first
        // half — a missing/blank/whitespace-only id is already reported by validateCard's
        // own check via validateUnit's loop, so skipping it here just avoids using it as
        // a dedup key, not losing any error reporting.
        const id = card["id"];
        if (!isString(id) || id.trim() === "") continue;
        if (ids.has(id)) duplicates.add(id);
        ids.add(id);
      }
    }
  }
  if (duplicates.size > 0) {
    errors.push(`Duplicate card IDs: ${[...duplicates].join(", ")}`);
  }

  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Task #459: gated on isMainModule so tests can import validateCard/validateUnit/
// validatePack directly (per this task's own acceptance criteria — a regression test in
// the validator's own test coverage) without the CLI section executing process.exit()
// out from under the test runner.
const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (isMainModule) {
  const packPath = process.argv[2];
  if (!packPath) {
    console.error("Usage: validatePack.ts <path-to-pack.json>");
    process.exit(1);
  }

  const absPath = resolve(packPath);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absPath, "utf8")) as unknown;
  } catch (e) {
    console.error(`Cannot read or parse ${absPath}: ${String(e)}`);
    process.exit(1);
  }

  const errors = validatePack(raw);

  if (errors.length === 0) {
    const pack = raw as Json;
    console.log(`✓ ${absPath}`);
    console.log(`  lang=${String(pack["lang"])}  version=${String(pack["packVersion"])}  units=${String((pack["units"] as unknown[]).length)}  cards=${String(pack["cardCount"])}`);
    process.exit(0);
  } else {
    console.error(`✗ ${absPath} — ${errors.length} error(s):\n`);
    for (const err of errors) {
      console.error(`  • ${err}`);
    }
    process.exit(1);
  }
}
