// @vitest-environment jsdom
// ============================================================
// LanguageGrid.test.tsx — behavioral tests for LanguageGrid (Task #104, #150, #283)
// ============================================================
// Covers all 4 base-language render states: Italian (free), unlocked+ready paid,
// locked+ready paid, not-ready paid (in development).
// Also covers specialty pack tile states: empty section, purchased+ready,
// unpurchased (locked), and hidden when base language is not unlocked.
//
// #283: specialty-pack tests drive the real entitlementStore rather than injecting
// hasAddOn as a directly-controlled mock prop. Each test that needs a purchased
// add-on calls useEntitlementStore.setState({ purchasedAddOns: [...] }) before
// rendering; hasAddOn in renderGrid always reads from the real store. This proves
// that a regression deleting the store→prop wiring would be caught.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { SpecialtyPack } from "@/lib/langRegistry";

// mockSpecialtyPacks is shared across tests via vi.hoisted so the vi.mock factory can reference it.
// Each test that needs specialty packs pushes entries directly; beforeEach resets to [].
const mockSpecialtyPacks = vi.hoisted<SpecialtyPack[]>(() => []);

// Inline values in vi.mock factories — vi.mock is hoisted so outer-scope
// variables are not accessible; literals avoid the hoisting trap entirely.
vi.mock("@/lib/language", () => ({
  ITALIAN: { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
}));

// Three entries: Italian (free+ready), Spanish (paid+ready), French (paid+not-ready).
// This lets tests hit all three conditional branches in the paid-language renderer.
// SPECIALTY_PACKS is wired to mockSpecialtyPacks so tests can push entries directly.
// FREE_PACK_CODES and isSpecialtyPackCode are included so that useEntitlementStore
// (imported below for #283) can initialise its state without errors.
vi.mock("@/lib/langRegistry", () => ({
  LANGUAGE_REGISTRY: [
    { code: "it", config: { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" }, isFree: true,  ready: true  },
    { code: "es", config: { code: "es", name: "Spanish", nativeName: "Español",  flag: "🇪🇸" }, isFree: false, ready: true  },
    { code: "fr", config: { code: "fr", name: "French",  nativeName: "Français", flag: "🇫🇷" }, isFree: false, ready: false },
  ],
  SPECIALTY_PACKS:          mockSpecialtyPacks,
  FREE_PACK_CODES:           ["it"],
  ALL_PACK_CODES:            ["it", "es", "fr"],
  READY_PACK_CODES:          ["it", "es"],
  isSpecialtyPackCode:       () => false,
  isValidPackCode:           (s: string) => ["it", "es", "fr"].includes(s),
}));

vi.mock("@/lib/entitlement", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/entitlement")>();
  return { ...actual, PRICING: { annual: "$34.99/yr" } };
});

vi.mock("@/content/index", () => ({
  ALL_UNITS: Array.from({ length: 20 }, (_, i) => ({ id: `u${i}` })),
}));

import { LanguageGrid } from "./LanguageGrid";
import { useEntitlementStore } from "@/store/entitlementStore";
import type { LicenseType } from "@/lib/licenseTypes";
import { SUBSCRIPTION_GRACE_PERIOD_MS } from "@/lib/featureFlags";

const onSelect = vi.fn();
const onUpgradeClick = vi.fn();

// hasAddOn always reads from the real entitlementStore — tests that need a
// purchased add-on set up store state via useEntitlementStore.setState() before
// rendering. Tests with no purchased add-ons rely on the beforeEach reset.
// licenseType defaults to "free"; pass "subscription" for tests that need isPro=true
// (specialty packs visible via isPackUnlocked without purchase).
// validUntil defaults to null (no expiry — Task #420 isProEnabled contract) so every
// existing "subscription" call site stays Pro-enabled unless a test explicitly passes
// an expired timestamp.
function renderGrid(isPackUnlocked: (code: string) => boolean, licenseType: LicenseType = "free", validUntil: number | null = null) {
  render(
    <LanguageGrid
      onSelect={onSelect}
      onUpgradeClick={onUpgradeClick}
      isPackUnlocked={isPackUnlocked}
      hasAddOn={(code) => useEntitlementStore.getState().hasAddOn(code)}
      licenseType={licenseType}
      validUntil={validUntil}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSpecialtyPacks.length = 0;
  useEntitlementStore.setState({ purchasedAddOns: [] });
});
afterEach(() => {
  cleanup();
  // #403 DSC-1: env stubs must not leak between tests when an assertion throws before the
  // in-body unstub — file-level cleanup makes the in-body calls belt-and-braces only.
  vi.unstubAllEnvs();
});

describe("LanguageGrid", () => {
  // ── State 1: Italian (always free) ───────────────────────────────────────────
  it("renders Italian with 'Free' badge and calls onSelect('it') on click", () => {
    renderGrid(() => false);

    screen.getByText("Free"); // presence assertion — throws if absent
    screen.getByText("Italian"); // presence assertion
    screen.getByText(/20 units/); // presence assertion — unit count from ALL_UNITS

    const italianBtn = screen.getByRole("button", { name: /Italian/i });
    fireEvent.click(italianBtn);

    expect(onSelect).toHaveBeenCalledWith("it");
    expect(onUpgradeClick).not.toHaveBeenCalled();
  });

  // ── State 2: Unlocked + ready paid pack ──────────────────────────────────────
  it("renders an unlocked+ready paid language as selectable and calls onSelect on click", () => {
    renderGrid((code) => code === "es"); // Spanish unlocked

    const spanishBtn = screen.getByRole("button", { name: /Spanish/i });
    fireEvent.click(spanishBtn);

    expect(onSelect).toHaveBeenCalledWith("es");
    expect(onUpgradeClick).not.toHaveBeenCalled();
  });

  // ── State 3: Locked + ready paid pack → pricing CTA ──────────────────────────
  it("renders locked+ready paid language with pricing string and calls onUpgradeClick on click", () => {
    renderGrid(() => false); // nothing unlocked

    // Pricing string appears for each locked language entry (Spanish locked+ready, French locked+not-ready)
    const pricingEls = screen.getAllByText("$34.99/yr →");
    expect(pricingEls.length).toBe(2);

    // The Spanish button's click must call onUpgradeClick with no argument (base language CTA)
    const spanishBtn = screen.getByText("Spanish").closest("button");
    fireEvent.click(spanishBtn!);

    expect(onUpgradeClick).toHaveBeenCalledWith();
    expect(onSelect).not.toHaveBeenCalledWith("es");
  });

  // ── State 4: Not-ready pack → "In development" label + onUpgradeClick ────────
  it("renders a not-ready paid pack with 'In development' and calls onUpgradeClick on click", () => {
    renderGrid(() => false);

    screen.getByText(/In development/); // presence assertion
    screen.getByText("French"); // presence assertion

    const frenchBtn = screen.getByText("French").closest("button");
    fireEvent.click(frenchBtn!);

    expect(onUpgradeClick).toHaveBeenCalledWith();
    expect(onSelect).not.toHaveBeenCalledWith("fr");
  });

  // ── State 5: Unlocked + NOT-ready pack → "Soon" (not pricing, not selectable) ─
  it("renders 'Soon' for an unlocked not-ready pack and does not call onSelect on click", () => {
    renderGrid((code) => code === "fr"); // French unlocked but not ready

    screen.getByText("Soon"); // presence assertion
    // Verify the French button itself does NOT contain the pricing string
    const frenchBtnForPricingCheck = screen.getByText("French").closest("button");
    expect(frenchBtnForPricingCheck!.textContent).not.toContain("$34.99/yr");

    const frenchBtn = screen.getByText("French").closest("button");
    fireEvent.click(frenchBtn!);

    expect(onUpgradeClick).toHaveBeenCalledWith();
    expect(onSelect).not.toHaveBeenCalledWith("fr");
  });
});

describe("LanguageGrid — specialty packs (Task #150)", () => {
  // Task #427: specialtyPacks now defaults OFF (lib/featureFlags.ts) since it gates an
  // unfinished feature — this suite's own subject is Add-ons *visibility given ready/
  // purchased state*, not the feature-flag default itself (that's covered by
  // tests/featureFlags.test.ts and the #276/#403 flag-off tests below), so the flag is
  // stubbed on here. Tests that specifically need it off re-stub "false" themselves.
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS", "true");
  });

  // ── State 1: No specialty packs registered → Add-ons section absent ─────────
  it("does not render Add-ons section when SPECIALTY_PACKS is empty (default production state)", () => {
    // mockSpecialtyPacks is empty (reset by beforeEach) — matches production SPECIALTY_PACKS = []
    renderGrid(() => true);

    expect(screen.queryByText("Add-ons")).toBeNull();
  });

  // ── State 2: Purchased + ready specialty pack → selectable ──────────────────
  it("renders a purchased+ready specialty pack as selectable and calls onSelect(sp.code) on click", () => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    // Drive real store state — proves the hasAddOn callback wires store state to the UI.
    useEntitlementStore.setState({ purchasedAddOns: ["it-medical"] });

    renderGrid((code) => code === "it"); // Italian unlocked → its specialty packs shown

    screen.getByText("Add-ons"); // presence assertion
    const tile = screen.getByRole("button", { name: /Medical Italian/i });
    fireEvent.click(tile);

    expect(onSelect).toHaveBeenCalledWith("it-medical");
    expect(onUpgradeClick).not.toHaveBeenCalled();
  });

  // ── State 3: Not-purchased + ready specialty pack → locked, pricing CTA ──────
  it("renders an unpurchased+ready specialty pack as locked with pricing CTA and calls onUpgradeClick on click", () => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    // purchasedAddOns is [] from beforeEach — hasAddOn returns false for all codes.

    // "subscription" required: filter is hasAddOn(sp.code) || (isPro && isPackUnlocked(sp.baseLang)).
    // With free tier isPro=false, the unlocked base language alone does not surface the tile.
    renderGrid((code) => code === "it", "subscription"); // Italian unlocked, Pro tier

    screen.getByText("Add-ons"); // presence assertion
    // Verify the specific specialty tile (not any base-language tile) shows the pricing CTA
    const tile = screen.getByText("Medical Italian").closest("button");
    expect(tile!.textContent).toContain("$34.99/yr →");
    fireEvent.click(tile!);

    expect(onUpgradeClick).toHaveBeenCalledWith("it-medical");
    expect(onSelect).not.toHaveBeenCalledWith("it-medical");
  });

  // ── State 3b (#420): licenseType still "subscription" but validUntil has lapsed past its
  // grace period → isPro must be false, same as a free-tier user. Before #420, isProEnabled
  // never checked expiry, so this exact state (a subscriber who never manually deactivated
  // after their subscription lapsed) stayed Pro-gated-in indefinitely for the Add-ons section.
  it("#420: hides an unpurchased+ready specialty pack for a lapsed subscription (validUntil past grace period)", () => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });

    renderGrid((code) => code === "it", "subscription", Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS - 1);

    // isPro is false → the unpurchased tile does not surface at all (filter: hasAddOn ||
    // (isPro && isPackUnlocked)) — Add-ons section itself may still be absent since no
    // owned add-ons exist and the only registered pack is filtered out.
    expect(screen.queryByText("Medical Italian")).toBeNull();
  });

  // ── State 4: Specialty pack exists but base language not unlocked AND not purchased → hidden ──
  it("does not show specialty packs when their base language is not unlocked and the add-on is not purchased", () => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    // purchasedAddOns is [] from beforeEach — hasAddOn returns false; isPackUnlocked also returns false.

    renderGrid(() => false);

    expect(screen.queryByText("Add-ons")).toBeNull();
    expect(screen.queryByText("Medical Italian")).toBeNull();
  });

  // ── State 5: Not-ready specialty pack → "Coming soon" label ─────────────────
  it("renders a not-ready specialty pack with 'Coming soon' label and calls onUpgradeClick on click", () => {
    mockSpecialtyPacks.push({ code: "it-cooking", baseLang: "it", name: "Italian Cooking", ready: false });

    // "subscription" required: same isPro filter reasoning as State 3 above.
    renderGrid((code) => code === "it", "subscription");

    screen.getByText("Add-ons"); // presence assertion
    screen.getByText("Coming soon"); // presence assertion
    // Verify the specialty tile itself does not show pricing (base-language tiles may still show it)
    const tile = screen.getByText("Italian Cooking").closest("button");
    expect(tile!.textContent).not.toContain("$34.99/yr →");

    fireEvent.click(tile!);

    expect(onUpgradeClick).toHaveBeenCalledWith("it-cooking");
    expect(onSelect).not.toHaveBeenCalledWith("it-cooking");
  });

  // ── State 5b (#411): purchased + unready → owned state, never the buy CTA ───────
  it("#411: renders a purchased+unready specialty pack as 'Owned', never routes through onUpgradeClick or onSelect", () => {
    // Before #411, purchased && !sp.ready fell into the same branch as an unpurchased,
    // unready pack: "Coming soon" wired to onUpgradeClick — a user who already paid for
    // this pack (readiness later reverted — deprecation/rollback) would be shown a buy
    // CTA despite already owning it, contradicting Task #384's "readiness gates
    // purchasing/loading, not retention" policy.
    mockSpecialtyPacks.push({ code: "it-cooking", baseLang: "it", name: "Italian Cooking", ready: false });
    useEntitlementStore.setState({ purchasedAddOns: ["it-cooking"] });

    renderGrid((code) => code === "it");

    screen.getByText("Add-ons"); // presence assertion
    screen.getByText("Coming soon"); // presence assertion — pack is still genuinely unready
    screen.getByText("Owned"); // presence assertion — distinguishes owned from unowned

    const tile = screen.getByText("Italian Cooking").closest("div")!;
    // Not a price CTA — no pricing text anywhere in the tile
    expect(tile.textContent).not.toContain("$34.99/yr →");
    // Not a <button> at all — there is no action available in this state
    expect(screen.getByText("Italian Cooking").closest("button")).toBeNull();

    fireEvent.click(tile);

    expect(onUpgradeClick).not.toHaveBeenCalledWith("it-cooking");
    expect(onSelect).not.toHaveBeenCalledWith("it-cooking");
  });

  it("#411: purchased+unready renders distinctly from unpurchased+unready (no 'Owned' badge, buy CTA click still fires)", () => {
    mockSpecialtyPacks.push({ code: "it-cooking", baseLang: "it", name: "Italian Cooking", ready: false });
    // purchasedAddOns is [] from beforeEach — not owned.

    renderGrid((code) => code === "it", "subscription");

    screen.getByText("Coming soon");
    expect(screen.queryByText("Owned")).toBeNull();
    const tile = screen.getByText("Italian Cooking").closest("button")!;
    fireEvent.click(tile);
    expect(onUpgradeClick).toHaveBeenCalledWith("it-cooking");
  });

  // ── State 6b (#403): flag off must hide even OWNED add-ons — the case that made the
  // former render-site flag check load-bearing (hasAddOn bypasses isPro in the filter).
  // Deleting the flag fold in the specialtyPacks list makes this fail.
  it("#403: does not render Add-ons section for an OWNED add-on when the feature flag is off", () => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    vi.stubEnv("NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS", "false");
    // Ownership state injected directly — the purchase FLOW has its own gated tests; this
    // test is about rendering given owned state. The sanity assertion keeps it falsifiable:
    // if ownership were not actually set, the section would be hidden for the wrong reason.
    useEntitlementStore.setState({ purchasedAddOns: ["it-medical"] });
    expect(useEntitlementStore.getState().hasAddOn("it-medical")).toBe(true);

    renderGrid((code) => code === "it");

    expect(screen.queryByText("Add-ons")).toBeNull();
    expect(screen.queryByText("Medical Italian")).toBeNull();

    vi.unstubAllEnvs();
  });

  // ── State 6 (#276): Feature flag disabled → Add-ons section hidden even with registered packs ──
  it("#276: does not render Add-ons section when NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS is 'false'", () => {
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    vi.stubEnv("NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS", "false");

    renderGrid((code) => code === "it");

    expect(screen.queryByText("Add-ons")).toBeNull();
    expect(screen.queryByText("Medical Italian")).toBeNull();

    vi.unstubAllEnvs();
  });

  // ── State 7 (#278): Purchased add-on shown even when base language is not unlocked ───────────
  it("#278: shows a purchased specialty add-on even when its base language is not currently unlocked", () => {
    // This tests the structural enforcement added in Task #278: an owned add-on is never hidden
    // due to base language lock state (e.g. after a subscription lapses but the add-on was bought).
    mockSpecialtyPacks.push({ code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true });
    // Drive real store state — base language NOT unlocked but the add-on IS purchased.
    useEntitlementStore.setState({ purchasedAddOns: ["it-medical"] });

    renderGrid(() => false); // base language NOT unlocked

    screen.getByText("Add-ons"); // presence assertion
    // Purchased add-on tile is in selectable branch — click proves it is rendered and wired correctly.
    const tile = screen.getByRole("button", { name: /Medical Italian/i });
    fireEvent.click(tile);
    expect(onSelect).toHaveBeenCalledWith("it-medical");
  });
});
