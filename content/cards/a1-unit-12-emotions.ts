import type { Unit } from "@/content/types";

const unit: Unit = {
  id: "a1-unit-12-emotions",
  name: "Emotions",
  level: "A1",
  theme: "Feelings & Personality",
  emoji: "😊",
  prerequisiteUnits: ["a1-unit-11-food"],
  cards: [
    // ── TIER 1: VOCABULARY ─────────────────────────────────────

    // Emotions
    {
      id: "a112-t1-001",
      type: "produce",
      prompt: "happy",
      accepted: ["felice"],
      hint: "Same form m/f — felice. Plural: felici.",
      tags: ["adjective", "emotion", "A1"],
      tier: 1,
    },
    {
      id: "a112-t1-002",
      type: "produce",
      prompt: "sad",
      accepted: ["triste"],
      hint: "Same form m/f — triste. Plural: tristi.",
      tags: ["adjective", "emotion", "A1"],
      tier: 1,
    },
    {
      id: "a112-t1-003",
      type: "produce",
      prompt: "angry",
      accepted: ["arrabbiato", "arrabbiata"],
      hint: "arrabbiato (m) / arrabbiata (f).",
      tags: ["adjective", "emotion", "A1"],
      tier: 1,
    },
    // ... (22 Tier 1 cards total)

    // ── TIER 2: GRAMMAR ────────────────────────────────────────
    // 4 fill_blank cards covering cause/effect, adjective agreement, "Come stai?"

    // ── TIER 3: PHRASES ────────────────────────────────────────
    // 5 eng_to_ita cards

    // ── TIER 4: PASSAGE CLOZE ──────────────────────────────────
    // 1 passage_cloze: Marco's job interview nerves
  ],
};

export default unit;
