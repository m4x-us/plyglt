// ============================================================
// useLangPack.ts — Hook: loads and caches the active language pack from static JSON
// ============================================================
"use client";

import { useState, useEffect, useMemo } from "react";
import { ALL_UNITS, UNIT_MAP as ITALIAN_UNIT_MAP } from "@/content/index";
import { loadPack, fetchManifest, seedMemCache, type LoadPackResult } from "@/lib/packLoader";
import { isValidPackCode, SPECIALTY_PACKS, isReadySpecialtyPackCode } from "@/lib/langRegistry";

type LoadPackError = Extract<LoadPackResult, { ok: false }>["error"];

/** Maps LoadPackResult error discriminants to BRAND.md-compliant user-facing strings.
 * Module-level to avoid recreation on every render (Rule 15). Typed as
 * Record<LoadPackError, string> for exhaustiveness — TypeScript flags missing entries
 * if a new discriminant is added to LoadPackResult (Poka-yoke). */
export const LOAD_PACK_ERROR_MESSAGES: Record<LoadPackError, string> = {
  invalid_lang:          "Pack not available.",
  base_pack_not_loaded:  "Load the base language pack first.",
  download_failed:       "Couldn't load pack. Try again.",
  checksum_mismatch:     "Pack data corrupted. Try again.",
  parse_error:           "Couldn't read pack. Try again.",
};
import { getLanguageConfig, type LanguageConfig } from "@/lib/language";
import type { Unit } from "@/content/types";
import { LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode } from "@/lib/constants";
import { useEntitlementStore } from "@/store/entitlementStore";

/**
 * @deprecated Import directly from "@/lib/constants". This re-export exists for
 * backward compatibility only and will be removed once all consumers are confirmed
 * on the canonical import path.
 */
export { LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode };

// ── Static packs (bundled at build time — no network request) ─────────────────
// Italian is bundled as TypeScript content. Future languages load from JSON.

const STATIC_PACKS: Record<string, { units: Unit[]; unitMap: Record<string, Unit> }> = {
  it: { units: ALL_UNITS, unitMap: ITALIAN_UNIT_MAP },
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface LangPackState {
  units: Unit[];
  unitMap: Record<string, Unit>;
  lang: LanguageConfig;
  loading: boolean;
  error: string | null;
}

export function useLangPack(): LangPackState {
  // #323: validate before passing to getLanguageConfig — a corrupted LANG_PAIR_KEY produces an
  // unrecognised code that makes getLanguageConfig log on every render. Detect once, repair the
  // stored value (setTargetLangCode writes to localStorage immediately), and fall back to "it"
  // for this render so the error fires at most once per corrupt value.
  const rawTargetLang = getTargetLangCode();
  const isKnownCode =
    isValidPackCode(rawTargetLang) || SPECIALTY_PACKS.some(sp => sp.code === rawTargetLang);
  if (!isKnownCode) {
    console.error(`[ERR-LANGPACK-CORRUPT] unrecognised targetLang "${rawTargetLang}" — resetting to "it"`);
    setTargetLangCode("it");
  }
  const targetLang = isKnownCode ? rawTargetLang : "it";

  const lang = useMemo(() => getLanguageConfig(targetLang), [targetLang]);
  // #261: Thread purchasedAddOns into loadPack so the specialty-pack entitlement gate
  // has the current state. Zustand maintains referential stability — this only triggers
  // a re-render (and re-run of the effect) when the array actually changes (new purchase).
  const purchasedAddOns = useEntitlementStore(state => state.purchasedAddOns);

  const [state, setState] = useState<LangPackState>(() => {
    const static_ = STATIC_PACKS[targetLang];
    if (static_) {
      // #296: seed memCache so loadSpecialtyPack's memCache.has(baseLang) precondition is
      // satisfied for it-* specialty packs. The STATIC_PACKS early-return bypasses loadPack
      // entirely, so without this seed memCache["it"] is never populated and all specialty
      // packs return base_pack_not_loaded unconditionally. seedMemCache is idempotent.
      seedMemCache(targetLang, static_.units);
      return { ...static_, lang, loading: false, error: null };
    }
    return { units: [], unitMap: {}, lang, loading: true, error: null };
  });

  useEffect(() => {
    if (STATIC_PACKS[targetLang]) return; // Already loaded synchronously

    let cancelled = false;
    fetchManifest()
      .then((manifest) => loadPack(targetLang, manifest, { purchasedAddOns }))
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          const { units } = result.pack;
          const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
          setState({ units, unitMap, lang, loading: false, error: null });
        } else {
          // #324: invalid_lang is overloaded — it covers both "code not in the allowlist" and
          // "code is a ready specialty pack but not purchased". Surface distinct messages so a
          // user who has a pack available to buy sees a purchase prompt rather than a dead end.
          const errorMsg =
            result.error === "invalid_lang" && isReadySpecialtyPackCode(targetLang)
              ? "Add-on not purchased."
              : LOAD_PACK_ERROR_MESSAGES[result.error];
          setState({ units: [], unitMap: {}, lang, loading: false, error: errorMsg });
        }
      })
      .catch((e) => {
        console.error(`[LANGPACK_LOAD_FAIL-${Date.now()}]`, e);
        if (!cancelled) {
          setState({ units: [], unitMap: {}, lang, loading: false, error: LOAD_PACK_ERROR_MESSAGES["download_failed"] });
        }
      });
    return () => { cancelled = true; };
  }, [targetLang, lang, purchasedAddOns]);

  return state;
}
