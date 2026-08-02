import type { Unit } from "./types";

// NOTE: Italian card IDs use the legacy format "u{unit}-t{tier}-{seq}" (e.g., "u01-t1-001").
// All future languages use the namespaced format "{lang}-{level}u{unit}-t{tier}-{seq}" (e.g., "es-a1u01-t1-001").
// Do NOT migrate Italian IDs — it would require a store migration that risks corrupting live user data.

// A1 — Beginner (20 units)
import a1Unit01 from "./cards/a1-unit-01-greetings";
import a1Unit02 from "./cards/a1-unit-02-bar";
import a1Unit03 from "./cards/a1-unit-03-family";
import a1Unit04 from "./cards/a1-unit-04-city";
import a1Unit05 from "./cards/a1-unit-05-time";
import a1Unit06 from "./cards/a1-unit-06-describing";
import a1Unit07 from "./cards/a1-unit-07-likes";
import a1Unit08 from "./cards/a1-unit-08-review";
import a1Unit09 from "./cards/a1-unit-09-colors";
import a1Unit10 from "./cards/a1-unit-10-body";
import a1Unit11 from "./cards/a1-unit-11-food";
import a1Unit12 from "./cards/a1-unit-12-emotions";
import a1Unit13 from "./cards/a1-unit-13-household";
import a1Unit14 from "./cards/a1-unit-14-animals";
import a1Unit15 from "./cards/a1-unit-15-numbers";
import a1Unit16 from "./cards/a1-unit-16-shopping";
import a1Unit17 from "./cards/a1-unit-17-weather";
import a1Unit18 from "./cards/a1-unit-18-routine";
import a1Unit19 from "./cards/a1-unit-19-work";
import a1Unit20 from "./cards/a1-unit-20-clothes";

// A2 — Elementary (30 units)
import a2Unit10 from "./cards/a2-unit-10-past-avere";
import a2Unit11 from "./cards/a2-unit-11-past-essere";
import a2Unit12 from "./cards/a2-unit-12-imperfetto";
import a2Unit13 from "./cards/a2-unit-13-shopping";
import a2Unit14 from "./cards/a2-unit-14-daily-routine";
import a2Unit15 from "./cards/a2-unit-15-future";
import a2Unit16 from "./cards/a2-unit-16-conditional";
import a2Unit17 from "./cards/a2-unit-17-comparisons";
import a2Unit18 from "./cards/a2-unit-18-a2-review";
import a2Unit19 from "./cards/a2-unit-19-weather";
import a2Unit20 from "./cards/a2-unit-20-adverbs";
import a2Unit21 from "./cards/a2-unit-21-verbs-ii";
import a2Unit22 from "./cards/a2-unit-22-professions";
import a2Unit23 from "./cards/a2-unit-23-numbers-ii";
import a2Unit24 from "./cards/a2-unit-24-adjectives-ii";
import a2Unit25 from "./cards/a2-unit-25-nature";
import a2Unit26 from "./cards/a2-unit-26-irregular-participles";
import a2Unit27 from "./cards/a2-unit-27-reflexive-verbs-expanded";
import a2Unit28 from "./cards/a2-unit-28-travel-transportation";
import a2Unit29 from "./cards/a2-unit-29-restaurants-food-culture";
import a2Unit30 from "./cards/a2-unit-30-technology-internet";
import a2Unit31 from "./cards/a2-unit-31-passato-vs-imperfetto";
import a2Unit32 from "./cards/a2-unit-32-at-the-doctor";
import a2Unit33 from "./cards/a2-unit-33-media-entertainment";
import a2Unit34 from "./cards/a2-unit-34-relationships-social-life";
import a2Unit35 from "./cards/a2-unit-35-describing-people-personalities";
import a2Unit36 from "./cards/a2-unit-36-education-studies";
import a2Unit37 from "./cards/a2-unit-37-money-banking";
import a2Unit38 from "./cards/a2-unit-38-time-expressions";
import a2Unit39 from "./cards/a2-unit-39-housing-renting";

// B1 — Intermediate (36 units)
import b1Unit19 from "./cards/b1-unit-19-relative-pronouns";
import b1Unit20 from "./cards/b1-unit-20-congiuntivo";
import b1Unit21 from "./cards/b1-unit-21-trapassato";
import b1Unit22 from "./cards/b1-unit-22-gerundio";
import b1Unit23 from "./cards/b1-unit-23-passivo";
import b1Unit24 from "./cards/b1-unit-24-si-impersonale";
import b1Unit25 from "./cards/b1-unit-25-travel";
import b1Unit26 from "./cards/b1-unit-26-work";
import b1Unit27 from "./cards/b1-unit-27-health";
import b1Unit28 from "./cards/b1-unit-28-b1-review";
import b1Unit29 from "./cards/b1-unit-29-sports-hobbies";
import b1Unit30 from "./cards/b1-unit-30-school-education";
import b1Unit31 from "./cards/b1-unit-31-materials";
import b1Unit32 from "./cards/b1-unit-32-social";
import b1Unit33 from "./cards/b1-unit-33-subjunctive-opinions";
import b1Unit34 from "./cards/b1-unit-34-subjunctive-impersonal";
import b1Unit35 from "./cards/b1-unit-35-subjunctive-emotion";
import b1Unit36 from "./cards/b1-unit-36-hypothetical";
import b1Unit37 from "./cards/b1-unit-37-concession-contrast";
import b1Unit38 from "./cards/b1-unit-38-cause-effect";
import b1Unit39 from "./cards/b1-unit-39-purpose-result";
import b1Unit40 from "./cards/b1-unit-40-formal-register";
import b1Unit41 from "./cards/b1-unit-41-society-social-life";
import b1Unit42 from "./cards/b1-unit-42-politics-civic-basics";
import b1Unit43 from "./cards/b1-unit-43-economy-everyday";
import b1Unit44 from "./cards/b1-unit-44-technology-digital-life";
import b1Unit45 from "./cards/b1-unit-45-environment-nature";
import b1Unit46 from "./cards/b1-unit-46-art-museums";
import b1Unit47 from "./cards/b1-unit-47-music-performing-arts";
import b1Unit48 from "./cards/b1-unit-48-keeping-up-with-news";
import b1Unit49 from "./cards/b1-unit-49-italian-history-ancient-medieval";
import b1Unit50 from "./cards/b1-unit-50-italian-history-modern";
import b1Unit51 from "./cards/b1-unit-51-life-stages-milestones";
import b1Unit52 from "./cards/b1-unit-52-sleep-stress-wellbeing";
import b1Unit53 from "./cards/b1-unit-53-subjunctive-connector-mastery";
import b1Unit54 from "./cards/b1-unit-54-imperativo-informale";

// B2 — Upper Intermediate (13 units)
import b2Unit29 from "./cards/b2-unit-29-hypotheticals";
import b2Unit30 from "./cards/b2-unit-30-reported-speech";
import b2Unit31 from "./cards/b2-unit-31-nuanced-opinions";
import b2Unit32 from "./cards/b2-unit-32-formal-register";
import b2Unit33 from "./cards/b2-unit-33-media-news";
import b2Unit34 from "./cards/b2-unit-34-abstract-ideas";
import b2Unit35 from "./cards/b2-unit-35-numbers-economy";
import b2Unit36 from "./cards/b2-unit-36-italian-culture";
import b2Unit37 from "./cards/b2-unit-37-advanced-idioms";
import b2Unit38 from "./cards/b2-unit-38-b2-review";
import b2Unit39 from "./cards/b2-unit-39-science-tech";
import b2Unit40 from "./cards/b2-unit-40-law-society";
import b2Unit41 from "./cards/b2-unit-41-psychology";

export const ALL_UNITS: Unit[] = [
  // A1
  a1Unit01, a1Unit02, a1Unit03, a1Unit04,
  a1Unit05, a1Unit06, a1Unit07, a1Unit08,
  a1Unit09, a1Unit10, a1Unit11, a1Unit12, a1Unit13, a1Unit14,
  a1Unit15, a1Unit16, a1Unit17, a1Unit18, a1Unit19, a1Unit20,
  // A2
  a2Unit10, a2Unit11, a2Unit12, a2Unit13, a2Unit14,
  a2Unit15, a2Unit16, a2Unit17, a2Unit18,
  a2Unit19, a2Unit20, a2Unit21, a2Unit22, a2Unit23, a2Unit24, a2Unit25,
  a2Unit26, a2Unit27, a2Unit28, a2Unit29, a2Unit30,
  a2Unit31, a2Unit32, a2Unit33, a2Unit34, a2Unit35,
  a2Unit36, a2Unit37, a2Unit38, a2Unit39,
  // B1
  b1Unit19, b1Unit20, b1Unit21, b1Unit22, b1Unit23,
  b1Unit24, b1Unit25, b1Unit26, b1Unit27, b1Unit28,
  b1Unit29, b1Unit30, b1Unit31, b1Unit32,
  b1Unit33, b1Unit34, b1Unit35, b1Unit36, b1Unit37, b1Unit38, b1Unit39, b1Unit40,
  b1Unit41, b1Unit42, b1Unit43, b1Unit44, b1Unit45, b1Unit46, b1Unit47, b1Unit48,
  b1Unit49, b1Unit50, b1Unit51, b1Unit52, b1Unit53, b1Unit54,
  // B2
  b2Unit29, b2Unit30, b2Unit31, b2Unit32, b2Unit33,
  b2Unit34, b2Unit35, b2Unit36, b2Unit37, b2Unit38,
  b2Unit39, b2Unit40, b2Unit41,
];

export const UNIT_MAP: Record<string, Unit> = Object.fromEntries(
  ALL_UNITS.map((u) => [u.id, u])
);

export type { Unit };
