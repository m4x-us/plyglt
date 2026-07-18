CLOSED: #392 #391 #396 #387
NOT_CLOSED: none

# Charles — Stream W14C — Wave 14 — completion notes (2026-07-16)

Debt entries logged: 0
Carry-forward tasks generated: 0 (#393 already scheduled by the orchestrator — see below)

## Verification gate (all four green at hand-off)
- `npx tsc --noEmit` — zero errors (whole project; an in-flight `tests/importBackup.test.ts`
  error from Barry's window cleared before my final run)
- `npm test` — 58 files, 1187 tests pass, coverage thresholds met
- `npm run lint` — zero errors; 2 pre-existing warnings, both in files owned by other
  streams (`app/page.tsx` — Adam; `hooks/useExportImport.test.ts` — untouched this wave)
- Assertion grep gate — PASS
- E2E (Playwright) NOT run from this window — port-3099 collision risk with parallel
  windows; run once at batch close per AGENTS.md.
- `bash scripts/deep-audit.sh` (named in every task's acceptance criteria) does not exist
  in the repo — substituted the AGENTS.md verification gate above.

## #391 — exact corrected behavior (REQUIRED READING for whoever writes #393's seam test)
`hooks/useExportImport.ts` handleImport, when the parsed backup lacks `licenseKey` OR
`instanceId` (either one missing/null):
- `setEntitlement` is **NOT called** — the session's current entitlement state is
  deliberately kept as-is. Rationale: an unsigned backup file must never downgrade or
  wipe an active license; the real data-loss risk was the wipe, not the skip.
- The skip is no longer silent: the success message becomes
  `Restored N card(s) of progress.[ (M card(s) skipped — corrupted data)] No license in backup — license unchanged.`
- When BOTH fields are present, `setEntitlement({licenseKey, instanceId, licenseType,
  unlockedPacks, validUntil})` is called exactly as before and the message has no license note.
#393's seam test should assert: (1) entitlement store state unchanged after importing a
license-less backup over an active subscription; (2) the exact success message above;
(3) the with-license path still restores. Per the brief, I wrote NO test for this seam —
that is #393's job against this documented behavior. (Note: `hooks/useExportImport.test.ts`
exists and passed unchanged — it does not assert on the success-message wording.)

## #392 — root cause and fix
`hasValidUnitsArray` (lib/packTypes.ts) now validates every non-optional Unit field the UI
dereferences unconditionally: `level` (membership in A1/A2/B1/B2 via a `satisfies readonly
Level[]` set — typo-proof, but a NEW level must be added there and in
scripts/validatePack.ts's VALID_LEVELS), `theme` (string), `emoji` (string),
`prerequisiteUnits` (array). This makes the runtime guard exactly mirror
scripts/validatePack.ts's validateUnit for these fields; the doc comment on the function
now names the sync requirement. New tests in tests/packTypes.test.ts (7 added; existing
fixture extended to full Unit shape).

## #396 — root cause and fix
Root cause: `PackMemCacheImpl.write()`'s fire-and-forget specialty-key cleanup executed at
an arbitrary later time, unordered relative to a concurrent `loadSpecialtyPack` re-merge's
`writeCacheMeta`/`writeCacheData` for the same code — the delayed deletion could destroy
just-written keys while memory reported the add-on merged.
Class-eliminating fix: per-code storage **mutation chains** in lib/packCache.ts
(`_enqueueStorageMutation`). ALL storage mutations — writeCacheMeta, writeCacheData,
_clearSpecialtyStorageKeys removals, and clearPackCache's base-pack removals (the sibling
call site the architect memory warned about) — now execute in initiation order per pack
code. Reads are deliberately unchained (atomic per key; #309 meta-before-data ordering
already fails closed on torn pairs). A rejected op propagates to its caller but never
poisons the chain; the map self-drains. `clearPackCacheState()` clears the chains for test
isolation. Deletion Test performed: with the chaining reverted, the new race test fails;
with it, passes.

## #387 — root cause and fix
Added `lang` to readCacheMeta's and readCacheData's error ref IDs
(`[ERR-CACHE-META-<lang>-…]`, `[ERR-CACHE-DATA-<lang>-…]`) AND to the sibling
`CACHE_PARSE_FAIL` log in parseValidateAndCache — the one same-class site the finding
didn't name (this exact gap previously survived the #275 rewrite by hiding in an unnamed
sibling). Grep-verified: every ref ID in lib/packCache.ts now carries a lang/code.
Tests assert the exact ref-ID format for both readers and the parse path.

## Ownership deviation (deliberate, flagged for review)
The brief's "edit ONLY these" list named 3 files, but SCTS Kaizen mandates a test per fix
and #392 made existing fixtures invalid. I edited/created two test files owned by NO
parallel window (verified against adam/barry/derek briefs): `tests/packTypes.test.ts`
(fixture + 7 new tests) and `tests/packCache.test.ts` (new file, 6 tests covering #396 and
#387). No off-limits file was touched.

## For the next stream touching these files
- New pack fixtures with non-empty `units` must carry full Unit shape (level/theme/emoji/
  prerequisiteUnits) or hasValidUnitsArray rejects them.
- Any new storage mutation in lib/packCache.ts MUST go through `_enqueueStorageMutation`
  — a raw `getStorage().setItem/removeItem` for a pack key reintroduces the #396 class.
