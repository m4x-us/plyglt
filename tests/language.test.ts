import { describe, it, expect } from "vitest";
import { getPrompt, getAccepted, ITALIAN, SPANISH, getLanguageConfig } from "@/lib/language";
import { ALL_PACK_CODES } from "@/lib/langRegistry";
import { checkAnswer } from "@/lib/srs";
import type { Card } from "@/content/types";

function card(overrides: Partial<Card>): Card {
  return {
    id: "test-01",
    type: "recognize",
    prompt: "il gatto",
    accepted: ["the cat"],
    tags: [],
    tier: 1,
    ...overrides,
  };
}

// ── getPrompt ─────────────────────────────────────────────────────────────────

describe("getPrompt()", () => {
  it("produce — returns canonical English prompt for 'en' source", () => {
    const c = card({ type: "produce", prompt: "the cat" });
    expect(getPrompt(c, "en")).toBe("the cat");
  });

  it("produce — falls back to canonical when no translation for requested lang", () => {
    const c = card({ type: "produce", prompt: "the cat" });
    expect(getPrompt(c, "es")).toBe("the cat");
  });

  it("produce — falls back to canonical when prompts map is absent", () => {
    const c = card({ type: "produce", prompt: "the cat" }); // no prompts key
    expect(getPrompt(c, "fr")).toBe("the cat");
  });

  it("produce — returns source-language prompt when available", () => {
    const c = card({ type: "produce", prompt: "the cat", prompts: { es: "el gato", fr: "le chat" } });
    expect(getPrompt(c, "es")).toBe("el gato");
    expect(getPrompt(c, "fr")).toBe("le chat");
  });

  it("recognize — always returns target-language prompt regardless of sourceLang", () => {
    const c = card({ type: "recognize", prompt: "il gatto" });
    expect(getPrompt(c, "es")).toBe("il gatto");
    expect(getPrompt(c, "en")).toBe("il gatto");
    expect(getPrompt(c, "de")).toBe("il gatto");
  });

  it("conjugate — always returns target-language prompt", () => {
    const c = card({ type: "conjugate", prompt: "essere (io, presente)" });
    expect(getPrompt(c, "de")).toBe("essere (io, presente)");
  });

  it("fill_blank — always returns target-language prompt", () => {
    const c = card({ type: "fill_blank", prompt: "Io ___ stanco." });
    expect(getPrompt(c, "fr")).toBe("Io ___ stanco.");
  });

  it("passage_cloze — always returns target-language prompt", () => {
    const c = card({ type: "passage_cloze", prompt: "Nel ___ c'è un gatto." });
    expect(getPrompt(c, "en")).toBe("Nel ___ c'è un gatto.");
  });
});

// ── getAccepted ───────────────────────────────────────────────────────────────

describe("getAccepted()", () => {
  it("recognize — returns canonical English accepted answers for 'en' source", () => {
    const c = card({ type: "recognize", accepted: ["the cat"] });
    expect(getAccepted(c, "en")).toEqual(["the cat"]);
  });

  it("recognize — falls back to English when no translation for requested lang", () => {
    const c = card({ type: "recognize", accepted: ["the cat"] });
    expect(getAccepted(c, "es")).toEqual(["the cat"]);
  });

  it("recognize — falls back when translations map is absent", () => {
    const c = card({ type: "recognize", accepted: ["the cat"] }); // no translations key
    expect(getAccepted(c, "de")).toEqual(["the cat"]);
  });

  it("recognize — returns source-language translations when available", () => {
    const c = card({
      type: "recognize",
      accepted: ["the cat"],
      translations: { es: ["el gato"], de: ["die Katze", "eine Katze"] },
    });
    expect(getAccepted(c, "es")).toEqual(["el gato"]);
    expect(getAccepted(c, "de")).toEqual(["die Katze", "eine Katze"]);
  });

  it("produce — always returns target-language accepted answers, ignores translations", () => {
    const c = card({
      type: "produce",
      accepted: ["il gatto", "gatto"],
      translations: { es: ["el gato"] },
    });
    expect(getAccepted(c, "es")).toEqual(["il gatto", "gatto"]);
    expect(getAccepted(c, "en")).toEqual(["il gatto", "gatto"]);
  });

  it("conjugate — always returns target accepted answers", () => {
    const c = card({ type: "conjugate", accepted: ["sono"] });
    expect(getAccepted(c, "fr")).toEqual(["sono"]);
  });

  it("fill_blank — always returns target accepted answers", () => {
    const c = card({ type: "fill_blank", accepted: ["sono", "ero"] });
    expect(getAccepted(c, "de")).toEqual(["sono", "ero"]);
  });
});

// ── Italian article alternation order ────────────────────────────────────────
// These tests fail with the old inline regex (un before uno/una/un') and pass
// after the fix that imports ITALIAN_ARTICLES from lib/srs.ts.

describe("Italian lang.articles — correct alternation order", () => {
  const articles = ITALIAN.articles;

  it("strips 'una' (not 'un') from 'una pizza'", () => {
    expect(checkAnswer("pizza", ["una pizza"], { articles })).toBe("correct");
  });
  it("strips 'uno' from 'uno studente'", () => {
    expect(checkAnswer("studente", ["uno studente"], { articles })).toBe("correct");
  });
  it("strips \"un'\" from \"un'amica\"", () => {
    expect(checkAnswer("amica", ["un'amica"], { articles })).toBe("correct");
  });
  it("strips plain 'un' from 'un cane'", () => {
    expect(checkAnswer("cane", ["un cane"], { articles })).toBe("correct");
  });
  it("does not over-strip 'i' when article is 'il'", () => {
    expect(checkAnswer("gatto", ["il gatto"], { articles })).toBe("correct");
  });
  it("does not over-strip 'i' when article is 'gli'", () => {
    expect(checkAnswer("amici", ["gli amici"], { articles })).toBe("correct");
  });
});

// ── Spanish article alternation order ────────────────────────────────────────
// These tests fail with the old inline regex (un before una/unos/unas, la before las)
// and pass after SPANISH_ARTICLES (longest-first) is used.

describe("Spanish lang.articles — correct alternation order", () => {
  const articles = SPANISH.articles;

  it("strips 'las' (not 'la') from 'las mesas'", () => {
    expect(checkAnswer("mesas", ["las mesas"], { articles })).toBe("correct");
  });
  it("strips 'los' from 'los gatos'", () => {
    expect(checkAnswer("gatos", ["los gatos"], { articles })).toBe("correct");
  });
  it("strips 'una' (not 'un') from 'una gata'", () => {
    expect(checkAnswer("gata", ["una gata"], { articles })).toBe("correct");
  });
  it("strips 'unos' from 'unos gatos'", () => {
    expect(checkAnswer("gatos", ["unos gatos"], { articles })).toBe("correct");
  });
  it("strips 'unas' from 'unas gatas'", () => {
    expect(checkAnswer("gatas", ["unas gatas"], { articles })).toBe("correct");
  });
  it("strips plain 'un' from 'un gato'", () => {
    expect(checkAnswer("gato", ["un gato"], { articles })).toBe("correct");
  });
});

// ── ITALIAN config ────────────────────────────────────────────────────────────

describe("ITALIAN config", () => {
  it("code is 'it'", () => expect(ITALIAN.code).toBe("it"));
  it("has a non-null articles regex", () => expect(ITALIAN.articles).not.toBeNull());

  it("articles regex matches 'il' prefix", () => {
    expect(ITALIAN.articles!.test("il gatto")).toBe(true);
  });
  it("articles regex matches 'la' prefix", () => {
    expect(ITALIAN.articles!.test("la casa")).toBe(true);
  });
  it("articles regex matches \"l'\" prefix", () => {
    expect(ITALIAN.articles!.test("l'amico")).toBe(true);
  });
  it("articles regex matches 'gli' prefix", () => {
    expect(ITALIAN.articles!.test("gli amici")).toBe(true);
  });
  it("articles regex matches 'un' prefix", () => {
    expect(ITALIAN.articles!.test("un cane")).toBe(true);
  });
  it("articles regex does NOT match plain word", () => {
    expect(ITALIAN.articles!.test("gatto")).toBe(false);
  });
  it("has all card type labels defined and non-trivial", () => {
    const required = ["produce", "recognize", "conjugate", "fill_blank", "passage_cloze"];
    for (const type of required) {
      const label = ITALIAN.uiStrings.cardLabels[type as keyof typeof ITALIAN.uiStrings.cardLabels];
      expect(label).toMatch(/\S/);
      expect(label).not.toBe("undefined");
      expect(label.length).toBeGreaterThan(2);
    }
  });
});

// ── diacriticTolerant flag ────────────────────────────────────────────────────

describe("diacriticTolerant flag", () => {
  it("ITALIAN.diacriticTolerant is true", () => {
    expect(ITALIAN.diacriticTolerant).toBe(true);
  });

  it("SPANISH.diacriticTolerant is true", () => {
    expect(SPANISH.diacriticTolerant).toBe(true);
  });

  it("every config returned by getLanguageConfig has diacriticTolerant as a boolean", () => {
    for (const code of ALL_PACK_CODES) {
      const cfg = getLanguageConfig(code);
      expect(typeof cfg.diacriticTolerant, `getLanguageConfig("${code}").diacriticTolerant is not a boolean`).toBe("boolean");
    }
  });
});

// ── getLanguageConfig poka-yoke guard ─────────────────────────────────────────
// Ensures LANGUAGE_MAP in lib/language.ts covers every code in the registry.
// If a new language is added to LANGUAGE_REGISTRY but forgotten in LANGUAGE_MAP,
// this test fails — preventing getLanguageConfig() from silently returning Italian.
describe("getLanguageConfig poka-yoke", () => {
  it("returns the config whose code matches the requested pack code", () => {
    for (const code of ALL_PACK_CODES) {
      if (code === "it") continue; // Italian returning Italian is correct
      const cfg = getLanguageConfig(code);
      expect(cfg.code, `getLanguageConfig("${code}") returned wrong config — update LANGUAGE_MAP in lib/language.ts`).toBe(code);
    }
  });

  it("returns a defined config for every registered pack code", () => {
    for (const code of ALL_PACK_CODES) {
      const cfg = getLanguageConfig(code);
      expect(cfg).toBeDefined();
      expect(typeof cfg.code).toBe("string");
    }
  });
});
