# Stream W3A Task State

### Task #529 | feature | severity 6
**What:** Wire Task #528's gate-check into desktop's actual firing decision: before firing (OS event or scheduled poll path), check the shared gate via `lib/interruptGate.ts`; on timeout/unknown, fall back to local last-known state and fire anyway (per `docs/INTERRUPT_ARCHITECTURE.md` §6's recommendation — fire-anyway-on-timeout over suppress-on-timeout, confirmed by Max 2026-08-13). On an actual fire with content, write a `fired` event via #528.
**Why:** This is the task that actually makes cross-device coordination real — #525/#527/#528 build the pieces, this is where desktop starts using them for real firing decisions instead of only its local clock.
**File:** `components/InterruptHandler.tsx` (or a new co-located hook if this pushes the file past its size cap, matching the project's existing extraction pattern for oversized files)
**Severity:** 6 | **DoD Tier:** 3
**Complexity:** ⚡ Direct — 1 file, no matched scope-trigger word (rubric-mechanical label; genuinely cross-cutting in effect since it's the task that makes #526/#528 actually load-bearing, not reflected by file count alone)
**Blocked by:** #526, #528 (both COMPLETE, Wave 2) | **Blocks:** Nothing
**Done when:** Tests prove: a fresh `fired` event from another device (simulated) suppresses a local fire that would otherwise have happened; a gate-check timeout still allows a local fire (fire-anyway fallback); a real local fire writes a `fired` event. Full verification gate clean.
**Owner:** Architecture Agent
