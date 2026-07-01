// ============================================================
// BuyModal.tsx — Subscription upgrade dialog
// ============================================================
// Renders the modal that appears when a user clicks a locked language.
// Callers own the URL-opening side-effect via onActivate — keeps this
// component testable without mocking Tauri.
// ============================================================
// DEPENDS ON: @/lib/entitlement (CHECKOUT_URLS, PRICING)
// USED BY: app/page.tsx
// ============================================================
"use client";

import { CHECKOUT_URLS, PRICING } from "@/lib/entitlement";

interface BuyModalProps {
  onClose: () => void;
  /** Called with the checkout URL when a pricing row is selected. */
  onActivate: (url: string) => void;
}

interface PricingRowProps {
  label: string;
  price: string;
  description: string;
  url: string;
  highlight?: boolean;
  onClose: () => void;
  onActivate: (url: string) => void;
}

function PricingRow({
  label,
  price,
  description,
  url,
  highlight = false,
  onClose,
  onActivate,
}: PricingRowProps) {
  return (
    <button
      onClick={() => { onActivate(url); onClose(); }}
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

export function BuyModal({ onClose, onActivate }: BuyModalProps) {
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
            label="Annual"
            price={PRICING.annual}
            description="All languages · cancel anytime"
            url={CHECKOUT_URLS.annual}
            highlight
            onClose={onClose}
            onActivate={onActivate}
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
