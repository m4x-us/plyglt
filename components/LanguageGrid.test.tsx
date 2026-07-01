// @vitest-environment jsdom
// ============================================================
// LanguageGrid.test.tsx — behavioral tests for LanguageGrid (Task #104, #150)
// ============================================================
// Covers all 4 base-language render states: Italian (free), unlocked+ready paid,
// locked+ready paid, not-ready paid (in development).
// Also covers specialty pack tile states: empty section, purchased+ready,
// unpurchased (locked), and hidden when base language is not unlocked.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Inline values in vi.mock factories — vi.mock is hoisted so outer-scope
// variables are not accessible; literals avoid the hoisting trap entirely.
vi.mock("@/lib/language", () => ({
  ITALIAN: { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
}));

// Three entries: Italian (free+ready), Spanish (paid+ready), French (paid+not-ready).
// This lets tests hit all three conditional branches in the paid-language renderer.
// getSpecialtyPacks is a vi.fn so individual tests can override its return value.
vi.mock("@/lib/langRegistry", () => ({
  LANGUAGE_REGISTRY: [
    { code: "it", config: { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" }, isFree: true,  ready: true  },
    { code: "es", config: { code: "es", name: "Spanish", nativeName: "Español",  flag: "🇪🇸" }, isFree: false, ready: true  },
    { code: "fr", config: { code: "fr", name: "French",  nativeName: "Français", flag: "🇫🇷" }, isFree: false, ready: false },
  ],
  getSpecialtyPacks: vi.fn(() => []),  // default: empty (matches production SPECIALTY_PACKS = [])
}));

vi.mock("@/lib/entitlement", () => ({
  PRICING: { annual: "$34.99/yr" },
}));

vi.mock("@/content/index", () => ({
  ALL_UNITS: Array.from({ length: 20 }, (_, i) => ({ id: `u${i}` })),
}));

import { LanguageGrid } from "./LanguageGrid";
import { getSpecialtyPacks } from "@/lib/langRegistry";

const onSelect = vi.fn();
const onUpgradeClick = vi.fn();

function renderGrid(
  isPackUnlocked: (code: string) => boolean,
  hasAddOn: (code: string) => boolean = () => false,
) {
  render(
    <LanguageGrid
      onSelect={onSelect}
      onUpgradeClick={onUpgradeClick}
      isPackUnlocked={isPackUnlocked}
      hasAddOn={hasAddOn}
    />
  );
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

describe("LanguageGrid", () => {
  // ── State 1: Italian (always free) ───────────────────────────────────────────
  it("renders Italian with 'Free' badge and calls onSelect('it') on click", () => {
    renderGrid(() => false);

    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Italian")).toBeTruthy();
    expect(screen.getByText(/20 units/)).toBeTruthy(); // unit count from ALL_UNITS

    const italianBtn = screen.getByText("Italian").closest("button");
    expect(italianBtn).not.toBeNull();
    fireEvent.click(italianBtn!);

    expect(onSelect).toHaveBeenCalledWith("it");
    expect(onUpgradeClick).not.toHaveBeenCalled();
  });

  // ── State 2: Unlocked + ready paid pack ──────────────────────────────────────
  it("renders an unlocked+ready paid language as selectable and calls onSelect on click", () => {
    renderGrid((code) => code === "es"); // Spanish unlocked

    const spanishBtn = screen.getByText("Spanish").closest("button");
    expect(spanishBtn).not.toBeNull();
    fireEvent.click(spanishBtn!);

    expect(onSelect).toHaveBeenCalledWith("es");
    expect(onUpgradeClick).not.toHaveBeenCalled();
  });

  // ── State 3: Locked + ready paid pack → pricing CTA ──────────────────────────
  it("renders locked+ready paid language with pricing string and calls onUpgradeClick on click", () => {
    renderGrid(() => false); // nothing unlocked

    // Pricing string appears for each locked language entry
    const pricingEls = screen.getAllByText("$34.99/yr →");
    expect(pricingEls.length).toBeGreaterThan(0);

    // The Spanish button's click must call onUpgradeClick, not onSelect
    const spanishBtn = screen.getByText("Spanish").closest("button");
    fireEvent.click(spanishBtn!);

    expect(onUpgradeClick).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalledWith("es");
  });

  // ── State 4: Not-ready pack → "In development" label + onUpgradeClick ────────
  it("renders a not-ready paid pack with 'In development' and calls onUpgradeClick on click", () => {
    renderGrid(() => false);

    expect(screen.getByText(/In development/)).toBeTruthy();
    expect(screen.getByText("French")).toBeTruthy();

    const frenchBtn = screen.getByText("French").closest("button");
    fireEvent.click(frenchBtn!);

    expect(onUpgradeClick).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalledWith("fr");
  });

  // ── State 5: Unlocked + NOT-ready pack → "Soon" (not pricing, not selectable) ─
  it("renders 'Soon' for an unlocked not-ready pack and does not call onSelect on click", () => {
    renderGrid((code) => code === "fr"); // French unlocked but not ready

    expect(screen.getByText("Soon")).toBeTruthy();
    // Verify the French button itself does NOT contain the pricing string
    const frenchBtnForPricingCheck = screen.getByText("French").closest("button");
    expect(frenchBtnForPricingCheck!.textContent).not.toContain("$34.99/yr");

    const frenchBtn = screen.getByText("French").closest("button");
    fireEvent.click(frenchBtn!);

    expect(onUpgradeClick).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalledWith("fr");
  });
});

describe("LanguageGrid — specialty packs (Task #150)", () => {
  // ── State 1: No specialty packs registered → Add-ons section absent ─────────
  it("does not render Add-ons section when getSpecialtyPacks returns [] (default production state)", () => {
    // getSpecialtyPacks mock defaults to returning [] — matches SPECIALTY_PACKS = []
    renderGrid(() => true);

    expect(screen.queryByText("Add-ons")).toBeNull();
  });

  // ── State 2: Purchased + ready specialty pack → selectable ──────────────────
  it("renders a purchased+ready specialty pack as selectable and calls onSelect(sp.code) on click", () => {
    vi.mocked(getSpecialtyPacks).mockReturnValue([
      { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true },
    ]);

    renderGrid(
      (code) => code === "it",     // Italian unlocked → its specialty packs shown
      (code) => code === "it-medical", // it-medical purchased
    );

    expect(screen.getByText("Add-ons")).toBeTruthy();
    const tile = screen.getByText("Medical Italian").closest("button");
    expect(tile).not.toBeNull();
    fireEvent.click(tile!);

    expect(onSelect).toHaveBeenCalledWith("it-medical");
    expect(onUpgradeClick).not.toHaveBeenCalled();
  });

  // ── State 3: Not-purchased + ready specialty pack → locked, pricing CTA ──────
  it("renders an unpurchased+ready specialty pack as locked with pricing CTA and calls onUpgradeClick on click", () => {
    vi.mocked(getSpecialtyPacks).mockReturnValue([
      { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true },
    ]);

    renderGrid(
      (code) => code === "it",  // Italian unlocked
      () => false,              // nothing purchased
    );

    expect(screen.getByText("Add-ons")).toBeTruthy();
    // Verify the specific specialty tile (not any base-language tile) shows the pricing CTA
    const tile = screen.getByText("Medical Italian").closest("button");
    expect(tile!.textContent).toContain("$34.99/yr →");
    fireEvent.click(tile!);

    expect(onUpgradeClick).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalledWith("it-medical");
  });

  // ── State 4: Specialty pack exists but base language not unlocked → hidden ───
  it("does not show specialty packs when their base language is not unlocked", () => {
    vi.mocked(getSpecialtyPacks).mockReturnValue([
      { code: "it-medical", baseLang: "it", name: "Medical Italian", ready: true },
    ]);

    // isPackUnlocked returns false for everything — Italian not unlocked → no specialty tiles
    renderGrid(() => false);

    expect(screen.queryByText("Add-ons")).toBeNull();
    expect(screen.queryByText("Medical Italian")).toBeNull();
  });

  // ── State 5: Not-ready specialty pack → "Coming soon" label ─────────────────
  it("renders a not-ready specialty pack with 'Coming soon' label and calls onUpgradeClick on click", () => {
    vi.mocked(getSpecialtyPacks).mockReturnValue([
      { code: "it-cooking", baseLang: "it", name: "Italian Cooking", ready: false },
    ]);

    renderGrid((code) => code === "it");

    expect(screen.getByText("Add-ons")).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
    // Verify the specialty tile itself does not show pricing (base-language tiles may still show it)
    const tile = screen.getByText("Italian Cooking").closest("button");
    expect(tile!.textContent).not.toContain("$34.99/yr →");

    fireEvent.click(tile!);

    expect(onUpgradeClick).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalledWith("it-cooking");
  });
});
