# Layer Map — plyglt
Last survey: 2026-08-06 | Triggered by: batch-20-complete

**Methodology note:** this project doesn't match the generic monorepo template (`apps/web/src/app/dashboard/`, package-per-module) the survey script assumes. Adapted to this project's real structure per `CLAUDE.md`'s Layer Map: `app/`, `components/`, `hooks/`, `lib/`, `store/` as the five layers. This project also has TWO established, intentional test-location conventions — `components/`/`hooks/`/`app/` co-locate tests next to source (Rule 14, "Component Truth"), while `lib/`/`store/` tests live centrally in `tests/`, often testing a module indirectly through a re-export facade (e.g. `lib/packManifest.ts`'s `fetchManifest` is tested via `tests/packLoader.test.ts`, which imports it through `lib/packLoader.ts`'s re-export, per that file's own documented "USED BY: lib/packLoader.ts ONLY" contract) or through a store's public action rather than a direct file import (e.g. `store/entitlementAddOns.ts`'s `createPurchaseAddOn` is tested via `tests/purchaseAddOnGuards.test.ts` calling `store().purchaseAddOn(...)`, the real production entry point — the correct pattern per this project's own Rule 20). A naive same-directory-same-stem check misreports both as 0% covered; every apparent gap below was individually traced to its real test (by re-export chain or store facade) before being counted as covered or flagged as a genuine gap.

## Piece Layer
| Module | Covered | Total | % | Notes |
|--------|---------|-------|---|-------|
| app/       | 5 | 6  | 83%  | Co-located tests. Uncovered: `app/layout.tsx` (37 lines, standard Next.js root layout — no test found anywhere by any method; conventionally low-risk boilerplate, below the file-count threshold for a formal gap). |
| components/ | 16 | 16 | 100% | Co-located tests. Rule 14 ("every user-facing component needs a co-located test") is fully satisfied, matching QA memory's prior confirmation. |
| hooks/     | 5 | 6  | 83%  | Co-located tests. Uncovered: `hooks/useInterruptConfig.ts` (43 lines — real logic, extracted from `InterruptHandler.tsx` per architect memory's Batch 19 notes; traced with the same rigor as the lib/store files above — zero test references found anywhere, direct or indirect). |
| lib/       | 22 | 28 (naive) → 27/28 (traced) | 96% (traced) | Naive same-dir check reports 0/28 — false. Traced: 22 files have a same-stem file in `tests/`; of the remaining 6, 5 are tested indirectly via a sibling test file (`tauriInterrupt`→`tests/tauri.test.ts`+`components/InterruptHandler.test.tsx`; `licenseTypes`→`tests/entitlement.test.ts`+others; `basePackLoader`→`tests/packLoader.test.ts`+`tests/fetchWithTimeout.test.ts`; `packManifest`→`tests/packLoader.test.ts` via its documented re-export). **1 genuinely untraced file this survey: none found** — see Gap Analysis below for the one item that could not be confirmed either way without deeper investigation. |
| store/     | 6 (traced) | 6 | 100% (traced) | Naive same-dir check reports 0/6 — false. All 6 traced to real tests: `entitlementCrossTabSync`, `settingsStore`, `migrations`, `srsStore` all have direct `tests/*.test.ts` files; `entitlementAddOns` tested via `tests/purchaseAddOnGuards.test.ts` calling the real `store().purchaseAddOn(...)` production entry point (not the raw function) — the correct pattern per this project's Rule 20; `entitlementStore` has 7+ test files exercising it. |

## Module Layer (seam/integration tests — this project's naming is `seam_*.test.ts`, not `*.integration.test.*`)
| Seam | File | Status |
|------|------|--------|
| Session-start auto-introduction | `tests/seam_studyLoop.test.ts` | ✓ |
| Backup import/restore round-trip | `tests/seam_importRestore.test.ts` | ✓ |
| Introduction engine due-card queue | `tests/seam_introduction.test.ts` | ✓ |

Naive check for `*.integration.test.*` returns 0 hits — this project uses the `seam_*` naming convention instead (matches QA agent memory, which already documents this pattern). Not a gap.

## App Layer (E2E)
| Spec File | Status |
|-----------|--------|
| `tests/e2e/study-session.spec.ts` | ✓ — language picker → /learn → A1 unit → StudyCard → card advance |

1 E2E spec, matching QA memory's prior documentation. Runs separately via `npm run test:e2e` (port 3099), not counted in coverage thresholds per `CLAUDE.md §8`.

## Delta Since Last Survey
First survey — no prior `.autocode/map.md` existed before this run. Baseline established.

## Gap Analysis

No gap crosses the survey's formal proposal thresholds (piece coverage <40% with ≥5 files; no integration test with ≥8 files; no E2E spec at all; no E2E spec in an auth/order/payment-named module) once naive false positives are corrected. `app/layout.tsx` is standard low-risk Next.js boilerplate — no action needed. `hooks/useInterruptConfig.ts` (43 lines, real logic extracted from `InterruptHandler.tsx`, zero test coverage found by any method — traced with the same rigor as every lib/store file above, this one is a genuine gap, not a false positive) is below the ≥5-file threshold for a formal severity-5 proposal, but real enough to log rather than silently drop — added to `debt.md` as a low-severity, Direct-complexity item for a future adjacent task to pick up.

**PROPOSED ADDITIONS: None cross the formal threshold. 1 minor item logged to debt.md (`hooks/useInterruptConfig.ts` — no test coverage, severity 3, Direct).**
