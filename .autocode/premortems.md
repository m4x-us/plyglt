
## 2026-07-16 | Task #399: tighten articles-regex test
FAILURE1: Test asserts only ready languages; es (ready:false) gets ITALIAN_ARTICLES assigned in lib/language.ts:83 and no test fails until es ships. MECHANISM: filter(l => l.ready) excludes es. SILENT BECAUSE: suite green. TRIGGER: regex swap on a not-ready language. → Mitigated: test iterates ALL of LANGUAGE_REGISTRY.
TEST1: "every language's articles regex is the canonical regex for that language" — GIVEN LANGUAGE_REGISTRY, WHEN comparing entry.config.articles.source/.flags to the canonical constant per code, THEN mismatch fails with a named-language message. Not pseudocode: expectedArticles is hardcoded in the test, not derived from configs (B7 verified YES by independent agent).
---
## 2026-07-16 | Task #377 (W14A)
F1 store-mutation leakage across describe blocks (RTL auto-cleanup INERT: vitest globals off, tests/setup.ts registers no cleanup) → fixed in-build: file-level afterEach(cleanup + full store reset). Systemic gap (other jsdom files) logged to stream debt.
F2 real loadPack gate never exercised → already covered by tests/packLoader.test.ts:799-830 (#350 suite, registry mocks).
F3 specialty/base cross-gate error taxonomy misleads paying add-on customer when base lang becomes non-free → out of scope, logged to stream debt.
F4 raw setState-only reactivity test would miss in-place mutation regressions in setEntitlement → fixed in-build: 4th test drives real setEntitlement (Rule 20a).
---
## 2026-07-16 | Task #378 (W14A)
F1 concurrent loadPack(baseLang) TOCTOU double-download clobbers merged specialty units (memCache.write clears specialty tracking) → FIXED IN-BUILD: in-flight dedup map in lib/packLoader.ts (owned file) + 3 tests in tests/packLoader.test.ts.
F2 registered-but-unentitled specialty code strands user: learn page's escape link doesn't clear LANG_PAIR_KEY → redirect loop. Fix needs app/learn/page.tsx (not owned) → debt; symptom pinned by test.
F3 base-pack load in flight during clearEntitlement resolves after eviction and re-populates memCache (cacheAndReturn has no generation check, unlike _mergeFromJson) → fix needs lib/packCache.ts (off-limits) → debt.
By-design verified: eviction-generation re-seed works for specialty targets (pinned by new test); multi-add-on merges already serialized in specialtyPackLoader.
---
