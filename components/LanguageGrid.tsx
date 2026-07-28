// ============================================================
// LanguageGrid.tsx — Target language selection grid
// ============================================================
// Renders the "I want to learn" section of the language picker.
// Pure presentation: callers own state and side-effects.
// ============================================================
// DEPENDS ON: @/lib/language (ITALIAN), @/lib/langRegistry (LANGUAGE_REGISTRY,
//             SPECIALTY_PACKS), @/lib/entitlement (PRICING),
//             @/lib/featureFlags (getFeatureFlags, isProEnabled),
//             @/lib/licenseTypes (LicenseType), @/content/index (ALL_UNITS)
// USED BY: app/page.tsx
// ============================================================
"use client";

import { ITALIAN } from "@/lib/language";
import { LANGUAGE_REGISTRY, SPECIALTY_PACKS } from "@/lib/langRegistry";
import { PRICING } from "@/lib/entitlement";
import { getFeatureFlags, isProEnabled } from "@/lib/featureFlags";
import type { LicenseType } from "@/lib/licenseTypes";
import { ALL_UNITS } from "@/content/index";

const PAID_LANGUAGES = LANGUAGE_REGISTRY.filter((l) => !l.isFree);

interface Props {
  onSelect: (code: string) => void;
  // Task #334: code param is intentionally optional — LanguageGrid passes sp.code for
  // specialty-tile clicks so a future wiring can pre-select the add-on in BuyModal, but
  // app/page.tsx currently opens the generic subscription BuyModal and discards the arg.
  // This is a deliberate deferral (#295 precedent): no specialty content exists yet, the
  // Tauri command and per-add-on pricing are unimplemented. When specialty content ships,
  // wire code through to BuyModal and remove this comment.
  onUpgradeClick: (code?: string) => void;
  isPackUnlocked: (code: string) => boolean;
  hasAddOn: (code: string) => boolean;
  // Task #356: required so the Add-ons section can gate on Pro subscription status.
  licenseType: LicenseType;
  // Task #420: required so isProEnabled can apply its expiry check — without this, a
  // lapsed subscriber past validUntil + grace period stayed Pro-gated-in for the Add-ons
  // section indefinitely, unlike isPackUnlocked's identical expiry policy for pack access.
  validUntil: number | null;
}

export function LanguageGrid({ onSelect, onUpgradeClick, isPackUnlocked, hasAddOn, licenseType, validUntil }: Props) {
  // Task #276/#306: Feature flag gate for specialty pack UI. Reads via the canonical
  // getFeatureFlags() accessor so parseFlag()'s full falsy-value set ('false','0','off','no')
  // is respected — not just === "false". NEXT_PUBLIC_* vars are inlined at build time
  // (next.config.ts sets output:'export'), so changing this flag requires a redeploy.
  const specialtyPacksEnabled = getFeatureFlags().specialtyPacks;

  // Task #356: add-on purchases are a Pro-only feature per BRAND.md. A free-tier user
  // who has the base language unlocked (Italian is always free) should NOT see the "buy
  // add-on" CTA — they would hit ERR_ADDON_NOT_PRO if they clicked through. Only Pro
  // subscribers (or users who already own an add-on before a lapse) see the section.
  const isPro = isProEnabled(specialtyPacksEnabled, licenseType, validUntil);

  // Task #278: Use SPECIALTY_PACKS directly rather than iterating unlocked base languages.
  // Each specialty pack appears exactly once — no deduplication needed.
  // Task #403: the #276 feature flag gates ALL specialty UI in ONE place — this list. Flag
  // off → empty list → section hidden, INCLUDING already-owned add-ons (the hasAddOn half
  // of the filter ignores isPro, so a separate flag check at the render site used to be
  // load-bearing for exactly that case and read like a redundant double-gate; folding it
  // here leaves a single source of visibility truth). isPro (which also folds the flag,
  // per the isProEnabled contract) stays in the purchase half unchanged.
  // Filter: show add-on if the user owns it (regardless of Pro status — preserve access
  // to already-purchased add-ons even after subscription lapses) OR if Pro (can purchase).
  const specialtyPacks = specialtyPacksEnabled
    ? SPECIALTY_PACKS.filter(sp => hasAddOn(sp.code) || (isPro && isPackUnlocked(sp.baseLang)))
    : [];

  return (
    <>
      <div className="mb-8">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">I want to learn</p>
        <div className="space-y-2">
          {/* Italian — always free */}
          <button
            onClick={() => onSelect(ITALIAN.code)}
            className="w-full flex items-center gap-4 rounded-2xl border border-gray-700 bg-gray-900 hover:border-yellow-600 hover:bg-gray-800 px-5 py-4 transition-all group"
          >
            <span className="text-3xl">{ITALIAN.flag}</span>
            <div className="flex-1 text-left">
              <div className="font-semibold text-white group-hover:text-yellow-300 transition-colors">
                {ITALIAN.name}
              </div>
              <div className="text-xs text-gray-500">
                {ITALIAN.nativeName} · A1–B2 · {ALL_UNITS.length} units
              </div>
            </div>
            <div className="text-xs bg-green-900 text-green-400 rounded-full px-2.5 py-0.5 font-semibold">
              Free
            </div>
            <span className="text-gray-600 group-hover:text-white transition-colors text-lg">›</span>
          </button>

          {/* Paid languages */}
          {PAID_LANGUAGES.map((entry) => {
            const unlocked = isPackUnlocked(entry.code);
            return unlocked && entry.ready ? (
              <button
                key={entry.code}
                onClick={() => onSelect(entry.code)}
                className="w-full flex items-center gap-4 rounded-2xl border border-gray-700 bg-gray-900 hover:border-yellow-600 hover:bg-gray-800 px-5 py-4 transition-all group"
              >
                <span className="text-3xl">{entry.config.flag}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white group-hover:text-yellow-300 transition-colors">
                    {entry.config.name}
                  </div>
                  <div className="text-xs text-gray-500">{entry.config.nativeName}</div>
                </div>
                <span className="text-gray-600 group-hover:text-white transition-colors text-lg">›</span>
              </button>
            ) : (
              <button
                key={entry.code}
                onClick={() => onUpgradeClick()}
                className="w-full flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900/30 px-5 py-4 hover:border-yellow-900/50 hover:bg-gray-900/50 transition-all group"
              >
                <span className="text-3xl opacity-60">{entry.config.flag}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-400 group-hover:text-gray-300">
                    {entry.config.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {entry.config.nativeName}
                    {entry.ready ? "" : " · In development"}
                  </div>
                </div>
                <div className="text-xs text-gray-600 border border-gray-700 rounded-full px-2.5 py-0.5">
                  {unlocked ? "Soon" : `${PRICING.annual} →`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Specialty packs — the #276 flag, #356 Pro status, and ownership are all folded
          into specialtyPacks above; a non-empty list IS the visibility decision (#403) */}
      {specialtyPacks.length > 0 && (
        <div className="mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Add-ons</p>
          <div className="space-y-2">
            {specialtyPacks.map(sp => {
              const purchased = hasAddOn(sp.code);
              if (purchased && sp.ready) {
                return (
                  <button
                    key={sp.code}
                    onClick={() => onSelect(sp.code)}
                    className="w-full flex items-center gap-4 rounded-2xl border border-gray-700 bg-gray-900 hover:border-yellow-600 hover:bg-gray-800 px-5 py-4 transition-all group"
                  >
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-white group-hover:text-yellow-300 transition-colors">
                        {sp.name}
                      </div>
                    </div>
                    <span className="text-gray-600 group-hover:text-white transition-colors text-lg">›</span>
                  </button>
                );
              }
              if (purchased && !sp.ready) {
                // Task #411: owned but currently unready (deprecated or rolled back after
                // purchase). Readiness gates purchasing and loading, never retention (Task
                // #384 policy) — this state must never route through onUpgradeClick (no
                // purchase needed) or onSelect (the pack cannot load yet). Not a <button>:
                // there is no action for the user to take here.
                return (
                  <div
                    key={sp.code}
                    className="w-full flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900/30 px-5 py-4"
                  >
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-gray-400">{sp.name}</div>
                      <div className="text-xs text-gray-600">Coming soon</div>
                    </div>
                    <div className="text-xs text-gray-600 border border-gray-700 rounded-full px-2.5 py-0.5">
                      Owned
                    </div>
                  </div>
                );
              }
              return (
                <button
                  key={sp.code}
                  onClick={() => onUpgradeClick(sp.code)}
                  className="w-full flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900/30 px-5 py-4 hover:border-yellow-900/50 hover:bg-gray-900/50 transition-all group"
                >
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-400 group-hover:text-gray-300">
                      {sp.name}
                    </div>
                    {!sp.ready && (
                      <div className="text-xs text-gray-600">Coming soon</div>
                    )}
                  </div>
                  {sp.ready && (
                    <div className="text-xs text-gray-600 border border-gray-700 rounded-full px-2.5 py-0.5">
                      {PRICING.annual} →
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
