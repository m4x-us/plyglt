# plyglt — Project Status

## 1. Shipped

The following features are complete and in production:

- **SRS core** — FSRS v4 scheduler (`lib/srs.ts`). Schedules cards at the moment before forgetting. No overdue cards — cards are "ready" when due.
- **Italian A1–B2 curriculum — complete and audited.** All 126 units / 30,609 cards across all four CEFR levels (A1 20/20, A2 30/30, B1 36/36, B2 40/40) are authored and validated. Every level has been through at least one adversarial content-quality audit + remediation round (see `CURRICULUM.md` for the full history). Full word-card pipeline: vocabulary (recognize + produce), grammar (conjugate + fill-blank), phrases, and passage cloze.
- **Interrupt engine** — Proactive review sessions surfaced on a schedule. Desktop: Tauri system tray integration. The engine drives 3–5 card sessions of 30–60 seconds each.
- **Proactive interruption engine (M3) — fully live on macOS.** OS-level wake/unlock/idle detection (`src-tauri/src/os_events.rs`) triggers a mandatory-mode overlay session automatically, not just on a fixed schedule. Windows/Linux OS hooks are code-complete but not yet verified on real hardware (see §2).
- **Entitlement** — Client-side license model (`lib/entitlement.ts`, `store/entitlementStore.ts`). Honour system by design. See Known Issues for context.
- **Backup / restore** — Export and import of full user state as a versioned JSON backup (`lib/exportBackup.ts`, `lib/importBackup.ts`). Current backup format: version 2.
- **Platform storage abstraction** — `lib/storage.ts:createPlatformStorage` routes persistence to Tauri Store (desktop) or localStorage (web). All Zustand stores use this factory.
- **Feature flags** — `lib/featureFlags.ts` reads `NEXT_PUBLIC_FLAGS_*` environment variables. Flags are evaluated at runtime; no build step required to toggle.
- **Answer checking** — `lib/answerCheck.ts` with Levenshtein distance and NFC normalization. Handles accented characters and minor typos without false positives.
- **Introduction engine** — `lib/introduction.ts` + srsStore integration — fully live — lib/introduction.ts + srsStore integration + session-start activation (hooks/useStudySession.ts, 2026-06-29).
- **Multi-language architecture: real source-language selection.** `app/page.tsx`'s "I speak" picker is wired to a persisted `sourceLang` field (`store/settingsStore.ts`, `SETTINGS_VERSION 3`). English and Spanish are supported source languages today (`lib/language.ts`). `components/StudyCard.tsx` grades `recognize` cards against the learner's actual source language, not a hardcoded one. Spanish as a *target* language (studying Spanish itself) is not yet ready — `content/es/` is an explicitly-labeled scaffold, not real curriculum content (see §3).
- **auto-updater — fully shipped, real release live.** `components/UpdateChecker.tsx` calls `checkForUpdates()` on mount via `lib/tauri.ts`. macOS packaging is complete: a real Developer ID Application certificate, notarization, and a signed `.dmg` (both `aarch64`/`x86_64`) are live via `.github/workflows/release.yml`. `v0.1.0-beta.2` is published as a public GitHub pre-release (macOS + Linux `.AppImage`), including a working `latest.json` auto-update manifest.
- **Specialty pack add-on infrastructure** — `SpecialtyPack` interface, `SPECIALTY_PACKS`, `getSpecialtyPacks()`, `isSpecialtyPackCode()` in `lib/langRegistry.ts`. `store/entitlementStore.ts` tracks `purchasedAddOns: string[]` with `hasAddOn()` and `purchaseAddOn()` actions (schema at `ENTITLEMENT_VERSION = 3`). `lib/packLoader.ts` handles the merge path (`loadedAddOns`, `getLoadedAddOns()`, `"base_pack_not_loaded"` guard). `LanguageGrid.tsx` renders the Add-ons section when specialty packs exist. No specialty packs authored yet — infrastructure is ready, content is not.
- **E2E Playwright smoke test** — `playwright.config.ts` at repo root; tests in `tests/e2e/`; runs on port 3099 via `npm run test:e2e`. Separate from the Vitest unit suite; not counted in coverage thresholds.

---

## 2. Planned (In Task List)

Active development is tracked in `.autocode/tasks.md`. That file is the canonical list of in-progress and queued work, organized by batch and stream.

**Current priority — Sync backend (Batch 16).** Cloud sync + auth so progress persists across devices, the prerequisite for mobile. `docs/SYNC_ARCHITECTURE.md` (Supabase + FCM) is approved. Real implementation (schema, auth flows, offline sync layer) is the active work.

**Paused — Windows + Linux packaging (Batch 15).** Code-complete (OS hooks, signing config, packaging) but not yet verified on real hardware — blocked on owner access to a Windows/Linux test machine and Azure Trusted Signing portal setup, not further engineering work.

**Not started — Spanish A1–B2 curriculum.** The multi-language pipeline (export/validate/lint-quality) is proven end-to-end against `content/es/`'s scaffold unit, but real Spanish content authoring (following the same process `CURRICULUM.md` used for Italian) has not begun.

**Deferred — Mobile (Batch 17).** Depends on Batch 16 (sync) landing first.

---

## 3. Known Issues / Accepted Risks

**Client-only entitlement (intentional).**
License verification is entirely client-side — there is no server round-trip to validate a key. This is an intentional offline-first trade-off confirmed by the owner (2026-06-24). The product prioritises offline operation and zero backend dependency for core functionality. Do not treat this as a missing feature or open bug. It is documented in `CLAUDE.md § Architecture § Entitlement Model`.

**Spanish A1–B2 curriculum not yet authored.**
`content/es/` is an explicitly-labeled scaffold (one unit), not real curriculum — see `CLAUDE.md §6`. This is content authoring work, not an engineering task; the export/validate/lint-quality pipeline already runs cleanly against it end-to-end. Spanish is registered (`lib/langRegistry.ts`) but hidden from the language picker via `ready: false` until real content lands.

**Placeholder language registrations removed (2026-06-27).**
Three placeholder registrations (French, German, Portuguese) with no real content or packs were cleaned out of lib/langRegistry.ts in Batch 3. Only `it` (Italian, ready) and `es` (Spanish, not yet ready) remain. Re-add a language only when a real LanguageConfig and pack exist — see CONTRIBUTING_LANGUAGE.md.

**RESOLVED 2026-08-06 (was: `next`/`postcss`/`sharp` high-severity npm vulnerabilities, previously believed unfixable without a major Next.js downgrade).**
A real fix shipped upstream since this was last checked (2026-07-29): `next@16.3.0` bundles patched `postcss`/`sharp` and was already permitted by `package.json`'s existing `^16.2.12` range — no version-range change needed, just a lockfile refresh (Task #513). `npm audit` now reports 0 vulnerabilities. Full verification gate (tsc, 1546/1546 tests, lint, a real `next build`) confirmed clean before this landed.

**RESOLVED 2026-08-04 (was: `eslint`/`minimatch`/`brace-expansion`/`eslint-config-next`'s plugins high-severity, added 2026-07-29).**
Re-checked before starting the previously-planned ESLint 9→10 major-version migration: `eslint`, `eslint-config-next`, and its plugins are no longer flagged at all (resolved by ordinary upstream dependency updates over the intervening week). The one remaining live finding — `brace-expansion` (transitively required by both `eslint`'s and `eslint-config-next`'s own `minimatch` dependencies, at two different version lines) — was fixed with a narrow, path-scoped `overrides` entry in `package.json` pinning each instance to its patched version (`^1.1.18` and `^5.0.9` respectively), rather than the originally-planned major ESLint upgrade. This closes the actual security gap with far less blast radius than a flat-config migration would have required. `.github/workflows/ci.yml`'s audit allowlist updated to match — `eslint`/`eslint-config-next`/its plugins/`minimatch`/`brace-expansion` all removed, since none are flagged anymore. ESLint 9→10 itself remains a legitimate but no-longer-security-urgent future upgrade — see `.autocode/tasks.md` Task #507.

---

## 4. Curriculum Status

| Level | Units authored | Units planned | Cards | New words (target, per CURRICULUM.md) |
|-------|---------------|---------------|-------|---------------|
| A1    | 20            | 20            | 2,810 | ~800          |
| A2    | 30            | 30            | 5,392 | ~1,400        |
| B1    | 36            | 35            | 7,296 | ~2,300        |
| B2    | 40            | 40            | 15,111 | ~3,500       |
| **Total** | **126**   | **125**       | **30,609** | **~8,000** |

Unit count exceeds the original 125-unit plan — B1 and B2 each shipped one extra unit past their original targets (B1's dedicated imperative-mood unit, B2's reading-passages capstone). Verified directly against `public/packs/it.json`'s `unitCount`/`cardCount` fields and `content/index.ts`'s `ALL_UNITS` length at the time this was written, not copied from `CURRICULUM.md`'s own prose (which currently understates B2 by 219 cards — a stale figure from before that level's most recent remediation round).

See `CURRICULUM.md` for the full unit index, word count targets, card quality standards, and the complete content-quality audit history for each level.

---

## 5. Card ID Format

Italian cards (the frozen, unnamespaced legacy format) use:

```
{level}u{unit:02d}-t{tier}-{seq:03d}
```

Example: `a1u01-t1-001` — A1, unit 01, tier 1, card 001.

Every language after Italian (including Spanish) uses a language-prefixed, namespaced format:

```
{lang}-{level}u{unit:02d}-t{tier}-{seq:03d}
```

Example: `es-a1u01-t1-001` — Spanish, A1, unit 01, tier 1, card 001. This format is live today in `content/es/`'s scaffold unit, not just planned.

CONTRIBUTING_LANGUAGE.md documents both formats.
