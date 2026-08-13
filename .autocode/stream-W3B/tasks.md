# Stream W3B Task State

### Task #530 | feature | severity 5
**What:** Desktop's snooze action (currently `lib/tauriInterrupt.ts`'s `snoozeInterrupt`, which only ever touches local in-memory Rust state via `interrupt.rs`'s `snooze_interrupt` command) also writes a `snoozed` event via Task #528's write function, so a snooze on one device is visible to every other device (including, once mobile ships, a phone) via the same shared gate.
**Why:** Without this, a user who snoozes on their phone gets no relief on their desktop a few minutes later, and vice versa — directly the scenario Max raised. This is a genuinely new capability for mobile (which has no snooze concept at all today), not just syncing an existing one. See `docs/INTERRUPT_ARCHITECTURE.md` §8.
**File:** `lib/tauriInterrupt.ts`, `app/study/page.tsx` (the "Snooze X min" button call site), relevant test files
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** 🔧 Full — 4 files (2 source + their 2 test counterparts)
**Blocked by:** #528 (COMPLETE, Wave 2) | **Blocks:** Nothing
**Done when:** Clicking Snooze writes a `snoozed` event with the correct `effective_until` (now + snooze minutes). A test proves a device checking the gate shortly after respects a snooze event it didn't itself create (simulated as if from another device).
**Owner:** Architecture Agent
