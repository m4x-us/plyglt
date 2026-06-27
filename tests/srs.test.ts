import { describe, it, expect } from "vitest";
import { checkAnswer, scheduleCard, defaultProgress, isDue, autoRate, ITALIAN_ARTICLES } from "@/lib/srs";
import type { CardProgress, CardState, Grade } from "@/lib/srs";

// ── checkAnswer — basic matching ──────────────────────────────────────────────

describe("checkAnswer() — basic matching", () => {
  it("exact match", () => expect(checkAnswer("ciao", ["ciao"])).toBe("correct"));
  it("case insensitive", () => expect(checkAnswer("CIAO", ["ciao"])).toBe("correct"));
  it("leading/trailing whitespace trimmed", () => expect(checkAnswer("  ciao  ", ["ciao"])).toBe("correct"));
  it("NFC normalisation: exact accent match is correct", () => expect(checkAnswer("caffè", ["caffè"])).toBe("correct"));
  it("NFC normalisation: missing accent without diacriticTolerant is wrong", () => expect(checkAnswer("caffe", ["caffè"])).toBe("wrong"));
  it("straight apostrophe normalised", () => expect(checkAnswer("l’amico", ["l’amico"])).toBe("correct"));
  it("multiple spaces collapsed", () => expect(checkAnswer("buona  sera", ["buona sera"])).toBe("correct"));
  it("completely wrong answer", () => expect(checkAnswer("buonasera", ["ciao"])).toBe("wrong"));
  it("empty typed string is wrong", () => expect(checkAnswer("", ["ciao"])).toBe("wrong"));
});

// ── checkAnswer — diacriticTolerant ──────────────────────────────────────────

describe("checkAnswer() — diacriticTolerant option", () => {
  it("exact accented match is correct (with or without diacriticTolerant)", () =>
    expect(checkAnswer("caffè", ["caffè"], { diacriticTolerant: true })).toBe("correct"));
  it("missing accent without diacriticTolerant is wrong", () =>
    expect(checkAnswer("caffe", ["caffè"])).toBe("wrong"));
  it("missing accent with diacriticTolerant is close", () =>
    expect(checkAnswer("caffe", ["caffè"], { diacriticTolerant: true })).toBe("close"));
  it("exact match preferred over stripped match when diacriticTolerant", () =>
    expect(checkAnswer("caffè", ["caffè"], { diacriticTolerant: true })).toBe("correct"));
  it("diacriticTolerant: false behaves same as omitting option", () =>
    expect(checkAnswer("caffe", ["caffè"], { diacriticTolerant: false })).toBe("wrong"));
});

// ── checkAnswer — article stripping ──────────────────────────────────────────

describe("checkAnswer() — Italian article stripping (explicit articles option)", () => {
  const opts = { articles: ITALIAN_ARTICLES };
  it("accepts 'il gatto' when answer is 'gatto'", () =>
    expect(checkAnswer("il gatto", ["gatto"], opts)).toBe("correct"));
  it("accepts 'gatto' when answer is 'il gatto'", () =>
    expect(checkAnswer("gatto", ["il gatto"], opts)).toBe("correct"));
  it("accepts 'la casa' when answer is 'la casa'", () =>
    expect(checkAnswer("la casa", ["la casa"], opts)).toBe("correct"));
  it("accepts \"l'uomo\" when answer is 'uomo'", () =>
    expect(checkAnswer("l'uomo", ["uomo"], opts)).toBe("correct"));
  it("accepts 'uomo' when answer is \"l'uomo\"", () =>
    expect(checkAnswer("uomo", ["l'uomo"], opts)).toBe("correct"));
  it("accepts 'un cane' when answer is 'cane'", () =>
    expect(checkAnswer("un cane", ["cane"], opts)).toBe("correct"));
  it("accepts 'gli amici' when answer is 'amici'", () =>
    expect(checkAnswer("gli amici", ["amici"], opts)).toBe("correct"));
  it("accepts 'lo zaino' when answer is 'zaino'", () =>
    expect(checkAnswer("lo zaino", ["zaino"], opts)).toBe("correct"));
  it("accepts 'le ragazze' when answer is 'ragazze'", () =>
    expect(checkAnswer("le ragazze", ["ragazze"], opts)).toBe("correct"));
  it("accepts 'una pizza' when answer is 'pizza'", () =>
    expect(checkAnswer("una pizza", ["pizza"], opts)).toBe("correct"));
});

describe("checkAnswer() — article stripping defaults", () => {
  it("no options → no article stripping (safe default for all languages)", () => {
    // Polish "ile" (how many) starts with "il" — must NOT be stripped without explicit articles option
    expect(checkAnswer("ile", ["ile"])).toBe("correct");
    expect(checkAnswer("ile", ["ile"], {})).toBe("correct");
  });
  it("explicit null articles → no stripping even on Italian-looking words", () => {
    expect(checkAnswer("il film", ["il film"], { articles: null })).toBe("correct");
  });
  it("explicit Italian articles option → strips correctly", () => {
    expect(checkAnswer("film", ["il film"], { articles: ITALIAN_ARTICLES })).toBe("correct");
  });
});

// ── checkAnswer — custom article regexp ──────────────────────────────────────

describe("checkAnswer() — custom article regexp (French)", () => {
  const french = /^(le|la|les|l'|l'|un|une|des|du|de|d')\s*/i;
  it("accepts 'le chien' when answer is 'chien'", () =>
    expect(checkAnswer("le chien", ["chien"], { articles: french })).toBe("correct"));
  it("accepts 'chien' when answer is 'le chien'", () =>
    expect(checkAnswer("chien", ["le chien"], { articles: french })).toBe("correct"));
  it("exact match still correct", () =>
    expect(checkAnswer("chien", ["chien"], { articles: french })).toBe("correct"));
});

// ── checkAnswer — fuzzy matching ──────────────────────────────────────────────

describe("checkAnswer() — fuzzy (Levenshtein)", () => {
  it("5-char word with 1-char transposition → close", () =>
    expect(checkAnswer("pizzo", ["pizza"])).toBe("close"));
  it("6-char word with 1-char typo → close", () =>
    expect(checkAnswer("gitato", ["gitato".replace("t", "i") /* agitato */])).toBe("close"));
  it("word ≤4 chars does not get close (ciao/cia)", () =>
    expect(checkAnswer("cia", ["ciao"])).toBe("wrong"));
  it("word ≤4 chars exact match still correct (ciao/ciao)", () =>
    expect(checkAnswer("ciao", ["ciao"])).toBe("correct"));
  it("2-char edit distance → wrong (pizzo vs ciaoo)", () =>
    expect(checkAnswer("pizzo", ["ciaoo"])).toBe("wrong"));
});

// ── checkAnswer — multiple accepted answers ───────────────────────────────────

describe("checkAnswer() — multiple accepted answers", () => {
  it("accepts first answer", () => expect(checkAnswer("ciao", ["ciao", "salve"])).toBe("correct"));
  it("accepts second answer", () => expect(checkAnswer("salve", ["ciao", "salve"])).toBe("correct"));
  it("close match against any answer", () => expect(checkAnswer("salvi", ["ciao", "salve"])).toBe("close"));
  it("wrong when none match", () => expect(checkAnswer("xyz", ["ciao", "salve"])).toBe("wrong"));
});

// ── scheduleCard — new cards ──────────────────────────────────────────────────

describe("scheduleCard() — new card initial ratings", () => {
  it("'good' graduates to review", () => {
    const next = scheduleCard(defaultProgress("x"), "good");
    expect(next.state).toBe("review");
    expect(next.reps).toBe(1);
    expect(next.lapses).toBe(0);
    expect(next.dueDate).toBeGreaterThan(Date.now());
  });

  it("'again' stays in learning with due=now (same-session retry)", () => {
    const next = scheduleCard(defaultProgress("x"), "again");
    expect(next.state).toBe("learning");
    expect(next.dueDate).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("'easy' gets higher stability than 'good'", () => {
    const easy = scheduleCard(defaultProgress("x"), "easy");
    const good = scheduleCard(defaultProgress("x"), "good");
    expect(easy.stability).toBeGreaterThan(good.stability);
  });

  it("'hard' gets lower stability than 'good'", () => {
    const hard = scheduleCard(defaultProgress("x"), "hard");
    const good = scheduleCard(defaultProgress("x"), "good");
    expect(hard.stability).toBeLessThan(good.stability);
  });

  it("stability is at least 0.001 even on 'again' (lower bound)", () => {
    const next = scheduleCard(defaultProgress("x"), "again");
    expect(next.stability).toBeGreaterThanOrEqual(0.001);
  });
});

// ── scheduleCard — stability clamping ─────────────────────────────────────────

describe("scheduleCard() — stability clamping", () => {
  const highStabilityCard = {
    ...defaultProgress("x"),
    state: "review" as const,
    stability: 999999,
    reps: 1,
    dueDate: Date.now() - 86400000,
  };

  it("extreme stability clamped to ≤ 36500 on 'easy'", () => {
    const next = scheduleCard(highStabilityCard, "easy");
    expect(next.stability).toBeLessThanOrEqual(36500);
  });

  it("extreme stability clamped to ≤ 36500 on 'good'", () => {
    const next = scheduleCard(highStabilityCard, "good");
    expect(next.stability).toBeLessThanOrEqual(36500);
  });

  it("resulting dueDate does not overflow (≤ 100 years from now)", () => {
    const next = scheduleCard(highStabilityCard, "easy");
    expect(next.dueDate).toBeLessThanOrEqual(Date.now() + 36500 * 86400000 + 60000);
  });

  it("lower bound: stability ≥ 0.001 even after forgetting", () => {
    const lapsedCard = { ...highStabilityCard, stability: 0.00001 };
    const next = scheduleCard(lapsedCard, "again");
    expect(next.stability).toBeGreaterThanOrEqual(0.001);
  });
});

// ── scheduleCard — review state transitions ───────────────────────────────────

describe("scheduleCard() — review state transitions", () => {
  it("review card 'again' → relearning with +1 lapse", () => {
    const initial = scheduleCard(defaultProgress("x"), "good");
    const lapsed  = scheduleCard(initial, "again");
    expect(lapsed.state).toBe("relearning");
    expect(lapsed.lapses).toBe(1);
  });

  it("review card 'good' → stays review", () => {
    const initial = scheduleCard(defaultProgress("x"), "good");
    const next    = scheduleCard(initial, "good");
    expect(next.state).toBe("review");
    expect(next.lapses).toBe(0);
  });

  it("review card 'hard' → stays review with lower stability than 'good'", () => {
    const base = scheduleCard(defaultProgress("x"), "good");
    const hard = scheduleCard(base, "hard");
    const good = scheduleCard(base, "good");
    expect(hard.state).toBe("review");
    expect(hard.stability).toBeLessThan(good.stability);
  });

  it("reps increments on every rating", () => {
    const a = scheduleCard(defaultProgress("x"), "good");
    const b = scheduleCard(a, "good");
    const c = scheduleCard(b, "again");
    expect(a.reps).toBe(1);
    expect(b.reps).toBe(2);
    expect(c.reps).toBe(3);
  });
});

// ── isDue ─────────────────────────────────────────────────────────────────────

describe("isDue()", () => {
  it("card due in the past is due", () => {
    expect(isDue({ ...defaultProgress("x"), dueDate: Date.now() - 1000 })).toBe(true);
  });

  it("card due in the future is not due", () => {
    expect(isDue({ ...defaultProgress("x"), dueDate: Date.now() + 86400000 })).toBe(false);
  });

  it("card due exactly at `now` is due", () => {
    const now = Date.now();
    expect(isDue({ ...defaultProgress("x"), dueDate: now }, now)).toBe(true);
  });
});

// ── autoRate ──────────────────────────────────────────────────────────────────

describe("autoRate() — all thresholds", () => {
  it("3 attempts → again", () => expect(autoRate(3, 500, false)).toBe("again"));
  it("4 attempts → again", () => expect(autoRate(4, 500, false)).toBe("again"));
  it("2 attempts → hard", () => expect(autoRate(2, 5000, false)).toBe("hard"));
  it("close match on 1st attempt → good (even if fast)", () =>
    expect(autoRate(1, 100, true)).toBe("good"));
  it("1st attempt < 10 s, not close → easy", () =>
    expect(autoRate(1, 9_999, false)).toBe("easy"));
  it("1st attempt 10 s exactly → good", () =>
    expect(autoRate(1, 10_000, false)).toBe("good"));
  it("1st attempt 10–25 s → good", () =>
    expect(autoRate(1, 15_000, false)).toBe("good"));
  it("1st attempt ≥ 25 s → hard", () =>
    expect(autoRate(1, 25_000, false)).toBe("hard"));
  it("1st attempt very slow → hard", () =>
    expect(autoRate(1, 120_000, false)).toBe("hard"));
});

// ── FSRS property-based invariant tests (#022) ────────────────────────────────
// Uses it.each — no property-testing library required.
// Covers all 4 grades × 4 states × 3 difficulty values = 48 combinations per invariant.

const GRADES: Grade[] = ["again", "hard", "good", "easy"];
const STATES: CardState[] = ["new", "learning", "review", "relearning"];
const DIFFICULTIES = [1, 5, 10];

function makeProgressCard(
  state: CardState,
  difficulty: number,
  stability = 5,
): CardProgress {
  return {
    cardId: "prop-test",
    state,
    stability,
    difficulty,
    retrievability: 0.9,
    dueDate: Date.now() - 86400000, // 1 day overdue — exercises elapsed-days path
    lapses: 0,
    reps: state === "new" ? 0 : 2,
  };
}

// Flatten to a single list for it.each
const ALL_COMBOS = GRADES.flatMap((grade) =>
  STATES.flatMap((state) =>
    DIFFICULTIES.map((difficulty) => ({ grade, state, difficulty }))
  )
);

describe("scheduleCard() — FSRS invariants (property-based, #022)", () => {
  it.each(ALL_COMBOS)(
    "difficulty in [1,10]: state=$state difficulty=$difficulty grade=$grade",
    ({ grade, state, difficulty }) => {
      const next = scheduleCard(makeProgressCard(state, difficulty), grade);
      expect(next.difficulty).toBeGreaterThanOrEqual(1);
      expect(next.difficulty).toBeLessThanOrEqual(10);
    }
  );

  it.each(ALL_COMBOS)(
    "stability ≥ 0.001: state=$state difficulty=$difficulty grade=$grade",
    ({ grade, state, difficulty }) => {
      const next = scheduleCard(makeProgressCard(state, difficulty), grade);
      expect(next.stability).toBeGreaterThanOrEqual(0.001);
    }
  );

  it.each(ALL_COMBOS)(
    "stability ≤ 36500: state=$state difficulty=$difficulty grade=$grade",
    ({ grade, state, difficulty }) => {
      // Use extreme stability to stress-test the upper-bound clamp
      const next = scheduleCard(makeProgressCard(state, difficulty, 999999), grade);
      expect(next.stability).toBeLessThanOrEqual(36500);
    }
  );

  it.each(ALL_COMBOS)(
    "reps increments by 1: state=$state difficulty=$difficulty grade=$grade",
    ({ grade, state, difficulty }) => {
      const prev = makeProgressCard(state, difficulty);
      const next = scheduleCard(prev, grade);
      expect(next.reps).toBe(prev.reps + 1);
    }
  );

  // dueDate monotonicity applies only to non-"again" grades in review/relearning states
  // ("again" resets to now for same-session retry; learning states may also produce interval=0)
  const REVIEW_STATES: CardState[] = ["review", "relearning"];
  const NON_AGAIN_GRADES: Grade[] = ["hard", "good", "easy"];

  it.each(
    REVIEW_STATES.flatMap((state) =>
      NON_AGAIN_GRADES.map((grade) => ({ state, grade }))
    )
  )(
    "dueDate monotonicity in $state state — grade=$grade → dueDate > prev.dueDate",
    ({ state, grade }) => {
      const prev = makeProgressCard(state, 5, 10);
      const next = scheduleCard(prev, grade);
      expect(next.dueDate).toBeGreaterThan(prev.dueDate);
    }
  );
});
