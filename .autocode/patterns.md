# AutoCode Patterns Log

## 2026-06-26 | Task: #060 /audit — 7-agent parallel review
- type-safety lib/packLoader.ts dead discriminant "not_cached" — declared in LoadPackResult union with zero return sites; pattern: every union variant must have at least one reachable return site; after changing a guard's return value, audit the full type and remove orphaned members — severity 6 | AUDIT
- tests tests/useLangPack.test.ts Rule 13 seam test missing — task adds discriminant crossing module boundary (packLoader→useLangPack→page) but zero behavioral tests trace data through the seam; pattern: when a new error discriminant is introduced, the test file for every intermediate consumer must exercise the new code path end-to-end — severity 6 | AUDIT
- security lib/packLoader.ts integrity bypass — clearPackCache evicts SHA-failed data from storage but local variable still holds those bytes; offline fallback subsequently serves integrity-failed pack as ok:true; pattern: after evicting data for integrity failure, null the local capture variable to prevent stale-fallback from resurrecting it — severity 7 | AUDIT
- error-handling lib/packLoader.ts structural validation gap — four JSON.parse(cachedData) as Pack cache-serve paths skip Array.isArray(pack.units) guard present only on fresh downloads; pattern: structural validation must be applied on ALL parse paths, not just the primary download path — severity 5 | AUDIT
- type-safety hooks/useLangPack.ts discriminant erased at hook boundary — LoadPackResult error union widened to string|null in LangPackState; pattern: when a discriminated union crosses a module boundary, the narrowed type must follow; derive PackLoadError from the source union rather than widening to string — severity 4 | AUDIT
- error-handling app/study/page.tsx,components/InterruptHandler.tsx silent error ignored — two useLangPack consumers never destructure error; pack load failure renders empty state with no user feedback; pattern: every consumer of a hook with an error field must handle the non-null case explicitly — severity 5 | AUDIT

## 2026-06-26 | Task: #003 standalone re-audit — Lens 1
- security lib/langRegistry.ts ALL_PACK_CODES mutable string[] — sole security allowlist for loadPack/evictPack is exported without Object.freeze() or readonly; pattern: security boundaries derived from LANGUAGE_REGISTRY must be immutable — severity 7 | AUDIT
- type-safety lib/langRegistry.ts PackCode resolves to string — `as string[]` cast on the source array erases literal types; PackCode type provides zero narrowing; pattern: don't cast away tuple/const types when downstream types depend on them for safety — severity 6 | AUDIT
- error-handling lib/packLoader.ts 7 silent catch {} — module-scale Rule 8 violation; pattern: when adding a security fix to a file with pre-existing catch {} violations, the entire file's error handling must be hardened in the same cycle — severity 6 | AUDIT
- data-corruption lib/langRegistry.ts placeholder configs — stub entries sharing another language's LanguageConfig corrupt all consumers of LANG_CONFIG_MAP; pattern: placeholder registry entries must either omit from exports or use a safe NullConfig not a live language's config — severity 8 | AUDIT

## 2026-06-25 | Task: #001 — WorldClass cycle 9 (orchestrated, WC_CYCLE 2 internal cycles 6-7)
- code-quality store/entitlementStore.ts "entitlement-v1" string literal duplicated on lines 127 and 130 without a named constant; Zustand persist name key and platform storage key can diverge silently — severity 6 | worldclass: -4 pts (arch) / -5 pts (vibes) | WORLDCLASS
- tests tests/entitlement.test.ts two deactivateLicense ok:true tests with identical mock payloads, identical assertions, only description differs — dead weight, no additional coverage — severity 4 | worldclass: -3 pts (arch) / -4 pts (vibes) | WORLDCLASS

## 2026-06-25 | Task: #001 — WorldClass cycle 8 (orchestrated, WC_CYCLE 2 internal cycle 1 — pre-build reference)
- code-quality lib/langRegistry.ts Rule 2 header missing; file was modified (added PackCode type) without adding the required header block — severity 5 | worldclass: -3 pts | WORLDCLASS
- tests tests/entitlement.test.ts Rule 13 seam test missing: validateLicense→markValidated→isPackUnlocked chain untested; activation and deactivation seams exist but validation renewal seam does not — severity 4 | worldclass: -3 pts | WORLDCLASS
- tests tests/entitlement.test.ts validateLicense struct guard (valid:true with non-active status) path untested — severity 4 | worldclass: -2 pts | WORLDCLASS

## 2026-06-25 | Task: #001 — WorldClass cycle 7 (orchestrated, WC_CYCLE 1 internal cycle 2)
- code-quality lib/entitlement.ts pervasive single-line catch/if blocks make Error Reference System hard to audit; contradicts Slow=Deliberate — severity 5 | worldclass: -4 pts | WORLDCLASS
- code-quality store/entitlementStore.ts PackCode[] upgrade stopped at state field; setEntitlement parameter, ActivateResult, resolveVariantEntitlement return type all still string[] — severity 4 | worldclass: -3 pts | WORLDCLASS
- feature-flag components/EntitlementValidator.tsx no ENTITLEMENT_VALIDATION_ENABLED constant; Rule 4 violation — severity 4 | worldclass: -2 pts | WORLDCLASS

## 2026-06-25 | Task: #001 — WorldClass cycle 4 (fresh invocation, cycle 1)
- code-quality store/migrations.ts DEPENDS ON header names @/store/entitlementStore but import is from @/lib/licenseTypes — severity 3 (worldclass: -2 pts)
- error-handling lib/entitlement.ts API contract violation paths (!raw, !instance, !meta) return without ref-ID log — severity 4 (worldclass: -2 pts)
- security lib/entitlement.ts invoke cast to LsActivateBody/LsValidateBody without runtime shape validation — severity 5 (worldclass: -2 pts)
- error-handling app/settings/page.tsx outer try/catch in handleActivate/handleValidate/handleDeactivate is dead — lib functions never throw — severity 5 (worldclass: -4 pts)
- security lib/entitlement.ts res.license_key.key not validated as non-empty string before being persisted — severity 5 (worldclass: -3 pts)
- auth lib/entitlement.ts deactivateLicense infers success from non-throw alone; response body ignored — severity 5 (worldclass: -2 pts)
- async components/EntitlementValidator.tsx runEntitlementValidation on ok:false does not update lastValidated; every mount re-triggers LS call — severity 4 (worldclass: -2 pts)

## 2026-06-25 | Task: #001 — WorldClass cycle 1
- tests lib/entitlement.ts+tests/entitlement.test.ts Rule 13 seam test missing: activateLicense→setEntitlement→isPackUnlocked chain not tested end-to-end — severity 6 (worldclass: -4 pts)
- code-quality lib/entitlement.ts duplicate date-parsing IIFE in parseVariant:79 and validateLicense:123; same anonymous IIFE copy-pasted instead of extracted helper — severity 4 (worldclass: -3 pts)
- tests components/EntitlementValidator.test.tsx hand-rolled runValidatorEffect() mirrors component logic but diverges silently; not testing the real component — severity 5 (worldclass: -5 pts)
- tests tests/entitlement.test.ts activateLicense ok:true test asserts validUntil is any Number but not > Date.now(); weaker than S002 which checks future date — severity 4 (worldclass: -3 pts)
- code-quality lib/entitlement.ts validateLicense reuses LsActivateBody (activation response type) as validation response type; lying type — severity 4 (worldclass: -4 pts)
- tests tests/migrations.test.ts no test for migration chain throw guard; migrateEntitlementStore({},3) when ENTITLEMENT_VERSION=2 is untested — severity 4 (worldclass: -3 pts)

## 2026-06-24 | Task: #001
- security store/migrations.ts ENTITLEMENT_MIGRATIONS[1]:55 persisted legacy licenseType bypasses expiry check via migration passthrough; unknown licenseType not sanitized to LicenseType union — severity 7 | store/migrations.ts:ENTITLEMENT_MIGRATIONS[1]:55 | NEW
- tests tests/migrations.test.ts:101 migration test asserts wrong behavior: old licenseType value expected to survive migration unchanged; blocks fix for migration passthrough — severity 6 | tests/migrations.test.ts:migrateEntitlementStore:101 | NEW
- code-quality app/settings/page.tsx:306 stale display label renders for non-subscription licenseKey holders; dead else branch in ternary not removed with type union change — severity 5 | app/settings/page.tsx:SettingsPage:306 | NEW
- security lib/entitlement.ts:52 parseVariant unlocksAll uses substring match on "all" and "bundle"; future variant names containing these substrings will unintentionally unlock all packs — severity 5 | lib/entitlement.ts:parseVariant:52 | NEW
- error-handling app/settings/page.tsx:178 bare catch without binding; JSON.parse and parseBackup errors all produce identical user message with no logging or ref ID; violates Rule 8 — severity 5 | app/settings/page.tsx:handleImportFile:178 | NEW
- code-quality app/page.tsx:181 BuyModal copy says "one purchase" — contradicts subscription-only pricing model per BRAND.md — severity 4 | app/page.tsx:BuyModal:181 | NEW
- error-handling app/settings/page.tsx:46 validateLicense promise has no .catch(); network errors produce unhandled rejection; violates Rule 8 — severity 4 | app/settings/page.tsx:useEffect:46 | NEW
- error-handling app/settings/page.tsx FileReader.onerror never assigned; file read failures produce no UI feedback and no error logged; violates Rule 8 — severity 4 | app/settings/page.tsx:handleImportFile:151 | NEW

## 2026-06-25 | Task: #001 — WorldClass cycle 3 (FINAL — MAX_CYCLES)
- code-quality app/settings/page.tsx 530 lines — 3.5× the ≤150-line route limit (Rule 1); pre-existing, tracked for Batch 3 refactor — severity 7 (worldclass: -12 pts)
- error-handling lib/entitlement.ts:activateLicense invoke call missing try/catch; deactivateLicense and validateLicense both have try/catch but activateLicense was missed; FIXED post-scoring — severity 7 (worldclass: -10 pts)
- code-quality app/settings/page.tsx useEffect duplicated runEntitlementValidation logic instead of calling it; omitted error logging on ok:false path; FIXED post-scoring — severity 5 (worldclass: -5 pts)
- code-quality lib/entitlement.ts parseVariant magic strings "monthly"/"annual"/"all languages" inline; should be named constants near CHECKOUT_URLS — severity 4 (worldclass: -4 pts)
- tests app/settings/page.tsx no co-located .test.tsx; 530-line component with hooks and conditional branches — severity 4 (worldclass: -4 pts)
- tests vitest.config.ts functions coverage 76.15% below AGENTS.md 80%+ floor; dragged by React hooks untestable in node environment — severity 4 (worldclass: -3 pts)

## 2026-06-24 | Task: #001 (Cycle 2)
- tests tests/migrations.test.ts storedVersion=1 v1-to-v2 migration path not tested; real-world upgrade path for existing users has zero coverage — severity 4 | tests/migrations.test.ts:migrateEntitlementStore:101 | NEW
- error-handling app/settings/page.tsx reader.onerror discards ProgressEvent; DOMException on target.error never read or logged — severity 4 | app/settings/page.tsx:handleImportFile:154 | NEW
- error-handling app/settings/page.tsx three console.error calls lack MODULE_CODE-TIMESTAMP ref IDs required by Rule 8 — severity 4 | app/settings/page.tsx:useEffect:49 | NEW
- code-quality store/migrations.ts inline VALID Set is third parallel LicenseType definition; untyped and frozen by migration immutability rule — severity 3 | store/migrations.ts:ENTITLEMENT_MIGRATIONS:67 | NEW
- code-quality store/migrations.ts migration v2 coerces any unknown licenseType to subscription; includes corrupted values; asymmetric with importBackup.ts — severity 3 | store/migrations.ts:ENTITLEMENT_MIGRATIONS:70 | NEW
- code-quality store/entitlementStore.ts persist key entitlement-v1 does not reflect ENTITLEMENT_VERSION=2; no comment explaining deliberate mismatch — severity 2 | store/entitlementStore.ts:persist:80 | NEW
- code-quality store/migrations.ts comment says one-time purchase — perpetuates deleted pricing concept in source — severity 2 | store/migrations.ts:ENTITLEMENT_MIGRATIONS:62 | NEW
- edge-case lib/entitlement.ts parseVariant includes annual matches semiannual/biannual; includes monthly matches bimonthly; no tests for these edge cases — severity 2 | lib/entitlement.ts:parseVariant:51 | NEW

## 2026-06-25 | Task: Task #001 — WorldClass cycle 6 (orchestrated, WC_CYCLE 1)
- tests lib/entitlement.ts:resolveVariantEntitlement console.warn on unknown variant untested; spy needed to assert observability event fires — severity 4 | worldclass: -2 pts | WORLDCLASS
- tests components/EntitlementValidator.tsx:runEntitlementValidation console.warn on ok:false untested; spy needed — severity 3 | worldclass: -1 pt | WORLDCLASS

## 2026-06-25 | Task: Task #001: Delete all lifetime entitlement code + harden entitlement module — WorldClass cycle 5 (orchestrated)
- code-quality app/settings/page.tsx 515 lines — 3.4× Route ≤150 limit (Rule 1), pre-existing tracked Task #026 — severity 6 | worldclass: -8 pts | WORLDCLASS
- tests lib/entitlement.ts:deactivateLicense null-invoke response path has no test — severity 4 | worldclass: -3 pts | WORLDCLASS
- tests deactivateLicense→clearEntitlement store seam untested — severity 4 | worldclass: -2 pts | WORLDCLASS
- tests components/EntitlementValidator.tsx:runEntitlementValidation co-located test not in scoring scope — severity 6 | worldclass: -4 pts | WORLDCLASS
- code-quality lib/entitlement.ts:parseVariant licenseType hardcoded "subscription" but described as "parses" — severity 3 | worldclass: -2 pts | WORLDCLASS
- code-quality store/entitlementStore.ts:VALIDATION_TTL_MS comment only documents grace-period use, not needsValidation use — severity 3 | worldclass: -2 pts | WORLDCLASS
