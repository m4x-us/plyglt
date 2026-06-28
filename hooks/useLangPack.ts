// ============================================================
// useLangPack.ts — Hook: loads and caches the active language pack from static JSON
// ============================================================
"use client";

import { useState, useEffect, useMemo } from "react";
import { ALL_UNITS, UNIT_MAP as ITALIAN_UNIT_MAP } from "@/content/index";
import { loadPack, fetchManifest, type LoadPackResult } from "@/lib/packLoader";

type LoadPackError = Extract<LoadPackResult, { ok: false }>["error"];

/** Maps LoadPackResult error discriminants to BRAND.md-compliant user-facing strings.
 * Module-level to avoid recreation on every render (Rule 15). Typed as
 * Record<LoadPackError, string> for exhaustiveness — TypeScript flags missing entries
 * if a new discriminant is added to LoadPackResult (Poka-yoke). */
export const LOAD_PACK_ERROR_MESSAGES: Record<LoadPackError, string> = {
  invalid_lang:      "Pack not available.",
  download_failed:   "Couldn't load pack. Try again.",
  checksum_mismatch: "Pack data corrupted. Try again.",
  parse_error:       "Couldn't read pack. Try again.",
};
import { getLanguageConfig, type LanguageConfig } from "@/lib/language";
import type { Unit } from "@/content/types";
import { LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode } from "@/lib/constants";

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
  const targetLang = getTargetLangCode();
  const lang = useMemo(() => getLanguageConfig(targetLang), [targetLang]);

  const [state, setState] = useState<LangPackState>(() => {
    const static_ = STATIC_PACKS[targetLang];
    if (static_) {
      return { ...static_, lang, loading: false, error: null };
    }
    return { units: [], unitMap: {}, lang, loading: true, error: null };
  });

  useEffect(() => {
    if (STATIC_PACKS[targetLang]) return; // Already loaded synchronously

    let cancelled = false;
    fetchManifest()
      .then((manifest) => loadPack(targetLang, manifest))
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          const { units } = result.pack;
          const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
          setState({ units, unitMap, lang, loading: false, error: null });
        } else {
          setState({ units: [], unitMap: {}, lang, loading: false, error: LOAD_PACK_ERROR_MESSAGES[result.error] });
        }
      })
      .catch((e) => {
        console.error(`[LANGPACK_LOAD_FAIL-${Date.now()}]`, e);
        if (!cancelled) {
          setState({ units: [], unitMap: {}, lang, loading: false, error: LOAD_PACK_ERROR_MESSAGES["download_failed"] });
        }
      });
    return () => { cancelled = true; };
  }, [targetLang, lang]);

  return state;
}
