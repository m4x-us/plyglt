# Docs Agent Memory — plyglt

## Canonical Docs
- `CLAUDE.md` — architecture reference for agent sessions. Must be updated when: new lib/ modules added, layer rules change, major features shipped.
- `STATUS.md` — at-a-glance project state. Must reflect current milestone and shipped features.
- `AGENTS.md` — contains verification gate with coverage thresholds. Must match vitest.config.ts.
- `BRAND.md` — product vision and terminology. Checked into repo. Not agent-modified.
- `CURRICULUM.md` — curriculum specification. Not agent-modified.

## Current State (as of Batch 13 COMPLETE)

### CLAUDE.md
- §1–§8 all present and accurate.
- §2 Tauri Gateway: lists checkForUpdates(), enableAutostart(), disableAutostart() ✓ (Task #116)
- Notable modules: lib/checkout.ts ✓ (Task #116)
- Notable modules: lib/featureFlags.ts:isProEnabled combinator ✓ (Task #116)
- Notable modules: components/UpdateChecker.tsx ✓ (Task #116)
- §5 Entitlement Model: cross-ref to lib/checkout.ts ✓ (Task #116); purchasedAddOns/hasAddOn/purchaseAddOn/ENTITLEMENT_VERSION=3 ✓ (run 7, 2026-07-01)
- §6 Pack Format: SpecialtyPack/loadedAddOns/getLoadedAddOns/base_pack_not_loaded merge path ✓ (run 7, 2026-07-01)
- §7 Introduction Engine: session-start activation sentence ✓ (Task #116)
- §8 E2E Testing: Playwright, port 3099, tests/e2e/, test:e2e script ✓ (run 7, 2026-07-01)
- Notable modules: components/LanguageGrid.tsx — Add-ons section + hasAddOn prop ✓ (run 7, 2026-07-01)

### STATUS.md
- §1 Shipped: lists SRS core, curriculum, interrupt engine, entitlement, backup/restore, feature flags, introduction engine, auto-updater wired ✓ (Task #116); specialty pack + E2E entries ✓ (run 7, 2026-07-01)
- §2 Planned: M2 description present.
- §3 Known Issues: fr/de/pt stale claims removed; CVE documentation added ✓ (Task #125 fulfilled inline, run 7, 2026-07-01)

### AGENTS.md
- Verification gate: lines=84, funcs=79, branches=81, stmts=82 — ACCURATE ✓

## Open Tasks
(None — all documentation current as of Batch 13 COMPLETE, 2026-07-01)

## Resolved Issues (do not re-report)
- CLAUDE.md §1-§7 architecture sections — ADDED
- STATUS.md created
- CONTRIBUTING_LANGUAGE.md all 9 issues — FIXED (Task #033)
- BRAND.md session timer spec — REMOVED (Task #079)
- CLAUDE.md §7 Introduction Engine — ADDED (Task #093)
- STATUS.md fr/de/pt stale claims — REMOVED (Task #093)
- AGENTS.md coverage thresholds added — DONE (Task #093)
- AGENTS.md branches 79→81 — DONE (Task #107)
- CLAUDE.md lib/utils.ts, useStudySession.ts, BuyModal.tsx, LanguageGrid.tsx — ADDED (Task #108)
- STATUS.md M2 description + intro engine "fully live" — DONE (Task #109)
- CLAUDE.md lib/checkout.ts, featureFlags.ts isProEnabled, UpdateChecker.tsx, tauri exports, session-start activation — ADDED (Task #116)
- STATUS.md auto-updater shipped entry — ADDED (Task #116)
- CLAUDE.md §5 purchasedAddOns/hasAddOn/purchaseAddOn + ENTITLEMENT_VERSION=3 — FIXED (run 7, 2026-07-01)
- CLAUDE.md §6 SpecialtyPack/loadedAddOns/getLoadedAddOns/base_pack_not_loaded merge path — FIXED (run 7, 2026-07-01)
- CLAUDE.md §1 LanguageGrid — Add-ons section + hasAddOn prop — FIXED (run 7, 2026-07-01)
- CLAUDE.md §8 E2E Testing — Playwright, port 3099, tests/e2e/, test:e2e script — ADDED (run 7, 2026-07-01)
- STATUS.md specialty pack + E2E entries in §1 Shipped — FIXED (run 7, 2026-07-01)
- STATUS.md §3 CVE documentation (Task #125 fulfilled inline) — FIXED (run 7, 2026-07-01)

## Test Count in Docs
No explicit test count claimed in CLAUDE.md (good — avoids staleness). AGENTS.md verification gate references coverage thresholds only. QA memory baseline: 897 tests (confirmed Batch 10 workable tasks + run 9).

## Run History
9 runs total through 2026-07-01. Blind spots: CONTRIBUTING_LANGUAGE.md stale lifetime refs (run 1); stale file refs (run 3); introduction engine absent from CLAUDE.md (run 4); lib/utils.ts + useStudySession.ts + BuyModal.tsx + LanguageGrid.tsx missing from CLAUDE.md (run 5); lib/checkout.ts, featureFlags.ts isProEnabled, UpdateChecker.tsx, tauri exports, session-start activation missing (run 6 — Task #116 closed all); run 7: No new blind spots — all 6 documentation gaps detected in the Batch 12-13 specialty pack + E2E additions and fixed inline during run 7. Run 8: not recorded separately (sub-session). Run 9 (2026-07-01): 5 stale entries found — lib/checkout.ts pricing ($4.99/mo ref), BuyModal.tsx "checkout URLs" plural, §6 merge path attributed to packLoader.ts (now specialtyPackLoader.ts), lib/specialtyPackLoader.ts missing from notable modules, STATUS.md auto-updater signing entry — all fixed inline during run 9.

## Run 10 (2026-08-06 — full /meet re-examination) — MAJOR BLIND SPOT: STATUS.md frozen for over a month, undetected across two intervening STATUS.md-touching commits

Between run 9 and this run, STATUS.md was never substantially updated despite the entire B1/B2 curriculum shipping (69 more units, ~28,000 more cards), the M3 proactive interruption engine shipping, the full M2 macOS release pipeline going live, and the multi-language architecture prep landing. Traced precisely: the "57/125 units" table text was introduced in commit `fecd86c` (2026-07-01) and stayed byte-identical through two later STATUS.md-touching commits (`fed381e`/`4d2c772` 2026-07-29, `bb5ed5a` 2026-08-04) that edited only the unrelated Known Issues/ESLint section — both had every opportunity to catch this and didn't. This is a genuine blind spot in the docs-agent process: STATUS.md was not re-verified against live pack state at either of those two touch points.

**Findings this run (ground truth verified directly against `public/packs/it.json`'s `unitCount`/`cardCount` fields and `content/index.ts`'s `ALL_UNITS.length` — not just trusted from CURRICULUM.md's own prose):**
1. [sev 9] `STATUS.md §4 Curriculum Status` — should say A1=20/20 (2,810 cards), A2=30/30 (5,392), B1=36/36 (7,296), B2=40/40 (14,892), **Total 126/125 units, 30,609 cards**; currently says 57/125, ~2,660 words.
2. [sev 9] `STATUS.md §1 Shipped` — "57 of 125 planned units authored" should say the curriculum track is complete and audited across all 4 CEFR levels.
3. [sev 8] `STATUS.md §3 Known Issues` — "68 curriculum units not yet authored" entirely obsolete; should be removed or replaced with the real remaining gap (Spanish A1-B2 content, not yet started — `content/es/` is an explicit scaffold).
4. [sev 7] `STATUS.md §1` — auto-updater entry says "pending signed macOS packaging"; actually COMPLETE (Task #122/#123/#508, real notarized release built — though still sitting as a GitHub draft, see Product/Architecture finding, promoted to Task #509).
5. [sev 8] `STATUS.md §1` — zero mention of the M3 proactive interruption engine (Batch 14, COMPLETE 2026-07-31) — BRAND.md's headline differentiator, completely absent.
6. [sev 6] `STATUS.md` — zero mention of the multi-language/source-language selection feature (2026-08-04/05).
7. [sev 7] `STATUS.md §2 Planned` — still frames "M2 — Desktop shipping" as the active frontier; should describe the real one (Batch 15 paused on Max's hardware/Azure access; Batch 16 Task #169 now Max's stated 90-day priority as of 2026-08-06; real Spanish content not started).
8. [sev 4] `STATUS.md` — no mention of the sync architecture decision doc (Task #168, COMPLETE, Supabase+FCM).
9. [sev 6] `CLAUDE.md` — zero architecture-section coverage of `lib/tauriInterrupt.ts` (Batch 14's entire deliverable — tray/mandatory-mode IPC, consumed by 3 files), despite being COMPLETE since 2026-07-31.
10. [sev 3] `CLAUDE.md` "Notable modules" — omits several existing support-utility `lib/` files (lower priority).

Findings 1-8 promoted to Task #510 (Batch 20) — a single consolidated STATUS.md rewrite task. Max confirmed 2026-08-06: fix now. Findings 9-10 logged here as CLAUDE.md follow-up debt, not yet promoted to a task.

**Verified accurate, no action needed:** `CLAUDE.md §6`'s source-language paragraph matches the real implementation exactly (spot-checked `settingsStore.ts`/`app/page.tsx`/`StudyCard.tsx`); `content/es/index.ts` scaffold description accurate; `AGENTS.md` coverage thresholds match `vitest.config.ts`; CURRICULUM.md's own self-flagged "STALE" disclaimers on the B1/B2 planning tables still present and accurate.

**Process lesson for next run:** when STATUS.md is touched for one section (e.g. a CVE note update), always re-verify §4's curriculum numbers against a live pack read in the same pass — do not assume "STATUS.md was touched recently" means "STATUS.md is current." This is exactly how a month-long staleness gap survived two edits.

## Run 9 Fixes (2026-07-01 — applied inline)
- CLAUDE.md §1 lib/checkout.ts — "$4.99/mo, $34.99/yr" → "$34.99/yr — annual plan only" ✓
- CLAUDE.md §1 BuyModal.tsx — "checkout URLs" (plural) → "checkout URL" (singular) ✓
- CLAUDE.md §1 lib/specialtyPackLoader.ts — new notable module entry added ✓
- CLAUDE.md §6 specialty pack merge path — attributed to specialtyPackLoader.ts (not packLoader.ts) ✓
- CLAUDE.md §6 specialtyPackLoader.ts merge path detail — loadSpecialtyPack() signature documented ✓
- STATUS.md §1 auto-updater — "signing keys are Batch 10 prerequisites" → Task #121 COMPLETE, pending signed packaging ✓
- STATUS.md §2 M2 planned — removed "auto-updater with real signing keys" (done); added annual-only pricing note ✓

## Pending (after Task #175 ships — packTypes.ts extraction)
- CLAUDE.md §6 Pack Format: update `lib/packLoader.ts` Pack interface reference → "defined in `lib/packTypes.ts`" (Task #176)
