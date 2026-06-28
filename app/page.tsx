// ============================================================
// page.tsx — Root page: initialises language and routes to /learn
// ============================================================
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ITALIAN } from "@/lib/language";
import { useEntitlementStore } from "@/store/entitlementStore";
import { CHECKOUT_URLS, CUSTOMER_PORTAL_URL, PRICING } from "@/lib/entitlement";
import { ALL_UNITS } from "@/content/index";
import { LANGUAGE_REGISTRY } from "@/lib/langRegistry";
import { openExternalUrl } from "@/lib/tauri";
import { LANG_PAIR_KEY, setTargetLangCode } from "@/lib/constants";

const SOURCE_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
];

// Paid languages derived from registry — add new languages in lib/langRegistry.ts only
const PAID_LANGUAGES = LANGUAGE_REGISTRY.filter(l => !l.isFree);

export default function LanguagePicker() {
  const router = useRouter();
  const [sourceLang, setSourceLang] = useState("en");
  // useSyncExternalStore: React 18 idiomatic way to detect client-side mount without
  // triggering a cascading setState-in-effect. Server snapshot = false; client snapshot = true.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const { isPackUnlocked, licenseType } = useEntitlementStore();

  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_PAIR_KEY);
    if (saved) router.replace("/learn");
  }, [router]);

  const handleSelect = (targetCode: string) => {
    setTargetLangCode(targetCode);
    // Full page reload required so the SRS store re-initializes with the new lang-pair key
    window.location.href = "/learn";
  };

  if (!mounted) return null;

  const hasPremium = licenseType !== "free";

  return (
    <div
      className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 py-12"
      style={{ fontFamily: "sans-serif" }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🌍</div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Choose your language</h1>
          <p className="text-gray-500 text-sm">
            Short sessions, science-backed spacing.
          </p>
        </div>

        {/* Source language */}
        <div className="mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">I speak</p>
          <div className="flex gap-2 flex-wrap">
            {SOURCE_LANGUAGES.map((src) => (
              <button
                key={src.code}
                onClick={() => setSourceLang(src.code)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  sourceLang === src.code
                    ? "border-yellow-500 bg-yellow-900/30 text-yellow-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                <span>{src.flag}</span>
                <span>{src.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Target language */}
        <div className="mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">I want to learn</p>
          <div className="space-y-2">
            {/* Italian — always free */}
            <button
              onClick={() => handleSelect(ITALIAN.code)}
              className="w-full flex items-center gap-4 rounded-2xl border border-gray-700 bg-gray-900 hover:border-yellow-600 hover:bg-gray-800 px-5 py-4 transition-all group"
            >
              <span className="text-3xl">{ITALIAN.flag}</span>
              <div className="flex-1 text-left">
                <div className="font-semibold text-white group-hover:text-yellow-300 transition-colors">
                  {ITALIAN.name}
                </div>
                <div className="text-xs text-gray-500">{ITALIAN.nativeName} · A1–B2 · {ALL_UNITS.length} units</div>
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
                  onClick={() => handleSelect(entry.code)}
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
                  onClick={() => setBuyModalOpen(true)}
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
                    {unlocked ? "Soon" : `${PRICING.monthly} →`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <p className="text-gray-700 text-xs">
            Free forever for Italian · Pro from {PRICING.monthly}
          </p>
          {hasPremium && (
            <button
              onClick={() => openExternalUrl(CUSTOMER_PORTAL_URL)}
              className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
            >
              Manage license →
            </button>
          )}
        </div>
      </div>

      {/* Buy modal */}
      {buyModalOpen && (
        <BuyModal onClose={() => setBuyModalOpen(false)} />
      )}
    </div>
  );
}

function BuyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-1">Unlock all languages</h2>
        <p className="text-gray-400 text-sm mb-6">
          Spanish, French, German, Portuguese and every future language — one subscription.
        </p>

        <div className="space-y-3 mb-6">
          <PricingRow
            label="Monthly"
            price={PRICING.monthly}
            description="All languages, cancel anytime"
            url={CHECKOUT_URLS.monthly}
            onClose={onClose}
          />
          <PricingRow
            label="Annual"
            price={PRICING.annual}
            description="All languages · ~$2.92/month"
            url={CHECKOUT_URLS.annual}
            highlight
            onClose={onClose}
          />
        </div>

        <p className="text-gray-600 text-xs text-center mb-4">
          After purchase, enter your license key in Settings → License.
        </p>

        <button
          onClick={onClose}
          className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

function PricingRow({
  label,
  price,
  description,
  url,
  highlight = false,
  onClose,
}: {
  label: string;
  price: string;
  description: string;
  url: string;
  highlight?: boolean;
  onClose: () => void;
}) {
  return (
    <button
      onClick={() => { openExternalUrl(url); onClose(); }}
      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
        highlight
          ? "border-yellow-700 bg-yellow-900/20 hover:bg-yellow-900/30"
          : "border-gray-700 bg-gray-800/50 hover:bg-gray-800"
      }`}
    >
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <div className={`text-sm font-bold ${highlight ? "text-yellow-400" : "text-white"}`}>
        {price}
      </div>
    </button>
  );
}
