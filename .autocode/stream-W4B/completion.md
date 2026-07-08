Tasks closed: #235, #236
Tasks NOT completed: none
Debt entries logged: 0
Carry-forward tasks generated: 0

## Summary

**Task #235 — Deep-freeze LANG_CONFIG_MAP**
- `lib/langRegistry.ts`: added `deepFreezeConfig()` helper that freezes `config.uiStrings.cardLabels`, then `config.uiStrings`, then `config`. Applied to every entry during `LANG_CONFIG_MAP` construction.
- `tests/langRegistry.test.ts`: added `"LANG_CONFIG_MAP — deep immutability (Task #235)"` describe block with two tests — one asserting `LANG_CONFIG_MAP["it"].articles` mutation throws `TypeError` and the value is unchanged; one asserting `LANG_CONFIG_MAP["it"].uiStrings.appTitle` mutation throws `TypeError` (the case that shallow freeze would have allowed silently).

**Task #236 — Tighten activateLicense instanceId type guard**
- `lib/entitlement.ts`: changed `LsActivateBody.instance` from `{ id: string } | null` to `{ id: unknown } | null` (reflects the truth — the `raw as LsActivateBody` cast provides no runtime string guarantee). Changed guard from `if (!res.instance?.id)` to `if (!res.instance?.id || typeof res.instance.id !== "string")`. Changed return to `instanceId: res.instance.id as string` (safe after the guard).
- `tests/entitlement.test.ts`: added test asserting `instance: { id: 123 }` (number) returns `{ ok: false, error: ERR_ACTIVATE_NO_INSTANCE }`.

Verification gate: tsc --noEmit ✓ | npm test 1006/1006 ✓ | npm run lint 0 errors ✓ | assert grep gate ✓
