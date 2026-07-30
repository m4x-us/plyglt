# plyglt — Curriculum

## The Goal

**8,000 Italian words. A1 through B2. ~33,000 cards.**

A B2 graduate can understand the main ideas of complex texts on both concrete and abstract topics, write clear and detailed texts across a wide range of subjects, and articulate viewpoints and arguments in writing. That is the ceiling plyglt targets — nothing less, nothing more.

The curriculum is structured around four CEFR levels, each broken into thematic units. Every unit contains all four card tiers. Every word appears in natural, contextual sentences — never isolated, never textbook-sterile.

---

## Content Generation Status (updated 2026-07-30)

**A1 and A2 are at full target CARD-COUNT density, including a 2026-07-30 backfill pass that fixed 6 units audited as thinner than their siblings (3 of them, A1 units 08/09/10, had ZERO tier-2 grammar cards despite each unit's whole theme being a grammar point — modal verbs, adjective agreement, "mi fa male"). But a same-day content-quality audit (see below) found A1/A2 are NOT yet "done" in the sense of matching the Card Quality Standards further down this file — real, measured gaps remain. B1 and B2 are NOT started (still at old, thin density).**

| Level | Units | Cards | Target cards | Status |
|-------|-------|-------|--------------|--------|
| A1 | 20/20 | 2,434 | ~2,600 | Card count at target; quality gate debt tracked (see below) — backfilled units 08, 09, 10, 12, 19 (2026-07-30) |
| A2 | 30/30 | 4,830 | ~5,700 | Card count at target; quality gate debt tracked (see below) — backfilled unit 38 (2026-07-30) |
| B1 | 14/35 | 444 | ~9,450 | NOT STARTED — 21 units missing; the 14 existing units are thin (~32 cards/unit avg, need expanding to ~270/unit) |
| B2 | 13/40 | 411 | ~15,200 | NOT STARTED — 27 units missing; the 13 existing units are thin (~32 cards/unit avg, need expanding to ~380/unit) |
| **Total** | **77/125** | **8,119** | **~32,950** | ~25% of the way to the full target by card count |

**2026-07-30 backfill note:** a per-unit density audit (comparing each unit's card count and tier breakdown against its siblings, not just the level-wide total) found that the level-wide totals above were masking real gaps: 6 units (A1: 08, 09, 10, 12, 19; A2: 38) were meaningfully thinner than their peers, and three of them (A1 08/09/10) had never had a single tier-2 (grammar) card written despite each unit's theme *being* a grammar point. All 6 were expanded append-only (verified via `git diff` showing zero modified/deleted lines among original cards, beyond two stale placeholder comments), re-validated (`tsc`, full test suite, `pack:export`/`pack:validate`, corpus-wide duplicate-sentence and duplicate-ID scans — all clean), then committed. Lesson for future audits: check per-unit density and tier balance, not just the level-wide card-count total — a healthy aggregate can hide individually thin or structurally incomplete units.

**2026-07-30 content-quality audit note:** immediately after the backfill above, Max asked the harder question — is this content actually worldclass, not just at-target by card count. Two independent adversarial reviews (an 8-unit, 1,168-card representative sample, cross-checked against the full 8,119-card corpus for the structural claims) scored pedagogical rigor 61/100 and brand/voice fidelity 74/100. Real, verified findings: only 3 of 20 A1 units have any `passage_cloze` tier-4 cards at all (the rest substitute short standalone sentences, missing BRAND.md's "60-80 word passage" promise entirely); 42% of tier-1 cards corpus-wide don't have their word appearing in any sentence card in their own unit; subjunctive grammar leaks into A2 content in at least 2 units (a recurring failure mode CURRICULUM.md already names); 28% of cards corpus-wide have no hint, wildly unevenly distributed (0% in some units, 79% in one); a handful of verbatim duplicate cards; one real Italian spelling error. This resulted in `scripts/lintCardQuality.ts`, a mechanical Card Quality Gate (see the Card Quality Standards section below) that makes the cheap-to-check defects (empty hints, duplicates, missing tiers) structurally impossible to repeat, and grandfathers the larger structural debt (tier-1 context, tier-4 passages) as a tracked, shrinking baseline rather than a blocking rewrite. The tier-1/tier-4 backfill itself is a separate, large future content project — not done as part of this session (see `.autocode/agents/cto.md`'s Strategic Priorities).

**Owner decision (2026-07-29/30):** the actual shipped curriculum had drifted far below this file's original density targets — existing units averaged ~30-40 cards each versus the ~130-380/unit targets in the table below. Max explicitly chose to hit the ORIGINAL card-count targets (not just "write the missing units at whatever density"), which means every existing thin unit needs expansion too, not just the ~62 missing units.

**The process that worked for A1/A2 (repeat this for B1, then B2):**
1. **New units**: for each missing unit, generate the complete file from scratch at full target density (~190 cards for A2, ~270 for B1, ~380 for B2) in one pass, following the exact schema in `content/types.ts` and the Card Quality Standards below. Batch 5-10 units per run.
2. **Existing thin units**: for each already-shipped unit, an agent reads the file, identifies what's already taught, and APPENDS new cards deepening the same theme/grammar point — never modifying or deleting an existing card. Verify this with a byte-identical diff check against the pre-expansion git commit for every original card, not just by trusting the agent's own report.
3. **Review**: every generated/expanded unit gets an independent adversarial review pass checking: card count vs. target, ID sequencing/uniqueness, schema correctness, natural-sentence quality, no duplicate sentences (within the file AND against a corpus-wide scan — short vocabulary-phrase overlaps between related units are fine; duplicated *invented example sentences* are not), and correct grammar level for the CEFR tier.
4. **Integration**: wire new unit files into `content/index.ts` (import + add to `ALL_UNITS` array, in level order), then run `npm run pack:export`, `npm run pack:validate`, `npx tsc --noEmit`, and `npm test` before committing.
5. This was done via a multi-agent workflow (parallel generation + review agents) — see git log around 2026-07-30 (`content: add ... A2 units` commits) for the exact prompts used; they're reusable as a template for B1/B2.

Real bugs the review passes actually caught and fixed (so future passes know what to watch for): subjunctive grammar leaking into A2-level content, mistranslated accepted-answer variants, fill_blank cards testing words never taught in their own unit, dangling/wrong prerequisite card-ID references, gender-mismatched accepted answers, self-contradictory example sentences, and unnatural preposition choices.

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
- **Within-unit duplicate** — 7 cards (2026-07-30) are the identical card re-shelved under a second tier. Not yet auto-removable: card IDs are permanent (`scripts/checkCardIds.ts`) and the schema's `deprecated` flag, while present on `Card`, has no runtime consumer yet — nothing in `lib/queue.ts` or `store/srsStore.ts` filters it out, so marking a card `deprecated: true` today would not actually stop it from being shown. Wiring that up is a separate, tracked task.
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
