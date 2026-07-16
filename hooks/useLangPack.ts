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
  // unrecognised code that makes getLanguageConfig log on every render. Detect once, fall back
  // to "it" for this render. Task #339: repair side-effects (console.error + setTargetLangCode)
  // moved to useEffect below so the render body remains pure.
  const rawTargetLang = getTargetLangCode();
  const isKnownCode =
    isValidPackCode(rawTargetLang) || SPECIALTY_PACKS.some(sp => sp.code === rawTargetLang);
  const targetLang = isKnownCode ? rawTargetLang : "it";

  const lang = useMemo(() => getLanguageConfig(targetLang), [targetLang]);
  // #261: Thread purchasedAddOns into loadPack so the specialty-pack entitlement gate
  // has the current state. Zustand keeps the reference stable between writes, so the
  // effect below re-runs only when the array is replaced — on a new purchase, but also on
  // persist rehydration or a cross-tab storage sync, which write a fresh (possibly
  // content-identical) array. Those extra re-runs are cheap: loadPack hits memCache.
  const purchasedAddOns = useEntitlementStore(state => state.purchasedAddOns);
  // #377: thread unlockedPacks into loadPack as options.unlockedLangs so packLoader's
  // non-free base-pack entitlement gate has a real production caller (Rule 20b — the gate
  // shipped in Task #350 with zero callers; every subscribed user would have hit
  // invalid_lang the day a second ready base pack shipped). Rename-at-boundary passthrough
  // only: no expiry/grace filtering here — the primary expiry-aware gate is the UI layer's
  // isPackUnlocked (store/entitlementStore.ts); the loader gate is secondary
  // defense-in-depth and deliberately membership-only. Mirrors the purchasedAddOns pattern.
  const unlockedPacks = useEntitlementStore(state => state.unlockedPacks);
  // Task #362: subscribe to clearEntitlement's eviction-complete signal. When clearEntitlement
  // finishes evicting base packs, it increments this counter — the effect below re-seeds
  // memCache for static languages so specialty-pack loads don't see base_pack_not_loaded.
  const cacheEvictionGeneration = useEntitlementStore(state => state._cacheEvictionGeneration);

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

  // Task #339: repair side-effects moved out of render body. console.error + setTargetLangCode
  // are side-effects and must not run in the render body (StrictMode double-invocation fires
  // them twice). The render body still derives targetLang synchronously (pure); this effect
  // repairs the stored value so the next render returns the correct code without the fallback.
  useEffect(() => {
    if (!isKnownCode) {
      console.error(`[ERR-LANGPACK-CORRUPT] unrecognised targetLang "${rawTargetLang}" — resetting to "it"`);
      setTargetLangCode("it");
    }
  }, [rawTargetLang, isKnownCode]);

  useEffect(() => {
    if (STATIC_PACKS[targetLang]) {
      // Task #362: re-seed memCache when clearEntitlement evicts the base lang.
      // cacheEvictionGeneration === 0 on first mount — the lazy useState initializer
      // already seeded at that point. Only re-seed when an eviction has actually fired
      // (generation > 0), so we don't call seedMemCache twice on initial render.
      if (cacheEvictionGeneration > 0) {
        seedMemCache(targetLang, STATIC_PACKS[targetLang].units);
      }
      return;
    }

    let cancelled = false;
    fetchManifest()
      .then((manifest) => loadPack(targetLang, manifest, { purchasedAddOns, unlockedLangs: unlockedPacks }))
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
  }, [targetLang, lang, purchasedAddOns, unlockedPacks, cacheEvictionGeneration]);

  return state;
}
