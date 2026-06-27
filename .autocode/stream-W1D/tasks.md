# Stream W1D Task State

### Task #029 | Add feature flag system (Rule 4)
**Severity:** 5 | **File(s):** `lib/` (new file), `next.config.ts`
**DoD Tier:** 2
**Complexity:** 🔧 Full — "new feature" keyword, 4 files (lib/featureFlags.ts, next.config.ts, components/InterruptHandler.tsx, tests/featureFlags.test.ts)

No feature flag system exists. Rule 4: every new feature must be toggleable off. This blocks shipping the proactive interruption engine, vacation mode, analytics, and any Pro feature safely behind a flag.

**Changes required:**
1. Create `lib/featureFlags.ts` — define a `FeatureFlags` interface and a `getFeatureFlags(): FeatureFlags` function. Flags read from `process.env.NEXT_PUBLIC_FLAGS_*` at build time (Next.js static replacement). Initial flags:
   ```ts
   export interface FeatureFlags {
     interruptEngine: boolean;  // NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE
     vacationMode: boolean;     // NEXT_PUBLIC_FLAGS_VACATION_MODE
     analytics: boolean;        // NEXT_PUBLIC_FLAGS_ANALYTICS
   }
   ```
2. `next.config.ts` — document the flag env vars in a comment.
3. `components/InterruptHandler.tsx` — gate the interrupt listener registration behind `getFeatureFlags().interruptEngine`. If the flag is off, the component returns null immediately.

**Test required (write first):**
- `tests/featureFlags.test.ts` — `getFeatureFlags()` returns all flags as booleans. When `NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE` is `"false"`, `interruptEngine` is `false`. When absent, defaults to `true` (feature on by default).

**Done condition:** `lib/featureFlags.ts` exists. `tests/featureFlags.test.ts` passes. `components/InterruptHandler.tsx` reads the flag. Verification gate green.
