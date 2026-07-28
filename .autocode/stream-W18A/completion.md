CLOSED: #436 #432 #431 #416 #428 #429
NOT_CLOSED: none

## Task #436 — per-language eviction guard

`lib/basePackLoader.ts`'s single global `evictionGuard` counter is now a `Map<string,
GenerationGuard>` keyed by language, lazily created via `getEvictionGuard(lang)`.
`bumpEvictionGeneration(lang)` now requires and uses the language argument. Added a
separate `resetAllEvictionGuardsForTesting()` for `clearCacheForTesting`'s genuinely-global
reset case (bumps every currently-tracked guard). Updated all 3 `packLoader.ts` call sites.

Test calls `loadBasePackFromStorageOrNetwork` directly (not the public `loadPack`) with two
different lang codes ("it"/"es") concurrently, since only "it" is `READY_PACK_CODES` in the
real registry — `loadPack("es", ...)` would never reach this module's guard logic through
the public API. Evicts "es" mid-flight and proves "it"'s write is unaffected.

## Task #432 — forceRedownload for specialty packs

Chose the documented-no-op path over implementing a real forced specialty reload — traced
through why a bolted-on `forceRedownload` for specialty packs would be unsafe: units merge
additively (`_mergeFromJson` appends, never replaces), and `isAddOnLoaded(lang)` — the guard
a forced reload would need to bypass — is the only thing preventing a second, duplicating
merge. Every existing path that clears `isAddOnLoaded` also resets the base pack first;
bypassing it without a real "unmerge" step would double every unit from a previously-merged
specialty pack. Instead, `loadPack`'s specialty branch now logs a `FORCE_REDOWNLOAD_NOOP`
warning when `forceRedownload` is requested for a specialty code, making the no-op
observable (Rule 8) rather than silent. Expanded the `LoadPackOptions` doc comment in
`lib/basePackLoader.ts` to explain the hazard for the next person tempted to "just add the
parameter."

## Task #431 — sha256 hex-digest validation

Added `SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i` and wired it into `isValidManifestShape`.
Case-insensitive since `sha256Hex` produces lowercase but a manifest entry's exact casing
isn't this codebase's to dictate. Rejection routes through the existing
`MANIFEST_SHAPE_INVALID` log path, already distinct from any `checksum_mismatch` log —
confirmed by test rather than assumed.

## Task #416 — second-generation-check regression test

Added a regression test for `lib/basePackLoader.ts:257-264`'s second generation check
(fresh-download race, sibling of the existing K2-001a/K2-001b cache-hit and
offline-stale-fallback tests). Intercepts the `pack-data-v1-it` `setItem` call specifically
(meta writes first, so triggering on the data key lands the eviction between the two
writes) and calls `bumpEvictionGeneration("it")` synchronously from inside the interception.
Verified the Deletion Test by hand: temporarily deleted lines 257-264, confirmed the new
test fails (`memCache.has("it")` becomes `true`), then restored the code from a backup copy
and re-verified the test passes and the full suite is green.

## Task #428 — basePackLoader header/test correction

Corrected `lib/basePackLoader.ts`'s header, `CLAUDE.md`'s Section 1 entry, and the
poka-yoke test name to state the true two-importer contract (`lib/packLoader.ts` +
`lib/packResolver.ts`'s type-only import) instead of the false "ONLY packLoader.ts" claim.
Corrected the `bumpEvictionGeneration` caller-list claim in the header to reflect its actual
2 call sites in `packLoader.ts` (evictPack, loadPack's forced-reload branch) plus the
separate `resetAllEvictionGuardsForTesting` call site (`clearCacheForTesting`) introduced by
#436 — described the final post-436 state as instructed, not the pre-436 state the finding
was originally written against. Also fixed one adjacent, clearly-stale claim in
`CLAUDE.md` while already touching that line (`lib/specialtyPackLoader.ts`'s
generationGuard migration is described as "a tracked migration" — it isn't; it shipped in
Task #409, Wave 16) — narrow, in-scope poka-yoke fix, not a broader doc sweep.

## Task #429 — allowlist-guard isolation test

Traced why the existing path-traversal/invalid-lang tests don't actually prove the
allowlist guard: every one of them (path traversal, `""`, registered-but-unready `"es"`)
is ALSO rejected independently by the later base-pack entitlement gate
(`FREE_PACK_CODES`/`unlockedLangs`), so deleting just the allowlist guard leaves them all
green. Added a test that passes `"../evil"` via `unlockedLangs: ["../evil"]` — defeating
the entitlement gate specifically for that exact string — so only the allowlist guard can
still reject it. Verified by hand: temporarily replaced the allowlist guard's condition
with `if (false)`, confirmed the new test fails (a real fetch attempt was made, surfacing
as `download_failed` instead of `invalid_lang`), then restored from a backup copy and
re-verified.

## Verification

Full gate green: `tsc --noEmit` clean (whole repo), `npm test` 1349/1349 passing (whole
repo — no cross-stream instability this wave, unlike prior waves), `npm run lint` 0 errors
(3 pre-existing warnings in files this stream doesn't own), coverage above every threshold
(stmts 89.97%, branches 85.45%, funcs 89.4%, lines 92.4%), existence-check grep clean (found
and fixed 2 `.not.toBeNull()` assertions in my own new #431 tests before closing — replaced
with exact `.toEqual()` checks against the full manifest object).

Debt entries logged: 0
Carry-forward tasks generated: 0
