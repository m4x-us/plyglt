// ============================================================
// lib/checkout.ts — Lemon Squeezy checkout URL and pricing constants
// ============================================================
// DEPENDS ON: nothing
// USED BY: lib/entitlement.ts (re-exports), components/BuyModal.tsx,
//          app/settings/page.tsx, app/page.tsx, components/LanguageGrid.tsx
// ============================================================

export const LS_STORE_SLUG = "plyglt";

export const CHECKOUT_URLS = {
  annual: "https://plyglt.lemonsqueezy.com/checkout/buy/c541a459-fd38-4c81-94be-a4f2d6af3385",
} as const;

// Customer portal where users can manage or cancel their subscription.
export const CUSTOMER_PORTAL_URL = "https://app.lemonsqueezy.com/my-orders";

export const PRICING = {
  annual: "$34.99/yr",
} as const;
