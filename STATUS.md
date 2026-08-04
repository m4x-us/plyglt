# plyglt — Project Status

## 1. Shipped

The following features are complete and in production:

- **SRS core** — FSRS v4 scheduler (`lib/srs.ts`). Schedules cards at the moment before forgetting. No overdue cards — cards are "ready" when due.
- **Italian A1–B1 curriculum** — 57 of 125 planned units authored and validated. Full word-card pipeline: vocabulary (recognize + produce), grammar (conjugate + fill-blank), phrases, and passage cloze.
- **Interrupt engine** — Proactive review sessions surfaced on a schedule. Desktop: Tauri system tray integration. The engine drives 3–5 card sessions of 30–60 seconds each.
- **Entitlement** — Client-side license model (`lib/entitlement.ts`, `store/entitlementStore.ts`). Honour system by design. See Known Issues for context.
- **Backup / restore** — Export and import of full user state as a versioned JSON backup (`lib/exportBackup.ts`, `lib/importBackup.ts`). Current backup format: version 2.
- **Platform storage abstraction** — `lib/storage.ts:createPlatformStorage` routes persistence to Tauri Store (desktop) or localStorage (web). All Zustand stores use this factory.
- **Feature flags** — `lib/featureFlags.ts` reads `NEXT_PUBLIC_FLAGS_*` environment variables. Flags are evaluated at runtime; no build step required to toggle.
- **Answer checking** — `lib/answerCheck.ts` with Levenshtein distance and NFC normalization. Handles accented characters and minor typos without false positives.
- **Introduction engine** — `lib/introduction.ts` + srsStore integration — fully live — lib/introduction.ts + srsStore integration + session-start activation (hooks/useStudySession.ts, 2026-06-29).
- **auto-updater wired** — `components/UpdateChecker.tsx` calls `checkForUpdates()` on mount via `lib/tauri.ts`. Real ed25519 pubkey added to `src-tauri/tauri.conf.json` (Task #121 — complete). Full shipping pending signed macOS packaging (M2).
- **Specialty pack add-on infrastructure** — `SpecialtyPack` interface, `SPECIALTY_PACKS`, `getSpecialtyPacks()`, `isSpecialtyPackCode()` in `lib/langRegistry.ts`. `store/entitlementStore.ts` tracks `purchasedAddOns: string[]` with `hasAddOn()` and `purchaseAddOn()` actions (schema at `ENTITLEMENT_VERSION = 3`). `lib/packLoader.ts` handles the merge path (`loadedAddOns`, `getLoadedAddOns()`, `"base_pack_not_loaded"` guard). `LanguageGrid.tsx` renders the Add-ons section when specialty packs exist. No specialty packs authored yet — infrastructure is ready, content is not.
- **E2E Playwright smoke test** — `playwright.config.ts` at repo root; tests in `tests/e2e/`; runs on port 3099 via `npm run test:e2e`. Separate from the Vitest unit suite; not counted in coverage thresholds.

---

## 2. Planned (In Task List)

Active development is tracked in `.autocode/tasks.md`. That file is the canonical list of in-progress and queued work, organized by batch and stream.

**M2 — Desktop shipping:** Pro feature gating, Lemon Squeezy annual checkout flow end-to-end ($34.99/yr, Task #120 complete), macOS packaging (signed + notarised). Windows/Linux packaging deferred to Batch 9.

---

## 3. Known Issues / Accepted Risks

**Client-only entitlement (intentional).**
License verification is entirely client-side — there is no server round-trip to validate a key. This is an intentional offline-first trade-off confirmed by the owner (2026-06-24). The product prioritises offline operation and zero backend dependency for core functionality. Do not treat this as a missing feature or open bug. It is documented in `CLAUDE.md § Architecture § Entitlement Model`.

**68 curriculum units not yet authored.**
57 of 125 planned units exist (A1 through B1). The remaining 68 (B2 level and some B1 consolidation units) are content authoring work, not engineering tasks. No code change is required to add them — the pipeline that converts unit TypeScript files into validated JSON packs is complete. Missing units are a content gap, not a software gap.

**Placeholder language registrations removed (2026-06-27).**
Three placeholder registrations (French, German, Portuguese) with no real content or packs were cleaned out of lib/langRegistry.ts in Batch 3. Only `it` (Italian, ready) and `es` (Spanish, not yet ready) remain. Re-add a language only when a real LanguageConfig and pack exist — see CONTRIBUTING_LANGUAGE.md.

**`next`/`postcss`/`sharp` high-severity npm vulnerabilities — bundled inside Next.js itself, unfixable without a major Next.js downgrade (updated 2026-07-29).**
`npm audit` reports high-severity advisories for `postcss` and `sharp` even at Next.js's latest available version (16.2.12) — both are dependencies Next.js bundles internally, not something this project chooses independently. (This entry previously described 2 *moderate*-severity build-time CSS ReDoS issues; the underlying packages have since accumulated additional, higher-severity CVEs and the advisory database now classifies them as high.) The only "fix" `npm audit fix --force` offers is downgrading to `next@9.3.3`, an ancient, incompatible version — not a real option. CI's audit step (`.github/workflows/ci.yml`) allows exactly this documented set of package names through; any new high-severity advisory outside this list still fails the build. Do not investigate or attempt to fix these — they require an upstream Next.js patch release.

**RESOLVED 2026-08-04 (was: `eslint`/`minimatch`/`brace-expansion`/`eslint-config-next`'s plugins high-severity, added 2026-07-29).**
Re-checked before starting the previously-planned ESLint 9→10 major-version migration: `eslint`, `eslint-config-next`, and its plugins are no longer flagged at all (resolved by ordinary upstream dependency updates over the intervening week). The one remaining live finding — `brace-expansion` (transitively required by both `eslint`'s and `eslint-config-next`'s own `minimatch` dependencies, at two different version lines) — was fixed with a narrow, path-scoped `overrides` entry in `package.json` pinning each instance to its patched version (`^1.1.18` and `^5.0.9` respectively), rather than the originally-planned major ESLint upgrade. This closes the actual security gap with far less blast radius than a flat-config migration would have required. `.github/workflows/ci.yml`'s audit allowlist updated to match — `eslint`/`eslint-config-next`/its plugins/`minimatch`/`brace-expansion` all removed, since none are flagged anymore. ESLint 9→10 itself remains a legitimate but no-longer-security-urgent future upgrade — see `.autocode/tasks.md` Task #507.

---

## 4. Curriculum Status

| Level | Units authored | Units planned | Words covered |
|-------|---------------|---------------|---------------|
| A1    | 20            | 20            | ~800          |
| A2    | 30            | 30            | ~1,400        |
| B1    | 7             | 35            | ~460 (partial)|
| B2    | 0             | 40            | 0             |
| **Total** | **57**    | **125**       | **~2,660**    |

See `CURRICULUM.md` for the full unit index, word count targets, and card quality standards.

No code task is required for the 68 unbuilt units — they are content authoring work handled outside the engineering backlog.

---

## 5. Card ID Format

Italian cards (the only shipped language) use the format:

```
{level}u{unit:02d}-t{tier}-{seq:03d}
```

Example: `a1u01-t1-001` — A1, unit 01, tier 1, card 001.

Non-Italian cards added in future language packs should use a language-prefixed format:

```
{lang}-{level}u{unit:02d}-t{tier}-{seq:03d}
```

Example: `es-a1u01-t1-001` — Spanish, A1, unit 01, tier 1, card 001.

CONTRIBUTING_LANGUAGE.md documents both formats (updated this sprint).
