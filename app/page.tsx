// ============================================================
// page.tsx — Root page: language picker, routes to /learn
// ============================================================
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useEntitlementStore } from "@/store/entitlementStore";
import { CUSTOMER_PORTAL_URL, PRICING } from "@/lib/entitlement";
import { openExternalUrl } from "@/lib/tauri";
import { hasStoredLangPair, setTargetLangCode } from "@/lib/constants";
import { BuyModal } from "@/components/BuyModal";
import { LanguageGrid } from "@/components/LanguageGrid";

const SOURCE_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
];

export default function LanguagePicker() {
  const router = useRouter();
  const [sourceLang, setSourceLang] = useState("en");
  // useSyncExternalStore: React 18 idiomatic way to detect client-side mount without
  // triggering a cascading setState-in-effect. Server snapshot = false; client snapshot = true.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const { isPackUnlocked, licenseType, hasAddOn, validUntil } = useEntitlementStore();

  useEffect(() => {
    // Task #389: presence check via lib/constants — the module's sole-authorized-caller
    // rule forbids direct window.localStorage reads of LANG_PAIR_KEY here. getLangPair()
    // would not work: it synthesizes "en-it" when nothing is stored, which would redirect
    // first-run users straight past the picker.
    if (hasStoredLangPair()) router.replace("/learn");
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
          <p className="text-gray-500 text-sm">Short sessions, science-backed spacing.</p>
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

        <LanguageGrid
          onSelect={handleSelect}
          // Task #334: code is received but intentionally unused until specialty content ships.
          // LanguageGrid passes sp.code for specialty-tile clicks so a future wiring can
          // pre-select the add-on in BuyModal. The generic subscription BuyModal currently
          // has no concept of a per-add-on code or checkout URL. Deliberate deferral (#295
          // precedent): wire code through to BuyModal when specialty content and per-add-on
          // pricing are implemented.
          onUpgradeClick={(_code) => setBuyModalOpen(true)}
          isPackUnlocked={isPackUnlocked}
          hasAddOn={hasAddOn}
          licenseType={licenseType}
          validUntil={validUntil}
        />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <p className="text-gray-700 text-xs">
            Free forever for Italian · Pro {PRICING.annual}
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

      {buyModalOpen && (
        <BuyModal
          onClose={() => setBuyModalOpen(false)}
          onActivate={(url) => { openExternalUrl(url); setBuyModalOpen(false); }}
        />
      )}
    </div>
  );
}
