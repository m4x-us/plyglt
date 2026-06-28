---
agent: docs
last-updated: 2026-06-27
runs: 3
---
# Documentation Agent Memory — plyglt

## Codebase Model

**Stack:** Next.js 16.2.9, React 19, Zustand 5, Tauri 2. Client-only architecture. Desktop-first app wrapped in Tauri; web routes served via Next.js App Router. Target languages: it (Italian) and es (Spanish). fr/de/pt removed from langRegistry.ts.

**Docs inventory as of 2026-06-27:**
- `CLAUDE.md` — three `@include` directives only (BRAND.md, CURRICULUM.md, AGENTS.md). No architecture content, no module inventory, no onboarding.
- `BRAND.md` — product philosophy, voice/tone rules, terminology table, visual identity, pricing model, proactive interruption model, roadmap. Authoritative and comprehensive. Note: session timer spec (thin progress bar, 60-second countdown) will be REMOVED by Task #054 — card position is the intended design.
- `CURRICULUM.md` — full 125-unit plan (A1–B2), word count targets, card quality standards, content generation workflow. Describes planned state, not shipped state. 57 of 125 units shipped (68 unbuilt).
- `AGENTS.md` — Slow-Coding Toyota System (SCTS): Andon cord, Kaizen, Poka-yoke, Slow=Deliberate. Verification gate. Stop-the-line violations. Well-written and enforceable.
- `CONTRIBUTING_LANGUAGE.md` — procedural guide for adding a new language pack, steps 1–7. 9 known issues as of 2026-06-27 (see Open Findings). Task #033 is FIRST in Batch 4 — expedited.
- `.autocode/tasks.md` — task tracking (76 tasks, 6 batches). Canonical source of truth for wave/batch status.
- No `STATUS.md` exists anywhere in the repo.

**Key source modules:**
- `lib/srs.ts` — FSRS v4 algorithm implementation (Weight array, Grade/CardState types, autoRate())
- `lib/answerCheck.ts` — answer checking: Levenshtein, NFC normalization, article stripping. Extracted from srs.ts in Batch 3. CONTRIBUTING_LANGUAGE.md still references lib/srs.ts in Step 1 — stale.
- `lib/cardLabels.ts` — TIER_LABELS constant, tierLabel() function. New in Batch 3.
- `lib/exportBackup.ts` — exportBackup(), CURRENT_BACKUP_VERSION = 2. New in Batch 3. Undocumented in all agent docs.
- `lib/featureFlags.ts` — getFeatureFlags(), FeatureFlags interface, 3 NEXT_PUBLIC_FLAGS_* env vars. New in Batch 3. Entirely undocumented in CLAUDE.md.
- `lib/constants.ts` — LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode extracted from store layer
- `lib/licenseTypes.ts` — LicenseType moved from store layer to lib layer
- `lib/storage.ts` — platform storage abstraction (Tauri Store vs localStorage)
- `lib/tauri.ts` — Tauri graceful-degradation wrapper. Rule: always import from lib/tauri, never from @tauri-apps/api directly. All calls no-op in browser. Undocumented in CLAUDE.md.
- `lib/langRegistry.ts` — language registry; fr/de/pt REMOVED. Only it and es registered.
- `store/migrations.ts` — Zustand persist migration chain with version constant
- `app/study/` — study session orchestration
- `content/types.ts` — Pack/Manifest/Card type definitions
- `scripts/exportPack.ts`, `scripts/validatePack.ts` — pack toolchain

**New hooks (Batch 3, undocumented in CLAUDE.md):**
- `hooks/useStudySession.ts`
- `hooks/useExportImport.ts`
- `hooks/useLicenseActivation.ts`

**New components (Batch 3, undocumented in CLAUDE.md):**
- `UnitRow`, `LevelSection`, `Stat`, `StudyDoneScreen`, `StudyResumePrompt`
- `settings/Section`, `settings/Toggle`

**Shipped curriculum reality:** 57 units (A1–B2). Planned: 125 units. Gap: 68 units unbuilt.

**Test suite:** ~515 `it()` calls (was 310 as of 2026-06-26). Coverage baseline: stmts=83.49% (likely higher after Batch 3 — needs re-measure). Thresholds exist in `vitest.config.ts` but not ratcheted and not documented externally.

## Documentation Map

| Document | Covers | Quality |
|---|---|---|
| `BRAND.md` | Product philosophy, voice, terminology, visual identity, pricing, interruption model, roadmap | High — Task #054 will remove stale session timer spec |
| `CURRICULUM.md` | 125-unit plan, word counts, card quality standards, content workflow | High for plan; 57 of 125 units shipped (68 unbuilt) — no "Shipped vs. Planned" callout |
| `AGENTS.md` | SCTS dev philosophy, verification gate, stop-the-line violations | High — enforceable, well-scoped |
| `CONTRIBUTING_LANGUAGE.md` | Steps 1–7 for adding a language pack, card ID format, file structure | LOW — 9 known issues; Task #033 (expedited, first in Batch 4) |
| `CLAUDE.md` | Entry point for agents | Low — three @include directives only; no architecture section (Task #031) |
| `STATUS.md` | — | MISSING (Task #032) |

## Recurring Patterns

**Plan/reality divergence without reconciliation.** CURRICULUM.md describes 125 planned units as if they exist. CONTRIBUTING_LANGUAGE.md describes a card ID format that doesn't match Italian cards. Neither document notes the gap between plan and shipped state. Future documentation work should always include a "Shipped vs. Planned" callout when a document covers roadmap content.

**Conventions live only in code comments.** Migration system conventions (never remove entries, throw on missing step, bump VERSION), atomic write ordering (data-before-meta), and Tauri graceful-degradation pattern are documented only inline. They are invisible to agents reading CLAUDE.md. Any convention enforced only in comments will eventually be violated by an agent that reads the module list but not every file.

**New modules undocumented after extraction.** Batch 3 added 4 lib/ modules (answerCheck.ts, cardLabels.ts, exportBackup.ts, featureFlags.ts) and 3 hooks/ — zero appear in CLAUDE.md. This pattern will recur after every batch unless documentation is updated as part of the batch completion checklist.

**Stub code not cross-referenced from docs.** fr/de/pt stubs in lib/langRegistry.ts were documented as "future examples" but those stubs are now removed. CONTRIBUTING_LANGUAGE.md used fr as its primary worked example — now stale and actively misleading. Always re-check CONTRIBUTING_LANGUAGE.md for stale file references when a langRegistry cleanup task ships.

**CONTRIBUTING_LANGUAGE.md as a compounding risk.** This file accumulates stale references faster than any other doc because it sits at the intersection of lib/ extraction changes, langRegistry changes, entitlement changes, and card format decisions. It must be explicitly reviewed as a step in every task that touches those modules.

## Known Blind Spots

- Did not catch that CONTRIBUTING_LANGUAGE.md Step 2 had a TypeScript compile error in its example code until /meet 2026-06-27.
- Did not catch that fr as worked example would break after langRegistry cleanup.
- Did not flag that CURRENT_BACKUP_VERSION = 2 should be anchored in an agent doc — any agent touching backup import/export has no external version signal.
- Future: always re-check CONTRIBUTING_LANGUAGE.md for stale file references when any lib/ extraction task ships.
- Future: coverage baseline needs re-measurement after Batch 3 — the 83.49% figure is stale.

## Past Findings — Open

| Task | Location | Finding |
|---|---|---|
| Task #031 | `CLAUDE.md` | No ## Architecture section — module inventory, layer architecture, and how-to-run instructions are entirely absent. |
| Task #031 | `CLAUDE.md` | lib/featureFlags.ts entirely undocumented — 3 NEXT_PUBLIC_FLAGS_* env vars, getFeatureFlags(), FeatureFlags interface. Future agents will not know these exist. |
| Task #031 | `CLAUDE.md` | lib/answerCheck.ts entirely undocumented — future agents will add answer-checking logic directly to lib/srs.ts, causing duplicate logic or correctness bugs. |
| Task #031 | `CLAUDE.md` | lib/tauri.ts graceful-degradation pattern undocumented. Rule: always import from lib/tauri, never from @tauri-apps/api directly; all calls no-op in browser. Critical for any agent adding Tauri features. |
| Task #031 | `CLAUDE.md` | CURRENT_BACKUP_VERSION = 2 undocumented. Any agent touching backup import/export has no signal that a version field must be bumped on schema change. |
| Task #031 | `CLAUDE.md` | Coverage thresholds exist in vitest.config.ts but not documented in CLAUDE.md or AGENTS.md (SCTS kaizen violation — Task C). |
| Task #031 | `CLAUDE.md` | hooks/useStudySession.ts, hooks/useExportImport.ts, hooks/useLicenseActivation.ts added in Batch 3; none appear in any agent-facing doc. |
| Task #031 | `CLAUDE.md` | lib/constants.ts and lib/licenseTypes.ts added since last meet; neither documented in CLAUDE.md module inventory. |
| Task #032 | repo root | STATUS.md does not exist. No project status tracking in the repo. |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | Step 1 references "lib/srs.ts" — should be "lib/answerCheck.ts" (Batch 3 extraction changed this). |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | Step 2 TypeScript compile error: example code references a `pricing` field that does not exist in LanguageEntry. |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | Step 5 references `french_lifetime` license key — forbidden per lib/entitlement.ts:118; lifetime keys were removed in Task #001. |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | French (fr) used as primary worked example throughout — fr removed from langRegistry.ts. Example is now a non-working language. |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | NFC normalization behavior undocumented. checkAnswer normalizes both sides to NFC; content authors do not need to list accent-stripped variants in accepted[]. |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | Diacritic tolerance undocumented. Missing an accent returns "correct" (not "close") because NFD-stripped forms match. |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | Levenshtein "close" threshold undocumented. Authors need to know short words (≤4 chars) have no fuzzy tolerance. |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | Card ID format discrepancy: template specifies {lang}-{level}u{unit:02d}-t{tier}-{seq:03d}; Italian cards use a shorter format without lang prefix. |
| Task #033 | `CONTRIBUTING_LANGUAGE.md` | ready:false stub pattern undocumented. Authors do not know how to register a language that is defined but not yet user-visible. |
| Batch 4 | `BRAND.md` | Session timer spec (thin progress bar, 60-second countdown) will be REMOVED by Task #054. Card position is the intended design. Must be removed before Task #054 ships. |
| Batch 4 | `CONTRIBUTING_LANGUAGE.md` | Lifetime checkout URLs and pricing text present — removed from lib/entitlement.ts in Task #001 but this file was not updated. |
| Batch 4 | `CONTRIBUTING_LANGUAGE.md` | File organization template references content/fr/index.ts — does not match actual structure (content/cards/ flat layout). |
| Batch 4 | `CONTRIBUTING_LANGUAGE.md` | Card ID format example fr-a1u01-t1-001 includes a language prefix that Italian cards do not use. Confirmed mismatch. Format documented must match actual Italian format (no lang prefix). |
| Batch 4 | `CURRICULUM.md` | Plan/reality mismatch: CURRICULUM.md describes 125 units; 57 are shipped. No document reconciles planned vs. shipped. |
| Batch 4 | `lib/srs.ts` | FSRS algorithm entirely undocumented externally. Weight array, Grade/CardState types, Stability/Difficulty/Retrievability semantics, autoRate() logic — none covered in any doc. |
| Batch 4 | `store/migrations.ts` | Migration system conventions (never remove entries, throw on missing step, bump VERSION constant) exist only in inline code comments. |
| Batch 4 | `lib/storage.ts` | Platform storage abstraction undocumented. Tauri Store vs localStorage routing, useIsHydrated requirement — not covered anywhere external to the file. |
| Batch 4 | `content/types.ts` | Pack format undocumented. Pack/Manifest interfaces, _version, canonicalSource, sha256, three-layer cache (memory → storage → network) not described outside code. |
| Batch 4 | `app/study/` | Entitlement architecture undocumented. Lemon Squeezy, licenseType values, FREE_PACK_CODES, unlockedPacks semantics — no external doc. |
| Batch 4 | `scripts/exportPack.ts` | Atomic write pattern (data-before-meta ordering in packLoader.ts) not documented. |
| Batch 4 | `CLAUDE.md` | Test count and coverage baseline stale. Actual: ~515 it() calls (was 310). Coverage likely above 83.49% after Batch 3 — needs re-measure. Thresholds not documented externally. |
| — | `public/packs/es.json` | 245KB Spanish pack file exists but is entirely undocumented. Not referenced in CONTRIBUTING_LANGUAGE.md, CLAUDE.md, or any status document. Shipped content with no doc anchor. |
| — | `app/decks/` | Empty directory — owner decided to delete (2026-06-26). No routes, no files, no references. Any doc referencing app/decks/ must be updated after deletion. |
| — (Task #015) | `tests/grading.test.ts` | Dead test file still present — strict subset of tests/srs.test.ts. Should be removed. If any doc references this file, update after removal. |

## Past Findings — Resolved

None yet.
