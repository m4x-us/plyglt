// ===========================================
// CHECKOUT TESTS — lib/checkout.ts (Task #101)
// ===========================================
// Verifies that checkout constants live in their own module and
// that re-exports from lib/entitlement.ts remain identical.
// ===========================================

import { describe, it, expect } from "vitest";
import {
  LS_STORE_SLUG,
  CHECKOUT_URLS,
  PRICING,
  CUSTOMER_PORTAL_URL,
} from "@/lib/checkout";
import {
  CHECKOUT_URLS as CHECKOUT_URLS_VIA_ENTITLEMENT,
  PRICING as PRICING_VIA_ENTITLEMENT,
  CUSTOMER_PORTAL_URL as CUSTOMER_PORTAL_URL_VIA_ENTITLEMENT,
} from "@/lib/entitlement";

describe("lib/checkout — constants", () => {
  it("LS_STORE_SLUG is the expected store slug", () => {
    expect(LS_STORE_SLUG).toBe("plyglt");
  });

  it("CHECKOUT_URLS.annual is the real LS checkout URL", () => {
    expect(CHECKOUT_URLS.annual).toContain(LS_STORE_SLUG);
    expect(CHECKOUT_URLS.annual).toMatch(/^https:\/\//);
    expect(CHECKOUT_URLS.annual).toContain("c541a459-fd38-4c81-94be-a4f2d6af3385");
  });

  it("PRICING has an annual string value", () => {
    expect(typeof PRICING.annual).toBe("string");
    expect(PRICING.annual.length).toBeGreaterThan(0);
  });

  it("CUSTOMER_PORTAL_URL is a valid HTTPS URL", () => {
    expect(CUSTOMER_PORTAL_URL).toMatch(/^https:\/\//);
  });
});

describe("lib/entitlement re-exports — values are identical to lib/checkout originals", () => {
  it("CHECKOUT_URLS re-export matches the original", () => {
    expect(CHECKOUT_URLS_VIA_ENTITLEMENT).toBe(CHECKOUT_URLS);
  });

  it("PRICING re-export matches the original", () => {
    expect(PRICING_VIA_ENTITLEMENT).toBe(PRICING);
  });

  it("CUSTOMER_PORTAL_URL re-export matches the original", () => {
    expect(CUSTOMER_PORTAL_URL_VIA_ENTITLEMENT).toBe(CUSTOMER_PORTAL_URL);
  });
});
