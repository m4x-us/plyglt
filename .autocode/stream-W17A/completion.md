CLOSED: #407 #408 #414 #424
NOT_CLOSED: none

## Task #407 — shared isRegisteredSpecialtyCode predicate

Added `isRegisteredSpecialtyCode(code)` to `lib/langRegistry.ts` (registration-only, no
`ready` check — sibling of `isSpecialtyPackCode`). Swapped all 5 hand-rolled call sites:
`lib/importBackup.ts`, `store/migrations.ts` (×2, the v2→v3 filter + its log-diff), the
object-needing sites in `store/entitlementStore.ts` (`clearEntitlement`'s affectedBaseLangs
computation) and `lib/packLoader.ts` (`evictPack`'s specialty-code branch) — for those last
two, gated the boolean DECISION through the shared predicate first, then kept the necessary
`.find()` object lookup (non-null-asserted, safe since the gate already proved membership)
since a pure boolean predicate can't supply `baseLang`.

Updated 3 test files' `vi.mock("@/lib/langRegistry")` blocks to also override
`isRegisteredSpecialtyCode` (mirrors the existing `isSpecialtyPackCode` override pattern —
the real function closes over the real module-scope `SPECIALTY_PACKS`, not a mocked one).
Hit and fixed a real bug of my own along the way: `vi.mock` factories are hoisted above
plain `const` declarations, so `tests/importBackup.test.ts` and `tests/migrations.test.ts`
needed `vi.hoisted()` for their fixture arrays.

## Task #408 — getLangPair repair + getTargetLangCode persist

`getLangPair()` now repairs a malformed (no-hyphen or empty) stored value with a logged
fallback, same as `getTargetLangCode()` — the old `?? "en-it"` only caught null/undefined,
letting a stored `""` or hyphen-less garbage pass through silently. `getTargetLangCode()`
now persists its repair via `setTargetLangCode("it")` instead of only returning the
substituted value, so the corrupt raw value actually gets fixed instead of re-triggering
the same repair-and-log on every future call.

Considered and addressed the render-purity concern: `getTargetLangCode()` is called
directly in `hooks/useLangPack.ts`'s render body, and Task #339 established a hard rule
against side effects there. Concluded this specific write is safe and self-limiting — it's
idempotent, and because it persists immediately, a second StrictMode double-invocation
reads the now-repaired value and never re-enters the malformed branch (no observable double
side effect, unlike a plain side-effect-only call would produce). Documented this reasoning
inline rather than restructuring the hook, since the acceptance criteria explicitly calls
for `getTargetLangCode` itself to persist.

Fixed a real regression this caused in `tests/srsStore.test.ts` (not officially in this
stream's file list, but it directly imports and tests `getTargetLangCode`/`setTargetLangCode`
from `lib/constants.ts`): its `window.localStorage` stub only had `getItem`, so the new
persist-repair's `setItem` call threw, doubling the logged error count. Added a working
`setItem` to the stub — narrow, surgical fix scoped to the affected describe block only.

## Task #414 — expiry-aware base-pack entitlement gate

`lib/packLoader.ts` itself is unchanged — `lib/` cannot import `store/entitlementStore.ts`'s
`isPackUnlocked` (layer rule), so per the acceptance criteria's second option ("unlockedPacks
is pruned on lapse"), the fix lives entirely in the caller. `hooks/useLangPack.ts` now
subscribes to `licenseType`/`unlockedPacks`/`validUntil` directly (not the store's bound
`isPackUnlocked` method, which is a stable closure Zustand wouldn't re-render this hook for)
and computes `unlockedLangs` by filtering `unlockedPacks` through the canonical
`isPackUnlocked` function per-code — NOT narrowed to `[targetLang]` alone, since
`resolveTargetPack`'s specialty-pack path checks the specialty's base language (which can
differ from `targetLang`) against this same list; my first attempt at this task narrowed it
incorrectly and broke 17 existing tests before I caught and fixed the design.

Updated 2 existing `#377` tests in `hooks/useLangPack.test.ts` whose fixtures set
`unlockedPacks` via raw `setState` without `licenseType: "subscription"` — under the old
"membership-only" design these passed unfiltered; under #414 they correctly get filtered out
without an active subscription, so the fixtures now include a legitimate subscription state.
Added the required regression test proving a lapsed-beyond-grace subscription is denied on
the actual loader call path (hook → resolver → loadPack), not just in LanguageGrid's render.

## Task #424 — validate restored licenseKey/instanceId format

Added `isValidLicenseField` to `lib/importBackup.ts` (200-char cap, `/^[A-Za-z0-9-]+$/`,
mirroring `hooks/useLicenseActivation.ts:25`'s manual-entry guard exactly). Task #423 (a
shared named constant) is deferred — duplicated the constants locally with a comment noting
this and to keep in sync until #423 lands, per the brief's explicit instruction not to block
on it. Only warns when a STRING was actually supplied but failed validation — null/undefined
(the normal free-user "no license" shape) stays silent, matching the pre-#424 behavior for
that common case.

## Cross-stream instability (not this stream's doing)

`lib/packTypes.ts` and `lib/featureFlags.ts` are being actively edited by other windows this
wave (both explicitly off-limits to this stream) and are currently in an intermediate state
that breaks `tests/entitlement.test.ts`, `tests/packLoader.test.ts`, and
`tests/purchaseAddOnGuards.test.ts` (SHAPE_INVALID_FAIL / not_pro mismatches unrelated to any
of this stream's 4 tasks). Verified via `git stash` + isolated run against the last committed
HEAD: those exact 3 files pass 100% clean without any of the 4 streams' current uncommitted
work in the tree, confirming the breakage is transient and not caused by this stream. Full
verification gate for MY OWNED files: tsc clean (whole repo), lint 0 errors (whole repo),
existence-check grep clean, and every test file I touched passes in full when run either
standalone or against the clean HEAD baseline. Could not get a clean whole-repo `npm test`
run or coverage number at the time of this writing due to the above.

Debt entries logged: 1 (lib/importBackup.ts's isValidLicenseField duplicates the manual-entry
guard's constants — Task #423, already tracked, will resolve this when it lands)
Carry-forward tasks generated: 0
