# Adding a New Language

Follow these steps in order. Each step has a completion test. Do not mark a step done unless its test passes.

---

## Step 1 — Article regex

Add the article-stripping regex to `lib/srs.ts` alongside `ITALIAN_ARTICLES` and `SPANISH_ARTICLES`:

```typescript
// Longest alternatives first — prevents shorter prefix from consuming a longer token.
export const FRENCH_ARTICLES = /^(les|des|le|la|un|une)\s*/i;
```

**Rule:** Longer alternatives must come before shorter ones. `les` before `le`/`la`. `une` before `un`. When unsure, write the alternation-order tests first (step 1b) and confirm they fail with the wrong order.

**Tests (write these before authoring any cards — they must fail first):**

Add to `tests/language.test.ts` a describe block `"French lang.articles — correct alternation order"` with 6 tests, one per article form that could be over-consumed. Each test must:
- Pass the article-prefixed form as the accepted answer
- Assert `checkAnswer(bare_word, [article + " " + bare_word], { articles })` returns `"correct"`

---

## Step 2 — Language config

Add a `LanguageConfig` object to `lib/language.ts`:

```typescript
export const FRENCH: LanguageConfig = {
  code: "fr",
  name: "French",
  nativeName: "Français",
  flag: "🇫🇷",
  articles: FRENCH_ARTICLES,
  uiStrings: {
    appTitle: APP_NAME,
    appSubtitle: APP_SUBTITLE,
    correctFeedback: "Correct !",
    closeFeedback: "Presque ! Close enough.",
    cardLabels: {
      produce:       "Type in French",
      recognize:     "Translate to English",
      conjugate:     "Conjugate the verb",
      fill_blank:    "Fill in the blank",
      passage_cloze: "Read and fill the blank",
    },
    curriculumCredit: "Français A1 · Beta",
  },
};
```

Then import it in `lib/langRegistry.ts` and add a registry entry with `ready: false`:

```typescript
import { ITALIAN, SPANISH, FRENCH } from "@/lib/language";

// In LANGUAGE_REGISTRY:
{ code: "fr", config: FRENCH, isFree: false, ready: false, pricing: { lifetime: "$9.99" } },
```

**Test:** `npm test tests/langRegistry.test.ts` — the sync test `"LANG_CONFIG_MAP has an entry for every code"` will confirm the config is wired correctly.

---

## Step 3 — Content

Author cards and units in `content/fr/index.ts`. Use the same `Unit`/`Card` types as Italian:

```typescript
import type { Unit } from "@/content/types";

const unit01: Unit = {
  id: "fr-a1u01-greetings",
  name: "Greetings",
  level: "A1",
  theme: "Greetings & Introductions",
  emoji: "👋",
  prerequisiteUnits: [],
  cards: [
    {
      id: "fr-a1u01-t1-001",
      type: "recognize",
      prompt: "bonjour",
      accepted: ["hello", "good morning", "good day"],
      tags: ["greeting"],
      tier: 1,
    },
    // ...
  ],
};

export const ALL_UNITS: Unit[] = [unit01, /* ... */];
```

**Card ID format:** `{lang}-{level}u{unit:02d}-t{tier}-{seq:03d}` — e.g. `fr-a1u01-t1-001`.

**Minimum for `ready: true`:** Full A1 unit set (≥ 10 units, ≥ 100 cards).

---

## Step 4 — Pack generation

```bash
npm run pack:export fr      # Writes public/packs/fr.json + updates manifest.json
npm run pack:validate:all   # Must pass with zero errors
npm run pack:check-ids      # Must report zero duplicate IDs
```

---

## Step 5 — Entitlement

1. Create a product in Lemon Squeezy: "French Lifetime" — add its checkout URL to `lib/entitlement.ts` `CHECKOUT_URLS`:
   ```typescript
   french_lifetime: `https://${LS_STORE_SLUG}.lemonsqueezy.com/buy/french-lifetime`,
   ```
2. Update `parseVariant` in `lib/entitlement.ts` if French has its own per-language pricing tier. If French uses the same "All Languages" bundle as other languages, no change needed.

---

## Step 6 — QA checklist

Run through this manually in the Tauri app:

- [ ] Select French on the language picker → navigates to `/learn`
- [ ] Study loop: card shown, answer accepted/rejected correctly with article stripping
- [ ] Interrupt fires with correct French due count (not Italian count)
- [ ] Stats page shows French data only
- [ ] Export backup → verify JSON contains `"langPair": "en-fr"`
- [ ] Import backup on a fresh install → data restores without warnings
- [ ] All prices shown correctly in `BuyModal` and Settings

---

## Step 7 — Launch

Set `ready: true` in `lib/langRegistry.ts`. The language now appears as purchasable in the UI.

```typescript
{ code: "fr", config: FRENCH, isFree: false, ready: true, pricing: { lifetime: "$9.99" } },
```

Commit with tag: `git tag -a v1.fr -m "Launch French"`
