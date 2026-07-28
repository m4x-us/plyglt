// ============================================================
// useLangPack.ts — Hook: resolves the active language pack (bundled Italian content, or
// network-loaded packs via lib/packLoader) into render-ready state
// Comment refs (#NNN = task, FNNN/K2-*/N*/F-C2-*/V* = audit findings): resolve via
// `git log -S "<ref>"` or .autocode/ history; the prose carries the WHY on its own.
// ============================================================
"use client";

import { useState, useEffect, useMemo } from "react";
import { ALL_UNITS, UNIT_MAP as ITALIAN_UNIT_MAP } from "@/content/index";
import { loadPack, fetchManifest, seedMemCache, type LoadPackResult } from "@/lib/packLoader";
import { isReadyBasePackCode, isSpecialtyPackCode, SPECIALTY_PACKS } from "@/lib/langRegistry";
import { resolveTargetPack } from "@/lib/packResolver";
import { getLanguageConfig, type LanguageConfig } from "@/lib/language";
import type { Unit } from "@/content/types";
import { LANG_PAIR_KEY, getTargetLangCode, setTargetLangCode } from "@/lib/constants";
import { useEntitlementStore, isPackUnlocked } from "@/store/entitlementStore";
import { hasAddOn } from "@/lib/entitlement";
import { useIsHydrated } from "@/lib/storage";

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

// #378 cycle-2 F-C2-2: how long the dynamic-load effect waits for entitlement-store
// hydration before proceeding with store defaults. Generous vs. a storage read (~ms) so it
// only ever fires on the genuine failure/race paths it exists to unblock. Exported so the
// boundary test asserts against the real constant, not a duplicated literal.
export const HYDRATION_GRACE_MS = 3000;

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
  // moved to useEffect below so the render body remains pure — EXCEPT the narrow, self-limiting
  // case handled inside getTargetLangCode itself (Task #408: a no-hyphen/empty-tail malformed
  // stored value persists its own "it" repair via setTargetLangCode before returning). That
  // write is idempotent and self-correcting under StrictMode's double-render: the first
  // invocation repairs localStorage, so a second invocation in the same double-render reads
  // the now-valid value and never re-enters the malformed branch — no observable double-log,
  // unlike a plain side effect would produce. The #339 effect below still owns the SEPARATE
  // "known but unready code" repair, which getTargetLangCode cannot detect on its own (it has
  // no visibility into READY_PACK_CODES/SPECIALTY_PACKS).
  const rawTargetLang = getTargetLangCode();
  // #261: Thread purchasedAddOns into loadPack so the specialty-pack entitlement gate
  // has the current state. Zustand keeps the reference stable between writes, so the
  // effect below re-runs only when the array is replaced — on a new purchase, but also on
  // persist rehydration or a cross-tab storage sync, which write a fresh (possibly
  // content-identical) array. Each such re-run re-issues fetchManifest over the network
  // (cache: "no-store") before loadPack short-circuits on memCache — cheap for the pack,
  // not free for the manifest (#378 audit F027; acceptable at the current 1-2 re-runs per
  // session, revisit if rehydration frequency ever grows). Subscribed here (before
  // isKnownCode below), not further down: Task #419's ready-but-unpurchased repair needs
  // it in the same render pass that decides targetLang.
  const purchasedAddOns = useEntitlementStore(state => state.purchasedAddOns);
  // #378 audit F011 + WorldClass V1: BOTH halves require readiness — a registered-but-
  // unready code (base OR specialty) is unloadable by everything downstream, so treating it
  // as "known" would strand the user on a permanent "Pack not available." screen with no
  // self-heal; letting the #339 repair below reset it to "it" is the only path that
  // recovers. (READY_PACK_CODES, not isValidPackCode/ALL_PACK_CODES: "es" is registered
  // but ready:false today — a stale persisted "en-es" must repair, not strand. Both halves
  // use the registry's canonical ready-checks — one predicate each, no inline copies that
  // could drift.)
  const isKnownCode =
    isReadyBasePackCode(rawTargetLang) || isSpecialtyPackCode(rawTargetLang);
  // #378 audit F014: the entitlement store hydrates asynchronously (Tauri IPC storage; on
  // web the async storage wrapper still defers hydration by a microtask) — reading
  // purchasedAddOns before hydration yields the store default ([]). Declared here (before
  // #419's unpurchasedSpecialty check below needs it) rather than further down where the
  // dynamic-load effect also consults it — Task #442: unpurchasedSpecialty is a render-body
  // computation with an immediate, PERSISTENT side effect (the #339 repair effect below
  // calls setTargetLangCode), unlike the dynamic-load effect's entitlement reads, which are
  // transient (re-run harmlessly once real data arrives). Gating only the load effect and
  // not this computation let a genuine owner's specialty code be misread as unowned during
  // the hydration window and PERMANENTLY overwrite their real selection in storage — the
  // effect's own `rawTargetLang === targetLang` guard never fires again once that happens,
  // so hydration completing afterward with the true ownership data could not self-correct it.
  const entitlementHydrated = useIsHydrated(useEntitlementStore);
  // #378 cycle-2 F-C2-2: zustand's persist NEVER finishes hydration when storage.getItem
  // rejects (verified against the middleware source — hasHydrated stays false and
  // onFinishHydration never fires on the failure path), and useIsHydrated has a narrow
  // subscribe race (see lib/storage.ts follow-up). Without a fallback, either condition
  // would leave this hook waiting forever: a permanent silent spinner. After a bounded
  // grace period (armed by the effect further below, once targetLang is known), proceed
  // with the store defaults — exactly the pre-#378 behavior, i.e. a transient, recoverable
  // wrong-entitlement read instead of an unrecoverable hang. Rule 8: taking the fallback
  // path is logged.
  const [hydrationGraceExpired, setHydrationGraceExpired] = useState(false);
  // #419: a ready-and-registered specialty code the user does not own is "known" above (it
  // resolves to a real, loadable pack) but unusable for THIS user. Left unhandled, the #339
  // repair below never fires for it (isKnownCode is true), so a code like "it-medical" left
  // over from a lapsed/hand-tampered entitlement would strand the user on a permanent
  // "Add-on not purchased." dead end forever — unlike every other unrecoverable-code case
  // this hook already self-heals. Redirecting here, in the render body (rather than only
  // after a failed load), also avoids ever making the doomed network request in the first
  // place. Falls back to the specialty's OWN baseLang (not a hardcoded "it") so this stays
  // correct once a non-Italian specialty pack ships. Currently latent — no specialty pack
  // is ready:true yet.
  // Task #442: gated on (entitlementHydrated || hydrationGraceExpired) — before hydration
  // completes, purchasedAddOns is the Zustand default [], so treating a code as "known but
  // unowned" here is only safe once hydration has actually run (or given up per the grace
  // timeout below). Pre-hydration, this stays undefined — isKnownCode alone decides
  // targetLang, so a genuinely-owned specialty code passes through unredirected and the
  // #339 repair effect's rawTargetLang===targetLang guard correctly stays silent until real
  // ownership data is available.
  const unpurchasedSpecialty = (entitlementHydrated || hydrationGraceExpired)
      && isSpecialtyPackCode(rawTargetLang) && !hasAddOn({ purchasedAddOns }, rawTargetLang)
    ? SPECIALTY_PACKS.find(sp => sp.code === rawTargetLang)
    : undefined;
  const targetLang = isKnownCode && !unpurchasedSpecialty ? rawTargetLang : (unpurchasedSpecialty?.baseLang ?? "it");

  const lang = useMemo(() => getLanguageConfig(targetLang), [targetLang]);
  // #377/#414: thread unlockedPacks into loadPack as options.unlockedLangs so packLoader's
  // non-free base-pack entitlement gate has a real production caller (Rule 20b — the gate
  // shipped in Task #350 with zero callers; every subscribed user would have hit
  // invalid_lang the day a second ready base pack shipped). Subscribe to the raw fields
  // (not the store's bound isPackUnlocked method, which is a stable closure Zustand would
  // never re-render this hook for) so the effect below correctly re-runs when any of them
  // changes. unlockedLangs stays a general membership list, NOT narrowed to [targetLang] —
  // resolveTargetPack's specialty-pack path checks the specialty's BASE lang (which can
  // differ from targetLang) against this same list. Task #414: each code is filtered
  // through the canonical isPackUnlocked expiry logic (same function LanguageGrid.tsx's
  // render uses) instead of passing the raw persisted array unfiltered — closing the gap
  // where a lapsed-beyond-grace subscriber's stale unlockedPacks entry still loaded a
  // non-free base pack via this call path (unlockedPacks itself is never pruned on lapse).
  const licenseType = useEntitlementStore(state => state.licenseType);
  const unlockedPacks = useEntitlementStore(state => state.unlockedPacks);
  const validUntil = useEntitlementStore(state => state.validUntil);
  const unlockedLangs = useMemo(
    () => unlockedPacks.filter(code => isPackUnlocked({ licenseType, unlockedPacks, validUntil }, code)),
    [licenseType, unlockedPacks, validUntil]
  );
  // #378 audit F014: the entitlement store hydrates asynchronously (Tauri IPC storage; on
  // web the async storage wrapper still defers hydration by a microtask) — reading
  // unlockedPacks/purchasedAddOns before hydration yields the store defaults, which would
  // make a legitimately-subscribed user transiently hit invalid_lang on a non-free pack.
  // The dynamic-load effect waits for hydration; the static-pack branch does not need to
  // (free content, no entitlement input). entitlementHydrated/hydrationGraceExpired are
  // declared earlier now (Task #442 — unpurchasedSpecialty above needs them too); this
  // effect is the one that actually arms the grace timer, once targetLang is known.
  useEffect(() => {
    // Scoped to the dynamic-load case: the static-pack branch never consults entitlement,
    // so arming the timer there would only produce a misleading timeout error for a slow
    // hydration with zero actual consequence (WorldClass cycle-3).
    if (entitlementHydrated || STATIC_PACKS[targetLang]) return;
    const timer = setTimeout(() => {
      console.error(`[ERR-ENTITLEMENT-HYDRATION-TIMEOUT-${Date.now()}] entitlement store did not hydrate within ${HYDRATION_GRACE_MS}ms — proceeding with defaults (pack loads may see stale entitlement until hydration completes)`);
      setHydrationGraceExpired(true);
    }, HYDRATION_GRACE_MS);
    return () => clearTimeout(timer);
  }, [entitlementHydrated, targetLang]);
  // Task #362: subscribe to clearEntitlement's eviction-complete signal. When clearEntitlement
  // finishes evicting base packs, it increments this counter — the effect below re-seeds
  // memCache for static languages so specialty-pack loads don't see base_pack_not_loaded.
  const cacheEvictionGeneration = useEntitlementStore(state => state._cacheEvictionGeneration);

  const [state, setState] = useState<LangPackState>(() => {
    const static_ = STATIC_PACKS[targetLang];
    if (static_) {
      // Pure initializer — the #296 memCache seed for static langs lives in the effect
      // below, NOT here: a module-cache write in the render body is exactly the class of
      // side effect this file's own #339 rule forbids (StrictMode double-invocation).
      // (#378 cycle-2 naive finding.) Nothing reads memCache between render and effect.
      return { ...static_, lang, loading: false, error: null };
    }
    return { units: [], unitMap: {}, lang, loading: true, error: null };
  });

  // Task #339: repair side-effects moved out of render body. console.error + setTargetLangCode
  // are side-effects and must not run in the render body (StrictMode double-invocation fires
  // them twice). The render body still derives targetLang synchronously (pure); this effect
  // repairs the stored value so the next render returns the correct code without the fallback.
  // Task #419: rawTargetLang !== targetLang covers both repair cases the render body can
  // produce — an unknown/unready code (targetLang falls back to "it") and a ready-but-
  // unpurchased specialty code (targetLang falls back to that pack's own baseLang) — a
  // second near-duplicate effect isn't needed; only the logged reason differs.
  // Task #442: unpurchasedSpecialty is now hydration-gated (see its declaration above), so
  // this branch can only fire once hydration has genuinely completed OR the grace period
  // expired. The message below distinguishes those two cases — a grace-expired read is a
  // fallback to store defaults, not confirmed data, so asserting non-ownership with the
  // same confidence as a real hydrated read would overstate what's actually known.
  useEffect(() => {
    if (rawTargetLang === targetLang) return;
    if (unpurchasedSpecialty) {
      const confidence = entitlementHydrated
        ? ""
        : " (entitlement hydration grace period expired — this reflects store defaults, not a confirmed read)";
      console.error(`[ERR-LANGPACK-ADDON-UNOWNED] targetLang "${rawTargetLang}" is a ready specialty pack not present in purchasedAddOns${confidence} — resetting to base language "${targetLang}"`);
    } else {
      console.error(`[ERR-LANGPACK-CORRUPT] unrecognised targetLang "${rawTargetLang}" — resetting to "${targetLang}"`);
    }
    setTargetLangCode(targetLang);
  }, [rawTargetLang, targetLang, unpurchasedSpecialty, entitlementHydrated]);

  useEffect(() => {
    const staticTarget = STATIC_PACKS[targetLang];
    if (staticTarget) {
      // #296 seed (moved here from the useState initializer — render bodies stay pure) and
      // #362 re-seed after clearEntitlement's eviction (this effect re-runs via the
      // cacheEvictionGeneration dep). Unconditional: seedMemCache is idempotent, so the
      // generation check the old code gated on bought nothing but a comment.
      // Return value deliberately ignored HERE (unlike the resolver, which maps a refusal
      // to base_pack_not_loaded): this branch serves the bundled static content regardless
      // — the seed only feeds the specialty precondition, and a refusal already logs its
      // own ref-ID inside seedMemCache.
      seedMemCache(targetLang, staticTarget.units);
      // #378 cycle-2 (naive finding): a post-mount transition INTO a static lang (e.g.
      // "pt" → "it" after a #339 repair or an in-app switch) must also publish the static
      // pack — the lazy initializer only covers mount-time static targets; without this,
      // the hook kept returning the PREVIOUS language's units forever. Functional update
      // with a reference bail so mount-time static renders (initializer already correct)
      // don't loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the reference-bail functional update settles in exactly one extra render on a real transition and zero on mount; the alternative (setState during render) violates this file's #339 purity rule
      setState(prev =>
        prev.units === staticTarget.units && !prev.loading && prev.error === null
          ? prev
          : { units: staticTarget.units, unitMap: staticTarget.unitMap, lang, loading: false, error: null }
      );
      return;
    }

    // #378 audit F014 / cycle-2 F-C2-2: don't read entitlement state before it has
    // hydrated — but never wait forever (grace fallback above; the effect re-fires via
    // the entitlementHydrated and hydrationGraceExpired deps).
    if (!entitlementHydrated && !hydrationGraceExpired) return;

    let cancelled = false;
    fetchManifest()
      // What to load, in which order (specialty base seeding/loading, failure propagation)
      // is pure orchestration — it lives in lib/packResolver.ts (unit-tested there), not in
      // this hook. The io argument is this module's imported primitives, so the resolver
      // composes whatever loadPack/seedMemCache the module system provides (real in
      // production, mocks under test).
      .then((manifest) =>
        resolveTargetPack(
          targetLang,
          manifest,
          { purchasedAddOns, unlockedLangs },
          STATIC_PACKS,
          { loadPack, seedMemCache }
        )
      )
      .then(({ result, baseFailed }) => {
        if (cancelled) return;
        if (result.ok) {
          const { units } = result.pack;
          const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
          setState({ units, unitMap, lang, loading: false, error: null });
        } else {
          // #324: invalid_lang is overloaded — it covers both "code not in the allowlist" and
          // "code is a ready specialty pack but not purchased". Surface distinct messages so a
          // user who has a pack available to buy sees a purchase prompt rather than a dead end.
          // #378 (audit F007): the "Add-on not purchased." prompt applies ONLY when the
          // SPECIALTY pack itself was refused — a propagated BASE-pack invalid_lang means the
          // base language is locked, so it gets the base message ("Pack not available."),
          // never a misleading add-on purchase prompt.
          // #419: by the time a specialty targetLang reaches this branch, the render body
          // above has already redirected any code the user doesn't own — so a specialty
          // code surfacing invalid_lang here is always a genuinely-owned pack failing for
          // some OTHER reason (missing manifest entry, sha mismatch, etc.), never a purchase
          // gap. isSpecialtyPackCode(targetLang) is kept as the discriminant (not a
          // hasAddOn check) for exactly that reason — it now means "this failure needs the
          // add-on-specific message" rather than "this specific request lacks purchase".
          const errorMsg =
            result.error === "invalid_lang" && !baseFailed && isSpecialtyPackCode(targetLang)
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
  }, [targetLang, lang, purchasedAddOns, unlockedLangs, cacheEvictionGeneration, entitlementHydrated, hydrationGraceExpired]);

  return state;
}
