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

function validateCard(card: unknown, path: string): string[] {
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

function validateUnit(unit: unknown, path: string): string[] {
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

function validatePack(raw: unknown): string[] {
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

  // Card ID uniqueness
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  for (const unit of (raw["units"] as Json[])) {
    for (const card of (unit["cards"] as Json[])) {
      const id = card["id"] as string;
      if (ids.has(id)) duplicates.add(id);
      ids.add(id);
    }
  }
  if (duplicates.size > 0) {
    errors.push(`Duplicate card IDs: ${[...duplicates].join(", ")}`);
  }

  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
