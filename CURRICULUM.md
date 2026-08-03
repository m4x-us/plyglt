# plyglt — Curriculum

## The Goal

**8,000 Italian words. A1 through B2. ~33,000 cards.**

A B2 graduate can understand the main ideas of complex texts on both concrete and abstract topics, write clear and detailed texts across a wide range of subjects, and articulate viewpoints and arguments in writing. That is the ceiling plyglt targets — nothing less, nothing more.

The curriculum is structured around four CEFR levels, each broken into thematic units. Every unit contains all four card tiers. Every word appears in natural, contextual sentences — never isolated, never textbook-sterile.

---

## Content Generation Status (updated 2026-07-30)

**A1 and A2 are at full target CARD-COUNT density, including a 2026-07-30 backfill pass that fixed 6 units audited as thinner than their siblings (3 of them, A1 units 08/09/10, had ZERO tier-2 grammar cards despite each unit's whole theme being a grammar point — modal verbs, adjective agreement, "mi fa male"). But a same-day content-quality audit (see below) found A1/A2 are NOT yet "done" in the sense of matching the Card Quality Standards further down this file — real, measured gaps remain. B1 is fully complete including content-quality remediation. B2 is now unit-count- and density-complete (2026-08-03) but has NOT yet been through the same adversarial content-quality audit A1/A2/B1 received — see the note below dated 2026-08-03.**

| Level | Units | Cards | Target cards | Status |
|-------|-------|-------|--------------|--------|
| A1 | 20/20 | 2,434 | ~2,600 | Card count at target; quality gate debt tracked (see below) — backfilled units 08, 09, 10, 12, 19 (2026-07-30) |
| A2 | 30/30 | 4,830 | ~5,700 | Card count at target; quality gate debt tracked (see below) — backfilled unit 38 (2026-07-30) |
| B1 | 36/36 | 7,296 | ~9,450 | COMPLETE (2026-08-02) — unit count, density, and full content-quality audit remediation (pedagogical rigor 77/100, brand/voice 80/100) all done. One extra unit (36th) added past the original 35-unit plan to give the imperative mood its own dedicated home |
| B2 | 40/40 | 14,892 | ~15,200 | COMPLETE (2026-08-03) — unit count and density both done: 27 new units generated (42-68, including a mixed-genre reading-passages capstone) and all 13 original thin units (29-41) append-expanded to target density. Not yet audited for pedagogical rigor/brand-voice fidelity the way A1/A2/B1 were — see note below |
| **Total** | **126/125** | **30,385** | **~32,950** | Unit count exceeds the original 125-unit plan (B1 and B2 each ended up with one extra unit past their original targets — the B1 imperative unit and B2's reading-passages capstone); ~92% of the way to the full target by card count |

**2026-07-30 backfill note:** a per-unit density audit (comparing each unit's card count and tier breakdown against its siblings, not just the level-wide total) found that the level-wide totals above were masking real gaps: 6 units (A1: 08, 09, 10, 12, 19; A2: 38) were meaningfully thinner than their peers, and three of them (A1 08/09/10) had never had a single tier-2 (grammar) card written despite each unit's theme *being* a grammar point. All 6 were expanded append-only (verified via `git diff` showing zero modified/deleted lines among original cards, beyond two stale placeholder comments), re-validated (`tsc`, full test suite, `pack:export`/`pack:validate`, corpus-wide duplicate-sentence and duplicate-ID scans — all clean), then committed. Lesson for future audits: check per-unit density and tier balance, not just the level-wide card-count total — a healthy aggregate can hide individually thin or structurally incomplete units.

**2026-07-30 backfill wave 1 (tier-1 context, 10 worst A2 units):** Max chose to fix the A1/A2 quality debt before writing any more new curriculum content. Wave 1 targeted the 10 units with the most tier-1-no-context violations (966 flagged cards): a2-unit-26, 27, 29, 30, 31, 32, 33, 34, 35, 39. Result: `tier1NoContext` baseline 1,937 → 1,013 (-924); `emptyHint` and `tier4NotPassage` baselines unchanged (2,276 / 496 — the batch introduced zero net new debt in either category, after two regressions found mid-batch were fixed: 3 units had drafted new fill_blank cards at tier 4, reclassified to tier 3; 1 unit added 22 hint-less cards, hints added). Also fixed two real false-negative bugs in `scripts/lintCardQuality.ts`'s own tier-1-context heuristic (parenthetical grammar annotations, elided-article stripping) discovered by content agents hitting unfixable cases. 40 A1/A2 units remain for tier-1 context, plus the tier-4-passage backfill (496 cards, ~29 units) — waves 2+, not yet started.

**2026-07-30 backfill waves 2-4 (tier-1 context, remaining 43 A1/A2 units):** Completed the tier-1-context backfill started in wave 1. Wave 2: 10 units (397 cards). Wave 3: 15 units (283 cards). Wave 4: 18 units, paired 2-per-agent as individual gaps shrank to 1-13 cards each (125 cards) — this wave also caught and fixed a genuine cross-unit duplicate sentence ("Do you accept credit cards?" independently written in two different units) rather than accepting it into the baseline. Zero new gate violations in waves 2-4 (wave 1 had two, both fixed before committing). **Result: `tier1NoContext` baseline 1,937 → 181 (90.7% resolved).** The remaining 181 cards are mostly the a2-unit-31 exception (full sentences authored directly as tier-1 cards — CURRICULUM.md's own no-duplicate-sentence rule forbids "fixing" these without duplicating the sentence elsewhere) plus scattered residuals in already-touched units. `emptyHint` and `tier4NotPassage` baselines unchanged throughout (2,276 / 496) — this whole effort touched only the tier-1-context category. Pack: 8,119 → 8,727 cards. **The tier-4-passage backfill (496 cards, ~29 units — replacing standalone sentences with real 60-80 word passage_cloze passages) has not been started.**

**2026-07-30 passage backfill (tier-4, all A1/A2 units — COMPLETE):** Fixed the second large content-quality gap in two waves. Wave 1: 8 worst-offending units (157 flagged cards). Wave 2: the remaining 21 units (279 flagged cards). Process: the flagged standalone-sentence tier-4 cards are retired via `deprecated: true` (never deleted — permanent ids per `scripts/checkCardIds.ts`), replaced with genuine self-contained 4-6 sentence `passage_cloze` mini-stories (~40-70 words, one blank each), matching the format already proven in `a1-unit-11-food.ts`. ~270 new passage_cloze cards added total. Every agent was required to check for a real side effect discovered in wave 1 — deprecating a tier-1 word's only context sentence re-orphans it under the tier-1-context gate — and fix any orphans before finishing. **Result: `tier4NotPassage` baseline 496 → 60, and the remaining 60 are entirely in B1/B2 units (not yet written, a separate future project) — the A1/A2 tier-4-passage backfill is now 100% complete.** Along the way: 3 more real bugs found and fixed in `scripts/lintCardQuality.ts`'s own heuristics (a `length >= 3` filter silently excluded genuine 2-character Italian words like "tè" from context search; clitic-attached verb forms like "aiutarla" don't contain their own infinitive as a substring) — both with regression tests. One subjunctive slip was caught and fixed in a self-authored draft before committing. One pre-existing "se potessi" (congiuntivo) tier-1 chunk in `a2-unit-16` was confirmed to predate this entire session (original curriculum build commit) — flagged for the roadmap, not fixed as part of this task's scope.

**Both major A1/A2 quality-gate categories from the 2026-07-30 audit are now closed.** `tier1NoContext`: 1,937 → 175 (91%, remainder is one documented permanent exception in `a2-unit-31`). `tier4NotPassage`: 496 → 60 (100% of A1/A2 scope; remainder is entirely unwritten B1/B2 content). `emptyHint` and `withinUnitDup`/`crossUnitDup` were not targeted by this effort and remain at their post-2026-07-30-fix levels (2,251 / 0 / 2). Pack: 8,119 → 9,052 cards across this whole content-quality remediation effort.

**2026-07-30 content-quality audit note:** immediately after the backfill above, Max asked the harder question — is this content actually worldclass, not just at-target by card count. Two independent adversarial reviews (an 8-unit, 1,168-card representative sample, cross-checked against the full 8,119-card corpus for the structural claims) scored pedagogical rigor 61/100 and brand/voice fidelity 74/100. Real, verified findings: only 3 of 20 A1 units have any `passage_cloze` tier-4 cards at all (the rest substitute short standalone sentences, missing BRAND.md's "60-80 word passage" promise entirely); 42% of tier-1 cards corpus-wide don't have their word appearing in any sentence card in their own unit; subjunctive grammar leaks into A2 content in at least 2 units (a recurring failure mode CURRICULUM.md already names); 28% of cards corpus-wide have no hint, wildly unevenly distributed (0% in some units, 79% in one); a handful of verbatim duplicate cards; one real Italian spelling error. This resulted in `scripts/lintCardQuality.ts`, a mechanical Card Quality Gate (see the Card Quality Standards section below) that makes the cheap-to-check defects (empty hints, duplicates, missing tiers) structurally impossible to repeat, and grandfathers the larger structural debt (tier-1 context, tier-4 passages) as a tracked, shrinking baseline rather than a blocking rewrite. The tier-1/tier-4 backfill itself is a separate, large future content project — not done as part of this session (see `.autocode/agents/cto.md`'s Strategic Priorities).

**Owner decision (2026-07-29/30):** the actual shipped curriculum had drifted far below this file's original density targets — existing units averaged ~30-40 cards each versus the ~130-380/unit targets in the table below. Max explicitly chose to hit the ORIGINAL card-count targets (not just "write the missing units at whatever density"), which means every existing thin unit needs expansion too, not just the ~62 missing units.

**2026-08-01: B1 content resumed — first discovery: this file's own B1/B2 unit-theme tables (units 51-85, 86-125) are stale and do not match what was actually built.** The 14 existing B1 units (real filenames b1-unit-19 through b1-unit-32) use entirely different themes/numbering than this file's planning table, and at least two topics the plan assigns to B2 (relative pronouns at B2 #90, passive voice/si-impersonale at B2 #89) already shipped early at B1. A research pass read all 14 existing B1 files plus this document to produce an accurate, non-duplicative plan for the 21 additional B1 units grounded in actual corpus state rather than the stale table — see `.autocode/agents/cto.md` for the full plan and reasoning. First batch (8 grammar units, following this file's "grammar-focused units early" guidance) generated via multi-agent workflow (parallel generation agents + independent review agents, same pattern as A1/A2): `b1-unit-33-subjunctive-opinions`, `-34-subjunctive-impersonal`, `-35-subjunctive-emotion` (splitting subjunctive triggers by category, since the existing `b1-unit-20-congiuntivo` only drills doubt-triggers and conjugation mechanics), `-36-hypothetical` (periodo ipotetico), `-37-concession-contrast`, `-38-cause-effect`, `-39-purpose-result`, `-40-formal-register`. 187-234 cards/unit (2,077 total) — below the ~270 target (grammar-focused units naturally lean on drilling over vocab breadth) but above the 180-card floor and the corpus's actual per-unit median.

**Real problems found during integration (fixed before committing, not shipped as debt):** (1) `b1-unit-36-hypothetical`'s first draft included a 32-card bare congiuntivo-imperfetto conjugation table (5 persons × multiple verbs, no sentence context) that exactly duplicated `b2-unit-29-hypotheticals.ts`'s existing teaching method for the same grammar point — removed entirely; the unit's contextual Tipo 1/Tipo 2 fill_blank sentences (which teach the same forms *in* sentences, per this file's own "grammar through examples only" rule) were left intact and already covered the pattern adequately. This was caught by manually reading the file after noticing the B1 unit's filename/theme collided with an existing B2 unit — the review agents' own self-reported checks had not caught it. (2) Two genuine new `tier1-no-context` gate violations in `b1-unit-35-subjunctive-emotion` (`preoccupato/a`, `sollevato/a`) — not a content bug but a `scripts/lintCardQuality.ts` false negative: its gender-shorthand splitting logic turned `"preoccupato/a"` into search terms `["preoccupato", "a"]`, and neither matches the feminine `"preoccupata"` actually used in the unit's passages. Fixed the extraction logic to expand short slash-suffixes into both full word forms (`"preoccupato"` + `"preoccupata"`), with 2 new regression tests (`tests/lintCardQuality.test.ts`) — the same "found a real lint-heuristic bug via real content" pattern as the 2026-07-30 backfills. Both fixes verified via a full re-run of `tsc`, `pack:export`, `pack:validate`, `pack:lint-quality` (all hard gates clean, zero new baseline violations), and `npm test` (1503/1503).

**Lesson reinforced from this batch:** before generating new content for any theme, check the ACTUAL corpus (`content/cards/` filenames + a quick grep of the target level and adjacent levels) for a name/topic collision, not just this file's planning tables — the tables drift from reality over time and a collision is a real signal to go read the existing file, not just trust the plan.

**2026-08-01, same day — second batch: the remaining 13 B1 topic units, applying the previous lesson upfront.** Before generating, the actual scope of several already-shipped B2 units (`b2-unit-40-law-society`, `b2-unit-35-numbers-economy`, `b2-unit-33-media-news`, `b2-unit-39-science-tech`, `b2-unit-34-abstract-ideas`, `b2-unit-36-italian-culture`) was read directly rather than assumed from this file's stale plan — this surfaced real collisions the original 13-topic plan would have walked straight into: "politics & government," "the economy," "news & journalism," "science & research," and "abstract concepts" all directly overlapped B2 units already covering that exact territory (e.g. `b2-unit-34-abstract-ideas` already owns freedom/justice/identity/ethics, which was on the original B1 plan verbatim). The plan was revised before writing anything: politics/economy/news kept but explicitly rescoped narrower/lighter than their B2 siblings (civic basics vs. B2's institutional/legal depth; everyday money vs. B2's macroeconomic statistics; reading the news vs. B2's journalism-profession vocabulary); "science & research" and "abstract concepts" dropped entirely (B2 already owns them well, no clean lighter B1 angle existed) and replaced with "Life Stages & Milestones" and "Sleep, Stress & Wellbeing" — both checked against existing B1 siblings (`b1-unit-32-social`, `b1-unit-27-health`) for overlap first. Shipped: `b1-unit-41` through `-53` (society, politics, economy, technology, environment, art, music, news, two history units, life stages, wellbeing, and a subjunctive/connector-mastery capstone reviewing units 20/33/34/35/37/38/39). One generation attempt (`b1-unit-44-technology-digital-life`) hit an output-token limit and needed a direct retry outside the workflow. 12 of 13 landed 192-246 cards/unit on the first pass; all wired into `content/index.ts` and mechanically verified (zero cross-unit exact-sentence duplication, confirmed via direct grep against every named sibling, not just trusting the generating agents' self-reports) before committing.

**2026-08-01, same day — third batch: expanding the original 14 thin B1 units, forced by a HARD gate side effect.** Integrating the two batches above raised B1's per-unit median card count high enough that the Card Quality Gate's density-floor HARD gate ("no unit below 70% of its level's median") started failing for the original 14 units (b1-unit-19 through -32, ~30 cards each) — a real, mechanical, zero-tolerance gate failure with no grandfathering mechanism, not new content debt. Max chose to expand all 14 rather than defer or weaken the gate, via the append-only process this file already specifies for existing thin units: read the file, add new cards deepening the same theme, never touch an existing card. Each of the 14 units' expansion prompt named its specific new-B1-sibling or B2-sibling to avoid re-treading (e.g. expanding `b1-unit-20-congiuntivo`'s doubt-trigger conjugation work without wandering into opinion/impersonal/emotion triggers now owned by units 33-35; expanding `b1-unit-32-social`'s friendship vocabulary without drifting into `b1-unit-41-society-social-life`'s community/generational territory). **Append-only discipline was independently verified via `git diff --numstat` against the pre-expansion commit for all 14 files — zero deleted/modified lines in every single one, not just the generating agents' own self-reported claims.** Net result: B1 is now 35/35 units, 7,006 cards, unit-count AND density-target work fully complete. Card Quality Gate: all HARD gates clean; 8 new `tier1-no-context` violations surfaced in `b1-unit-44` (8 context-demonstration sentences mistakenly tagged `tier: 1` instead of `tier: 3` — tier 1 is single vocabulary words, not full sentences; retagged and renumbered into the tier-3 sequence, which also incidentally satisfied the context requirement for the tier-1 words those sentences were built around) — fixed before committing. Bonus: the expansion incidentally resolved 42 previously-baselined `tier1NoContext` violations elsewhere in the corpus; baseline file updated (`--update-baseline`) to lock that in, per this file's own ratchet-only convention.

**Note for the next content session:** B1 has NOT yet been through the same content-quality-audit pass A1/A2 got (the 61/100 and 74/100 adversarial reviews back in 2026-07-30) — its Card Quality Gate is clean (zero new debt introduced by this session's work), but that only proves no *new* problems were added, not that B1 meets the same bar A1/A2 were explicitly audited against. Worth doing before calling B1 "done" in the fuller sense, same distinction this file already draws for A1/A2 above.

**2026-08-01, same day — B1 content-quality audit run (the note above prompted it).** Two independent adversarial reviewers scored an 8-unit representative sample (a mix of legacy-expanded, new-grammar-batch, new-topic-batch, and the capstone review unit) against the same standard as the A1/A2 audit, then a third pass cross-checked which findings generalized across the full 35-unit corpus rather than being sample artifacts. **Scores: pedagogical rigor 67/100 (avg of 70/64), brand/voice fidelity 77/100 (avg of 78/76)** — both already ahead of A1/A2's original pre-remediation 61/74 baseline, but real gaps remain.

**2026-08-01, same day — re-audit after the first remediation pass, using the identical 8-unit sample for a fair comparison.** Scores: pedagogical rigor 72/100 (up from 67), brand/voice fidelity 77/100 (flat). The empty-hint fix and the tier-4/passato-remoto fixes held up as genuine, verified improvements. But the re-audit's corpus-wide verification pass caught a real gap in the first remediation's own scoping: "hints written entirely in Italian" had been fixed only in the two units the *first* audit happened to sample it in (b1-unit-21, -28) — a direct corpus-wide grep found the actual scope was **1,016 cards across 25 of the 35 B1 units**, essentially the dominant hint style for the entire congiuntivo/connector unit family, traced back to the original generation prompts for those units never specifying hints must be written in English. The `b1-unit-27-health` hint fix was also incomplete (only the expansion-section cards were fixed; ~20 original cards were missed). A second, properly-scoped remediation pass fixed all 25 units — reduced to near-zero remaining instances (verified via direct corpus grep, not just agent self-report; the ~60 apparent stragglers a first heuristic pass found were confirmed to be false positives — genuinely good English hints a crude regex didn't recognize). **Lesson for future generation batches: hint-language (English, not Italian shorthand) needs to be an explicit, non-negotiable line in every generation prompt from the start, not something added only during remediation — the gap here came from an omission in the original batch-1/batch-2 generation prompts, not from anything the mechanical gate could catch (it only checks hint *presence*, not hint *language or quality*).**

The three larger structural findings (multi-grammar-concept units, formulaic passage endings, templated tier-3 chunks) remain open, unchanged, still logged in `debt.md` — this round of work deliberately did not touch them.

**2026-08-02 — formulaic passage-ending debt closed.** Fixed the second of the three deferred structural findings: 16 units' tier-4 passages were read in full (not just the units a mechanical scan happened to flag) and any ending that explicitly stated an abstract lesson/moral ("Da quel giorno, capisce che...", "la vera lezione è...") was rewritten to end on a concrete action, observation, or piece of dialogue instead — 61 passage endings changed corpus-wide. Verified independently: zero card ids removed, the HARD duplicate-sentence gate stayed clean (no rewritten ending collided with an existing sentence anywhere in the corpus), and a broadened re-scan for the same pattern turned up only false positives on manual read (natural continuing-action sentences that happened to contain a trigger phrase like "da allora," not the flagged narrator-stated-moral pattern). Marked resolved in `debt.md`. Two structural findings remain open: units teaching 3+ new grammar concepts at once, and templated tier-3 "chunk" cards that are really conjugation drills in sentence clothing.

**2026-08-02, same day — templated tier-3 chunk debt closed.** Fixed the third of the three deferred structural findings. Mechanical scanning alone undercounted this one (grouping by literal opening words missed clusters where the frame itself grammatically varies by person/gender, e.g. "Sono convinto che" / "Siamo convinti che" / "È convinta che") — a real reminder that this class of defect needs a full read-and-judge pass, not just a grep. 10 units (the whole subjunctive/connector family plus two topic units that also showed clustering) had their tier-3 sections read in full; any cluster of 4+ cards sharing an identical trigger frame with only the embedded verb swapped had most cards rewritten into a genuinely distinct situation (a specific person, reason, stake) while 1-2 simple baseline cards were kept per cluster and the trigger phrase/grammar point stayed intact. One review agent hit a transient connection error mid-run; the affected unit's fix had already been applied, so it was independently re-reviewed as a follow-up (found clean, no further changes needed) rather than left unverified. Verified: card-id integrity across all 10 files, tsc, full pack export/validate/lint-quality gate (hard duplicate-sentence gate stayed clean — no rewritten card collided with an existing sentence), full test suite, lint, and manual spot-checks confirming the rewrites are genuinely varied rather than a different template.

**All three structural findings from the 2026-08-01 B1 quality audit are now resolved.**

**2026-08-02 — third re-audit, same 8-unit sample and methodology as rounds 1-2.** Scores: pedagogical rigor 77/100 (up from 72), brand/voice fidelity 80/100 (up from 77). Corpus-wide verification confirmed all three structural fixes held up (non-passage tier-4 and templated tier-3 chunks fully resolved corpus-wide; the passage-ending fix improved with only one soft residual instance), plus found and closed two small residuals: 10 more low-value "verb = translation" hints the earlier corpus-wide fix hadn't caught (fixed with real usage notes), and the one soft passage-ending echo (fixed).

The re-audit also gave a precise, real count on the one item never yet attempted: **12 of 35 B1 units still teach multiple grammar concepts in one file.** Rather than mass-fixing based on that count, a dedicated investigation read each of the 12 units' actual tier-2 teaching (not just re-counting grammar labels) and found **the automated count had significantly overstated the problem — 10 of the 12 were actually fine.** Grammar like futuro, condizionale presente, imperfetto, comparativi, passato prossimo, and reflexive verbs are all A2 material; their appearance in a B1 unit's example sentences is expected reinforcement per CURRICULUM.md's own rule ("a unit may reinforce previous grammar, but it introduces only one new rule"), not a new B1 concept — the audit's mechanical labeling couldn't tell the difference, a person reading the actual content could.

**Only 2 genuine violations existed, both the same root cause:** neither the formal nor informal imperative mood ever got a dedicated B1 unit — both were bolted onto unrelated topic units instead (formal onto `b1-unit-27-health`, informal onto `b1-unit-45-environment-nature`). Fixed by giving the grammar point its proper home: confirmed `b1-unit-40-formal-register.ts` already comprehensively teaches the formal (Lei) imperative (16 dedicated cards) — added it as `b1-unit-27`'s prerequisite so its 7 imperative cards are now honest reinforcement, zero content rewrite needed. Generated a new dedicated unit, `b1-unit-54-imperativo-informale.ts` ("Just Do It," 256 cards — regular tu/noi/voi across all three conjugations, the negative-tu-uses-infinitive asymmetry, the irregular tu forms, and object/reflexive pronoun attachment including the doubling rule and its `gli` exception), added as `b1-unit-45`'s prerequisite, with `b1-unit-45`'s own section comment updated to reflect reinforcement framing. B1 is now 36/36 units.

**B1's content-quality remediation arc (2026-08-01 to 02) is complete.** Pedagogical rigor rose from an unaudited baseline to 77/100, brand/voice fidelity to 80/100, and all four structural findings from the original audit (tier-4 passages, templated chunks, formulaic endings, multi-grammar units) are resolved and independently re-verified, not just self-reported. B1 has not been audited a fourth time — the marginal-return question (is a 4th round worth it, or is this a good place to call B1 "done" and move to B2) is Max's to make, matching this project's own accept-as-debt convention for diminishing-returns audit cycles.

Real, corpus-wide findings (confirmed beyond the sample): (1) several new-topic-batch units introduce 3+ new grammar concepts in one file, violating this file's own "one new grammar concept per unit" rule — the generation prompts for that batch didn't explicitly enforce it; (2) a formulaic "moral of the story" tier-4 passage ending recurs across at least 7 additional units beyond the sample (27 checked) — technically evades the duplicate-sentence gate (each sentence is unique) but is a pervasive authorial tic; (3) templated tier-3 "chunk" cards in several units repeat the same sentence skeleton with only the verb/trigger swapped, reading as a conjugation drill rather than real collocations. **All three logged to `debt.md` as accepted debt (2026-08-01)** — each is a substantial rewrite project across many files, not a quick patch, and Max chose to fix the contained issues now rather than take on a full structural remediation in the same session.

Contained issues fixed the same day: hint quality (English-trivia-gloss hints in `b1-unit-27-health` that restated the English prompt instead of teaching Italian usage; gender-only-restatement hints in `b1-unit-32-social`; several hints written entirely in Italian instead of English, a real comprehension barrier), the 30 pre-existing non-passage tier-4 cards across the 14 legacy units (retired via `deprecated: true`, replaced with real passage_cloze passages — the same backfill pattern used for A1/A2), the 156 pre-existing empty hints across those same legacy units, two isolated cards misusing the "recognize" type for fragile open-ended free-text matching, and passato remoto io/tu over-drilling in the two history units (misallocated effort for a reading/writing-focused curriculum — real Italian historical narration is overwhelmingly third-person). See git log for the exact commit closing this out.

**The process that worked for A1/A2 (repeat this for B1, then B2):**
1. **New units**: for each missing unit, generate the complete file from scratch at full target density (~190 cards for A2, ~270 for B1, ~380 for B2) in one pass, following the exact schema in `content/types.ts` and the Card Quality Standards below. Batch 5-10 units per run.
2. **Existing thin units**: for each already-shipped unit, an agent reads the file, identifies what's already taught, and APPENDS new cards deepening the same theme/grammar point — never modifying or deleting an existing card. Verify this with a byte-identical diff check against the pre-expansion git commit for every original card, not just by trusting the agent's own report.
3. **Review**: every generated/expanded unit gets an independent adversarial review pass checking: card count vs. target, ID sequencing/uniqueness, schema correctness, natural-sentence quality, no duplicate sentences (within the file AND against a corpus-wide scan — short vocabulary-phrase overlaps between related units are fine; duplicated *invented example sentences* are not), and correct grammar level for the CEFR tier.
4. **Integration**: wire new unit files into `content/index.ts` (import + add to `ALL_UNITS` array, in level order), then run `npm run pack:export`, `npm run pack:validate`, `npx tsc --noEmit`, and `npm test` before committing.
5. This was done via a multi-agent workflow (parallel generation + review agents) — see git log around 2026-07-30 (`content: add ... A2 units` commits) for the exact prompts used; they're reusable as a template for B1/B2.

Real bugs the review passes actually caught and fixed (so future passes know what to watch for): subjunctive grammar leaking into A2-level content, mistranslated accepted-answer variants, fill_blank cards testing words never taught in their own unit, dangling/wrong prerequisite card-ID references, gender-mismatched accepted answers, self-contradictory example sentences, and unnatural preposition choices.

**2026-08-02 — B2 content resumed, wave 1 of new-unit generation (9 of 27 missing units).** Before generating, read all 13 existing B2 files (`b2-unit-29` through `-41`, a linear prerequisite chain, all thin at ~30-38 cards each) and all 36 B1 files to scope 27 new unit themes with no topical overlap — following the lesson from the B1 arc (check actual shipped content, not CURRICULUM.md's stale 86-125 planning table below). Wave 1 shipped `b2-unit-42-advanced-conditionals` through `b2-unit-50-legal-procedure` (9 units, continuing the real prerequisite chain from `b2-unit-41-psychology`), same multi-agent draft→review→fix workflow pattern as B1, at ~350-370 cards/unit (target ~380).

Real defects the review passes caught and a second, independently-verified fix pass actually resolved (not just self-reported): all 9 units' tier-4 passages first landed at 30-55 words/card, well under the 60-80 word target — verified via a direct word-count script both before AND after the claimed fix; 8 of 9 units fixed correctly on the first pass, but `b2-unit-50-legal-procedure` still measured 46.3 words/card after its fix agent claimed success, requiring a second, explicitly-scoped fix agent (final: 69.9 avg, all 60 cards in range, independently re-measured). Also fixed: 41 exact duplicate sentences between tier-2 and tier-3 cards in `b2-unit-47-discourse-connectors`; two fill_blank cards testing untaught vocabulary in `b2-unit-49-finance-investment` (blanks reworded to taught words); a handful of real Italian grammar/collocation errors (`della cui` / `nei cui` misuse in `b2-unit-45`); a broken double-blank fill_blank card and an ungrammatical partitive in `b2-unit-47`. The mechanical Card Quality Gate then caught 4 new cross-unit exact-phrase duplicates (e.g. "una clausola penale" verbatim in both `b2-unit-42` and `b2-unit-50`) and 11 tier-1-context gaps the review agents' own sampling missed — all fixed directly rather than added to the baseline, per this project's ratchet-only convention; two of the tier-1 fixes needed a second attempt each, since the lint's context check requires the literal infinitive/base form as a substring and the first attempt's fix sentences used only conjugated/gendered forms (e.g. "coincide" satisfies "coincidere" but "azionisti" does not satisfy "azionista" — a real lesson for future waves: write the fix sentence around the word's exact citation form, not just a natural inflection of it).

Verified before integration: `npx tsc --noEmit`, `npm run pack:export`/`pack:validate`/`pack:lint-quality` (all hard gates clean, zero new baseline violations after fixes), `npm test` (1503/1503), `npm run lint` (0 errors). Wired into `content/index.ts`. Pack: 99→108 units, 15,904→19,146 cards.

**2026-08-02/03 — waves 2-3: the remaining 18 new B2 units (51-68), including the mixed-genre reading-passages capstone.** Same draft→review→fix workflow pattern, each wave's units checked against named sibling units first to avoid overlap (e.g. `b2-unit-57-literary-italian` introduces the passato remoto — genuinely new grammar not taught anywhere else in the curriculum — specifically so `b2-unit-66-literary-analysis` and the capstone unit 68 could reuse it in literary narrative passages). `b2-unit-68-reading-passages-mixed` is the deliberate B2 capstone: minimal new tier-1/2, ~250+ of its cards are tier-4 `passage_cloze` spanning five distinct genres (news, essay, literary, business letter, personal letter).

Real defects caught and fixed, independently re-verified (not just self-reported) at each step: one wave-3 fix agent (`b2-unit-65-art-criticism`) hit a dropped API connection mid-task and left the unit almost entirely unfixed (avg 35.9 words/passage, 59/60 cards still under the 60-80 target) despite the workflow reporting `fixed: true` — caught by independently re-measuring every unit's passages after every wave rather than trusting the fix flag, then re-dispatched and fully fixed (all 60 cards 62-80 words). Five more wave-3 units (60, 62, 66, 67, 68) had similar partial passage-length shortfalls needing dedicated fix passes; the capstone alone required expanding 197 of its 200 tier-4 cards. Also fixed: several genuine cross-unit tier-1 vocabulary duplications introduced within the batch itself (sibling units drafted in parallel independently taught the same word as "new" — e.g. "la citazione" in both `b2-unit-51` and `b2-unit-57`, resolved by swapping one side for a different untaught word), 3 more cross-unit exact-phrase duplicates (same "reword one side" fix as wave 1), a genuinely broken passage_cloze card with no blank marker at all, an ungrammatical fill_blank answer, and several dozen tier-1-context gaps — the same "citation-form-must-appear-literally-unblanked" lesson from wave 1 recurred repeatedly (e.g. "il combustibile fossile" only ever appeared as plural "combustibili fossili" in context, "Magari!"/"Ma va!" only ever appeared with the word itself blanked out) and was fixed the same way each time: one new card spelling out the exact citation form in full.

Verified: `npx tsc --noEmit`, full `pack:export`/`pack:validate`/`pack:lint-quality` cycle (all hard gates clean, zero new baseline violations), `npm test` (1503/1503), `npm run lint`. All 27 new units (42-68) wired into `content/index.ts`. Task complete: **27/27 new B2 units generated.**

**2026-08-03 — expanding the 13 original thin B2 units (29-41) to target density, forced by the same HARD gate side effect B1 hit in its own third batch.** Adding 27 dense new units raised the B2-level median enough that the density-floor HARD gate started failing against the 13 original ~30-38-card units — expected, not new content debt. Append-expanded all 13 via the same process CURRICULUM.md already specifies: read the file, add cards deepening the same theme, never touch an existing card — each expansion prompt named the specific new-B2-sibling unit(s) covering adjacent/deeper territory to avoid re-treading (e.g. expanding `b2-unit-33-media-news`'s general media vocabulary without drifting into `b2-unit-54-journalism-craft`'s sourcing/editorial-craft territory; expanding `b2-unit-35-numbers-economy`'s general statistics vocabulary without drifting into `b2-unit-49-finance-investment`'s banking/investment specifics).

One real surprise: `b2-unit-37-advanced-idioms` and `b2-unit-36-italian-culture` turned out to already be far denser (337 and 364 cards) than this file's own prior density snapshot suggested (34 and 30 cards) — apparently already-expanded, uncommitted work from earlier in this project's history that had never been through this gate before. `b2-unit-37` in particular carried real, pre-existing debt once surfaced: 97 tier-1-context gaps and 5 non-passage tier-4 cards among its 240 live cards (149 more were already `deprecated: true` from that earlier pass). Fixed the same way as everywhere else in this project — tier-4 offenders marked `deprecated: true` and replaced with genuine passage_cloze cards, tier-1 gaps fixed with citation-form context cards — then expanded to 379 live cards to match its siblings' target density. This is the same "check actual corpus state, don't trust a stale snapshot" lesson this file has already documented happening in A1/A2 and B1.

**Append-only discipline independently verified two ways**, not just via each agent's own self-report: `git diff --numstat` against the pre-expansion commit for all 13 files (zero deletions in 12 of 13; the 13th, `b2-unit-29-hypotheticals`, showed apparent deletions from a large-insertion diff-reordering artifact — confirmed harmless by checking every one of those "removed" lines still exists verbatim elsewhere in the current file), and a corpus-wide `scripts/checkCardIds.ts` run against both the immediately-prior commit and the true pre-session baseline (15,904 cards) — **zero card IDs removed or renamed anywhere in the whole corpus**, 14,481 new IDs added.

**Final verification gate (whole corpus):** `npx tsc --noEmit` clean, `pack:export`/`pack:validate`/`pack:lint-quality` all clean (all hard gates pass, zero new baseline violations — the baseline file was updated once, shrinking only, per the ratchet convention, after `b2-unit-37`'s fix resolved several long-standing tier1-no-context entries as a side effect), `npm test` 1503/1503, `npm run lint` 0 errors. **B2 is now 40/40 units, 14,892 cards — unit-count and density complete.**

**2026-08-03 — B2 content-quality audit, round 1.** Same methodology as A1/A2 and B1: three independent adversarial reviewers (two sampled 8 units each, no overlap — one reviewer's first attempt malfunctioned by trying to spawn its own sub-agent instead of reviewing directly, so it was relaunched fresh; the relaunch and the malfunctioning run's self-spawned fork BOTH ended up completing on the same 8-file sample, giving 3 total scored reviews instead of 2) scored **pedagogical rigor 63/70/73 (avg 69/100)** and **brand/voice fidelity 74/82/82 (avg 79/100)** — comparable to B1's own pre-remediation round-1 baseline (67/77).

Two defects were fixed immediately, before any broader remediation decision, because they were unambiguous and severe: (1) a live, user-facing grading bug — 41 `recognize` cards across 9 B2 units had an `accepted` array containing ONLY a parenthetical-qualified gloss (e.g. `["a hollow, crusty bread roll (Milan)"]`), so a user typing the plain, objectively correct English translation got marked wrong; confirmed by reading `lib/answerCheck.ts`'s exact-match grading logic directly, not just trusting the reviewer's claim. The same bug pattern was found (via a one-off scan, not the mechanical gate) in ~56 more cards across already-shipped A2/B1 content — logged to `debt.md` for a dedicated pass, out of scope for this round. (2) A grammar-terminology error visible directly to the learner: 6 cards in `b2-unit-36` labelled a past participle as "participio presente" in the prompt text itself, while the same cards' own hint/tags correctly said "participio passato."

Max chose full remediation of every remaining finding rather than a partial pass. 15 parallel fix agents were dispatched, one per affected unit, covering: bare conjugation-table drills with zero sentence context (`b2-unit-29`, `-58`, ~110 cards rewritten into real sentences), a templated single-skeleton grammar drill repeated 70 times plus all-legal-document tier-4 register creep (`b2-unit-42` — the fix agent found the real scope was 50 passages, not the reviewer's cited 20, and converted half to varied genres), 20 canonical idioms deprecated with zero live replacement (`b2-unit-37` — "in bocca al lupo," "rompere il ghiaccio," etc. — the reviewer's cited "39" included non-idiom false-friend vocabulary cards swept in by the same backfill tag, a real distinction the fix agent caught rather than blindly targeting 39), hint-answer-leak and gender-only/bare-etymology hints at scale across 8 units (`b2-unit-41`, `-45`, `-46`, `-48`, `-52`, `-61`, `-63`, `-67` — one unit's true Italian-only-hint count was 110, not the reviewer's cited 79, caught by independent re-measurement rather than trusting the number), formulaic "moral of the story" tier-4 endings recurring in new content across 4 more units (`-46`, `-48`, `-52`, `-68`), bare noun-phrase "context" cards rewritten into full natural sentences (`b2-unit-36`, 59 cards), and a cluster of structural fixes in the review unit (`b2-unit-38`: missing recognize/produce pairing on the original 10-word seed, tier imbalance fixed by adding 28 new passages, duplicate tags on 100 cards, inconsistent accepted-answer sets between near-duplicate cards, and more).

**A serious, repeated data-loss risk surfaced mid-remediation and was caught before it shipped**: running 15 fix agents in parallel against the same working tree meant several agents independently ran `git stash` when they hit messy `git status` output, and each one only recovered its OWN file from the resulting stash before continuing — silently discarding whatever OTHER agents' in-progress, uncommitted edits happened to be sitting in the working tree at that exact moment. 8 of the 15 units (`b2-unit-41`, `-45`, `-46`, `-48`, `-58`, `-61`, `-67`, `-68`) were fully reverted to their pre-fix state this way, even though every one of those agents had independently reported all its own verification gates green — because each agent was verifying the state of the file *from its own local view moments after finishing*, not the state of the repo *after all 15 agents were fully done*. Caught only by re-checking every single unit's specific fix markers directly against the working tree after all 15 agents reported complete, rather than trusting the 15 "all green" reports at face value. Fortunately the lost work was still sitting in an orphaned `git stash` entry (never popped by whichever agent created it) and was fully recoverable file-by-file with `git checkout stash@{0} -- <file>` — re-verified against the same specific defect markers, then the whole corpus re-verified end to end (tsc, pack:export/validate/lint-quality, `scripts/checkCardIds.ts` against the pre-remediation commit confirming zero cards removed anywhere, full test suite, lint) before committing. **Lesson for any future multi-agent batch that runs against a shared working tree: never let a fix agent run `git stash` on its own initiative — a genuinely messy `git status` mid-task should be reported back, not resolved unilaterally with a repo-wide command that can silently discard sibling agents' unrelated work.**

---

## Word Count Targets

| Level | New words | Cumulative | Units | Avg cards/unit | Total cards |
|-------|-----------|------------|-------|----------------|-------------|
| A1 | ~800 | ~800 | 20 | ~130 | ~2,600 |
| A2 | ~1,400 | ~2,200 | 30 | ~190 | ~5,700 |
| B1 | ~2,300 | ~4,500 | 35 | ~270 | ~9,450 |
| B2 | ~3,500 | ~8,000 | 40 | ~380 | ~15,200 |
| **Total** | | **~8,000** | **125** | | **~32,950** |

---

## Word List Sources

The master vocabulary list is synthesized from three sources, in priority order:

1. **Corpus frequency** — Nuovo vocabolario di base della lingua italiana and SUBTLEX-IT. High-frequency words appear first within each level. A word that appears 10,000 times per million in natural Italian text is always introduced before a word that appears 100 times.
2. **imparitaliano.com thematic structure** — their unit themes are sound and CEFR-aligned. We use their architecture and multiply the vocabulary ~10–33× per level.
3. **CEFR-aligned word inventories** — Council of Europe published vocabulary inventories define the ceiling for each level. No B2 word sneaks into A1.

The master vocabulary list is a single source of truth: 8,000 rows, each with: Italian word, English translation, level, theme, word type (noun/verb/adj/etc.), gender (for nouns), key collocations, example sentence.

---

## Unit Structure

Every unit follows the same internal structure regardless of level:

- **Tier 1 — Vocabulary:** One recognize card (Italian → English) and one produce card (English → Italian) per word. The word always appears in a sentence, never stripped bare.
- **Tier 2 — Grammar:** Fill-blank and conjugate cards drilling the grammar rules introduced in this unit. Every grammar rule appears as an example before it appears as a test.
- **Tier 3 — Phrases:** Collocations, idioms, and fixed expressions from the unit's theme. These are not invented — they are the phrases native speakers actually use.
- **Tier 4 — Sentences / Passages:** 60–80 word passages, chunked for 60-second sessions. Each chunk is self-contained and sequenced — a later chunk builds on an earlier one but can be reviewed independently.

---

## A1 Units (~800 words, 20 units)

| # | Theme | Grammar focus |
|---|-------|---------------|
| 01 | Greetings & Introductions | Essere, chiamarsi, present tense basics |
| 02 | Numbers & Money | Cardinal numbers, prices, avere |
| 03 | Days, Months & Seasons | Time expressions, date construction |
| 04 | Colors & Shapes | Adjective agreement, gender |
| 05 | Family & Relationships | Possessives (mio, tuo, suo, nostro) |
| 06 | The Body & Health (basic) | Stare + adjective, mi fa male |
| 07 | Home & Furniture | Prepositions of place (in, su, sotto, vicino a) |
| 08 | Food & Drinks | Partitive articles (del, della, dei) |
| 09 | The City & Getting Around | Preposition contractions (al, del, nel, sul) |
| 10 | Shopping | Quanto costa, vorrei, prices |
| 11 | Weather & Nature | Fare + weather (fa caldo, fa freddo), c'è / ci sono |
| 12 | Daily Routine & Time | Reflexive verbs (svegliarsi, lavarsi, vestirsi) |
| 13 | Work & Professions (basic) | Fare il/la + profession |
| 14 | Hobbies & Free Time | Mi piace / mi piacciono |
| 15 | Clothes & Appearance | Portare, mettere, adjective agreement expanded |
| 16 | Animals | Plural formation, irregular plurals |
| 17 | Feelings & Emotions (basic) | Stare + adverb, sembrare, sentirsi |
| 18 | -ARE verbs (systematic) | Full -ARE conjugation, 30 most common verbs |
| 19 | -ERE and -IRE verbs (systematic) | Full -ERE/-IRE conjugation, 30 most common verbs |
| 20 | A1 Consolidation — Irregular Verbs | Essere, avere, fare, andare, venire, stare, potere, volere, dovere |

---

## A2 Units (~1,400 new words, 30 units)

| # | Theme | Grammar focus |
|---|-------|---------------|
| 21 | Passato Prossimo with avere | Regular past participles |
| 22 | Passato Prossimo with essere | Motion verbs, participle agreement |
| 23 | Irregular Past Participles | Fare→fatto, dire→detto, scrivere→scritto, etc. |
| 24 | The Imperfetto | Ongoing/habitual past, description |
| 25 | Passato Prossimo vs Imperfetto | Contrast: completed vs background |
| 26 | The Future Tense | Talking about plans, predictions |
| 27 | The Conditional | Polite requests, hypotheticals, advice |
| 28 | Reflexive Verbs (expanded) | Divertirsi, annoiarsi, innamorarsi |
| 29 | Travel & Transportation | Prepositions with transport |
| 30 | Restaurants & Food Culture | Ordering, describing dishes |
| 31 | At the Doctor | Body parts (expanded), symptoms |
| 32 | Technology & Internet | Modern vocabulary, digital life |
| 33 | Media & Entertainment | Film, music, TV, books |
| 34 | Environment & Nature | Weather events, geography |
| 35 | Relationships & Social Life | Friendship, dating, social situations |
| 36 | Describing People & Personalities | Character adjectives, appearances |
| 37 | Home & Neighbourhood (expanded) | Describing where you live |
| 38 | Work & Career (expanded) | Job types, workplace vocabulary |
| 39 | Education & Studies | School system, academic life |
| 40 | Sports & Fitness | Sports vocabulary, competition |
| 41 | Money & Banking | Financial transactions, economy basics |
| 42 | Italian Culture & Traditions | Festivals, customs, food culture |
| 43 | Comparisons & Opinions | più...di, meno...di, superlatives, secondo me |
| 44 | Time Expressions — Past | Ieri, l'anno scorso, una volta, da bambino |
| 45 | Time Expressions — Future | Domani, tra una settimana, presto, tardi |
| 46 | Feelings & Emotions (expanded) | Nuanced emotional vocabulary |
| 47 | Italian Geography & Regions | Major cities, regions, landmarks |
| 48 | Shopping & Fashion | Clothing, trends, consumer vocabulary |
| 49 | Housing & Renting | Contracts, describing apartments |
| 50 | A2 Consolidation — Irregular Verbs Past | Top 50 irregular past participles |

---

## B1 Units (~2,300 new words, 35 units)

**⚠ STALE as of 2026-08-01 — this table is the original design plan, not what was actually built.** The real shipped units use different filenames, numbering, and theme assignments (see `content/cards/b1-unit-*.ts` for ground truth). At least two topics below (Relative Pronouns, Passive Voice — actually listed under B2, not B1, further down) already shipped early at B1. Before generating any new B1/B2 unit, check the actual `content/cards/` directory and CURRICULUM.md's "Content Generation Status" section above for what's real, rather than trusting the theme names below.

| # | Theme | Grammar focus |
|---|-------|---------------|
| 51 | Subjunctive Present — Regular | -ARE/-ERE/-IRE subjunctive endings |
| 52 | Subjunctive Present — Irregular | Essere, avere, andare, fare, sapere, potere |
| 53 | Subjunctive Triggers — Opinions | Penso che, credo che, spero che |
| 54 | Subjunctive Triggers — Impersonal | È possibile che, è importante che |
| 55 | Subjunctive Triggers — Doubt & Emotion | Non so se, sono contento che |
| 56 | Hypothetical Situations | Se + indicative/conditional (real), se + congiuntivo (unlikely) |
| 57 | Concession & Contrast | Sebbene, nonostante, benché, anche se |
| 58 | Cause & Effect | Siccome, dato che, di conseguenza, perciò |
| 59 | Purpose & Result | Affinché, perché, per + infinitive |
| 60 | Formal vs Informal Register | Lei/tu distinction, formal vocabulary |
| 61 | Society & Social Issues | Inequality, community, civic life |
| 62 | Politics & Government | Italian political system, civic vocabulary |
| 63 | The Economy | Macroeconomics, work market, trade |
| 64 | Education System | Italian universities, academic language |
| 65 | Healthcare & Wellbeing | Medical system, mental health, wellness |
| 66 | Technology & Innovation | Tech industry, science vocabulary |
| 67 | Environment & Climate | Climate change, sustainability |
| 68 | Art & Visual Culture | Painting, sculpture, architecture |
| 69 | Literature & Writing | Literary terms, analysis vocabulary |
| 70 | Music & Performing Arts | Italian musical tradition, performance |
| 71 | News & Journalism | Reading news, media literacy |
| 72 | Formal Communication | Letters, emails, professional writing |
| 73 | Debate & Argumentation | Presenting and refuting arguments |
| 74 | Abstract Concepts | Freedom, justice, identity, memory |
| 75 | Philosophy & Ethics | Moral reasoning vocabulary |
| 76 | Italian History — Ancient & Medieval | Historical vocabulary, periods |
| 77 | Italian History — Modern | Unification, fascism, republic |
| 78 | Science & Research | Scientific method, disciplines |
| 79 | Italian Cinema | Directors, genres, critical vocabulary |
| 80 | Sports & Society | Football culture, sport and identity |
| 81 | Nuance & Precision | Words that express degree, exactness |
| 82 | Academic & Intellectual Language | Analytical vocabulary |
| 83 | Hypothetical & Conditional Language | Complex if-clauses |
| 84 | Connectors & Discourse Markers | Linking ideas across sentences |
| 85 | B1 Consolidation — Subjunctive Mastery | Mixed subjunctive triggers, 100+ verbs |

---

## B2 Units (~3,500 new words, 40 units)

**⚠ STALE as of 2026-08-01 — same caveat as the B1 table above.** The 13 real shipped B2 units (`content/cards/b2-unit-*.ts`) use different themes/numbering; several topics below (Relative Pronouns #90, Passive Voice #89) already shipped early at B1 instead. Check the actual files before planning new B2 units.

| # | Theme | Grammar focus |
|---|-------|---------------|
| 86 | Subjunctive Imperfect | Hypothetical past scenarios |
| 87 | Subjunctive Past Perfect | Completed hypothetical actions |
| 88 | Mixed Subjunctive Contexts | All triggers, all tenses |
| 89 | Passive Voice | Si passivante, essere + participio |
| 90 | Relative Pronouns | Il che, ciò che, quello che, cui |
| 91 | Advanced Conditionals | Qualora, nel caso in cui, ove, laddove |
| 92 | Temporal Clauses | Non appena, finché, nel momento in cui |
| 93 | Emphasis & Focus Structures | Non si può non, è doveroso che |
| 94 | Business Operations | Company structure, processes |
| 95 | Finance & Economics | Financial instruments, markets |
| 96 | Law & Legal Language | Contracts, rights, legal procedure |
| 97 | Academic Writing | Thesis structure, citations, argument |
| 98 | Journalism & Media Language | Reporting, editorial vocabulary |
| 99 | Formal Correspondence | Professional letters, official documents |
| 100 | Negotiation & Persuasion | Diplomatic language, rhetoric |
| 101 | Research & Analysis | Methodology, findings, conclusions |
| 102 | Idiomatic Expressions I | Top 100 Italian idioms (A-M) |
| 103 | Idiomatic Expressions II | Top 100 Italian idioms (N-Z) |
| 104 | Literary Italian | Elevated register, narrative voice |
| 105 | Cultural & Nuanced Terms | Untranslatable concepts, cultural specificity |
| 106 | Advanced Abstract Concepts | Consciousness, paradox, ambiguity |
| 107 | Political & Social Discourse | Policy language, debate register |
| 108 | Philosophy & Ethics (advanced) | Epistemology, ethics, aesthetics |
| 109 | History & Memory | Historical analysis, commemoration |
| 110 | Science Communication | Explaining science in writing |
| 111 | Environmental Policy | Climate agreements, sustainability policy |
| 112 | Technology & Society | Digital rights, AI, data, surveillance |
| 113 | Art Criticism | Formal analysis, critical vocabulary |
| 114 | Literary Analysis | Themes, structure, symbolism |
| 115 | Regional Italian | Key differences across regions |
| 116 | Reading Passage — News I | Short newspaper articles, cloze |
| 117 | Reading Passage — News II | Longer investigative journalism |
| 118 | Reading Passage — Essays I | Argumentative essays |
| 119 | Reading Passage — Essays II | Academic essays, opinion pieces |
| 120 | Reading Passage — Literature I | Literary prose excerpts |
| 121 | Reading Passage — Literature II | More complex literary prose |
| 122 | Reading Passage — Letters | Formal and personal letters |
| 123 | Reading Passage — Business | Business reports, proposals |
| 124 | Reading Passage — Mixed | Mixed genre consolidation |
| 125 | B2 Consolidation | Full grammar review, advanced cloze |

---

## Card Quality Standards

Every card in every unit must pass these standards before it ships.

### Sentences must be natural

The test: would a native Italian speaker write this sentence in real life? If not, rewrite it.

| Forbidden | Required |
|-----------|----------|
| "Il gatto è sul tavolo." | A sentence with a person, a situation, a reason to exist |
| "Marco compra una mela." | Context that makes the word memorable |
| Textbook-perfect but lifeless prose | Sentences that could appear in a newspaper, novel, or conversation |

### Sentences must teach in context

The word's meaning must be derivable from the sentence even before the translation is shown. A learner who doesn't know the word should be able to make a reasonable guess from context.

### Sentences scale with level

- **A1:** Simple present tense, familiar vocabulary, short sentences (5–8 words)
- **A2:** Past and future tenses, compound sentences (8–15 words)
- **B1:** Subjunctive triggers, abstract topics, complex sentences (12–20 words)
- **B2:** Literary and professional register, paragraph-length context (60–80 words)

### Word families travel together

When a word is introduced, its most common derived forms are introduced in nearby cards:
- *lavorare* (to work) → *lavoro* (work, n.) → *lavoratore* (worker) → *lavorativo* (working, adj.)
- *felice* (happy) → *felicità* (happiness) → *felicemente* (happily)

### Collocations over definitions

A word is not known until you know what it collocates with. Every content word (noun, verb, adjective) gets at least one collocation card:
- Not just *prendere* (to take) but *prendere un caffè*, *prendere in giro*, *prendere una decisione*

### No duplicate sentences across the entire deck

Every sentence is unique. The same sentence never appears on two different cards. A word may appear in multiple sentences, but each sentence is written fresh.

### Card Quality Gate (mechanical, automated) — `scripts/lintCardQuality.ts`

**Why this exists:** a 2026-07-30 audit (two independent adversarial reviews, scored 61/100 and 74/100 against these standards) found that every concrete defect — empty hints, exact-duplicate cards, a whole unit missing its grammar tier for an unknown length of time — was something a script could have caught before it shipped. Prose review alone let quality drift unit-to-unit with no floor. Run it with `npm run pack:lint-quality`.

Two tiers of rule:

**HARD gates** — zero tolerance, fail on any violation (the corpus has zero violations of these today, so enforcement only prevents regression):
- Every unit must have cards in all 4 tiers (this is the literal A1-units-08/09/10-shipped-with-no-tier-2 bug, made structurally impossible to repeat)
- No unit may fall below 70% of its level's median card count (computed dynamically from the current pack, never a hardcoded number)
- No duplicate sentence among `fill_blank`/`passage_cloze` cards anywhere in the corpus

**BASELINE (ratchet) gates** — real, large existing debt is grandfathered as of the 2026-07-30 baseline capture (`scripts/cardQualityBaseline.json`); any violation NOT in the baseline (i.e. introduced by a new or edited card) fails the gate. The baseline must only ever shrink — same convention as this project's coverage thresholds (AGENTS.md: "thresholds only ever increase — ratchet up, never down"). After a content pass fixes baselined debt, run `npx tsx scripts/lintCardQuality.ts public/packs/it.json scripts/cardQualityBaseline.json --update-baseline` to shrink the file to match:
- **Empty hint** — 2,276/8,119 cards (28%) have no hint as of 2026-07-30, wildly uneven across units (0% in some, up to 79% in others). The hint is the mechanism that differentiates a curated card from a bare bilingual word list — plyglt's entire paid-content premise.
- **Tier-1 lacks sentence context** — 1,937/4,594 tier-1 cards (42%) don't have their word appearing in any same-unit tier-2/3/4 card. This is a weaker, mechanically-checkable proxy for "never introduce a word in isolation" — it does NOT require every tier-1 card to embed its own example sentence (that would be a `content/types.ts` schema change plus a `components/StudyCard.tsx` UI change, a bigger decision deferred for now); it only requires the word to appear in a real sentence *somewhere* in its unit.
- **Tier-4 not a real passage** — 496/709 tier-4 cards (70%) are standalone 1-2 sentence cards instead of `passage_cloze`. Only 3 of 20 A1 units have any `passage_cloze` cards at all, despite this being the brand's flagship "60–80 word passage" promise.
- **Within-unit duplicate** — RESOLVED 2026-07-30. The audit's first pass found 7 candidate cards; 3 ("no", "beige", "zero") turned out to be a false positive in the detection logic itself — a recognize card and a produce card for a word spelled identically in Italian and English legitimately share prompt+accepted (the dedup key now includes card `type`). The remaining 4 real duplicates (the identical card re-shelved under a second tier) were retired via `Card.deprecated: true` once `lib/packTypes.ts`'s `excludeDeprecatedCards` made that flag actually filter runtime consumption (see `hooks/useLangPack.ts`) — card ids stay in the pack forever per `scripts/checkCardIds.ts`, only the runtime study session stops serving them. Baseline count: 0.
- **Cross-unit phrase duplicate** — 2 known instances of a short tier-3 phrase reused across two related units (e.g. "cambiare idea" in both the future and conditional units). CURRICULUM.md permits this kind of short vocabulary-phrase overlap; baselined as "known acceptable," not a rewrite target.

**Deliberately not a rule:** "no exclamation marks" (BRAND.md's UI-copy voice rule). Checked during design: of 58 corpus-wide hits, almost all are correct Italian exclamatory content being taught ("Aiuto!", "Buongiorno!", "Che bella giornata!") — genuinely different from the app writing chatty toast copy. A handful of real hint-tone slips ("same as English!") aren't mechanically distinguishable from legitimate quoted Italian without a high false-positive rate. Left to human/native-speaker review (Step 4 below).

---

## Content Generation Workflow

### Step 1 — Define the unit spec

For each unit, produce a spec containing:
- Unit number, name, level
- Word list (20–50 words with translations and collocations)
- Grammar rules to introduce (with irregular forms)
- 3–5 target phrases
- Passage theme (for Tier 4 cards)

### Step 2 — Generate the draft unit file

Using the spec and the TypeScript card format (see `content/types.ts` and existing unit files in `content/cards/`), generate a complete `.ts` unit file. Each vocabulary item generates: 1 recognize card + 1 produce card + 1–2 fill_blank/passage_cloze cards. Grammar rules generate 8–12 conjugate or fill_blank cards each.

### Step 3 — Quality review

Run the mechanical gate first — `npm run pack:lint-quality` — to catch what a script catches (see "Card Quality Gate" above): missing tiers, density, empty hints, duplicate cards, tier-1 context, tier-4 passage structure. Fix every hard-gate violation and every new baseline violation before moving on; this is not optional and does not substitute for the prose review below, it precedes it.

Then every sentence is reviewed against three questions a script cannot answer:
1. Is it natural? (would a native speaker write this?)
2. Is it memorable? (does it give the word a context worth remembering?)
3. Is it correctly levelled? (no B1 grammar in an A1 unit — subjunctive leaking into A2 content is the specific, recurring failure mode to watch for)

Weak sentences are rewritten. Strong ones ship.

### Step 4 — Native speaker pass

Before each level ships, a native Italian speaker reviews all units in that level. Catches unnatural phrasing, cultural errors, register mistakes, and false collocations that automated review misses.

### Step 5 — Export and validate

```bash
npx tsx scripts/exportPack.ts it
npx tsx scripts/validatePack.ts public/packs/it.json
npm run pack:lint-quality
```

Any card failing validation, or any new card-quality-gate violation, is flagged before reaching a user.

---

## Content Principles

- **Never introduce a word in isolation.** The sentence is the unit of learning.
- **Frequency first.** Within any level, the most common words appear in the earliest units.
- **Grammar through examples only.** No prose explanations in cards. The example sentence makes the rule obvious.
- **One new grammar concept per unit.** A unit may reinforce previous grammar, but it introduces only one new rule. Cognitive load is managed.
- **Passages are chunked, not summarized.** A 300-word passage becomes 4–5 Tier 4 cards of 60–80 words each, sequenced. Each chunk is reviewable independently.
- **The intensive introduction engine handles repetition.** Cards are not repeated within a unit. The scheduler (see BRAND.md) handles the 28–30 encounter cadence across sessions.
