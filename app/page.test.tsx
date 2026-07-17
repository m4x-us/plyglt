// @vitest-environment jsdom
// ============================================================
// app/page.test.tsx — Behavioral tests for app/page.tsx (Task #111)
// ============================================================
// Covers: LanguageGrid renders with free/unlocked states based on
// entitlement, BuyModal opens on upgrade CTA click, language selection
// writes the lang pair to localStorage via setTargetLangCode.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LANG_PAIR_KEY } from "@/lib/constants";
import { useEntitlementStore } from "@/store/entitlementStore";

// ── vi.hoisted: values closed over by vi.mock factories ───────────────────────

const { mockRouterReplace, mockRouterPush } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockRouterPush: vi.fn(),
}));

// ── next/navigation — controlled router ───────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
}));

// ── @/lib/tauri — isTauri=false, no-op openExternalUrl ───────────────────────
vi.mock("@/lib/tauri", () => ({
  isTauri: false,
  openExternalUrl: vi.fn(),
  invoke: vi.fn(),
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// ── @/lib/entitlement — constants only (functions not used by page.tsx) ───────
vi.mock("@/lib/entitlement", () => ({
  CHECKOUT_URLS: {
    annual: "https://pay.example.com/annual",
  },
  CUSTOMER_PORTAL_URL: "https://pay.example.com/portal",
  PRICING: { annual: "$34.99/yr" },
}));

// ── @/lib/storage — no-op: prevents Tauri IPC or real localStorage in stores ─
vi.mock("@/lib/storage", () => ({
  createPlatformStorage: () => ({
    getItem:    vi.fn().mockResolvedValue(null),
    setItem:    vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
  useIsHydrated: () => true,
}));

// ── @tauri-apps/plugin-store — safety net ─────────────────────────────────────
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get:     vi.fn().mockResolvedValue(undefined),
    set:     vi.fn().mockResolvedValue(undefined),
    save:    vi.fn().mockResolvedValue(undefined),
    has:     vi.fn().mockResolvedValue(false),
    delete:  vi.fn().mockResolvedValue(undefined),
    entries: vi.fn().mockResolvedValue([]),
    keys:    vi.fn().mockResolvedValue([]),
  }),
}));

// ── @/components/LanguageGrid — test double ───────────────────────────────────
// Exposes onSelect / onUpgradeClick / isPackUnlocked as buttons so tests can
// invoke them directly and observe the page's response.
vi.mock("@/components/LanguageGrid", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LanguageGrid: ({ onSelect, onUpgradeClick, isPackUnlocked }: any) => (
    <div data-testid="language-grid">
      <button data-testid="select-it" onClick={() => onSelect("it")}>Italian</button>
      <button data-testid="upgrade-cta" onClick={onUpgradeClick}>
        {isPackUnlocked("es") ? "Spanish" : "Unlock Spanish"}
      </button>
    </div>
  ),
}));

// ── @/components/BuyModal — test double ───────────────────────────────────────
vi.mock("@/components/BuyModal", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BuyModal: ({ onClose }: any) => (
    <div data-testid="buy-modal">
      <button data-testid="buy-modal-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

// Import the component under test after all mocks are registered
import LanguagePicker from "./page";

// ── Store reset ───────────────────────────────────────────────────────────────

function resetStores() {
  useEntitlementStore.setState({
    licenseKey:    null,
    instanceId:    null,
    licenseType:   "free",
    unlockedPacks: ["it"],
    lastValidated: 0,
    validUntil:    null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Clear localStorage so the page's useEffect does not redirect on startup
  localStorage.clear();
  resetStores();
});

afterEach(() => { cleanup(); });

// ─────────────────────────────────────────────────────────────────────────────

describe("LanguagePicker — app/page.tsx", () => {
  // Task #389: the returning-user redirect must key on stored PRESENCE (via
  // lib/constants.hasStoredLangPair), not on getters that synthesize defaults.
  it("redirects a returning user (stored lang pair) to /learn on mount", () => {
    localStorage.setItem(LANG_PAIR_KEY, "en-it");
    render(<LanguagePicker />);
    expect(mockRouterReplace).toHaveBeenCalledWith("/learn");
  });

  it("does NOT redirect a first-run user (nothing stored) — the picker must render", () => {
    render(<LanguagePicker />);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // Test 1: LanguageGrid isPackUnlocked reflects entitlement state
  it("passes isPackUnlocked to LanguageGrid — free pack shows unlocked, locked pack shows Unlock CTA", () => {
    // Italian is in unlockedPacks → isPackUnlocked("it") = true
    // Spanish is NOT in unlockedPacks → isPackUnlocked("es") = false
    useEntitlementStore.setState({ licenseType: "free", unlockedPacks: ["it"] });

    render(<LanguagePicker />);

    expect(screen.getByTestId("select-it")).toHaveTextContent("Italian");
    // upgrade-cta shows "Unlock Spanish" because isPackUnlocked("es") = false
    expect(screen.getByTestId("upgrade-cta")).toHaveTextContent("Unlock Spanish");
  });

  it("upgrade CTA shows language name when pack is unlocked (Pro state)", () => {
    // Both "it" and "es" unlocked — upgrade-cta shows "Spanish"
    useEntitlementStore.setState({ licenseType: "subscription", unlockedPacks: ["it", "es"] });

    render(<LanguagePicker />);

    expect(screen.getByTestId("upgrade-cta")).toHaveTextContent("Spanish");
  });

  // Test 2: BuyModal opens when upgrade CTA is clicked
  it("BuyModal renders when upgrade CTA is clicked and closes when onClose is invoked", () => {
    render(<LanguagePicker />);

    // BuyModal is initially absent
    expect(screen.queryByTestId("buy-modal")).not.toBeInTheDocument();

    // Click the upgrade CTA — triggers onUpgradeClick → setBuyModalOpen(true)
    fireEvent.click(screen.getByTestId("upgrade-cta"));

    expect(screen.getByTestId("buy-modal")).toBeInTheDocument();

    // Close the modal
    fireEvent.click(screen.getByTestId("buy-modal-close"));

    expect(screen.queryByTestId("buy-modal")).not.toBeInTheDocument();
  });

  // Test 3: Language selection writes lang pair to localStorage via setTargetLangCode
  it("selecting a language writes the lang pair to localStorage", () => {
    render(<LanguagePicker />);

    fireEvent.click(screen.getByTestId("select-it"));

    // setTargetLangCode("it") writes "en-it" to localStorage under LANG_PAIR_KEY
    expect(localStorage.getItem("srs-lang-pair")).toBe("en-it");
  });
});
