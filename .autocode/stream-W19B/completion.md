CLOSED: #442 #449 #446
NOT_CLOSED: none

## #442 — unpurchased-specialty redirect fired before entitlement hydration completed

`hooks/useLangPack.ts`'s render-body `unpurchasedSpecialty` computation was reading
`purchasedAddOns` unconditionally — before hydration, that's the Zustand default `[]`,
so a genuinely-owned ready specialty code got misclassified as unowned and the #339
repair effect PERMANENTLY overwrote the persisted `LANG_PAIR_KEY` before hydration ever
revealed the truth (the effect's own `rawTargetLang===targetLang` guard could never
fire again once that happened).

Fix: moved `entitlementHydrated`/`hydrationGraceExpired`'s declarations earlier in the
hook (they were previously declared after `unpurchasedSpecialty`, for the dynamic-load
effect's own gate) and gated `unpurchasedSpecialty` on `(entitlementHydrated ||
hydrationGraceExpired)`. Pre-hydration, `unpurchasedSpecialty` now stays `undefined` —
`isKnownCode` alone decides `targetLang`, so a genuinely-owned code passes through
unredirected, and the repair effect's existing guard naturally stays silent (no new gate
needed on the effect itself — the gating flows through cleanly via `targetLang`). The
grace-timer effect that arms `hydrationGraceExpired` stays in its original position
(after `targetLang`/`lang` are computed, since it needs `targetLang`) — only the state
declaration moved, not the effect.

Also softened the repair effect's `ERR-LANGPACK-ADDON-UNOWNED` log message per the third
acceptance criterion: it now distinguishes a genuinely-hydrated read from a
grace-period-expired fallback (the latter reflects store defaults, not confirmed
non-ownership, so asserting the same confidence would overstate what's actually known).

Two tests added to `hooks/useLangPack.test.ts`, verified against the Deletion Test
(temporarily removed the gate, confirmed both fail, restored):
- A genuinely-owned code + hydration pending → no repair fires; hydration then reveals
  the true (owned) data → pack loads normally, storage untouched throughout.
- A genuinely-unowned code + hydration pending → no repair fires while unconfirmed;
  hydration then confirms non-ownership → only then does the redirect/repair fire.

One collateral fix: adding `entitlementHydrated` to the log message introduced a
`react-hooks/exhaustive-deps` lint warning on the repair effect (the value was read in
the body but missing from the dependency array) — added it to the deps array; verified
safe (the effect's own `rawTargetLang===targetLang` guard makes an extra re-run from
this dep a no-op once a repair has already landed).

## #449 — createPurchaseAddOn had no post-await deactivation-guard re-check

Added a module-level `createGenerationGuard()` instance to `store/entitlementAddOns.ts`
(mirrors `lib/specialtyPackLoader.ts`'s `deactivationGuard` pattern exactly — same
primitive, same snapshot-after-entry-gate / re-check-before-mutation timing).
`createPurchaseAddOn`'s returned function now snapshots the guard right after the Pro
gate passes, and re-checks `isStale()` immediately before the mutating `set()` that
appends to `purchasedAddOns` — if a `clearEntitlement()` completed while the
`verify_addon_receipt` IPC call was in flight, the purchase is rejected instead of
silently resurrected into the just-cleared array.

Added a new, precise error constant `ERR_ADDON_DEACTIVATED` (distinct from
`ERR_ADDON_NOT_PRO`, which is checked at entry before any IPC round-trip — the two are
genuinely different diagnostics: "you aren't Pro" vs. "you were deactivated mid-purchase").
Re-exported from `store/entitlementStore.ts` alongside the other `ERR_ADDON_*` constants.

Wiring: `store/entitlementAddOns.ts` exports `bumpAddOnDeactivationGuard()` (an
`@internal` trigger, not the guard object itself) — `store/entitlementStore.ts`'s
`clearEntitlement` calls it at the same point it resets `purchasedAddOns` (inside the
`.then()` block added by last wave's #438 fix). This keeps the guard's ownership inside
`entitlementAddOns.ts` (the module whose own security property it protects) without
creating a runtime circular import between the two store files — `entitlementStore.ts`
already imports from `entitlementAddOns.ts`; this just adds one more named export to
that existing import, no new dependency direction.

Test in `tests/entitlement.test.ts`: holds the `verify_addon_receipt` IPC call pending
via a manually-controlled promise, calls and awaits a real `clearEntitlement()` while it's
still in flight, then resolves the IPC call with `verified:true` (proving the eventual
rejection comes from the deactivation guard, not a failed receipt) and asserts `{ ok:
false, error: ERR_ADDON_DEACTIVATED }` with `purchasedAddOns` still `[]`. Verified against
the Deletion Test (removed the re-check, confirmed the test fails with `{ok:true}`,
restored).

## #446 — getLangPair's repair didn't match getTargetLangCode's

`getLangPair` checked `pair.indexOf("-") === -1` only — "en-" has a hyphen, so it passed
this check unrepaired and unlogged, silently feeding `store/srsStore.ts`'s persisted
storage key (`srs-${_activeLangPair}`) a malformed `"srs-en-"`. Replaced the check with
the identical derivation `getTargetLangCode` already uses (slice after the first hyphen;
empty tail means malformed), so the two getters are now structurally impossible to drift
apart on this specific check again — not just patched for the one missed input shape.

Added `tests/constants.test.ts`'s `getLangPair` "en-" case, mirroring the existing
`getTargetLangCode` "en-" test exactly. Verified against the Deletion Test (temporarily
reverted just the `getLangPair` branch to the old check via the Edit tool — not a blind
string replace, since both functions now share near-identical code shape and a naive
script-based patch risks matching the wrong occurrence, which is exactly what happened on
my first attempt and was caught immediately by `tsc`/re-reading the file before
proceeding).

Debt entries logged: 0
Carry-forward tasks generated: 0

## Process note

Mid-session, several system notifications showed what looked like stale/reverted
snapshots of files I'd just edited (`tests/constants.test.ts`, `store/entitlementAddOns.ts`).
Directly re-grepping each file confirmed my edits were intact throughout — the
notifications did not reflect live disk state. No action was needed; noting only so a
reviewer isn't confused if those notification snapshots are visible in the transcript.
