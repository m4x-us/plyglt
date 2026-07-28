CLOSED: #455 #466
NOT_CLOSED: none

## Task #455 — fix 29 banned-assertion violations

Fixed all 29 flagged assertions across the 12 owned test files. Broke them into three
groups by actual risk, not just mechanical pattern-matching:

**21 stylistically-redundant `screen.getByText(...).toBeDefined()`** (StudyDoneScreen,
Stat, UnitRow ×3, BuyModal, LevelSection ×5, StudyResumePrompt ×2, settings/Section ×2,
settings/Toggle ×2) — swapped to `.toBeInTheDocument()`, the codebase's own already-
established RTL idiom (already used in `app/page.test.tsx`, `app/study/page.test.tsx`).
Technically `getByText` already throws on absence so the Deletion Test distinction from
`.toBeDefined()` is minor here, but `.toBeInTheDocument()` is the semantically-correct,
consistent-with-the-rest-of-the-codebase choice and isn't on the banned list.

**5 genuinely-weak assertions the task flagged as higher-risk**, each given a real
value-specific fix after reading the actual component/hook logic, not a mechanical swap:
- `DifficultyBar.test.tsx` ×3 — `expect(bar).not.toBeNull()` on a `querySelector(".bg-X-500")`
  result only proved "some element with this class exists," not that the color LOGIC is
  correct. Requeried via the stable `.h-full` class (present regardless of color) and
  asserted the specific color class via `.toContain()` on `.className` — now actually proves
  the threshold logic picked the right color.
- `UnitRow.test.tsx:51` — `locks.length` (getAllByText("🔒")) `.toBeGreaterThan(0)` would
  pass even if the lock glyph rendered twice (a real bug). Read `UnitRow.tsx`: the glyph
  renders from exactly one conditional, never a loop. Changed to `.toHaveLength(1)`.
- `StudyCard.test.tsx:118` — same `.toBeGreaterThan(0)` shape on `getAllByText("il gatto")`.
  Read `StudyCard.tsx`'s result-phase JSX: the "You typed" label only renders when
  `typed !== canonical`; this test's typed value equals the canonical answer, so the text
  appears exactly once. Changed to `.toHaveLength(1)`.
- `StudyCard.test.tsx:128` — `.not.toBeNull()` on a `.border-yellow-500` querySelector,
  swapped to `.toBeInTheDocument()` (same reasoning as the getByText cases — the class
  selector itself is already the specific check; jest-dom's matcher is the correct idiom).
- `hooks/useStudySession.test.ts:133` — `expect(firstCall).toBeDefined()` was fully
  redundant with the preceding `toHaveBeenCalledTimes(1)` (which already guarantees
  `mock.calls[0]` exists). Replaced with `expect(firstCall).toHaveLength(3)`, which actually
  proves something new: `commitSession` was called with exactly 3 arguments, not just that
  the calls array's first slot is non-undefined.
- `components/InterruptHandler.test.tsx:150` — `expect(callback).toBeDefined()` on a
  `Map.get()` result. Replaced with `expect(typeof callback).toBe("function")`, which is
  strictly more specific (a non-function truthy value would pass the old check but fail the
  new one) and still serves the same pre-invocation guard purpose.

**3 justified `existence-check:` exemptions**: none. Every one of the 29 hits resolved to
either a redundant/replaceable check or a genuinely fixable value-specific assertion — none
involved a non-deterministic value (auto-generated ID, `Date.now()` timestamp).

Verified the fix is real, not just silencing the grep: ran AGENTS.md's exact Verification
Gate command after the fix (zero hits), re-ran `tsc --noEmit` (clean), ran all 12 owned test
files directly (68/68 passing, not just "the suite as a whole didn't regress"), and ran
`npm run lint` (0 errors). Updated `.autocode/agents/cto.md`'s Batch Audit Log with a dated
verification entry under the Batch 12 sixth-cycle section (not a new row — an addendum
directly under the FAIL verdict that originally flagged this, documenting that #455 was
independently re-verified green, not just marked closed) per the acceptance criteria.

## Task #466 — CI enforcement of banned-assertion grep

Added a new CI step to `.github/workflows/ci.yml`, placed after `Tests` and before `Build`
(grouped with the other quality-gate steps — tsc/lint/tests — rather than the
deployment-readiness steps that follow). Runs AGENTS.md's exact banned-assertion grep
command, byte-for-byte, and `exit 1`s if it finds any unjustified hit. Comment notes this is
the mechanical enforcement of AGENTS.md's Verification Gate and instructs future editors to
keep the two commands in sync.

Verified locally per the acceptance criteria: ran the step's exact command against the
post-#455 (clean) tree — passes. Temporarily reintroduced one violation
(`components/Stat.test.tsx:13`, `.toBeInTheDocument()` → `.toBeDefined()`), re-ran the exact
command, confirmed it correctly detects the hit and exits 1, then restored the file from a
backup copy and re-confirmed the gate passes again. Validated the workflow YAML parses
correctly (`python3 -c "import yaml; yaml.safe_load(...)"`).

## Verification

Full gate green: `tsc --noEmit` clean, `npm test` 1397/1397 passing (full repo, with
coverage), `npm run lint` 0 errors (3 pre-existing warnings in files this stream doesn't
own), coverage above every threshold (stmts 90.59%, branches 86.15%, funcs 90%, lines
93.04%), Verification Gate grep clean.

Hit the same class of transient cross-stream instability as every prior wave this session —
`lib/basePackLoader.ts` (explicitly off-limits to this stream) and a new untracked
`lib/fetchWithTimeout.ts` both showed real but transient TypeScript errors mid-run,
consistent with another window's in-progress consolidation of Task #465 (the
`FETCH_TIMEOUT_MS` triplication this same audit cycle flagged, introduced by my own #445
fix two waves ago). Confirmed via `git stash` + isolated re-run and by simply re-running
`tsc`/`vitest` a few seconds later that these were not caused by anything in this stream's
diff and resolved once the owning window's edit settled.

Debt entries logged: 0
Carry-forward tasks generated: 0
