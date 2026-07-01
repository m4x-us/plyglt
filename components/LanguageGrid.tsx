// ============================================================
// LanguageGrid.tsx — Target language selection grid
// ============================================================
// Renders the "I want to learn" section of the language picker.
// Pure presentation: callers own state and side-effects.
// ============================================================
// DEPENDS ON: @/lib/language (ITALIAN), @/lib/langRegistry (LANGUAGE_REGISTRY,
//             getSpecialtyPacks), @/lib/entitlement (PRICING),
//             @/content/index (ALL_UNITS)
// USED BY: app/page.tsx
// ============================================================
"use client";

import { ITALIAN } from "@/lib/language";
import { LANGUAGE_REGISTRY, getSpecialtyPacks } from "@/lib/langRegistry";
import { PRICING } from "@/lib/entitlement";
import { ALL_UNITS } from "@/content/index";

const PAID_LANGUAGES = LANGUAGE_REGISTRY.filter((l) => !l.isFree);

interface Props {
  onSelect: (code: string) => void;
  onUpgradeClick: () => void;
  isPackUnlocked: (code: string) => boolean;
  hasAddOn: (code: string) => boolean;
}

export function LanguageGrid({ onSelect, onUpgradeClick, isPackUnlocked, hasAddOn }: Props) {
  // Specialty packs for all currently unlocked base languages. Empty until
  // SPECIALTY_PACKS registry has entries with ready:true (Task #149 wired the loader).
  const specialtyPacks = LANGUAGE_REGISTRY
    .filter(entry => isPackUnlocked(entry.code))
    .flatMap(entry => getSpecialtyPacks(entry.code));

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
                onClick={onUpgradeClick}
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

      {/* Specialty packs — only shown when at least one add-on exists for an unlocked language */}
      {specialtyPacks.length > 0 && (
        <div className="mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Add-ons</p>
          <div className="space-y-2">
            {specialtyPacks.map(sp => {
              const purchased = hasAddOn(sp.code);
              return purchased && sp.ready ? (
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
              ) : (
                <button
                  key={sp.code}
                  onClick={onUpgradeClick}
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
