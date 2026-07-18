CLOSED: #384 #388 #390 #394 #385 #386 #397 #401
NOT_CLOSED: none

# Barry — Stream W14B — Wave 14 — Completion Report (2026-07-16)

Verification gate (all four green at completion): `npx tsc --noEmit` clean; 1191/1191
tests pass; coverage above all thresholds (stmts 88.21/82, branches 82.6/81, funcs
88.42/79, lines 90.9/84); lint 0 errors (2 pre-existing warnings in files owned by other
streams: app/page.tsx, hooks/useExportImport.test.ts); weak-assertion grep gate clean.

Debt entries logged: 0
Carry-forward tasks generated: 3 (listed below)

## YOUR #388 DECISION IN FULL — the Pro gate IS IMPLEMENTED

**Decision: implemented the store-level Pro gate in this wave, under #388.** There was no
remaining real blocker. Evidence trail:

1. The stale rationale claimed tests/entitlement.test.ts calls purchaseAddOn with
   licenseType:"free". Verified false: both describe blocks that call purchaseAddOn
   (`purchasedAddOns` and the #284 seam block) run under a beforeEach setting
   `licenseType: "subscription"` (Wave 13 change).
2. I also checked the OTHER purchaseAddOn test file the rationale never mentioned:
   tests/purchaseAddOnGuards.test.ts. Its beforeEach (line 43) also sets
   `licenseType: "subscription"`. So every purchaseAddOn call site in the entire suite
   passes the gate.
3. The parseFlag(undefined)=true concern actually helps: with
   NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS unset (all environments today),
   `isProEnabled(getFeatureFlags().specialtyPacks, licenseType)` reduces to exactly
   `licenseType === "subscription"` — no featureFlags mocking needed anywhere.

**Implementation:** in store/entitlementStore.ts purchaseAddOn, after the code-validity
guard and before the receipt guards:
`if (!isProEnabled(getFeatureFlags().specialtyPacks, get().licenseType)) return { ok:false, error: ERR_ADDON_NOT_PRO }`.
This is the exact combinator pattern CLAUDE.md mandates and that app/stats/page.tsx:17 and
LanguageGrid.tsx:50 already use. The deferral history is preserved in the code comment
(why it was deferred, what changed, when). Three new tests in tests/entitlement.test.ts
("#388" cases): free user → not_pro + nothing persisted; free user → invoke never called;
code guard precedes the Pro gate. Stale companion comments corrected in
tests/entitlement.test.ts and tests/purchaseAddOnGuards.test.ts.

**Consequence for next wave's #357/#395/#381:** all three are now substantively CLOSED by
this implementation — they should be marked closed-by-#388 in tasks.md, not re-planned:
- #357 and #395 describe the same fix from two findings (as the brief predicted) — the
  gate now exists at the store layer, devtools bypass is closed.
- #381 (ERR_ADDON_NOT_PRO permanently-dead branch) — the constant is now a live,
  constructed, test-covered branch. It was NOT deleted, per the brief.
Recommend collapsing all three into one reconciliation entry pointing at #388's commit.

## Other task details

**#384 (data-loss, migrations v2→v3):** Root cause was validating persisted PAID purchase
records against `isSpecialtyPackCode` (registration AND ready:true — a mutable business
flag). Fixed the CLASS per the architect-memory guidance, not just the instance: both
store/migrations.ts (v3 filter) and the structurally identical sibling in
lib/importBackup.ts (purchasedAddOns filter) now validate REGISTRATION only
(SPECIALTY_PACKS membership), and migrations now logs dropped entries (was fully silent).
Policy comment at both sites cross-references the other ("keep in sync"). Readiness still
gates purchasing (purchaseAddOn) and loading (loadSpecialtyPack) — it just never gates
retention. Regression tests: registered-but-ready:false code survives migration AND
backup restore; drops are logged; non-strings still dropped.

**#394 (TOCTOU on deactivation):** Design constraint: the fix must re-validate inside
_mergeFromJson, but lib/ cannot read the live store (layer rule). Implemented the
deactivation-generation design the task suggested: module-level counter in
specialtyPackLoader, incremented by resetSpecialtyLoadState() (which clearEntitlement
calls after evictions settle), captured by loadSpecialtyPack immediately after its
purchasedAddOns gate, re-checked in _mergeFromJson immediately before memCache.merge.
On mismatch: abort with "invalid_lang" (reusing the entry gate's not-purchased code —
the error union in lib/packTypes.ts is closed and owned by W14C, so no new code could be
added). The abort also prevents re-persisting storage keys post-eviction. Regression test
drives a real in-flight load through loadPack with a deferred fetch, runs
evict→reset→re-seed mid-flight, and asserts no merge, no bookkeeping, no storage keys.

**#385 (rename):** clearSpecialtyCache → resetSpecialtyLoadState (accurate: loadedAddOns
bookkeeping + inFlight map + #394 generation bump; never memCache). lib/packLoader.ts
(W14A-owned, off-limits) still imports the old name, so a deprecated alias
`export const clearSpecialtyCache = resetSpecialtyLoadState` keeps it compiling — same
precedent as the isReadySpecialtyPackCode alias (#361). All call sites I own migrated;
compensating disclaimer comments in clearEntitlement trimmed to ordering-rationale only.

**#390:** data.entitlement now gets the identical strict shape check as data.srs
(object, non-null, non-array). Tests cover "corrupted", 5, true, [].

**#386:** isPackUnlocked rewritten as an exhaustive switch over LicenseType with
`licenseType satisfies never` in the default branch (compile error on union growth) and
fail-closed (false) for out-of-union runtime values. Behavior identical for valid inputs;
test proves a corrupt value denies paid access but keeps free packs unlocked.

**#397:** all five bare `store().clearEntitlement()` test call sites now awaited.

**#401:** importBackup.ts USED BY now lists lib/exportBackup.ts; migrations.ts DEPENDS ON
now lists SPECIALTY_PACKS (not isSpecialtyPackCode — #384 changed the import) and
isCalendarValidDate. entitlementStore.ts's header needed NO edit: its @/lib/featureFlags
claim became TRUE when #388 added the real import, and its USED BY list matches the 7
actual importers exactly (verified by grep on real import statements).

## Files touched outside the owned list (justification)

tests/migrations.test.ts, tests/importBackup.test.ts, tests/specialtyPackLoader.test.ts,
tests/purchaseAddOnGuards.test.ts. All four verified UNOWNED by every parallel stream
this wave (checked adam/charles/derek queue files) — zero conflict risk. Reasons: Kaizen
requires a test per fix; CLAUDE.md §4 mandates migration tests live in
tests/migrations.test.ts specifically; and #388's whole point is that false comments must
not be left standing (purchaseAddOnGuards.test.ts carried two stale deferral comments).

## Carry-forward tasks for next wave

1. **Migrate lib/packLoader.ts to resetSpecialtyLoadState** (one line: import + call at
   packLoader.ts:40/329), then delete the deprecated clearSpecialtyCache alias from
   lib/specialtyPackLoader.ts. Owner should be whoever holds packLoader.ts. Also update
   the comment at lib/packCache.ts:64 which references the old name (W14C-owned file,
   comment-only).
2. **Mark #357/#395/#381 closed-by-#388** in tasks.md (see decision section above) —
   collapse into one reconciliation entry, do not re-plan as work.
3. **scripts/deep-audit.sh does not exist** — every Wave 14 task's second acceptance
   criterion ("Audit passes: bash scripts/deep-audit.sh <file>") is unrunnable; scripts/
   contains only checkCardIds.ts, exportPack.ts, validatePack.ts. Either restore the
   script or strip the criterion from the task template. I substituted the full
   AGENTS.md verification gate (tsc + tests + coverage + lint + weak-assertion grep).

## Notes for streams touching these files next

- The #394 generation counter is module-level state in lib/specialtyPackLoader.ts;
  clearCacheForTesting → resetSpecialtyLoadState increments it per test reset — loads
  never span resets, so tests are unaffected.
- purchaseAddOn's guard order is now: code validity → Pro gate → empty token → token
  format → IPC. Tests encode this order; don't reorder casually.
- migrations.test.ts and importBackup.test.ts now mock SPECIALTY_PACKS (one ready:true +
  one ready:false entry) instead of mocking isSpecialtyPackCode — the ready:false entry
  is load-bearing for the #384 regression tests.
