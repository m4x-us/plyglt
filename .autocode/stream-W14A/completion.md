CLOSED: #377 #378 #379 #389 #380 #398 #403
NOT_CLOSED: none

# Adam — Stream W14A — Wave 14 — completion (2026-07-17)

All seven tasks closed, each with its own commit, fresh-eyes review gate artifact, and green
verification (final state: tsc clean, 1252/1252 tests, lint 0 errors — the 2 warnings are
pre-existing in other streams' files). Commits in order: #377 afae4f9, #378 8f6c634,
#379 97224ff, #389 91c0b58, #380 4713d33, #398 1aae732, #403 e43adea.

Debt entries logged: 24 (`.autocode/stream-W14A/debt.md` — one #377-era entry was later
RESOLVED by #378's hydration gate and removed).
Carry-forward tasks generated: 2 formal blocks in `.autocode/stream-W14A/tasks.md`
(need global numbers at consolidation):
  1. lib/specialtyPackLoader.ts unguarded sha256Hex (audit F028, sev 5) — owning stream;
     copy the SHA_VERIFY_FAIL pattern from lib/basePackLoader.ts.
  2. lib/storage.ts useIsHydrated subscribe race + zustand persist never finishing hydration
     on storage failure (sev 5) — now load-bearing for pack loads; useLangPack carries a 3s
     grace-timeout mitigation (HYDRATION_GRACE_MS) until the root fix lands.

## #378 design decision (the brief asked)
Chose hook-side post-reload base resolution (Option: useLangPack resolves specialty→baseLang
before its load flow) — selection-time seeding is worthless because handleSelect navigates via
full page reload, which wipes memCache. During WorldClass remediation the orchestration was
extracted to a NEW pure module `lib/packResolver.ts` (dependency-injected, unit-tested), so
the hook is wiring only. app/page.tsx and components/LanguageGrid.tsx needed NO changes for
#378 (verified by AC agent against the staged diff).

#378 grew far beyond its 3-file estimate — the audit (2 cycles, 8 auditors, 30 findings) and
WorldClass (4 cycles, 83→95) surfaced adjacent seam defects the fix made load-bearing. New
modules created: `lib/basePackLoader.ts` (Rule 1 extraction of packLoader's load path +
eviction-generation guard closing a real mid-flight-eviction cache-resurrection race),
`lib/packResolver.ts`, `lib/generationGuard.ts` (shared snapshot/bump/isStale primitive —
specialtyPackLoader's hand-rolled twin is debt for its owner), plus `hooks/useLangPackSeam.test.ts`
(Rule 13, mutation-verified) and `tests/packResolver.test.ts` / `tests/generationGuard.test.ts`.
Also hardened along the way: meta-before-data cache writes (sibling of #309), stale-offline
bytes re-verified against their recorded sha256, in-flight dedup for both base packs and the
manifest, forced-redownload supersession, hydration gating with a grace fallback, and
seedMemCache now returns boolean with a FREE_PACK_CODES invariant. CLAUDE.md §1 documents the
three new modules.

## #380 — what the rename touched to keep the suite green (the brief asked)
- hooks/useLangPack.test.ts: YES — mock key re-pointed to `isSpecialtyPackCode`
  (registry-driven default impl instead of blanket false), import + mocked-var renamed.
- tests/packLoader.test.ts: YES — the vi.mock override re-keyed exactly as the brief
  predicted (the alias-keyed override would have silently stopped driving loadPack's gate).
- ALSO REQUIRED, NOT COMMITTED BY ME (⚠ for the owning streams): the rename mechanically
  broke mocks in two shared test files that carry OTHER streams' live uncommitted hunks, so
  my minimal fixes sit in the working tree and must ride with their owners' commits:
    * tests/specialtyPackLoader.test.ts — mock key renamed to `isSpecialtyPackCode` (~line 45).
    * tests/entitlement.test.ts — the bare `isSpecialtyPackCode: vi.fn()` and the alias-keyed
      registry-driven impl merged into one canonical `vi.fn(impl)` (~line 60), plus a
      per-test registry-driven override inside the #326 storage-keys e2e test (~line 1190)
      because that describe's beforeEach blankets the canonical fn to true, which post-rename
      would misroute the base "it" load down the specialty branch.
  I unstaged these two files after a reviewer caught that staging them swept foreign hunks —
  whichever stream commits them next carries both change sets; the suite is green in the
  working tree.
- Alias deleted from lib/langRegistry.ts with a tombstone; CLAUDE.md §6 updated. Two stale
  comment lines naming the alias remain in off-limits lib/specialtyPackLoader.ts (debt).

## Other things the next wave should know
- #389 required a documented scope escalation into lib/constants.ts (new `hasStoredLangPair()`):
  the audit finding's literal suggestion (getLangPair()) synthesizes a default and would have
  redirected first-run users past the picker. store/srsStore.ts:26 still carries the same
  direct-localStorage violation class (debt, cross-stream).
- #398's `EvictPackResult` should relocate to lib/packTypes.ts when that file frees up (debt);
  the #402 double-log finding is resolved as a natural consequence of the typed result (the
  escalated ERR-EVICT-SPECIALTY log is gone, one warn per rejected call remains, regression-
  guarded on the correct branch).
- #403's audit premise was half-wrong: the "redundant" flag check was load-bearing for
  owned-add-on-with-flag-off. Fixed by folding the #276 flag into the specialtyPacks list
  construction — single visibility source, behavior identical in all four quadrants,
  mutation-verified.
- #382 (deferred doc sweep): note that packLoader.ts's header "SPECIALTY_PACKS is currently
  empty" line was corrected during #378 remediation (audit F008) — the sweep's remaining
  targets are the other files only.
- Systemic, repo-wide: RTL auto-cleanup is INERT (vitest globals disabled, tests/setup.ts
  registers no afterEach(cleanup)) — every jsdom test file leaks mounted components; bit us
  hard in #377. One line in tests/setup.ts fixes the class (debt, unowned file).
