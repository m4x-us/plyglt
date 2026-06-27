<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Slow-Coding Toyota System (SCTS)

We build code like Toyota builds cars — deliberately, without shortcuts, stopping the line the moment a defect is found. Never like Ford.

## The Four Principles

### 1. Andon Cord — Zero Tolerance
The line stops for *any* quality violation: failing test, TypeScript error, audit finding, code smell. Everything else waits. Root cause only — never patches. Never workarounds.

### 2. Kaizen — All Three, Every Time
Every fix requires all three — no exceptions:
1. **A test** that would have caught the bug (write it before the fix when possible)
2. **A root-cause fix** that eliminates the class of problem, not just the instance
3. **A docs update** (this file, CONTRIBUTING_LANGUAGE.md, or an inline comment) that prevents recurrence

### 3. Poka-Yoke — Mistake-Proof Now
When a mistake-prone pattern is spotted — a magic string, a parallel list, an unsafe cast, a silent catch — fix it immediately. Do not log it. Do not defer it. The wrong thing must be hard to do; the right thing must be automatic.

### 4. Slow = Deliberate
- Read the relevant guide before writing any code (Next.js docs for Next.js; Tauri plugin docs for Tauri; library docs for any library being used for the first time)
- Run the full verification gate before any batch of work is considered done
- No half-finished implementations — either it is done (gate passes, docs updated) or it does not ship
- No silent failures — every `catch` block must surface the error to the user or log it explicitly; swallowing errors is a stop-the-line violation

## Verification Gate
Run this before closing any batch of work. All three must be green:
```bash
npx tsc --noEmit        # zero TypeScript errors
npm test                # all tests pass + all coverage thresholds met
npm run lint            # zero lint errors
```

## Stop-the-Line Violations (no exceptions — stop and fix before continuing)
- Any TypeScript error
- Any failing test
- Any `catch {}` or `catch (e) {}` that silently discards an error
- Any hardcoded string that belongs in a named constant
- Any parallel list/array that should be derived from a single source of truth
- Any user-visible feature with zero tests covering its happy path
- Any function that can silently corrupt persisted user data
