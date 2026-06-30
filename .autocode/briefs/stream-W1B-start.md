# Barry — Stream W1B — Wave 1 — 2026-06-30

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Barry | W1B | #131 #132 #133 #134 #135

You are Barry, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #131  — A1 Unit 06 Describing — Spanish source-language translation
2. /task #132  — A1 Unit 07 Likes — Spanish source-language translation
3. /task #133  — A1 Unit 08 Review — Spanish source-language translation
4. /task #134  — A1 Unit 09 Colors — Spanish source-language translation
5. /task #135  — A1 Unit 10 Body — Spanish source-language translation

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Barry — W1B
[✓] #131 — Unit 06 Describing   ← done
[→] #132 — Unit 07 Likes        ← starting now
[ ] #133 — Unit 08 Review
[ ] #134 — Unit 09 Colors
[ ] #135 — Unit 10 Body

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
content/cards/a1-unit-06-describing.ts
content/cards/a1-unit-07-likes.ts
content/cards/a1-unit-08-review.ts
content/cards/a1-unit-09-colors.ts
content/cards/a1-unit-10-body.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
content/cards/a1-unit-01-greetings.ts
content/cards/a1-unit-02-bar.ts
content/cards/a1-unit-03-family.ts
content/cards/a1-unit-04-city.ts
content/cards/a1-unit-05-time.ts
content/cards/a1-unit-11-food.ts
content/cards/a1-unit-12-emotions.ts
content/cards/a1-unit-13-household.ts
content/cards/a1-unit-14-animals.ts
content/cards/a1-unit-15-numbers.ts
content/cards/a1-unit-16-shopping.ts
content/cards/a1-unit-17-weather.ts
content/cards/a1-unit-18-routine.ts
content/cards/a1-unit-19-work.ts
content/cards/a1-unit-20-clothes.ts

## Task Definitions

### Task #131 — Describing Spanish translation
**What:** Open `content/cards/a1-unit-06-describing.ts`. For every `produce` card add `prompts: { es: "..." }`. For every `recognize` card add `translations: { es: ["..."] }`. Skip `conjugate`, `fill_blank`, `passage_cloze`.
Key vocab: alto/a→alto/a; basso/a→bajo/a; grande→grande; piccolo/a→pequeño/a; bello/a→bonito/a/hermoso/a; brutto/a→feo/a; giovane→joven; vecchio/a→viejo/a; magro/a→delgado/a; grasso/a→gordo/a; lungo/a→largo/a; corto/a→corto/a; nuovo/a→nuevo/a; caro/a→caro/a; economico/a→económico/a/barato/a; difficile→difícil; facile→fácil; interessante→interesante; noioso/a→aburrido/a; simpatico/a→simpático/a; antipatico/a→antipático/a; intelligente→inteligente; stupido/a→estúpido/a; forte→fuerte; debole→débil.
**File:** `content/cards/a1-unit-06-describing.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-06-describing.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

### Task #132 — Likes Spanish translation
**What:** Open `content/cards/a1-unit-07-likes.ts`. Same pattern.
Key vocab: mi piace→me gusta; non mi piace→no me gusta; mi piacciono→me gustan; adoro→adoro; odio→odio; preferisco→prefiero; sport→deporte; musica→música; film→película; libro→libro; viaggiare→viajar; cucinare→cocinar; leggere→leer; scrivere→escribir; cantare→cantar; ballare→bailar; giocare→jugar; nuotare→nadar; correre→correr; dipingere→pintar; fotografare→fotografiar; fare sport→hacer deporte; ascoltare musica→escuchar música; guardare film→ver películas.
**File:** `content/cards/a1-unit-07-likes.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-07-likes.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

### Task #133 — Review Spanish translation
**What:** Open `content/cards/a1-unit-08-review.ts`. Same pattern. This unit covers common irregular verbs.
Key vocab: essere→ser/estar; avere→tener; fare→hacer; andare→ir; venire→venir; potere→poder; volere→querer; dovere→deber; sapere→saber; stare→estar; dare→dar; dire→decir; mangiare→comer; bere→beber; dormire→dormir; lavorare→trabajar; abitare→vivir/habitar; parlare→hablar; capire→entender; guardare→mirar; sentire→oír/sentir; aprire→abrir; chiudere→cerrar; mettere→poner; prendere→tomar/coger.
**File:** `content/cards/a1-unit-08-review.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-08-review.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

### Task #134 — Colors Spanish translation
**What:** Open `content/cards/a1-unit-09-colors.ts`. Same pattern.
Key vocab: rosso/a→rojo/a; blu→azul; verde→verde; giallo/a→amarillo/a; bianco/a→blanco/a; nero/a→negro/a; arancione→naranja; viola→morado/a/violeta; rosa→rosa; grigio/a→gris; marrone→marrón; beige→beige; cerchio→círculo; quadrato→cuadrado; triangolo→triángulo; rettangolo→rectángulo; ovale→óvalo; chiaro/a→claro/a; scuro/a→oscuro/a; colorato/a→colorido/a; di che colore è→de qué color es; azzurro→azul cielo; dorato/a→dorado/a; argentato/a→plateado/a.
**File:** `content/cards/a1-unit-09-colors.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-09-colors.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

### Task #135 — Body Spanish translation
**What:** Open `content/cards/a1-unit-10-body.ts`. Same pattern.
Key vocab: testa→cabeza; occhio/occhi→ojo/ojos; naso→nariz; bocca→boca; orecchio→oreja; collo→cuello; spalla→hombro; braccio/braccia→brazo/brazos; mano/mani→mano/manos; dito/dita→dedo/dedos; petto→pecho; stomaco→estómago; schiena→espalda; gamba→pierna; ginocchio→rodilla; piede/piedi→pie/pies; capelli→cabello/pelo; dente/denti→diente/dientes; labbra→labios; mi fa male→me duele; ho mal di testa→tengo dolor de cabeza; ho mal di stomaco→tengo dolor de estómago; febbre→fiebre; tosse→tos; raffreddore→resfriado; medico→médico.
**File:** `content/cards/a1-unit-10-body.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-10-body.ts` returns ≥ 50.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

## Agent Memories

### Architecture Agent Memory — content/types.ts Card schema

The schema for source-language translation (from content/types.ts):
```typescript
export interface Card {
  id: string;
  type: CardType;  // "recognize" | "produce" | "conjugate" | "fill_blank" | "passage_cloze"
  prompt: string;
  accepted: string[];
  translations?: Record<string, string[]>;  // recognize cards only — e.g. { "es": ["rojo"] }
  prompts?: Record<string, string>;         // produce cards only — e.g. { "es": "rojo" }
  hint?: string;
  tags: string[];
  tier: Tier;
  prerequisites?: string[];
  deprecated?: boolean;
}
```

**Rules:**
- `produce` cards: add `prompts: { es: "..." }` — Spanish translation of the English `prompt`
- `recognize` cards: add `translations: { es: ["..."] }` — Spanish translation(s) of the `accepted` array
- `conjugate`, `fill_blank`, `passage_cloze`: skip — prompts are already in Italian
- Never modify existing fields — additive only
- TypeScript: both fields are optional, so adding to some cards but not others is valid

Example produce card after edit:
```typescript
{ id: "a106-t1-001", type: "produce", prompt: "tall", prompts: { es: "alto/a" }, accepted: ["alto", "alta"], tags: ["describing"], tier: 1 }
```

Example recognize card after edit:
```typescript
{ id: "a106-t1-101", type: "recognize", prompt: "alto", accepted: ["tall", "high"], translations: { es: ["alto", "alta"] }, tags: ["describing"], tier: 1 }
```

## When You Finish
Write your completion summary to .autocode/stream-W1B/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Barry is done."

— Barry | W1B | #131 #132 #133 #134 #135
