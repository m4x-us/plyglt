// Answer evaluation utilities extracted from lib/srs.ts.
// Contains only checking / matching logic — no FSRS scheduling code.
// lib/srs.ts re-exports everything here for backwards compatibility.

// ── Article regexes ──────────────────────────────────────────────────────────
// Longest alternatives first: prevents partial prefix matches
// ("un" must come after "uno"/"una"/"un'" so "una pizza" strips correctly)

export const ITALIAN_ARTICLES = /^(il|lo|la|l'|l'|gli|le|un'|un'|uno|una|un|i)\s*/i;
export const SPANISH_ARTICLES = /^(el|los|las|la|unos|unas|una|un)\s*/i;

// ── Utilities ────────────────────────────────────────────────────────────────

export function stripArticle(s: string, articles: RegExp | null): string {
  return articles ? s.replace(articles, "") : s;
}

// Standard dynamic-programming Levenshtein distance.
export function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      // Non-null: dp is fully initialised by the Array.from above
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[a.length]![b.length]!;
}

// ── checkAnswer ──────────────────────────────────────────────────────────────

export function checkAnswer(
  typed: string,
  accepted: string[],
  options?: { articles?: RegExp | null; diacriticTolerant?: boolean }
): "correct" | "close" | "wrong" {
  const articles = options?.articles ?? null; // null = no stripping; callers must be explicit
  const diacriticTolerant = options?.diacriticTolerant ?? false;

  // NFC: canonical Unicode composition — preserves accents for exact matching
  const normalize = (s: string) =>
    s.toLowerCase().trim()
      .normalize("NFC")
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");

  // Used only when diacriticTolerant: true — NFD decompose, strip combining marks, re-compose
  const normalizeStripped = (s: string) =>
    s.toLowerCase().trim()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .normalize("NFC")
      .replace(/['']/g, "'")
      .replace(/\s+/g, " ");

  const t = normalize(typed);
  const tNoArticle = normalize(stripArticle(typed, articles));
  // Pre-compute stripped forms once (used for both diacriticTolerant "close" and
  // to exclude accent-only pairs from the Levenshtein typo check)
  const tS = normalizeStripped(typed);
  const tNoArticleS = normalizeStripped(stripArticle(typed, articles));

  for (const answer of accepted) {
    const a = normalize(answer);
    const aNoArticle = normalize(stripArticle(answer, articles));

    if (t === a || t === aNoArticle || tNoArticle === a || tNoArticle === aNoArticle) {
      return "correct";
    }

    const aS = normalizeStripped(answer);
    const aNoArticleS = normalizeStripped(stripArticle(answer, articles));
    const isAccentOnly = tS === aS || tS === aNoArticleS || tNoArticleS === aS || tNoArticleS === aNoArticleS;

    if (isAccentOnly) {
      // Accent-only difference: only "close" when caller opts in to diacritic tolerance
      if (diacriticTolerant) return "close";
      // Otherwise falls through to "wrong" — missing an accent is not a typo
    } else {
      const distances = [
        levenshtein(t, a),
        levenshtein(t, aNoArticle),
        levenshtein(tNoArticle, a),
        levenshtein(tNoArticle, aNoArticle),
      ];
      if (a.length > 4 && Math.min(...distances) === 1) return "close";
    }
  }
  return "wrong";
}
