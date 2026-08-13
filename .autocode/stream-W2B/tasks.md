# Stream W2B Task State

### Task #527 | feature | severity 5
**What:** `supabase/functions/send-interrupt-notifications/dueSelection.ts`'s `selectDueTokens` currently gates on `push_tokens.last_sent_at` (per device-token). Change it to read `interrupt_gate_events` (per user, Task #525) instead. `dispatch.ts` writes a `fired` event to the same table on a real send, instead of (or in addition to, if `last_sent_at` is kept as a device-registration diagnostic only) updating `push_tokens.last_sent_at`.
**Why:** Without this, mobile push and desktop remain on two completely separate clocks even after Task #525's table exists — the cross-device coordination problem isn't actually solved until mobile's dispatch reads/writes the same shared state desktop will. See `docs/INTERRUPT_ARCHITECTURE.md` §5.
**File:** `supabase/functions/send-interrupt-notifications/dueSelection.ts`, `dispatch.ts`, and their Vitest-tested counterparts (`tests/` or co-located, per this directory's existing pure-function-testing pattern — see `index.ts`'s own header on why Deno-only wiring is excluded from `tsc`)
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (2 source + their 2 test counterparts), changes the core dispatch-gating query
**Blocked by:** #525 (COMPLETE, Wave 1) | **Blocks:** Nothing (mobile has no production caller yet — Tasks #171/#522/#172)
**Done when:** `selectDueTokens` (or its replacement) queries `interrupt_gate_events` per user, not `push_tokens.last_sent_at` per token. Tests prove a user with a recent `fired` event (from ANY device) is excluded even if their specific token's own `last_sent_at` is old/null. Existing dispatch tests still pass.
**Owner:** Architecture Agent
