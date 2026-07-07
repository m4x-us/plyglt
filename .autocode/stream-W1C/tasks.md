# Stream W1C Task State

### Task #184 | data-loss | severity 5
**What:** Fix two safety gaps in the SRS v3 migration introduced by Task #178. (1) `DATE_RE = /^\d{4}-\d{2}-\d{2}$/` accepts calendar-invalid strings like `"2026-13-45"`; these pass the regex, become `phaseStartDate`, and produce `NaN` in `getDayOfPhase` — silently hiding the card forever. The migration comment explicitly warns about this risk for empty strings but does not address it for invalid dates. Fix: add `&& !isNaN(new Date(v).getTime())` after each `DATE_RE.test()` call. (2) The for-loop at line 58 iterates over `Object.entries(introductions)` but does not guard against a stored null value (e.g. `{ "card-1": null }`); accessing `record.phaseStartDate` throws `TypeError`, which Zustand's persist middleware catches and resolves by resetting to default empty state — silently wiping all SRS card history.

Add two tests: (a) introductions map containing a null record — must not throw and must produce a valid phaseStartDate; (b) record with `introducedDate: "2026-13-45"` (calendar-invalid) — must fall back to today's date, not preserve the invalid string.
**Why:** Both bugs can silently corrupt or destroy user SRS progress. The NaN risk is the same failure mode the migration comment already warns about; the null-record risk causes silent data loss via the Zustand fallback path.
**File:** `store/migrations.ts`, `tests/migrations.test.ts`
**Severity:** 5 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — 2 files, no package boundary, single-scope fix
**Blocked by:** Nothing | **Blocks:** #183 (F007/F008 tests reference the corrected migration behaviour)
**Test required:** Two new it() blocks as described above.
**Done when:** New tests pass. `node -e "console.log(/^\d{4}-\d{2}-\d{2}$/.test('2026-13-45') && !isNaN(new Date('2026-13-45').getTime()))"` prints `false`. Verification gate green.
**Owner:** Architecture Agent
