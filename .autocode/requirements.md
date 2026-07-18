
## 2026-07-16 | Task #399: tighten articles-regex test (tests/langRegistry.test.ts:35)
AC1: Test maps each PackCode to its canonical regex (it→ITALIAN_ARTICLES, es→SPANISH_ARTICLES from @/lib/answerCheck) and asserts .source equality. PASS: swapping the regexes in lib/language.ts fails the test. FAIL: swap passes.
AC2: .flags asserted (loss of case-insensitive `i` flag must fail).
AC3: Covers ALL registry entries, not only ready:true — es is ready:false and a ready-only filter leaves the Spanish-config swap untested.
AC4: Full suite + tsc green.
EDGE1: config.articles null → ?.source is undefined ≠ expected.source → fails (correct).
AMBIGUITY: identity (.toBe on the RegExp object) vs source+flags comparison — source+flags [ASSUMED]: behavioral, survives legitimate regex cloning, still fails on swap.
---

## 2026-07-16 | Task #404: replace deprecated ALL_KNOWN_PACKS with ALL_PACK_CODES (app/settings/page.tsx)
AC1: grep -c ALL_KNOWN_PACKS app/settings/page.tsx = 0. PASS: zero references. FAIL: any reference remains.
AC2: ALL_PACK_CODES imported from @/lib/langRegistry (the canonical source), not via the store re-export. app/→lib/ import is layer-legal (dependencies flow downward).
AC3: Behavior identical — ALL_KNOWN_PACKS is `export { ALL_PACK_CODES as ALL_KNOWN_PACKS }`; same frozen array object at runtime.
AC4: tsc/lint/tests green for this diff (verified in isolated worktree against HEAD — live tree carries unrelated in-flight parallel-stream edits to lib/packCache.ts).
EDGE1: tests/langRegistry.test.ts intentionally still imports ALL_KNOWN_PACKS — it TESTS the deprecated alias equals ALL_PACK_CODES; that reference is the alias's regression guard, not a violation. Out of scope here.
---
## 2026-07-16 | Task #377: thread unlockedPacks into loadPack as options.unlockedLangs (W14A)
AC1 hook passes store unlockedPacks as options.unlockedLangs (exact-call assertions, default + mutated store). AC4 effect re-runs on unlockedPacks change (dep array; act+setState and act+setEntitlement variants). AC5 purchasedAddOns threading unchanged. AC6 three stale exact-match assertions updated (lines 70/88/95) — old signature now fails.
EDGE: store field stays `unlockedPacks`, renamed to `unlockedLangs` only at call boundary [ASSUMED]. Raw passthrough — no expiry filtering in hook (loader gate is secondary; UI isPackUnlocked is primary) [ASSUMED].
---
## 2026-07-16 | Task #378: specialty pack selection must seed/load its base pack (W14A)
AC1-4 base resolution before specialty load (static seed w/ reference-identity assert + order; network base awaited w/ deferred-promise temporal gating; failure propagation, specialty never requested). AC5 merged units surface. AC6 selection UI unchanged (verified — bug is entirely post-reload). AC7 seed idempotency lives in packLoader (check-before-write), not retested in hook file.
EDGE decisions: base failure error → existing LOAD_PACK_ERROR_MESSAGES mapping; base invalid_lang for ready specialty target shows "Add-on not purchased." [ACCEPTED imprecision, pinned by test]; loading stays true across both steps; cancellation preserves pre-existing cache-warming semantics [ASSUMED OK, pinned].
---
