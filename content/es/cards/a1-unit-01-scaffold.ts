import type { Unit } from "@/content/types";

// SCAFFOLD UNIT — NOT real curriculum content.
//
// This unit exists solely to prove the content/es/index.ts pipeline runs end-to-end
// (exportPack.ts -> validatePack.ts -> lintCardQuality.ts) for a second target language,
// per the multi-language architecture prep plan. exportPack.ts's ALL_UNITS-empty guard
// (scripts/exportPack.ts, "ALL_UNITS is empty — aborting") means a genuinely empty
// content/es/index.ts cannot be used to prove the pipeline works — this unit is the
// smallest real, linguistically-correct stand-in that satisfies that guard plus the Card
// Quality Gate's HARD tier-completeness check (every unit needs cards in all 4 tiers).
//
// Do NOT build the real Spanish A1 curriculum on top of this file — CURRICULUM.md's
// process (word-frequency sourcing, full density targets, multi-round adversarial audit)
// is the real next step, a separate project from this architecture-prep work. Delete or
// replace this unit entirely once that starts; nothing in the app depends on its exact
// content, only on content/es/index.ts exporting a non-empty, schema-valid ALL_UNITS.
const unit: Unit = {
  id: "es-a1-unit-01-scaffold",
  name: "Scaffold — Greetings",
  level: "A1",
  theme: "Greetings",
  emoji: "👋",
  prerequisiteUnits: [],
  cards: [
    // ─── Tier 1 – Vocabulary ───────────────────────────────────────────────
    {
      id: "es-a1u01-t1-001",
      type: "produce",
      prompt: "hello",
      accepted: ["hola"],
      hint: "The universal Spanish greeting.",
      tags: ["greetings"],
      tier: 1,
    },
    {
      id: "es-a1u01-t1-002",
      type: "recognize",
      prompt: "gracias",
      accepted: ["thank you"],
      hint: "Said after receiving something.",
      tags: ["greetings"],
      tier: 1,
    },
    // ─── Tier 2 – Grammar ───────────────────────────────────────────────────
    {
      id: "es-a1u01-t2-001",
      type: "fill_blank",
      prompt: "___ Elena, ¿y tú?",
      accepted: ["Soy"],
      hint: "\"Ser\" (to be), yo form — used for identity, not temporary states.",
      tags: ["greetings", "grammar"],
      tier: 2,
    },
    // ─── Tier 3 – Phrases ───────────────────────────────────────────────────
    {
      id: "es-a1u01-t3-001",
      type: "produce",
      prompt: "nice to meet you",
      accepted: ["mucho gusto"],
      hint: "Said the first time you meet someone.",
      tags: ["greetings", "phrases"],
      tier: 3,
    },
    // ─── Tier 4 – Passage ───────────────────────────────────────────────────
    {
      id: "es-a1u01-t4-001",
      type: "passage_cloze",
      prompt: "Hola, me llamo Elena. ___ profesora y vivo en Madrid. Mucho gusto, y gracias por tu tiempo.",
      accepted: ["Soy"],
      hint: "Introducing yourself: name, profession, city.",
      tags: ["greetings", "passage"],
      tier: 4,
    },
  ],
};

export default unit;
