---
agent: docs
last-updated: 2026-06-26
runs: 2
---
# Documentation Agent Memory — plyglt

## Codebase Model

**Stack:** Next.js 16.2.9, React 19, Zustand 5, Tauri 2. Desktop-first app wrapped in Tauri; web routes served via Next.js App Router. Target language: Italian (A1–B2). Planned multi-language platform.

**Docs inventory as of 2026-06-24:**
- `CLAUDE.md` — three `@include` directives only (BRAND.md, CURRICULUM.md, AGENTS.md). No architecture content.
- `BRAND.md` — product philosophy, voice/tone rules, terminology table, visual identity, pricing model, proactive interruption model, roadmap. Authoritative and comprehensive.
- `CURRICULUM.md` — full 125-unit plan (A1–B2), word count targets, card quality standards, content generation workflow. Describes planned state, not shipped state.
- `AGENTS.md` — Slow-Coding Toyota System (SCTS): Andon cord, Kaizen, Poka-yoke, Slow=Deliberate. Verification gate. Stop-the-line violations. Well-written and enforceable.
- `CONTRIBUTING_LANGUAGE.md` — procedural guide for adding a new language pack, steps 1–7. Solid structure; gaps in grading contract documentation.
- `.autocode/tasks.md` — task tracking (Wave 1, Batch D/D2 structure). Supersedes owner memory for wave/batch status.
- No `STATUS.md` exists anywhere in the repo.

**Key source modules (undocumented externally):**
- `lib/srs.ts` — FSRS v4 algorithm implementation
- `lib/storage.ts` — platform storage abstraction (Tauri Store vs localStorage)
- `lib/tauri.ts` — Tauri graceful-degradation wrapper
- `lib/langRegistry.ts` — language registry; stubs exist for fr/de/pt pointing to Spanish config
- `store/migrations.ts` — Zustand persist migration chain with version constant
- `app/study/` — study session orchestration
- `content/types.ts` — Pack/Manifest/Card type definitions
- `scripts/exportPack.ts`, `scripts/validatePack.ts` — pack toolchain

**Shipped curriculum reality:** 57 units (14 A1, 16 A2, 14 B1, 13 B2). Planned: 125 units. Gap: 68 units unbuilt.

**Test suite:** 310 `it()` calls across 16 test files (updated 2026-06-26). Coverage baseline: stmts=83.49%, branches=80.23%, functions=80.82%, lines=85.37%. Thresholds exist in `vitest.config.ts` but not ratcheted (see qa.md Task C).

**Key source modules added since 2026-06-24 (undocumented):**
- `lib/constants.ts` — LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode extracted from store layer
- `lib/licenseTypes.ts` — LicenseType moved from store layer to lib layer

## Documentation Map

| Document | Covers | Quality |
|---|---|---|
| `BRAND.md` | Product philosophy, voice, terminology, visual identity, pricing, interruption model, roadmap | High — authoritative, comprehensive, no gaps found |
| `CURRICULUM.md` | 125-unit plan, word counts, card quality standards, content workflow | High for plan; silent on plan-vs-shipped distinction — misleading |
| `AGENTS.md` | SCTS dev philosophy, verification gate, stop-the-line violations | High — enforceable, well-scoped |
| `CONTRIBUTING_LANGUAGE.md` | Steps 1–7 for adding a language pack, card ID format, file structure | Medium — procedural steps solid; grading contract (NFC, diacritic tolerance, Levenshtein fuzzy, "close" result) undocumented; card ID format inconsistent with Italian actual format |
| `CLAUDE.md` | Entry point for agents | Low — contains only three `@include` directives; zero architecture, no onboarding, no module inventory |

## Recurring Patterns

**Plan/reality divergence without reconciliation.** CURRICULUM.md describes 125 planned units as if they exist. CONTRIBUTING_LANGUAGE.md describes a card ID format that doesn't match Italian cards. Neither document notes the gap between plan and shipped state. Future documentation work should always include a "Shipped vs. Planned" callout when a document covers roadmap content.

**Conventions live only in code comments.** Migration system conventions (never remove entries, throw on missing step, bump VERSION), atomic write ordering (data-before-meta), and Tauri graceful-degradation pattern are documented only inline. They are invisible to agents reading CLAUDE.md. Any convention enforced only in comments will eventually be violated by an agent that reads the module list but not every file.

**Stub code not cross-referenced from docs.** `lib/langRegistry.ts` has fr/de/pt stubs pointing to Spanish config. `CONTRIBUTING_LANGUAGE.md` describes French as a future example language but doesn't mention these stubs. Agent adding French will either duplicate or conflict with them.

**No test count or coverage baseline anchored in docs.** The verification gate in AGENTS.md requires `npm test` to pass but names no threshold. Any coverage regression is invisible unless a developer happens to check.

## Known Blind Spots

<!-- Populated by /patterns after multiple runs -->

## Past Findings — Open

| Task | Location | Finding |
|---|---|---|
| Task #030 | `CLAUDE.md` | Zero architecture content — only three @include directives. No module inventory, no source file descriptions, no layer architecture. |
| Task #030 | `CLAUDE.md` | How to run the app (`npm run dev`, `npm run tauri:dev`) not documented. |
| Task #030 | `CLAUDE.md` | `CONTRIBUTING_LANGUAGE.md` not referenced from `CLAUDE.md`. |
| Task #030 | `CLAUDE.md` | Migration versioning conventions (never remove entries, throw on missing step, bump VERSION) not documented in `CLAUDE.md`. |
| Task #031 | repo root | No `STATUS.md` exists. No project status tracking in the repo. |
| Task #032 | `CONTRIBUTING_LANGUAGE.md` | NFC normalization behavior undocumented. `checkAnswer` normalizes both sides to NFC; content authors do not need to list accent-stripped variants in `accepted[]`. |
| Task #032 | `CONTRIBUTING_LANGUAGE.md` | Diacritic tolerance undocumented. Missing an accent returns "correct" (not "close") because NFD-stripped forms match. |
| Task #032 | `CONTRIBUTING_LANGUAGE.md` | "close" result (Levenshtein ≤1 for answers > 4 chars) undocumented. Authors need to know short words have no fuzzy tolerance. |
| Batch 4 | `lib/srs.ts` | FSRS algorithm entirely undocumented externally. Weight array, Grade/CardState types, Stability/Difficulty/Retrievability semantics, `autoRate()` logic — none covered in any doc. |
| Batch 4 | `store/migrations.ts` | Migration system conventions (never remove entries, throw on missing step, bump VERSION constant) exist only in inline code comments. |
| Batch 4 | `lib/tauri.ts` | Tauri graceful-degradation pattern undocumented. Rule: always import from `lib/tauri`, never from `@tauri-apps/api` directly; all calls no-op in browser. Critical for agents adding features. |
| Batch 4 | `lib/storage.ts` | Platform storage abstraction undocumented. Tauri Store vs localStorage routing, `useIsHydrated` requirement — not covered anywhere external to the file. |
| Batch 4 | `content/types.ts` | Pack format undocumented. `Pack`/`Manifest` interfaces, `_version`, `canonicalSource`, `sha256`, three-layer cache (memory → storage → network) not described outside code. |
| Batch 4 | `app/study/` | Entitlement architecture undocumented. Lemon Squeezy, `licenseType` values, `FREE_PACK_CODES`, `unlockedPacks` semantics — no external doc. |
| Batch 4 | `scripts/exportPack.ts:259` | Atomic write pattern (data-before-meta ordering in `packLoader.ts`) not documented. |
| Batch 4 | `CURRICULUM.md` | Plan/reality mismatch: CURRICULUM.md describes 125 units; 57 are shipped. No document reconciles planned vs. shipped. |
| Batch 4 | `CONTRIBUTING_LANGUAGE.md` | Card ID format mismatch: template specifies `{lang}-{level}u{unit:02d}-t{tier}-{seq:03d}`; Italian cards use a shorter format without lang prefix. |
| Batch 4 | `CONTRIBUTING_LANGUAGE.md` | `lib/langRegistry.ts` stubs for fr/de/pt point to Spanish config. `CONTRIBUTING_LANGUAGE.md` describes French as future example but doesn't mention these stubs. |
| Batch 4 | `CLAUDE.md` | Test count and coverage baseline absent. Actual (2026-06-26): 310 `it()` calls across 16 test files. Thresholds exist in `vitest.config.ts` but not documented externally. |
| — | `CONTRIBUTING_LANGUAGE.md` | Lifetime checkout URLs and pricing text present (Task #001 cleanup removed these from `lib/entitlement.ts` but this file was not updated). References to lifetime pricing must be removed. |
| — | `CONTRIBUTING_LANGUAGE.md` | File organization template references `content/fr/index.ts` — this path does not match the actual structure (`content/cards/` flat layout). Template must be updated to match real structure. |
| — | `CONTRIBUTING_LANGUAGE.md` | Card ID format example `fr-a1u01-t1-001` includes a language prefix that Italian cards do not use. Confirmed mismatch. Format documented must match actual Italian format (no lang prefix). |
| — | `public/packs/es.json` | 245KB Spanish pack file exists but is entirely undocumented. Not referenced in CONTRIBUTING_LANGUAGE.md, CLAUDE.md, or any status document. Shipped content with no doc anchor. |
| — | `CLAUDE.md` | `lib/constants.ts` and `lib/licenseTypes.ts` added since last meet; neither is documented in CLAUDE.md module inventory. |
| — | `app/decks/` | Empty directory — owner decided to delete (2026-06-26). No routes, no files, no references. Any doc referencing `app/decks/` must be updated after deletion. |
| — (Task #015) | `tests/grading.test.ts` | Dead test file still present — strict subset of `tests/srs.test.ts`. Should be removed. If any doc references this file, update after removal. |

## Past Findings — Resolved

None yet.
