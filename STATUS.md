# plyglt — Project Status

## 1. Shipped

The following features are complete and in production:

- **SRS core** — FSRS v4 scheduler (`lib/srs.ts`). Schedules cards at the moment before forgetting. No overdue cards — cards are "ready" when due.
- **Italian A1–B1 curriculum** — 57 of 125 planned units authored and validated. Full word-card pipeline: vocabulary (recognize + produce), grammar (conjugate + fill-blank), phrases, and passage cloze.
- **Interrupt engine** — Proactive review sessions surfaced on a schedule. Desktop: Tauri system tray integration. The engine drives 3–5 card sessions of 30–60 seconds each.
- **Entitlement** — Client-side license model (`lib/entitlement.ts`, `store/entitlementStore.ts`). Honour system by design. See Known Issues for context.
- **Backup / restore** — Export and import of full user state as a versioned JSON backup (`lib/exportBackup.ts`, `lib/importBackup.ts`). Current backup format: version 2.
- **Platform storage abstraction** — `lib/storage.ts:createPlatformStorage` routes persistence to Tauri Store (desktop) or localStorage (web). All Zustand stores use this factory.
- **Feature flags** — `lib/featureFlags.ts` reads `NEXT_PUBLIC_FLAGS_*` environment variables. Flags are evaluated at runtime; no build step required to toggle.
- **Answer checking** — `lib/answerCheck.ts` with Levenshtein distance and NFC normalization. Handles accented characters and minor typos without false positives.

---

## 2. Planned (In Task List)

Active development is tracked in `.autocode/tasks.md`. That file is the canonical list of in-progress and queued work, organized by batch and stream.

---

## 3. Known Issues / Accepted Risks

**Client-only entitlement (intentional).**
License verification is entirely client-side — there is no server round-trip to validate a key. This is an intentional offline-first trade-off confirmed by the owner (2026-06-24). The product prioritises offline operation and zero backend dependency for core functionality. Do not treat this as a missing feature or open bug. It is documented in `CLAUDE.md § Architecture § Entitlement Model`.

**68 curriculum units not yet authored.**
57 of 125 planned units exist (A1 through B1). The remaining 68 (B2 level and some B1 consolidation units) are content authoring work, not engineering tasks. No code change is required to add them — the pipeline that converts unit TypeScript files into validated JSON packs is complete. Missing units are a content gap, not a software gap.

**Placeholder language configurations for fr, de, pt.**
`lib/langRegistry.ts` contains stub entries for French, German, and Portuguese. These languages are not user-visible — they are not in `READY_PACK_CODES` and no packs exist for them. The stubs exist as scaffolding for future language expansion. Do not reference them in user-facing copy or documentation as shipped languages.

---

## 4. Curriculum Status

| Level | Units authored | Units planned | Words covered |
|-------|---------------|---------------|---------------|
| A1    | 20            | 20            | ~800          |
| A2    | 30            | 30            | ~1,400        |
| B1    | 7             | 35            | ~460 (partial)|
| B2    | 0             | 40            | 0             |
| **Total** | **57**    | **125**       | **~2,660**    |

See `CURRICULUM.md` for the full unit index, word count targets, and card quality standards.

No code task is required for the 68 unbuilt units — they are content authoring work handled outside the engineering backlog.

---

## 5. Card ID Format

Italian cards (the only shipped language) use the format:

```
{level}u{unit:02d}-t{tier}-{seq:03d}
```

Example: `a1u01-t1-001` — A1, unit 01, tier 1, card 001.

Non-Italian cards added in future language packs should use a language-prefixed format:

```
{lang}-{level}u{unit:02d}-t{tier}-{seq:03d}
```

Example: `es-a1u01-t1-001` — Spanish, A1, unit 01, tier 1, card 001.

CONTRIBUTING_LANGUAGE.md documents both formats (updated this sprint).
