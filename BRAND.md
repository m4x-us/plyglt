# plyglt — Brand

## The Name

**plyglt** is a coded shortening of *polyglot*. Deliberate: someone who reads well in multiple languages parses it immediately. A newcomer has to work it out. That tension is the product.

---

## What plyglt Is

plyglt is a **retention tool**. It makes everything you're learning in a language actually stick.

The core mechanic is FSRS v4 — a scientifically-validated spaced repetition algorithm that schedules cards at exactly the moment your memory is about to fade. Not arbitrary daily minimums. Not streaks for their own sake. The math decides when you review, and you remember more with less time.

The curriculum moves in four tiers, bottom to top:

1. **Vocabulary** — single words and their meanings
2. **Grammar** — how the language bends and conjugates
3. **Phrases** — multi-word chunks, idioms, fixed expressions
4. **Sentences** — full clauses, reading in context (passage cloze)

This is not a metaphor. These are the four card types in the codebase. Every card has a tier. The scheduler surfaces tier 1 before tier 2. You build from the ground up.

---

## The Goal: B2 Reading and Writing

plyglt targets **B2 under the CEFR framework** — specifically reading and writing. Not speaking. Not listening.

At B2, a learner can:
- Understand the main ideas of complex texts on both concrete and abstract topics
- Write clear, detailed texts across a wide range of subjects
- Articulate viewpoints, argue specific points, and explain the advantages and disadvantages of various options in writing

This is not the level of a native speaker. It is the level where you stop being a tourist in the language — where you read something real and understand the argument, and write something real and are understood clearly.

plyglt does not promise or target speaking fluency, listening comprehension, or conversational ability. Those are different skills requiring different tools.

---

## Who It's For

The primary user has already tried Duolingo. They liked it. They hit a wall. They realized they could finish a lesson and forget everything an hour later. They want the vocabulary to actually stay.

They may also have heard of Anki. They looked at it, felt lost, and closed the tab.

**Before plyglt:** They're studying — classes, apps, maybe a tutor. Input is happening. But when they look at a real article in the target language, they understand almost nothing. The input never converted to retention.

**After:** They work through the four tiers, review on schedule, and the vocabulary accumulates. At B2, they read complex texts without a dictionary and write clearly without translation software.

plyglt is **Anki for people who didn't set up Anki** — zero configuration, curated content, a clean interface that gets out of the way.

---

## How plyglt Sits in the Ecosystem

plyglt does not compete with Duolingo, Babbel, italki, or a classroom. It **subsidizes** all of them. Whatever you're doing to learn a language — a course, an app, a tutor, a textbook — plyglt is the retention layer underneath that makes everything you encounter consolidate into long-term memory.

Use Duolingo for exposure. Use plyglt to remember it.

The direct competitor is **Anki**: same job to be done (spaced repetition), different execution (curated content, no setup, designed for people who aren't already obsessed with learning systems).

---

## The Stress-Free Principle

plyglt is **light, calm, and pressure-free**. Language learning is a long game — anxiety is the enemy of consistency.

**There are no overdue cards.** Cards are always "ready" — never "overdue," never "late," never a debt owed. FSRS tracks optimal timing internally, but from the user's perspective, cards simply become available when the moment is right. There is no backlog. There is no wall of shame.

**Vacation mode** exists for exactly this reason. Return after two weeks away and the scheduler redistributes quietly across the coming days. You never open the app to a number that makes you want to close it again.

plyglt never makes you feel behind.

---

## Pricing Model

The core philosophy: **the knowledge is free; the system that makes it automatic is not.**

Content is never the paywall. Every language, full A1–B2 curriculum, is free forever. The paid tier is purely about the software experience — proactivity, sync, and staying current.

**No lifetime subscriptions.** plyglt runs on iOS, iPadOS, Android, Mac, Windows, and Linux. Sync requires infrastructure. Lifetime pricing cannot cover perpetual server costs. Pro is monthly or annual only.

| | Free | Pro |
|---|---|---|
| Every language, full A1–B2 | ✓ | ✓ |
| Core SRS engine | ✓ | ✓ |
| Manual open (desktop) | ✓ | ✓ |
| Desktop app (Mac, Windows, Linux) | ✓ | ✓ |
| Critical bug and security fixes | ✓ | ✓ |
| Software updates and new features | — | ✓ |
| New language packs added after download | — | ✓ |
| Proactive interruption engine | — | ✓ |
| Sync across all devices | — | ✓ |
| iOS, iPadOS, Android apps | — | ✓ |
| Forecast ("B2 in ~7 months at current pace") | — | ✓ |
| Vacation mode | — | ✓ |
| Analytics | — | ✓ |
| Custom cards | — | ✓ |

Free users get the version they downloaded, frozen in time. Paid users stay on the moving train.

---

## What plyglt Is Not

Deliberate product constraints — not future features:

- **Not for speaking or listening.** No audio production, no pronunciation grading, no conversation simulation.
- **No social features or leaderboards.** Language learning is personal. Competition between strangers adds noise without adding recall.
- **No grammar lectures.** plyglt is a practice tool, not a classroom. Users learn grammar rules elsewhere; plyglt drills the patterns until they're automatic.
- **No ads.** Ever. The user is the customer.
- **No overdue cards.** Cards are ready. Never overdue.

Streaks exist as a light continuity indicator. They are not weaponized: no streak-loss notifications, no pressure mechanics.

---

## The Proactive Interruption Model

Most apps wait for you to open them. plyglt interrupts your workday with a short review session — a tray notification, a mandatory overlay, 3–5 cards. Each session lasts 30–60 seconds.

On desktop (Mac, Windows, Linux) via Tauri, plyglt can interrupt on a schedule, on computer unlock, or when idle time is detected. On mobile, push notifications serve the same function. Pro feature on all platforms.

### The science behind 60-second sessions

**Distributed practice beats massed practice.** Cepeda et al. (2006, 2008) demonstrated that spreading reviews across time produces significantly better long-term retention than an equivalent amount of massed study. Ten 60-second sessions through the day outperform one 10-minute block, even at identical total study time.

**The testing effect makes retrieval the event.** Roediger & Karpicke (2006) showed that the act of retrieving a memory — regardless of session length — is what strengthens it. A 60-second burst is a series of retrieval events. Duration is irrelevant once retrieval happens.

**Cognitive load theory supports small batches.** Working memory holds roughly 7 items (Sweller). A 3–5 card burst stays well within that limit. Longer sessions push past it — performance degrades as cognitive load accumulates toward the end.

**FSRS makes this exceptionally powerful.** plyglt's interruptions trigger retrieval at the exact moment before forgetting. The timing does the work, not the session length. A 60-second retrieval at the right moment is maximally effective. A 60-minute session at the wrong moment is largely wasted.

The result: 6–10 minutes of language learning distributed as 6–10 interruptions across the workday — enough to reach B2 in 2.5 years (~73 total hours of targeted practice), more effective per minute than any single focused session, and sustainable indefinitely.

### The ultra-intensive introduction phase

Every new word, grammar rule, or passage is introduced within the 60-second interrupt window — no separate study sessions required. New content appears in context with its answer shown on first exposure, then immediately tested. All introduction and review happens in the same 60-second format.

Once introduced, new content enters an ultra-intensive repetition phase before graduating to the standard FSRS schedule.

**Introduction cadence:**

| Day | Appearances | Notes |
|-----|-------------|-------|
| Day 1 | Every interrupt — 6–10× | Varied format each time |
| Day 2 | Every other interrupt — 3–5× | |
| Days 3–5 | 2× per day | |
| Days 6–10 | 1× per day | |
| Days 11–21 | Every other day | |
| Day 22+ | FSRS takes over | Normal expanding intervals |

**~28–30 encounters in the first three weeks** before graduating to FSRS. Nation (2001) and subsequent vocabulary acquisition research identifies this range as the threshold for deep productive ownership — not just recognition, but automatic recall.

**The variety rule.** Each encounter uses a different retrieval angle: produce, recognize, fill-blank in a new sentence, translate cold. Identical repetition produces shallow encoding. Varied retrieval across encounters produces durable memory.

**Graduation requires performance, not time.** A card graduates after 15 consecutive correct retrievals across varied formats. Time alone does not advance it.

**Wrong-answer rules:**

| Failure | Response |
|---------|----------|
| Wrong once | Consecutive counter resets, card returns to Day 2 intensity |
| Wrong 3× in a row | Resets to Day 1 — appears in every interrupt again |
| Wrong across multiple days | New card introductions pause until this one stabilizes |

**One new card introduced per day maximum.** On any given day, several cards are at different intensive stages — one at Day 1 appearing 8 times, one at Day 6 appearing twice, one at Day 15 appearing once — plus FSRS reviews. Sessions stay at 60 seconds because the daily new card load is hard-capped.

### The session timer

Every interrupt session displays a thin progress bar — elapsed time, not a countdown. It fills left to right over 60 seconds. No number. No alarm. Just a visible confirmation that this is, genuinely, only a minute. If the learner is mid-answer when 60 seconds elapses, the session completes that card before closing.

---

## Product Roadmap

Features confirmed for future development:

- **Specialty packs** — vocabulary sets within a language: cooking, travel, business, medical, legal. Sold as add-ons within the Pro tier.
- **Sentence generator** — under evaluation. Would generate example sentences using vocabulary from a card just reviewed. High perceived value; requires deciding whether AI generation fits the brand's "quiet expert" voice.

---

## Voice and Tone

**plyglt speaks like a quiet expert.** It never congratulates. It never apologizes. It gives you exactly the information you need and nothing else. The work is its own reward.

### Rules

- No exclamation marks in UI copy
- No filler words ("just", "simply", "quickly", "easily")
- No passive voice
- Short sentences — one idea per sentence
- Present tense by default
- Never explain what the user already knows

### Examples

| Don't | Do |
|-------|-----|
| Amazing! You got it! 🎉 | Correct. |
| Oops, that's not quite right! | Wrong. Try again. |
| You have 3 cards coming up soon! | 3 ready tomorrow. |
| Something went wrong on our end 😅 | Couldn't load pack. Try again. |
| Great job finishing your session! | Session complete. |
| You don't have any cards due right now! | Nothing ready. |
| You have 47 overdue cards! | 47 cards ready. |

The voice applies to all strings written by agents: button labels, error messages, empty states, onboarding copy, tooltip text.

---

## Terminology

These are the canonical names. Use them consistently everywhere — UI copy, code comments, variable names, documentation.

| Use this | Not this |
|----------|----------|
| card | flashcard, note |
| unit | deck, lesson, module, course |
| review | practice, study, lesson |
| ready | overdue, due, available, unlocked |
| correct | right, great, perfect |
| close | almost, nearly, good try |
| wrong | incorrect, not quite |
| spaced repetition | flashcard algorithm, memory system |
| B2 | intermediate, conversational, fluent |
| language pack | course, content pack, deck file |

---

## Visual Identity

**Black and white dominant.** The current logo is a globe-and-speech-bubble hybrid — legible at icon size, no color required. The aesthetic direction is web3-influenced minimalism.

- No gradients
- No mascots or illustrated characters
- No confetti or celebratory animations
- No filled/colored icons — line icons only
- Clean sans-serif typography — the UI reads like a tool, not a language app
- Motion is minimal: the 1.4-second correct flash is close to the maximum

The brand should feel like software a professional runs on their machine and isn't embarrassed about. Not a toy. A system.

---

## The One-Sentence Version

> plyglt is the Anki you'll actually use — curated language packs, real memory science, no setup required, aimed at B2 reading and writing fluency.
