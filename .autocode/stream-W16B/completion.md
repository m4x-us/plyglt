CLOSED: #415 #420 #430 #411
NOT_CLOSED: none

## #415 — evictPack can never reject; clearEntitlement's defensive catch was dead code

Decision: made eviction failures genuinely observable (not the delete-the-dead-code option).
`lib/packCache.ts`'s `clearPackCache` and `_clearSpecialtyStorageKeys` now return a
`fullyClean: boolean` instead of `void` — still never reject (Promise.allSettled still
swallows individual storage errors internally, each logged with its own ref ID), but the
caller can now tell full success from a logged, partial storage residue.
`lib/packLoader.ts`'s `EvictPackResult`'s success variant became
`{ evicted: true; fullyClean: boolean }`. Fixed the self-contradicting doc comment (it
claimed both "the promise ALWAYS resolves" and "clearEntitlement's defensive .catch
remains live" — those two claims can't both be true; a promise that never rejects can
never reach a .catch).

`store/entitlementStore.ts`'s `clearEntitlement` no longer has a `.catch` on `evictPack()`
(it could never fire). It now `.then()`s the result and inspects `.evicted` and
`.fullyClean`; a false on either pushes into the same `evictionErrors`/throw/
useLicenseActivation.ts-message chain that already existed — that chain is live now, not
dead. Verified end-to-end with a real storage-removeItem failure in
`tests/entitlement.test.ts` (not a mock of evictPack — the actual clearPackCache →
storage-removeItem failure path), confirming `clearEntitlement()` rejects and
`useLicenseActivation.ts`'s "Deactivated. Restart the app to clear cached content."
message is genuinely reachable.

## #420 — isProEnabled never checked subscription expiry

`isProEnabled` gained a required third parameter, `validUntil: number | null`, and now
applies the identical `validUntil + SUBSCRIPTION_GRACE_PERIOD_MS` expiry check that
`isPackUnlocked` already used. Moved `SUBSCRIPTION_GRACE_PERIOD_MS`'s definition from
`store/entitlementStore.ts` into `lib/featureFlags.ts` (lib/ must never import from
store/, and isProEnabled needs the constant) — `store/entitlementStore.ts` now re-exports
it so every existing external import of that name keeps working unchanged.

Fixed all 3 real call sites:
- `store/entitlementStore.ts:purchaseAddOn` — passes `get().validUntil`.
- `app/stats/page.tsx` — destructures `validUntil` from the store hook alongside
  `licenseType`, self-contained, no other file touched.
- `components/LanguageGrid.tsx` — added `validUntil: number | null` as a new required
  prop (mirrors the existing `licenseType` prop pattern).

**Deviation from the literal file list, flagged explicitly**: `components/LanguageGrid.tsx`
is deliberately "pure presentation" (its own header comment) — receiving `licenseType` as
a prop, not reading the store directly. Making it expiry-aware requires the caller to
also supply `validUntil`, and its sole caller is `app/page.tsx`, which was not in this
stream's "Files You Own" list (and not off-limits either — just not mentioned). I made
the minimal necessary edit there: destructured `validUntil` from `useEntitlementStore()`
(already destructuring `licenseType` from the same hook one line above) and passed it as
a new prop, mirroring the existing pattern exactly. I considered instead having
LanguageGrid read `validUntil` directly from the store to avoid touching app/page.tsx,
but that would have made the component inconsistently half-store-driven/half-prop-driven
for the same underlying entitlement concern — worse than a one-line, pattern-consistent
addition to the actual caller. Flagging this for awareness since it's outside my literal
file grant.

Also similarly touched (mechanically required by the signature change, not scope creep):
`hooks/useLangPack.test.ts` (one mock literal needed the new field — no test file for
this hook was owned by anyone this wave), `tests/featureFlags.test.ts`,
`app/stats/page.test.tsx`, `components/LanguageGrid.test.tsx`, `tests/entitlement.test.ts`
— all are the natural test files for source files I do own, uncontested by other streams
(checked adam/charles/derek's file lists before touching any of them).

## #430 — unsigned backup import skips license-server re-validation

Decision: implemented the fix, not the sign-off-and-accept path — see caveat below for
why this isn't a full closure.

`setEntitlement`'s contract changed: `lastValidated` is now a REQUIRED field the caller
passes, not something the store auto-stamps to `Date.now()` internally. The two real
callers now diverge correctly:
- `hooks/useLicenseActivation.ts` (genuine `activateLicense()` server round-trip just
  completed) passes `Date.now()` — earns the real grace period, as before.
- `hooks/useExportImport.ts` (unsigned backup file, never touched the license server)
  passes `0` — makes `needsValidation()` true immediately, so
  `components/EntitlementValidator.tsx` re-validates against the real Lemon Squeezy API on
  the very next app foreground instead of trusting the restored fields for a full
  `VALIDATION_POLL_INTERVAL_MS` (7-day) window.

**Residual gap — explicitly flagging, not silently claiming full closure**: a forged
backup with `validUntil: null` still grants access indefinitely even after this fix. A
FAILED validation (`components/EntitlementValidator.tsx`'s catch path) never clears or
downgrades the entitlement state — it only resets the retry timer (`touchValidated()`);
revocation depends entirely on `isPackUnlocked`'s own `validUntil`-based expiry check, and
`validUntil: null` means "no expiry" by deliberate, separately-documented design (the
migrated-pre-versioning-user allowance — see `isPackUnlocked`'s comment and CLAUDE.md's
Entitlement Model section). This null-means-forever allowance predates this task, applies
equally to real migrated users, and is out of this task's scope to redesign — it exists
for a reason unrelated to backup import specifically. The concrete, scoped ask in the
acceptance criteria ("closing the free grace-period window") is fully closed; the deeper
"null validUntil never expires" policy is unchanged and is covered by the existing
owner-confirmed honour-system decision already recorded in CLAUDE.md (2026-06-24) — I'm
treating that as the sign-off for the residual gap rather than inventing a new one, since
it already explicitly says "a technically-savvy user can already grant themselves
identical access by editing their own store" is an accepted trade-off, and this
`validUntil:null` residue is exactly that same trade-off, not a new one. If Max wants the
null-expiry policy itself tightened, that's a distinct, explicitly-scoped follow-up task,
not a #430 sub-task.

Test coverage: `hooks/useExportImport.test.ts` asserts the exact `setEntitlement` call
shape (a forged licenseKey/instanceId → `lastValidated: 0`) end-to-end through
`readFile()`. `tests/entitlement.test.ts` covers `setEntitlement`'s new contract directly
(no more internal auto-stamp) and both `needsValidation()` outcomes.

## #411 — purchased-but-unready specialty pack showed the buy CTA

Added the missing third render state: `purchased && !sp.ready` now renders a distinct,
non-interactive "Owned" tile (not a `<button>` — there is no action available: not
purchasable again, not yet loadable) instead of falling into the same branch as an
unpurchased pack. "Coming soon" still shows (the pack genuinely isn't ready), but the
price CTA and `onUpgradeClick` wiring are gone for this state — matches the Task #384
"readiness gates purchasing/loading, not retention" policy that was already correctly
applied to the *visibility* filter but not the *button* selection.

Two new tests in `components/LanguageGrid.test.tsx`: one proving the owned+unready state
renders "Owned", no price text, no `<button>`, and clicking fires neither `onSelect` nor
`onUpgradeClick`; a second proving unpurchased+unready is unaffected (still shows the buy
CTA, still fires `onUpgradeClick` on click) — the two states render distinctly, per the
acceptance criteria. No product-copy ambiguity needed escalating to Max — "Owned" is a
plain, on-brand (BRAND.md quiet-expert voice) label consistent with existing short badge
text ("Soon", "Coming soon") already in this component.

## Process note

Mid-session, a transient repo-wide git reset briefly wiped in-progress edits across
multiple files (recovered automatically once other parallel windows' work settled — not
something I needed to intervene on). Unrelated to the above; noting only because if
anything here looks like it was redone, that's why.

Debt entries logged: 0
Carry-forward tasks generated: 0 (the #430 null-validUntil residual gap above is flagged
as a candidate for a future explicitly-scoped task, not filed as one — scoping that
decision belongs to the owner/architect, not to me unilaterally)
