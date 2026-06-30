# Adam — Stream W1A — Wave 1 — 2026-06-30

IDENTITY RULE — MANDATORY: End EVERY response with exactly this line, no exceptions
(including short replies, confirmations, and one-word answers):
— Adam | W1A | #126 #127 #128 #129 #130

You are Adam, a CTO working on a specific set of tasks in parallel with other windows.
Work exclusively on the files listed under "Files You Own". Do not touch anything else.

## Your Tasks (run in this exact order)
1. /task #126  — A1 Unit 01 Greetings — Spanish source-language translation
2. /task #127  — A1 Unit 02 Bar — Spanish source-language translation
3. /task #128  — A1 Unit 03 Family — Spanish source-language translation
4. /task #129  — A1 Unit 04 City — Spanish source-language translation
5. /task #130  — A1 Unit 05 Time — Spanish source-language translation

STATUS BOARD RULE — MANDATORY: After every completed /task, and before starting
the next one, print your current status board in this exact format:

Adam — W1A
[✓] #126 — Unit 01 Greetings   ← done
[→] #127 — Unit 02 Bar         ← starting now
[ ] #128 — Unit 03 Family
[ ] #129 — Unit 04 City
[ ] #130 — Unit 05 Time

Then proceed to the next task. This lets Max glance at any window and know
exactly where you are.

## Files You Own (edit ONLY these)
content/cards/a1-unit-01-greetings.ts
content/cards/a1-unit-02-bar.ts
content/cards/a1-unit-03-family.ts
content/cards/a1-unit-04-city.ts
content/cards/a1-unit-05-time.ts

## Off-Limits Files (DO NOT MODIFY — owned by other windows running in parallel)
content/cards/a1-unit-06-describing.ts
content/cards/a1-unit-07-likes.ts
content/cards/a1-unit-08-review.ts
content/cards/a1-unit-09-colors.ts
content/cards/a1-unit-10-body.ts
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

### Task #126 — Greetings Spanish translation
**What:** Open `content/cards/a1-unit-01-greetings.ts`. For every `produce` card add `prompts: { es: "..." }` with the Spanish translation of the English prompt. For every `recognize` card add `translations: { es: ["..."] }` with Spanish translation(s). Skip `conjugate`, `fill_blank`, `passage_cloze` cards entirely.
Key vocab: buongiorno→buenos días; buonasera→buenas tardes; buonanotte→buenas noches; ciao→hola/adiós; arrivederci→hasta luego; grazie→gracias; prego→de nada; mi chiamo→me llamo; come stai→cómo estás; bene→bien; male→mal; così così→más o menos; piacere→mucho gusto; scusi→disculpe; per favore→por favor; italiano/a→italiano/a; americano/a→americano/a; inglese→inglés; francese→francés; tedesco/a→alemán/a; spagnolo/a→español/a.
For produce cards with full English sentence prompts, translate the whole sentence to Spanish.
**File:** `content/cards/a1-unit-01-greetings.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-01-greetings.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

### Task #127 — Bar Spanish translation
**What:** Open `content/cards/a1-unit-02-bar.ts`. Same pattern: `prompts.es` on produce, `translations.es` on recognize, skip others.
Key vocab: caffè→café; cappuccino→capuchino; acqua→agua; vino→vino; birra→cerveza; succo→jugo/zumo; tè→té; pane→pan; conto→cuenta; cameriere→camarero; quanto costa→cuánto cuesta; vorrei→quisiera; per favore→por favor; un bicchiere di→un vaso de; una tazza di→una taza de; ho sete→tengo sed; ho fame→tengo hambre; il menù→el menú; aperto→abierto; chiuso→cerrado; in contanti→en efectivo; carta di credito→tarjeta de crédito.
**File:** `content/cards/a1-unit-02-bar.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-02-bar.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

### Task #128 — Family Spanish translation
**What:** Open `content/cards/a1-unit-03-family.ts`. Same pattern.
Key vocab: madre→madre; padre→padre; fratello→hermano; sorella→hermana; figlio→hijo; figlia→hija; nonno→abuelo; nonna→abuela; zio→tío; zia→tía; cugino/a→primo/a; marito→marido/esposo; moglie→esposa; fidanzato/a→novio/a; amico/a→amigo/a; mio/mia→mi; tuo/tua→tu; suo/sua→su; nostro/a→nuestro/a; genitori→padres; figlio unico→hijo único; gemelli→gemelos.
**File:** `content/cards/a1-unit-03-family.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-03-family.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

### Task #129 — City Spanish translation
**What:** Open `content/cards/a1-unit-04-city.ts`. Same pattern.
Key vocab: città→ciudad; piazza→plaza; strada→calle; negozio→tienda; supermercato→supermercado; chiesa→iglesia; museo→museo; farmacia→farmacia; banca→banco; stazione→estación; autobus→autobús; metro→metro; vicino a→cerca de; lontano da→lejos de; dov'è→dónde está; a destra→a la derecha; a sinistra→a la izquierda; dritto→recto; fermata→parada; semaforo→semáforo; palazzo→edificio; parco→parque; ospedale→hospital.
**File:** `content/cards/a1-unit-04-city.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-04-city.ts` returns ≥ 55.
**Complexity:** ⚡ Direct — 1 file, no package boundary, additive field additions only
**Owner:** Architecture Agent

### Task #130 — Time Spanish translation
**What:** Open `content/cards/a1-unit-05-time.ts`. Same pattern.
Key vocab: lunedì→lunes; martedì→martes; mercoledì→miércoles; giovedì→jueves; venerdì→viernes; sabato→sábado; domenica→domingo; gennaio→enero; febbraio→febrero; marzo→marzo; aprile→abril; maggio→mayo; giugno→junio; luglio→julio; agosto→agosto; settembre→septiembre; ottobre→octubre; novembre→noviembre; dicembre→diciembre; oggi→hoy; domani→mañana; ieri→ayer; mattina→mañana (morning); pomeriggio→tarde; sera→tarde/noche; ora→hora; minuto→minuto; che ore sono→qué hora es; sono le tre→son las tres; a mezzogiorno→al mediodía; a mezzanotte→a medianoche.
**File:** `content/cards/a1-unit-05-time.ts`
**Done when:** `npx tsc --noEmit` passes; `grep -c '"es":' content/cards/a1-unit-05-time.ts` returns ≥ 55.
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
- `produce` cards: add `prompts: { es: "..." }` where the value is the Spanish translation of the English `prompt` field
- `recognize` cards: add `translations: { es: ["..."] }` where the values are Spanish translations of the English `accepted` array
- `conjugate`, `fill_blank`, `passage_cloze`: skip entirely — their prompts are already in Italian
- Never modify `prompt`, `accepted`, `id`, `type`, `tags`, `tier`, or any other existing field
- This is additive only — insert new fields, never remove or change existing ones
- TypeScript: `prompts` and `translations` are optional fields, so adding them to some cards but not others is valid

Example of a correctly modified produce card:
```typescript
{
  id: "u01-t1-001",
  type: "produce",
  prompt: "hello / hi",
  prompts: { es: "hola / adiós" },
  accepted: ["ciao"],
  tags: ["greetings"],
  tier: 1,
}
```

Example of a correctly modified recognize card:
```typescript
{
  id: "u01-t1-101",
  type: "recognize",
  prompt: "ciao",
  accepted: ["hello", "hi", "goodbye", "bye"],
  translations: { es: ["hola", "adiós"] },
  tags: ["greetings"],
  tier: 1,
}
```

## When You Finish
Write your completion summary to .autocode/stream-W1A/completion.md:
  Tasks closed: [list task numbers that reached COMPLETE status]
  Tasks NOT completed: [list task number + done-when condition that failed]
  Debt entries logged: [count]
  Carry-forward tasks generated: [count]

Then tell Max in this window: "Adam is done."

— Adam | W1A | #126 #127 #128 #129 #130
