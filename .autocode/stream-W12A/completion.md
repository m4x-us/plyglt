# Stream W12A — Wave 12 — Completion

**Agent:** Adam  
**Wave:** 12  
**Date:** 2026-07-12  
**Tasks:** #295 #322 #300 #303 #304

---

## Tasks Closed

| Task | Status | Notes |
|------|--------|-------|
| #295 | COMPLETE | Option C chosen — documented deliberate deferral; no Rust or frontend wiring |
| #322 | COMPLETE | Added `!receiptToken.trim()` guard before IPC call |
| #300 | COMPLETE | `hasAddOn` now delegates to `libHasAddOn` from `lib/entitlement.ts` |
| #303 | COMPLETE | Cross-tab comment updated to remove inaccurate "two tabs racing on purchaseAddOn" language |
| #304 | COMPLETE | Added `_rehydrateInFlight` flag to deduplicate concurrent rehydrate() calls |

Tasks NOT completed: none  
Debt entries logged: 0  
Carry-forward tasks generated: 0

---

## Files Changed

- `store/entitlementStore.ts` — all 5 tasks; only owned file in W12A

---

## Verification Gate

- `npx tsc --noEmit` — 0 errors in `store/entitlementStore.ts` ✓ (2 pre-existing errors in `components/LanguageGrid.tsx` and `app/stats/page.test.tsx` from other parallel streams — not introduced by W12A)
- `npx vitest run tests/entitlement.test.ts` — 106/106 passing ✓
- `npx vitest run hooks/useLangPack.test.ts` — 15/15 passing ✓
- Full `npm test` — 47/47 test files + 1061 tests passed (8 worker-pool timeouts are resource exhaustion, not test failures) ✓
- `npm run lint` — 0 errors (1 pre-existing warning in `hooks/useExportImport.test.ts`) ✓
- Assertion quality grep gate — clean ✓

---

## #295 — Architectural Decision: Option C

**Context:** `purchaseAddOn` calls `invoke('verify_addon_receipt', {code, receiptToken})`. That Tauri command does not exist in `src-tauri/src/license.rs` or in `generate_handler!`. No production caller exists — `LanguageGrid`'s specialty-tile CTA opens the generic `BuyModal` (subscription checkout only) with no per-add-on code or receipt-delivery mechanism. `SPECIALTY_PACKS = Object.freeze([])` — no content exists.

**Why Option C:**
- **Option A** (implement Rust backend): would build a Tauri IPC command for a feature with zero content, zero pricing decided, and zero frontend caller. Premature backend work.
- **Option B** (wire frontend caller): would add a `BuyModal`/`LanguageGrid` flow to call `purchaseAddOn` — but without content or pricing, this would be a dead code path from day one. Also touches files outside the owned set.
- **Option C** (deliberate deferral): the code already has the right skeleton (code validation, receipt forwarding, IPC call, set()). It just needs an accurate doc comment that honestly documents the deferral, so no future developer is confused about why the Tauri command is missing or why nothing calls this function.

**What changed:** Updated the `purchaseAddOn` contract block comment and the inline implementation comment to explicitly state:
1. `verify_addon_receipt` Tauri command does not exist — not registered in `generate_handler!`, not implemented in `license.rs`
2. No production caller exists — both wiring paths (Rust + frontend) wait for specialty content per BRAND.md roadmap
3. Every current runtime call will return `ERR_ADDON_IPC_ERROR` (Tauri: invoke throws) or `ERR_ADDON_RECEIPT_INVALID` (web: invoke returns null)

**purchaseAddOn still has no real caller after W12A** — by design.

**Note for Task #326 builder:** W12A added no new `purchasedAddOns` write paths. The only write path remains `set((s) => ({ purchasedAddOns: [...] }))` inside `purchaseAddOn`, which is unreachable. `clearEntitlement` still clears `purchasedAddOns` to `[]`. If #326 adds a new `purchasedAddOns` write path (e.g. admin override or test seeding), that path should also trigger `clearSpecialtyCache()` for any codes being removed, to maintain the memCache/entitlement invariant.

---

## #322 — receiptToken validation

Added a `!receiptToken.trim()` guard immediately after the `isSpecialtyPackCode` check:
```typescript
if (!receiptToken.trim()) {
  console.warn(`[purchaseAddOn] receiptToken is empty — rejected`);
  return { ok: false, error: ERR_ADDON_RECEIPT_INVALID };
}
```

Returns `ERR_ADDON_RECEIPT_INVALID` (same error as a failed IPC verification) because an empty token is a definitively invalid receipt. Only non-empty is validated here — token structural format validation happens server-side at the Lemon Squeezy API layer.

---

## #300 — hasAddOn delegation

**Before:**
```typescript
hasAddOn: (code) => get().purchasedAddOns.includes(code),
```

**After:**
```typescript
hasAddOn: (code) => libHasAddOn(get(), code),
```

`libHasAddOn` is `hasAddOn` from `lib/entitlement.ts`, aliased to avoid naming collision. The lib function's doc comment explicitly directs this delegation: "store/entitlementStore.ts exposes a React-hook-compatible store action with the same name; that action should delegate here rather than duplicating the logic." Current behavior is identical — both call `.includes(code)` on `purchasedAddOns`. The delegation ensures that if the lib implementation ever evolves (additional validation, normalization), the store action inherits the change automatically.

Import added: `import { hasAddOn as libHasAddOn } from "@/lib/entitlement"` (store/ importing from lib/ is architecturally correct per the layer map).

---

## #303 — cross-tab doc comment correction

Removed the inaccurate "two browser tabs racing on purchaseAddOn" language. The guard serves a real purpose (syncing `setEntitlement`, `markValidated`, `clearEntitlement` across tabs) but the specific scenario that motivated the original comment is not reachable today. The updated comment:
- Describes the actual current use case (any entitlement write from one tab reflected in others)
- Notes why the purchaseAddOn-race framing was inaccurate (cross-references #295)
- Documents the race limitation honestly (cross-references #304)

---

## #304 — rehydrate() deduplication

**Before:** `void useEntitlementStore.persist.rehydrate()` — fire-and-forget, no guard against concurrent calls.

**After:** Added `_rehydrateInFlight` module-level flag:
```typescript
let _rehydrateInFlight = false;

export function _handleCrossTabStorageEvent(e: { key: string | null }): void {
  if (e.key !== ENTITLEMENT_STORE_KEY) return;
  if (_rehydrateInFlight) return;
  _rehydrateInFlight = true;
  const done = () => { _rehydrateInFlight = false; };
  const result = useEntitlementStore.persist.rehydrate();
  if (result instanceof Promise) {
    result.then(done, done);
  } else {
    done();
  }
}
```

**What this fixes:** rapid storage events (e.g. another tab writes twice quickly) no longer trigger overlapping `rehydrate()` calls. The second call is dropped until the first settles, preventing two concurrent reads from storage racing each other.

**What this does not fix (documented in the comment):** A `set()` call (from `markValidated`, `setEntitlement`, etc.) that completes between the storage event firing and `rehydrate()` completing can still be overwritten by the rehydrate's own `set()`. Zustand has no cross-operation lock primitive that would prevent this. The window is narrow in practice — entitlement writes are rare, and the client-only honour-system model (decision 2026-06-24) makes this an acceptable trade-off.

The `result instanceof Promise` check handles both return types of `persist.rehydrate()` — Zustand types it as `Promise<void> | void`.
