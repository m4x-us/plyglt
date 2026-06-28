# Adding a New Language

Follow these steps in order. Each step has a completion test. Do not mark a step done unless its test passes.

---

## Answer matching — read this before authoring any cards

**NFC normalization:** All card text is NFC-normalized on export by `scripts/exportPack.ts`. Write card content in precomposed form (e.g., `é` not `e` + combining accent). Do not list both composed and decomposed forms in `accepted` — the tooling handles normalization automatically.

**Diacritic tolerance:** When `diacriticTolerant: true`, an accent-only difference between the typed answer and an accepted answer returns `"close"` rather than `"wrong"`. Do not add duplicate accepted answers (e.g., both `"café"` and `"cafe"`) — the engine handles accent tolerance automatically.

**"close" threshold:** The Levenshtein fuzzy check only triggers when `accepted.length > 4 AND distance === 1`. Accepted answers with four or fewer characters have no fuzzy tolerance — they return `"correct"` or `"wrong"` only, never `"close"`. Authors must account for this when writing short-word cards.

---

## Step 1 — Article regex

Add the article-stripping regex to `lib/answerCheck.ts` alongside `ITALIAN_ARTICLES` and `SPANISH_ARTICLES`:

```typescript
// Longest alternatives first — prevents shorter prefix from consuming a longer token.
export const GERMAN_ARTICLES = /^(die|das|der|den|dem|des|ein|eine|einem|einen|eines|einer)\s*/i;
```

Replace `GERMAN_ARTICLES` and its values with `{LANG}_ARTICLES` and the correct articles for your target language.

**Rule:** Longer alternatives must come before shorter ones. When unsure, write the alternation-order tests first (step 1b) and confirm they fail with the wrong order.

**Tests (write these before authoring any cards — they must fail first):**

Add to `tests/language.test.ts` a describe block `"{Lang} lang.articles — correct alternation order"` with 6 tests, one per article form that could be over-consumed. Each test must:
- Pass the article-prefixed form as the accepted answer
- Assert `checkAnswer(bare_word, [article + " " + bare_word], { articles })` returns `"correct"`

---

## Step 2 — Language config

Add a `LanguageConfig` object to `lib/language.ts` (replacing `GERMAN` and German-specific strings with your language):

```typescript
export const GERMAN: LanguageConfig = {
  code: "de",
  name: "German",
  nativeName: "Deutsch",
  flag: "🇩🇪",
  articles: GERMAN_ARTICLES,
  diacriticTolerant: true,
  uiStrings: {
    appTitle: APP_NAME,
    appSubtitle: APP_SUBTITLE,
    correctFeedback: "Richtig.",
    closeFeedback: "Fast! Close enough.",
    cardLabels: {
      produce:       "Type in German",
      recognize:     "Translate to English",
      conjugate:     "Conjugate the verb",
      fill_blank:    "Fill in the blank",
      passage_cloze: "Read and fill the blank",
    },
    curriculumCredit: "Deutsch A1 · Beta",
  },
};
```

Then import it in `lib/langRegistry.ts` and add a registry entry with `ready: false`:

```typescript
import { ITALIAN, SPANISH, GERMAN } from "@/lib/language";

// In LANGUAGE_REGISTRY:
{ code: "de", config: GERMAN, isFree: false, ready: false },
```

Set `ready: false` until `public/packs/{lang}.json` exists and the content is complete. A `ready: false` entry loads the `LanguageConfig` (making it available to tests and imports) but hides the language from the production UI.

**Note:** `LanguageEntry` has no `pricing` field — do not add one. Pricing is derived from the Lemon Squeezy variant name at runtime in `lib/entitlement.ts`.

**Test:** `npm test tests/langRegistry.test.ts` — the sync test `"LANG_CONFIG_MAP has an entry for every code"` will confirm the config is wired correctly.

---

## Step 3 — Content

Author cards and units in `content/{lang}/index.ts`. Use the same `Unit`/`Card` types as Italian:

```typescript
import type { Unit } from "@/content/types";

const unit01: Unit = {
  id: "{lang}-a1u01-greetings",
  name: "Greetings",
  level: "A1",
  theme: "Greetings & Introductions",
  emoji: "👋",
  prerequisiteUnits: [],
  cards: [
    {
      id: "{lang}-a1u01-t1-001",
      type: "recognize",
      prompt: "...",
      accepted: ["hello", "good morning"],
      tags: ["greeting"],
      tier: 1,
    },
    // ...
  ],
};

export const ALL_UNITS: Unit[] = [unit01, /* ... */];
```

**Card ID format:**
- **Italian only (no lang prefix):** `{level}u{unit:02d}-t{tier}-{seq:003d}` — e.g. `a1u01-t1-001`
- **All other languages (lang prefix required):** `{lang}-{level}u{unit:02d}-t{tier}-{seq:003d}` — e.g. `de-a1u01-t1-001`

Italian cards were authored before the multi-language prefix convention was established. All new languages must include the `{lang}-` prefix to avoid ID collisions across packs.

**Minimum for `ready: true`:** Full A1 unit set (≥ 10 units, ≥ 100 cards).

---

## Step 4 — Pack generation

```bash
npm run pack:export {lang}      # Writes public/packs/{lang}.json + updates manifest.json
npm run pack:validate:all       # Must pass with zero errors
npm run pack:check-ids          # Must report zero duplicate IDs
```

---

## Step 5 — Entitlement

1. Create a product in Lemon Squeezy: "{Lang} Monthly" — add its checkout URL to `lib/entitlement.ts` `CHECKOUT_URLS`:
   ```typescript
   {lang}_monthly: `https://${LS_STORE_SLUG}.lemonsqueezy.com/buy/{lang}-monthly`,
   ```
2. Update `parseVariant` in `lib/entitlement.ts` if the new language has its own per-language pricing tier. If it uses the same "All Languages" bundle, no change needed.

**Note:** plyglt has no lifetime plans (BRAND.md). All checkout keys must reference subscription variants (`monthly` or `annual`). Do not add `lifetime` keys.

---

## Step 6 — QA checklist

Run through this manually in the Tauri app:

- [ ] Select the new language on the language picker → navigates to `/learn`
- [ ] Study loop: card shown, answer accepted/rejected correctly with article stripping
- [ ] Interrupt fires with correct due count (not Italian count)
- [ ] Stats page shows the new language's data only
- [ ] Export backup → verify JSON contains `"langPair": "en-{lang}"`
- [ ] Import backup on a fresh install → data restores without warnings
- [ ] All prices shown correctly in `BuyModal` and Settings

---

## Step 7 — Launch

Set `ready: true` in `lib/langRegistry.ts`. The language now appears as purchasable in the UI.

```typescript
{ code: "{lang}", config: {LANG}, isFree: false, ready: true },
```

Commit with tag: `git tag -a v1.{lang} -m "Launch {Lang}"`
