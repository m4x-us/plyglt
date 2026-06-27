// ===========================================
// MODULE BOUNDARY TEST — lib/answerCheck.ts
// ===========================================
// Pins the answerCheck module boundary: all imports come from @/lib/answerCheck,
// NOT from @/lib/srs. If this file fails to import, the extraction is incomplete.
// ===========================================

import { describe, it, expect } from "vitest";
import { checkAnswer, levenshtein, stripArticle, ITALIAN_ARTICLES } from "@/lib/answerCheck";

const italianOpts = { articles: ITALIAN_ARTICLES, diacriticTolerant: true };

// ── levenshtein ───────────────────────────────────────────────────────────────

describe("levenshtein", () => {
  it("single substitution: casa → caso = 1", () => {
    expect(levenshtein("casa", "caso")).toBe(1);
  });

  it("empty string to 1-char string = 1", () => {
    expect(levenshtein("", "a")).toBe(1);
  });

  it("identical strings = 0", () => {
    expect(levenshtein("gatto", "gatto")).toBe(0);
  });

  it("single insertion: cat → cats = 1", () => {
    expect(levenshtein("cat", "cats")).toBe(1);
  });
});

// ── stripArticle ──────────────────────────────────────────────────────────────

describe("stripArticle", () => {
  it("strips Italian definite article from noun", () => {
    expect(stripArticle("il gatto", ITALIAN_ARTICLES)).toBe("gatto");
  });

  it("no-op when articles is null", () => {
    expect(stripArticle("il gatto", null)).toBe("il gatto");
  });

  it("leaves word unchanged when no article prefix matches", () => {
    expect(stripArticle("gatto", ITALIAN_ARTICLES)).toBe("gatto");
  });
});

// ── checkAnswer — basic matching ──────────────────────────────────────────────

describe("checkAnswer — basic matching", () => {
  it("exact match returns correct", () => {
    expect(checkAnswer("ciao", ["ciao"], italianOpts)).toBe("correct");
  });

  it("wrong answer returns wrong", () => {
    expect(checkAnswer("ciao", ["buongiorno"], italianOpts)).toBe("wrong");
  });

  it("case insensitive match is correct", () => {
    expect(checkAnswer("CIAO", ["ciao"], italianOpts)).toBe("correct");
  });
});

// ── checkAnswer — NFC normalization ──────────────────────────────────────────

describe("checkAnswer — NFC normalization", () => {
  it("NFC-composed and NFD-decomposed accent are equal", () => {
    const composed   = "é";    // é as a single codepoint (NFC)
    const decomposed = "é";   // e + combining acute accent (NFD)
    expect(checkAnswer(composed, [decomposed], {})).toBe("correct");
  });

  it("exact accent match is correct", () => {
    expect(checkAnswer("caffè", ["caffè"], italianOpts)).toBe("correct");
  });

  it("missing accent with diacriticTolerant=false is wrong", () => {
    expect(checkAnswer("caffe", ["caffè"], { articles: null, diacriticTolerant: false })).toBe("wrong");
  });

  it("missing accent with diacriticTolerant=true is close", () => {
    expect(checkAnswer("caffe", ["caffè"], italianOpts)).toBe("close");
  });
});

// ── checkAnswer — article stripping ──────────────────────────────────────────

describe("checkAnswer — article stripping", () => {
  it("typed with article matches accepted without article", () => {
    expect(checkAnswer("il gatto", ["gatto"], italianOpts)).toBe("correct");
  });

  it("typed without article matches accepted with article", () => {
    expect(checkAnswer("gatto", ["il gatto"], italianOpts)).toBe("correct");
  });
});

// ── checkAnswer — close (typo / Levenshtein = 1) ─────────────────────────────

describe("checkAnswer — close match", () => {
  it("single-char typo on a 5+ character word returns close", () => {
    // 'gatoo' vs 'gatto' — Levenshtein = 1, length > 4
    expect(checkAnswer("gatoo", ["gatto"], italianOpts)).toBe("close");
  });

  it("typo on a short word (≤4 chars) is wrong, not close", () => {
    // 'coo' vs 'coo' — but let's test: 'coo' vs 'goo' (3 chars) should be wrong
    expect(checkAnswer("gat", ["cat"], {})).toBe("wrong");
  });
});
