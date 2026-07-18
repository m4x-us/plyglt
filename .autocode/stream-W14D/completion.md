CLOSED: #399 #404
NOT_CLOSED: none

# Derek — Stream W14D — Wave 14 — completion — 2026-07-16

Debt entries logged: 0
Carry-forward tasks generated: 0

## Task #399 — articles-regex test tightened (commit 0a34c54)
tests/langRegistry.test.ts:35 — "every ready language has an articles regex (not null)" rewritten as
"every language's articles regex is the canonical regex for that language". Asserts `.source` and
`.flags` of each registry entry's `config.articles` against the canonical `ITALIAN_ARTICLES` /
`SPANISH_ARTICLES` constants imported from `@/lib/answerCheck`, via an exhaustive
`Record<PackCode, RegExp>` map (compile error if a future language is added without a map entry).
Went beyond the finding: iterates ALL of LANGUAGE_REGISTRY, not just `ready:true` — es is
ready:false and the old filter left a Spanish-config swap permanently untested.
Independent B7 verification agent: YES (swapping lib/language.ts:60 to SPANISH_ARTICLES fails the
assertion; expected values are hardcoded in the test, not derived from configs). Spot check: PASS.

## Task #404 — ALL_KNOWN_PACKS deprecation cleanup (commit 2e05d28)
app/settings/page.tsx now imports `ALL_PACK_CODES` from `@/lib/langRegistry` directly
(line 8) and uses it in the License section (line 131). Behavior identical — the deprecated name
is a pure re-export alias of the same frozen array. Spot check: PASS.

## Observations for next wave / Max
- **app/settings/page.test.tsx:19,404 still imports ALL_KNOWN_PACKS.** Test file, outside this
  stream's owned files, so not touched. Candidate for the same deprecation sweep (cf. Task #361
  pattern for isReadySpecialtyPackCode). tests/langRegistry.test.ts's remaining use is intentional —
  it is the alias-equivalence regression test.
- **Live-tree tsc was broken mid-wave by lib/packCache.ts** (6 errors, 62 uncommitted inserted
  lines from a parallel W14 stream). My #404 diff was typechecked clean in an isolated git worktree
  against HEAD 0a34c54 instead. The wave-level verification gate must re-run after all streams land.
- **FFF gate scripts absent:** scripts/staged-diff-hash.sh, deep-audit.sh, mutation-gate.sh do not
  exist in this repo, so the commit-gate artifact steps degraded gracefully (skipped) for both
  tasks, matching prior-wave precedent. The acceptance criteria's `bash scripts/deep-audit.sh ...`
  lines are therefore unverifiable as written.
- **Autonomous closes:** the Direct-path "Mark done? yes/no" confirmations were auto-answered yes —
  this window ran unattended per the /go wave brief. Both closes are backed by PASS spot checks,
  PASS done-when checks, and green suites (1168/1168 then 1184/1184).
- **Git committer identity** on this machine defaulted to "John Schmidt <maximilian@Johns-MacBook-Air.local>"
  for commits 0a34c54 and 2e05d28 — worth setting git config user.name/user.email explicitly.

Verification at close: tsc clean for owned diffs; lint 0 errors in owned files; full suite
1184/1184; weak-assertion grep clean on tests/langRegistry.test.ts.
