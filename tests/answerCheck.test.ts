// ===========================================
// MODULE BOUNDARY TEST — lib/answerCheck.ts
// ===========================================
// Pins the answerCheck module boundary: all imports come from @/lib/answerCheck,
// NOT from @/lib/srs. If this file fails to import, the extraction is incomplete.
// ===========================================

import { describe, it, expect } from "vitest";
import { checkAnswer, levenshtein, stripArticle, ITALIAN_ARTICLES, SPANISH_ARTICLES } from "@/lib/answerCheck";

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

  it("strips a curly-apostrophe article (l’) identically to the straight form (l')", () => {
    expect(stripArticle("l’amico", ITALIAN_ARTICLES)).toBe("amico");
    expect(stripArticle("l'amico", ITALIAN_ARTICLES)).toBe("amico");
  });
});

// ── stripArticle — word-boundary regression (Batch 18) ───────────────────────
// B7 target for every "strips X" case: reverting the (?=\s|$) lookahead back to a bare \s*
// would still pass these (they're genuine articles followed by a space). The "does not strip"
// cases are the ones that actually catch the regression — each would fail if the lookahead
// were removed, since the pre-fix regex stripped these leading substrings unconditionally.

describe("stripArticle — ITALIAN_ARTICLES enumerates every alternative (11 total: 9 lookahead-gated + 2 apostrophe forms)", () => {
  it("strips 'il'", () => expect(stripArticle("il gatto", ITALIAN_ARTICLES)).toBe("gatto"));
  it("strips 'lo'", () => expect(stripArticle("lo zaino", ITALIAN_ARTICLES)).toBe("zaino"));
  it("strips 'la'", () => expect(stripArticle("la casa", ITALIAN_ARTICLES)).toBe("casa"));
  it("strips 'gli'", () => expect(stripArticle("gli amici", ITALIAN_ARTICLES)).toBe("amici"));
  it("strips 'le'", () => expect(stripArticle("le ragazze", ITALIAN_ARTICLES)).toBe("ragazze"));
  it("strips 'uno'", () => expect(stripArticle("uno studente", ITALIAN_ARTICLES)).toBe("studente"));
  it("strips 'una'", () => expect(stripArticle("una pizza", ITALIAN_ARTICLES)).toBe("pizza"));
  it("strips 'un'", () => expect(stripArticle("un cane", ITALIAN_ARTICLES)).toBe("cane"));
  it("strips 'i'", () => expect(stripArticle("i libri", ITALIAN_ARTICLES)).toBe("libri"));
  it("strips \"l'\"", () => expect(stripArticle("l'amico", ITALIAN_ARTICLES)).toBe("amico"));
  it("strips \"un'\"", () => expect(stripArticle("un'isola", ITALIAN_ARTICLES)).toBe("isola"));
});

describe("stripArticle — does not over-strip a word merely resembling an article (Batch 18)", () => {
  it("does not strip 'i' from 'isola' (island) — the exact audit repro", () => {
    expect(stripArticle("isola", ITALIAN_ARTICLES)).toBe("isola");
  });
  it("does not strip 'il' from 'illogico' (illogical)", () => {
    expect(stripArticle("illogico", ITALIAN_ARTICLES)).toBe("illogico");
  });
  it("does not strip 'lo' from 'lontano' (far)", () => {
    expect(stripArticle("lontano", ITALIAN_ARTICLES)).toBe("lontano");
  });
  it("does not strip 'la' from 'lago' (lake)", () => {
    expect(stripArticle("lago", ITALIAN_ARTICLES)).toBe("lago");
  });
  it("does not strip 'gli' from 'glicine' (wisteria)", () => {
    expect(stripArticle("glicine", ITALIAN_ARTICLES)).toBe("glicine");
  });
  it("does not strip 'le' from 'legge' (law)", () => {
    expect(stripArticle("legge", ITALIAN_ARTICLES)).toBe("legge");
  });
  it("does not strip 'una' from 'unanime' (unanimous)", () => {
    expect(stripArticle("unanime", ITALIAN_ARTICLES)).toBe("unanime");
  });
  it("does not strip 'un' from 'unico' (unique) — direct sibling of the 'isola' bug", () => {
    expect(stripArticle("unico", ITALIAN_ARTICLES)).toBe("unico");
  });
  it("still strips \"un'\" correctly from \"un'isola\" (an island, fem.) — apostrophe form unaffected", () => {
    expect(stripArticle("un'isola", ITALIAN_ARTICLES)).toBe("isola");
  });
  it("does not strip an article followed by punctuation with no space (intentional narrowing — under-strips, never over-strips)", () => {
    // The anchored ^ regex fails to match at all when the lookahead fails, so the whole
    // string is returned unchanged, not just the "la" portion.
    expect(stripArticle("la,", ITALIAN_ARTICLES)).toBe("la,");
    expect(stripArticle("la.", ITALIAN_ARTICLES)).toBe("la.");
  });
});

describe("stripArticle — SPANISH_ARTICLES enumerates every alternative (8 total)", () => {
  it("strips 'el'", () => expect(stripArticle("el gato", SPANISH_ARTICLES)).toBe("gato"));
  it("strips 'los'", () => expect(stripArticle("los gatos", SPANISH_ARTICLES)).toBe("gatos"));
  it("strips 'las'", () => expect(stripArticle("las mesas", SPANISH_ARTICLES)).toBe("mesas"));
  it("strips 'la'", () => expect(stripArticle("la casa", SPANISH_ARTICLES)).toBe("casa"));
  it("strips 'unos'", () => expect(stripArticle("unos gatos", SPANISH_ARTICLES)).toBe("gatos"));
  it("strips 'unas'", () => expect(stripArticle("unas gatas", SPANISH_ARTICLES)).toBe("gatas"));
  it("strips 'una'", () => expect(stripArticle("una gata", SPANISH_ARTICLES)).toBe("gata"));
  it("strips 'un'", () => expect(stripArticle("un gato", SPANISH_ARTICLES)).toBe("gato"));
});

describe("stripArticle — SPANISH_ARTICLES does not over-strip a word merely resembling an article (Batch 18)", () => {
  it("does not strip 'el' from 'elefante' (elephant)", () => {
    expect(stripArticle("elefante", SPANISH_ARTICLES)).toBe("elefante");
  });
  it("does not strip 'los' from 'losa' (flagstone)", () => {
    expect(stripArticle("losa", SPANISH_ARTICLES)).toBe("losa");
  });
  it("does not strip 'las' from 'lastre' (ballast)", () => {
    expect(stripArticle("lastre", SPANISH_ARTICLES)).toBe("lastre");
  });
  it("does not strip 'la' from 'lago' (lake)", () => {
    expect(stripArticle("lago", SPANISH_ARTICLES)).toBe("lago");
  });
  it("does not strip 'una' from 'unamos' (let's unite)", () => {
    expect(stripArticle("unamos", SPANISH_ARTICLES)).toBe("unamos");
  });
  it("does not strip 'un' from 'unico' (unique, unaccented typed form — realistic given diacriticTolerant)", () => {
    expect(stripArticle("unico", SPANISH_ARTICLES)).toBe("unico");
  });
});

describe("checkAnswer — article-stripped length gates the typo-tolerance check, not the raw length (Batch 18 fresh-eyes finding)", () => {
  it("does not grant typo tolerance to a short word just because the accepted answer carries an article", () => {
    // B7: pre-fix, the gate used a.length (the article-INCLUSIVE normalized form, "il re" = 5
    // chars) instead of aNoArticle.length (the true word, "re" = 2 chars). "ne" vs "re" is
    // Levenshtein distance 1, but "re" is far too short to deserve 1-edit typo tolerance —
    // the whole point of the length gate. Reverting to a.length would make this "close".
    expect(checkAnswer("ne", ["il re"], italianOpts)).toBe("wrong");
  });
  it("still grants typo tolerance on a genuinely long word carrying an article", () => {
    expect(checkAnswer("gattoo", ["il gatto"], italianOpts)).toBe("close");
  });
});

describe("checkAnswer — leading whitespace does not defeat article stripping (Batch 18 fresh-eyes finding)", () => {
  it("still strips a leading article when the typed answer has accidental leading whitespace", () => {
    // B7: stripArticle's regex is anchored at ^ with no leading \s* — pre-fix, calling it on
    // the raw untrimmed typed string meant " la casa" never matched the article alternation
    // at all, so the article was never stripped and this legitimate answer graded "wrong".
    expect(checkAnswer(" la casa", ["casa"], italianOpts)).toBe("correct");
  });
  it("still strips a leading article when the accepted answer has accidental leading whitespace", () => {
    expect(checkAnswer("casa", [" la casa"], italianOpts)).toBe("correct");
  });
});

describe("checkAnswer — no longer grades an unrelated word as correct (Batch 18)", () => {
  it("'isola' (island) vs accepted 'isola' is still correct — the fix doesn't break exact matches", () => {
    expect(checkAnswer("isola", ["isola"], italianOpts)).toBe("correct");
  });
  it("'sola' (alone) vs accepted 'isola' (island) is no longer 'correct' — falls to the existing close/wrong logic", () => {
    // B7: pre-fix, this returned "correct" (article-stripped 'isola'->'sola' collided with the
    // typed word). Post-fix it's "close" via the pre-existing, independently-tested
    // Levenshtein-distance-1 fuzzy-match rule (verified: levenshtein("sola","isola")===1,
    // "isola".length===5>4) — never full credit for a different word, but not "wrong" either.
    expect(checkAnswer("sola", ["isola"], italianOpts)).toBe("close");
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

  // Task #226: a curly/typographic apostrophe (U+2019, what iOS/macOS autocorrect produces
  // by default) must strip identically to the straight-apostrophe form ITALIAN_ARTICLES is
  // written with — previously the apostrophe-normalization regex was itself a duplicate-
  // alternation bug (both branches were the straight quote), so curly-quote input never
  // stripped and fell through to "wrong".
  it("typed with curly-apostrophe article (’) matches accepted without article", () => {
    expect(checkAnswer("l’amico", ["amico"], italianOpts)).toBe("correct");
  });

  it("typed with curly-apostrophe 'un’' article matches accepted without article", () => {
    expect(checkAnswer("un’amica", ["amica"], italianOpts)).toBe("correct");
  });

  it("straight- and curly-apostrophe typed forms produce the same result", () => {
    const straight = checkAnswer("l'amico", ["amico"], italianOpts);
    const curly = checkAnswer("l’amico", ["amico"], italianOpts);
    expect(curly).toBe(straight);
    expect(curly).toBe("correct");
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
