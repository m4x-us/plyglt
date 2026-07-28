CLOSED: #409 #410
NOT_CLOSED: none

## Task #409 — generation guard asymmetry

Replaced the hand-rolled `deactivationGeneration` counter in `lib/specialtyPackLoader.ts`
with `lib/generationGuard.ts`'s shared `createGenerationGuard()` primitive (`resetSpecialtyLoadState`
now calls `.bump()`, `loadSpecialtyPack` snapshots via `.snapshot()`, `_mergeFromJson` checks
via `.isStale()`) — same primitive `lib/basePackLoader.ts`'s `evictionGuard` already uses.

Root-caused the asymmetric hardening, not just the style duplication: `_mergeFromJson` used
to run `memCache.merge()` + `markAddOnLoaded()` *before* the `writeCacheMeta`/`writeCacheData`
awaits, with only one staleness check ahead of both. Reordered so the storage-persist block
runs first and `memCache.merge`/`markAddOnLoaded` are deferred to after a second `isStale`
check brackets it — mirroring `basePackLoader.ts:223-230` (#378 cycle-2 F-C2-1) exactly. A
deactivation landing mid-write can no longer resurrect merged content in memCache; the
storage writes themselves are self-healing via `packCache.ts`'s per-code mutation chain
(Task #396), same rationale as the base-pack side.

New regression test in `tests/specialtyPackLoader.test.ts` ("#409: a deactivation landing
during the post-download storage writes...") intercepts the meta-write via a `setItem` spy
to fire `resetSpecialtyLoadState()` + re-seed exactly between the meta and data writes,
proving the second check catches a window the old single check missed.

## Task #410 — offline/no-manifest sha256 re-verification

Added `staleAddOnBytesMatchRecordedHash(lang, cachedMeta, data)` to
`lib/specialtyPackLoader.ts`, mirroring `basePackLoader.ts`'s `staleBytesMatchRecordedHash`
(#378 cycle-2 naive finding) — re-verifies cached bytes against the sha256 recorded in
`cachedMeta` at cache time before serving them unverified. Wired into all four offline/
no-manifest fallback call sites in `_doLoad`: the cache-hit "no manifest entry" branch, the
"!addOnManifestEntry" fail-closed branch, and both the `!res.ok` and network-throw
offline-fallback branches. A tampered/corrupted specialty-pack cache now fails closed
(`download_failed`/`checksum_mismatch`) instead of being merged with zero verification.

Did NOT extract the duplicated logic into a shared module — `lib/basePackLoader.ts` and
`lib/packCache.ts` are both off-limits/not-owned this stream. Left a `TODO (tracked debt)`
comment at the new function noting the duplication; flagging as debt below rather than
scope-creeping into a cross-stream refactor.

Corrected `.autocode/agents/security.md`'s S2 entry: the old wording ("add-on packs have no
platform-storage cache") was stale since Task #269; rewrote it to name the actual gap
(missing re-verification of an *existing* cache) and cite the #410 fix. Left S3 (a separate,
now-likely-stale entry about the deactivation race that #394/#409 appear to have already
closed) untouched — out of scope for this task, noting it below as worth a follow-up audit
pass rather than fixing unilaterally.

Three new regression tests in `tests/specialtyPackLoader.test.ts` ("#410: ..."): one refusal
via the manifest-present/fetch-fails path, one positive "not overly strict" control (stale
version but byte-intact cache still serves), and one refusal via the no-manifest-at-all path
(covering both remaining call sites in one test, confirms zero network attempt on tampered
cache).

## Notable

Verification gate: `tsc --noEmit` clean, full suite 1285/1285 passing, lint 0 errors,
coverage all above threshold (stmts 89.49%, branches 84.46%, funcs 89.63%, lines 92.01%),
existence-check grep clean.

`tests/packLoader.test.ts` showed one transient failure on a single run
(`ReferenceError: memCache is not defined` in a test named "...( #415)") — re-running in
isolation passed cleanly. That test/task is not part of this stream's scope (belongs to
another window actively editing the same shared file concurrently this wave); the failure
was a read-during-write race against that other window's live edit, not a defect in this
stream's changes. Not investigated further since the file isn't owned by this stream.

Debt entries logged: 1 (staleAddOnBytesMatchRecordedHash duplication vs basePackLoader.ts —
noted inline as TODO, cross-stream extraction needed since it touches lib/packCache.ts)
Carry-forward tasks generated: 0 (worth a future audit look: security.md's S3 entry may
already be resolved by #394/#409 and just needs re-verification + doc update)
