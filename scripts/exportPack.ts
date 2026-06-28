// ============================================================
// exportPack.ts — Build script: compiles TypeScript card content into a deployable JSON pack
// ============================================================
/**
 * exportPack.ts — Compiles TypeScript content into a JSON pack file.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/exportPack.ts [langCode]
 *   langCode defaults to "it" (Italian)
 *
 * Outputs:
 *   public/packs/{langCode}.json      — the full pack
 *   public/packs/manifest.json        — version + size + sha256 index
 */

import { createHash } from "node:crypto";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// ── Resolve project root ─────────────────────────────────────────────────────

// __dirname is available with tsx (it polyfills CJS globals)
const ROOT = resolve(__dirname, "..");

// Path alias: @/ -> ROOT/
// tsx resolves this via tsconfig.json "paths", so direct imports work below.

// ── Import content ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getLanguageConfig } = require(join(ROOT, "lib/language.ts"));

// ── Pack format ──────────────────────────────────────────────────────────────

interface PackMeta {
  _version: 1;
  lang: string;
  packVersion: string;
  canonicalSource: string;
  name: string;
  nativeName: string;
  flag: string;
  unitCount: number;
  cardCount: number;
}

type Pack = PackMeta & { units: unknown[] };

interface ManifestEntry {
  name: string;
  nativeName: string;
  flag: string;
  version: string;
  size: number;
  sha256: string;
}

interface Manifest {
  _version: 1;
  generatedAt: string;
  packs: Record<string, ManifestEntry>;
}

// ── Build pack ───────────────────────────────────────────────────────────────

const langCode: string = process.argv[2] ?? "it";

// Verify language is registered (getLanguageConfig falls back to Italian for unknown codes)
const lang = getLanguageConfig(langCode);
if (lang.code !== langCode) {
  console.error(`Unknown lang "${langCode}". Add it to lib/language.ts first.`);
  process.exit(1);
}

// Load content — Italian ships from the bundled TypeScript source; other languages
// must have content authored at content/{langCode}/index.ts first.
let units: unknown[];
if (langCode === "it") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ALL_UNITS } = require(join(ROOT, "content/index.ts"));
  units = ALL_UNITS as unknown[];
} else {
  const contentPath = join(ROOT, "content", langCode, "index.ts");
  if (!existsSync(contentPath)) {
    console.error(`No content found at content/${langCode}/index.ts. Create it first.`);
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(contentPath);
  units = (mod.ALL_UNITS ?? mod.default) as unknown[];
}

if (!Array.isArray(units) || units.length === 0) {
  console.error("ALL_UNITS is empty — aborting.");
  process.exit(1);
}

const cardCount = (units as { cards: unknown[] }[]).reduce((n, u) => n + u.cards.length, 0);

const pack: Pack = {
  _version: 1,
  lang: lang.code as string,
  packVersion: "1.0.0",
  canonicalSource: "en",
  name: lang.name as string,
  nativeName: lang.nativeName as string,
  flag: lang.flag as string,
  unitCount: units.length,
  cardCount,
  units,
};

const packJson = JSON.stringify(pack);
const sha256 = createHash("sha256").update(packJson).digest("hex");
const size = Buffer.byteLength(packJson, "utf8");

// ── Write output ─────────────────────────────────────────────────────────────

const outDir = join(ROOT, "public", "packs");
mkdirSync(outDir, { recursive: true });

const packPath = join(outDir, `${langCode}.json`);
writeFileSync(packPath, packJson, "utf8");
console.log(`✓ Wrote ${packPath} (${(size / 1024).toFixed(0)} KB, ${units.length} units, ${cardCount} cards)`);

// ── Update manifest ───────────────────────────────────────────────────────────

const manifestPath = join(outDir, "manifest.json");
let manifest: Manifest = {
  _version: 1,
  generatedAt: new Date().toISOString(),
  packs: {},
};

if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  } catch {
    console.warn("Could not parse existing manifest.json — overwriting.");
  }
}

manifest.generatedAt = new Date().toISOString();
manifest.packs[langCode] = {
  name: lang.name as string,
  nativeName: lang.nativeName as string,
  flag: lang.flag as string,
  version: "1.0.0",
  size,
  sha256,
};

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log(`✓ Updated manifest: ${langCode} @ 1.0.0  sha256=${sha256.slice(0, 16)}…`);
