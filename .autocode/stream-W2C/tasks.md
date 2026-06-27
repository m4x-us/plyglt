# Stream W2C Task State

### Task #069 | code-quality | severity 5
**What:** Translate `LoadPackResult` error discriminants to user-readable strings in `hooks/useLangPack.ts:54-56` before storing in state
**Why:** `result.error` values (`"not_cached"`, `"download_filled"`, `"checksum_mismatch"`, `"parse_error"`) are internal machine codes stored directly in `LangPackState.error: string | null`. Users should never see `"checksum_mismatch"`. BRAND.md voice: "Couldn't load pack. Try again." — not `"download_failed"`. Translation must happen at the hook boundary before the value enters state.
**File:** `hooks/useLangPack.ts:54-56`
**Severity:** 5 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 1 file, no package boundary, string mapping
**Blocked by:** Task #060 (translation map must include `"invalid_lang"` once added) | **Blocks:** Nothing
**Risk:** Low — string mapping only
**Test required (write first):** `tests/useLangPack.test.ts` — for each error discriminant, assert `state.error` does not equal the raw discriminant and matches a BRAND.md-compliant string (short, no exclamation mark, no filler words).
**Done condition:** `grep -n "download_failed\|checksum_mismatch\|parse_error\|not_cached" hooks/useLangPack.ts` returns hits only inside a translation map, not in `setState` calls. Verification gate green.
**Owner:** Architecture Agent

---
