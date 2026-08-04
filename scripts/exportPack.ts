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
import { writeFileSync, readFileSync, mkdirSync, rmdirSync, existsSync, renameSync } from "node:fs";
import { resolve, join } from "node:path";

// ── Resolve project root ─────────────────────────────────────────────────────

// __dirname is available with tsx (it polyfills CJS globals)
const ROOT = resolve(__dirname, "..");

// Path alias: @/ -> ROOT/
// tsx resolves this via tsconfig.json "paths", so direct imports work below.

// writeFileSync is not atomic — a concurrent reader (e.g. another exportPack.ts
// invocation for a different langCode, running in parallel) can observe a
// truncated/partial file mid-write. Writing to a temp file in the same directory
// then renaming over the target makes the write atomic from every other
// process's point of view: readers only ever see the old complete file or the
// new complete file, never a partial one. Found via a real multi-agent session
// where concurrent exportPack.ts runs caused manifest.json's JSON.parse to
// intermittently fail and silently drop an unrelated language's entry.
function writeFileAtomic(path: string, data: string): void {
  const tmpPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, data, "utf8");
  renameSync(tmpPath, path);
}

// writeFileAtomic (above) fixes torn/partial reads — it does NOT fix the separate
// read-modify-write race: manifest.json holds every language's entry, so two
// exportPack.ts processes running concurrently for DIFFERENT langCodes (the exact
// "multi-agent session" scenario the comment above already names) can both read the
// manifest, both compute an update, and both write — whichever finishes writing last wins,
// silently discarding the other's update. Both individual reads and writes succeed and are
// individually well-formed, so there is no parse error to catch this time. This script has
// no other async work in its read-modify-write path (no await anywhere in this file — see
// its own JS single-threaded synchronous execution), so within ONE process there genuinely
// is no interleaving window at all; the race is purely across separate OS processes, which
// nothing inside one process's own control flow can close. Closing it needs real
// cross-process mutual exclusion — a lockfile, not a smaller in-process reordering.
//
// mkdirSync throwing EEXIST when the directory already exists is atomic at the OS level
// (unlike a "check if file exists, then create it" pattern, which has its own race), making
// a lock directory a standard, dependency-free mutex primitive for exactly this situation.
function withManifestLock<T>(manifestPath: string, fn: () => T): T {
  const lockPath = `${manifestPath}.lock`;
  const maxAttempts = 50; // 50 * 100ms = 5s max wait before giving up
  let attempt = 0;
  for (;;) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (err) {
      const isBusy = (err as NodeJS.ErrnoException).code === "EEXIST";
      attempt++;
      if (!isBusy || attempt >= maxAttempts) {
        throw new Error(
          `Could not acquire manifest lock at ${lockPath} after ${attempt} attempt(s) — ` +
          `if no other exportPack.ts run is actually in progress, delete this directory manually: ${String(err)}`
        );
      }
      // Synchronous sleep — deliberate: this is a CLI build script (not app runtime code),
      // and the whole point is to block THIS process until the lock is free, not to yield
      // to other work. Atomics.wait on a throwaway buffer is the standard synchronous-sleep
      // technique in Node scripts with no async equivalent available in a sync call chain.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try {
    return fn();
  } finally {
    rmdirSync(lockPath);
  }
}

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
writeFileAtomic(packPath, packJson);
console.log(`✓ Wrote ${packPath} (${(size / 1024).toFixed(0)} KB, ${units.length} units, ${cardCount} cards)`);

// ── Update manifest ───────────────────────────────────────────────────────────

const manifestPath = join(outDir, "manifest.json");

// withManifestLock (see its own comment above) makes this whole read-modify-write section
// a true cross-process critical section — the read-modify-write race described there can
// only happen if two exportPack.ts processes are inside this block at the same time, which
// the lock now prevents entirely, not just narrows.
withManifestLock(manifestPath, () => {
  let manifest: Manifest = {
    _version: 1,
    generatedAt: new Date().toISOString(),
    packs: {},
  };

  if (existsSync(manifestPath)) {
    // A parse failure here is never silently swallowed: manifest.json holds every
    // language's entry, and continuing past a genuine parse error would silently
    // reset and overwrite every OTHER language's entry along with this one. Fail
    // loudly instead — the caller can inspect/fix manifest.json and re-run.
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
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

  writeFileAtomic(manifestPath, JSON.stringify(manifest, null, 2));
});
console.log(`✓ Updated manifest: ${langCode} @ 1.0.0  sha256=${sha256.slice(0, 16)}…`);
