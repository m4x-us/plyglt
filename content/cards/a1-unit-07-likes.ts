import type { Unit } from "@/content/types";

const unit: Unit = {
  id: "a1-unit-07-likes",
  name: "Likes & Opinions",
  level: "A1",
  theme: "Likes & Opinions",
  emoji: "❤️",
  prerequisiteUnits: ["a1-unit-02-bar", "a1-unit-06-describing"],
  cards: [
    // -------------------------------------------------------------------------
    // TIER 1 — Vocabulary
    // -------------------------------------------------------------------------
    {
      id: "u07-t1-001",
      type: "produce",
      prompt: "to eat",
      accepted: ["mangiare"],
      hint: "infinitive verb",
      tags: ["verb", "infinitive", "food", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-002",
      type: "produce",
      prompt: "to drink",
      accepted: ["bere"],
      hint: "infinitive verb",
      tags: ["verb", "infinitive", "drinks", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-003",
      type: "produce",
      prompt: "to read",
      accepted: ["leggere"],
      hint: "infinitive verb",
      tags: ["verb", "infinitive", "hobby", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-004",
      type: "produce",
      prompt: "to watch",
      accepted: ["guardare"],
      hint: "infinitive verb",
      tags: ["verb", "infinitive", "hobby", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-005",
      type: "produce",
      prompt: "to listen",
      accepted: ["ascoltare"],
      hint: "infinitive verb",
      tags: ["verb", "infinitive", "hobby", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-006",
      type: "produce",
      prompt: "to cook",
      accepted: ["cucinare"],
      hint: "infinitive verb",
      tags: ["verb", "infinitive", "food", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-007",
      type: "produce",
      prompt: "to walk",
      accepted: ["camminare"],
      hint: "infinitive verb",
      tags: ["verb", "infinitive", "sport", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-008",
      type: "produce",
      prompt: "to sleep",
      accepted: ["dormire"],
      hint: "infinitive verb",
      tags: ["verb", "infinitive", "daily", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-009",
      type: "produce",
      prompt: "the book",
      accepted: ["il libro"],
      hint: "masculine noun",
      tags: ["noun", "masculine", "hobby", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-010",
      type: "produce",
      prompt: "the music",
      accepted: ["la musica"],
      hint: "feminine noun",
      tags: ["noun", "feminine", "hobby", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-011",
      type: "produce",
      prompt: "the film / movie",
      accepted: ["il film"],
      hint: "masculine noun — same word in Italian!",
      tags: ["noun", "masculine", "hobby", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-012",
      type: "produce",
      prompt: "the sport",
      accepted: ["lo sport"],
      hint: "uses 'lo' before s+consonant",
      tags: ["noun", "masculine", "sport", "tier1"],
      tier: 1,
    },
    {
      id: "u07-t1-013",
      type: "produce",
      prompt: "the pizza",
      accepted: ["la pizza"],
      hint: "feminine noun",
      tags: ["noun", "feminine", "food", "tier1"],
      tier: 1,
    },

    // -------------------------------------------------------------------------
    // TIER 2 — Grammar (piacere construction)
    // -------------------------------------------------------------------------
    {
      id: "u07-t2-001",
      type: "recognize",
      prompt: "Mi piace la pizza.",
      accepted: [
        "I like pizza.",
        "I like the pizza.",
        "Pizza pleases me.",
        "The pizza pleases me.",
      ],
      hint: "Lit: 'pizza pleases me' — singular subject → piace",
      tags: ["grammar", "piacere", "first-person", "singular", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-002",
      type: "produce",
      prompt: "Do you like music?",
      accepted: ["Ti piace la musica?"],
      hint: "ti = to you; piace (singular) because 'la musica' is singular",
      tags: ["grammar", "piacere", "second-person", "question", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-003",
      type: "produce",
      prompt: "He likes books. (lit: books please him)",
      accepted: ["Gli piacciono i libri.", "Gli piacciono i libri"],
      hint: "gli = to him; piacciono (plural) because 'i libri' is plural",
      tags: ["grammar", "piacere", "third-person", "plural", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-004",
      type: "produce",
      prompt: "She likes the film.",
      accepted: ["Le piace il film.", "Le piace il film"],
      hint: "le = to her; piace (singular) because 'il film' is singular",
      tags: ["grammar", "piacere", "third-person", "feminine", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-005",
      type: "produce",
      prompt: "I don't like… (start of phrase)",
      accepted: ["Non mi piace…", "Non mi piace"],
      hint: "non goes before the pronoun",
      tags: ["grammar", "piacere", "negation", "first-person", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-006",
      type: "produce",
      prompt: "I don't understand.",
      accepted: ["Non capisco.", "Non capisco"],
      hint: "non + verb = negation; capisco = I understand",
      tags: ["grammar", "negation", "capire", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-007",
      type: "recognize",
      prompt: "lo",
      accepted: ["it (masculine)", "him", "it"],
      hint: "direct object pronoun, masculine singular",
      tags: ["grammar", "pronoun", "direct-object", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-008",
      type: "recognize",
      prompt: "la",
      accepted: ["it (feminine)", "her", "it"],
      hint: "direct object pronoun, feminine singular",
      tags: ["grammar", "pronoun", "direct-object", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-009",
      type: "recognize",
      prompt: "li",
      accepted: ["them (masculine)", "them"],
      hint: "direct object pronoun, masculine plural",
      tags: ["grammar", "pronoun", "direct-object", "plural", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-010",
      type: "recognize",
      prompt: "le",
      accepted: ["them (feminine)", "them"],
      hint: "direct object pronoun, feminine plural — also means 'to her' as indirect pronoun",
      tags: ["grammar", "pronoun", "direct-object", "plural", "tier2"],
      tier: 2,
    },
    {
      id: "u07-t2-011",
      type: "fill_blank",
      prompt: "Rule: singular noun after piacere → ___; plural noun → ___",
      accepted: ["piace; piacciono", "piace / piacciono"],
      hint: "piace (sing.) or piacciono (pl.) — the subject is what is liked, not the person",
      tags: ["grammar", "piacere", "rule", "tier2"],
      tier: 2,
    },

    // -------------------------------------------------------------------------
    // TIER 3 — Chunks
    // -------------------------------------------------------------------------
    {
      id: "u07-t3-001",
      type: "recognize",
      prompt: "Mi piace molto.",
      accepted: ["I like it very much.", "I like it a lot.", "I really like it."],
      hint: "molto = very much / a lot",
      tags: ["chunk", "piacere", "adverb", "tier3"],
      tier: 3,
      prerequisites: ["u07-t2-001"],
    },
    {
      id: "u07-t3-002",
      type: "recognize",
      prompt: "Non mi piace.",
      accepted: ["I don't like it.", "I do not like it."],
      hint: "piace without a following noun = 'it pleases me'",
      tags: ["chunk", "piacere", "negation", "tier3"],
      tier: 3,
      prerequisites: ["u07-t2-005"],
    },
    {
      id: "u07-t3-003",
      type: "produce",
      prompt: "I love / adore… (start of phrase)",
      accepted: ["Adoro…", "Adoro"],
      hint: "adoro is stronger than 'mi piace'",
      tags: ["chunk", "adoro", "opinion", "tier3"],
      tier: 3,
    },
    {
      id: "u07-t3-004",
      type: "produce",
      prompt: "I prefer… (start of phrase)",
      accepted: ["Preferisco…", "Preferisco"],
      hint: "from preferire — irregular -isc- form",
      tags: ["chunk", "preferire", "opinion", "tier3"],
      tier: 3,
    },
    {
      id: "u07-t3-005",
      type: "produce",
      prompt: "Do you like…? (start of question)",
      accepted: ["Ti piace…?", "Ti piace"],
      hint: "ti = to you (informal)",
      tags: ["chunk", "piacere", "question", "tier3"],
      tier: 3,
      prerequisites: ["u07-t2-002"],
    },
    {
      id: "u07-t3-006",
      type: "recognize",
      prompt: "Non mi piace per niente.",
      accepted: [
        "I don't like it at all.",
        "I do not like it at all.",
        "I don't like it one bit.",
      ],
      hint: "per niente = at all / not at all",
      tags: ["chunk", "piacere", "negation", "emphasis", "tier3"],
      tier: 3,
      prerequisites: ["u07-t2-005", "u07-t3-002"],
    },

    // -------------------------------------------------------------------------
    // TIER 4 — Sentences
    // -------------------------------------------------------------------------
    {
      id: "u07-t4-001",
      type: "recognize",
      prompt: "Mi piace molto mangiare la pizza e bere il vino.",
      accepted: [
        "I like eating pizza and drinking wine very much.",
        "I really like eating pizza and drinking wine.",
        "I like to eat pizza and drink wine very much.",
        "I very much like to eat pizza and drink wine.",
      ],
      hint: "Two infinitives as subjects of mi piace",
      tags: ["sentence", "piacere", "food", "drinks", "tier4"],
      tier: 4,
      prerequisites: [
        "u07-t1-001", // mangiare
        "u07-t1-002", // bere
        "u07-t1-013", // la pizza
        "u07-t2-001", // mi piace construction
        "u07-t3-001", // molto
      ],
    },
    {
      id: "u07-t4-002",
      type: "recognize",
      prompt: "Gli piacciono i libri ma non gli piace il film.",
      accepted: [
        "He likes books but he doesn't like the film.",
        "He likes books but doesn't like the film.",
        "He likes books but he doesn't like movies.",
        "Books please him but the film doesn't please him.",
      ],
      hint: "piacciono (pl. libri) vs piace (sing. film)",
      tags: ["sentence", "piacere", "piacciono", "negation", "tier4"],
      tier: 4,
      prerequisites: [
        "u07-t1-009", // il libro
        "u07-t1-011", // il film
        "u07-t2-003", // gli piacciono (plural)
        "u07-t2-004", // le/gli piace singular
        "u07-t2-005", // non mi/gli piace
        "u07-t2-011", // piace vs piacciono rule
      ],
    },
    {
      id: "u07-t4-003",
      type: "recognize",
      prompt: "Non mi piace cucinare ma adoro mangiare.",
      accepted: [
        "I don't like cooking but I love eating.",
        "I don't like to cook but I love to eat.",
        "I don't like cooking but I adore eating.",
        "I don't like to cook but I adore to eat.",
      ],
      hint: "cucinare and mangiare are infinitives used as nouns",
      tags: ["sentence", "piacere", "negation", "adoro", "tier4"],
      tier: 4,
      prerequisites: [
        "u07-t1-001", // mangiare
        "u07-t1-006", // cucinare
        "u07-t2-005", // non mi piace
        "u07-t3-003", // adoro
      ],
    },
    {
      id: "u07-t4-004",
      type: "fill_blank",
      prompt: "Mi ___ la musica.",
      accepted: ["piace"],
      hint: "la musica is singular — which form of piacere?",
      tags: ["sentence", "piacere", "fill-blank", "music", "tier4"],
      tier: 4,
      prerequisites: [
        "u07-t1-010", // la musica
        "u07-t2-001", // mi piace construction
        "u07-t2-011", // piace vs piacciono rule
      ],
    },
    {
      id: "u07-t4-005",
      type: "recognize",
      prompt: "Ti piace lo sport? No, preferisco leggere.",
      accepted: [
        "Do you like sport? No, I prefer to read.",
        "Do you like sports? No, I prefer reading.",
        "Do you like sport? No, I prefer reading.",
        "Do you like sports? No, I prefer to read.",
      ],
      hint: "preferisco = I prefer (preferire, -isc- form)",
      tags: ["sentence", "piacere", "preferire", "leggere", "tier4"],
      tier: 4,
      prerequisites: [
        "u07-t1-003", // leggere
        "u07-t1-012", // lo sport
        "u07-t2-002", // ti piace question
        "u07-t3-004", // preferisco
        "u07-t3-005", // ti piace…?
      ],
    },
  ],
};

export default unit;
