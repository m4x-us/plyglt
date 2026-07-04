// @vitest-environment jsdom
// ============================================================
// page.test.tsx — Behavioural tests for app/settings/page.tsx (Task #106)
// ============================================================
// Covers: handleLaunchAtLogin → enableAutostart, Activate button wiring,
// and interrupt engine toggle → settingsStore.interruptEnabled.
// ============================================================
// NOTE: Toggle renders role="switch" with the label text in a sibling div (not
// inside the button), so aria accessible-name queries don't work. Tests use
// closest("div.flex") DOM traversal to reach the switch within the right group.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { useSettingsStore } from "@/store/settingsStore";
import { useEntitlementStore } from "@/store/entitlementStore";

// ── vi.hoisted: any value closed over by a vi.mock factory must be hoisted ────
// vi.mock factories are hoisted before module imports; outer-scope variables are
// in the temporal dead zone when the factory runs. Only vi.hoisted() values
// are resolved before the factory executes.

const { tauriState, mockEnableAutostart, mockDisableAutostart } = vi.hoisted(() => ({
  tauriState: { isTauri: false as boolean },
  mockEnableAutostart: vi.fn().mockResolvedValue(undefined),
  mockDisableAutostart: vi.fn().mockResolvedValue(undefined),
}));

const { mockActivation } = vi.hoisted(() => ({
  mockActivation: {
    licenseInput: "" as string,
    setLicenseInput: vi.fn(),
    licenseStatus: { type: "idle" as const },
    setLicenseStatus: vi.fn(),
    handleActivate: vi.fn(),
    handleValidate: vi.fn(),
    handleDeactivate: vi.fn(),
  },
}));

// ── @/lib/tauri — isTauri is a getter so it reads tauriState.isTauri at call time ─
vi.mock("@/lib/tauri", () => ({
  get isTauri() { return tauriState.isTauri; },
  enableAutostart:  (...args: unknown[]) => mockEnableAutostart(...args),
  disableAutostart: (...args: unknown[]) => mockDisableAutostart(...args),
  openExternalUrl: vi.fn(),
  listen: vi.fn().mockResolvedValue(() => {}),
  invoke: vi.fn(),
  checkForUpdates: vi.fn().mockResolvedValue({ available: false }),
}));

// ── @/hooks/useLicenseActivation — controlled per-test via mockActivation ────
vi.mock("@/hooks/useLicenseActivation", () => ({
  useLicenseActivation: () => mockActivation,
}));

// ── @/hooks/useExportImport — minimal stub ────────────────────────────────────
vi.mock("@/hooks/useExportImport", () => ({
  useExportImport: () => ({
    importRef: { current: null },
    dataStatus: { type: "idle" },
    handleExport: vi.fn(),
    handleImportFile: vi.fn(),
  }),
}));

// ── @/components/EntitlementValidator — no-op: page calls runEntitlementValidation
//    in useEffect; must not trigger real validation network calls ───────────────
vi.mock("@/components/EntitlementValidator", () => ({
  runEntitlementValidation: vi.fn(),
}));

// ── @/lib/entitlement — pricing constants required by the license form ─────────
vi.mock("@/lib/entitlement", () => ({
  CHECKOUT_URLS: {
    annual: "https://pay.example.com/annual",
  },
  CUSTOMER_PORTAL_URL: "https://pay.example.com/portal",
  PRICING: { annual: "$34.99/yr" },
  validateLicense: vi.fn().mockResolvedValue({ ok: true, validUntil: null }),
}));

// ── @/lib/storage — mock the entire storage layer so no Tauri IPC is attempted ─
// When isTauri=true, Zustand persist calls setItem → loadTauriStore → dynamic
// import("@tauri-apps/plugin-store"). Mocking lib/storage bypasses that chain
// entirely: stores behave as in-memory Zustand with no-op persistence.
vi.mock("@/lib/storage", () => ({
  createPlatformStorage: () => ({
    getItem:    vi.fn().mockResolvedValue(null),
    setItem:    vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
  useIsHydrated: () => true,
}));

// ── @tauri-apps/plugin-store — safety net in case other imports reach it ──────
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

// ── next/link — render children in a plain anchor to avoid router context ─────
vi.mock("next/link", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// Import after all mocks are registered
import SettingsPage from "./page";

// ── Store reset helpers ───────────────────────────────────────────────────────

function resetStores() {
  useSettingsStore.setState({
    launchAtLogin:        false,
    interruptEnabled:     false,
    intervalHours:        2,
    mandatory:            false,
    dndStart:             "22:00",
    dndEnd:               "08:00",
    snoozeMinutes:        15,
    wakeEnabled:          true,
    unlockEnabled:        true,
    idleEnabled:          true,
    idleThresholdMinutes: 15,
  });
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
  tauriState.isTauri = false;
  mockActivation.licenseInput = "";
  // clearAllMocks resets call counts but preserves mock implementations
  vi.clearAllMocks();
  resetStores();
});

afterEach(() => { cleanup(); });

// ── Helper: find the role="switch" button within the group labelled by `label` ─
// Toggle renders the label in a sibling <div>, not inside the <button>, so
// accessible-name queries don't work. DOM traversal via the label text is used.
function getSwitchByLabel(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  const groupDiv = labelEl.closest("div.flex");
  const btn = groupDiv!.querySelector('button[role="switch"]') as HTMLElement;
  if (!btn) throw new Error(`No switch found in group labelled "${label}"`);
  return btn;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("SettingsPage", () => {
  // Test 1: handleLaunchAtLogin toggle → enableAutostart called with isTauri=true
  it("clicking 'Launch at login' toggle calls enableAutostart and sets launchAtLogin=true", async () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ launchAtLogin: false });

    render(<SettingsPage />);

    const launchSwitch = getSwitchByLabel("Launch at login");
    expect(launchSwitch.getAttribute("aria-checked")).toBe("false");

    // handleLaunchAtLogin is async — act() flushes all pending state updates + microtasks
    await act(async () => { fireEvent.click(launchSwitch); });

    expect(useSettingsStore.getState().launchAtLogin).toBe(true);
    expect(mockEnableAutostart).toHaveBeenCalledTimes(1);
    expect(mockDisableAutostart).not.toHaveBeenCalled();
  });

  // Test 2: License activation form → Activate button calls handleActivate
  it("clicking Activate calls useLicenseActivation.handleActivate", () => {
    // licenseKey = null → activation form is shown (from resetStores)
    // licenseInput must be non-empty so the button is not disabled
    mockActivation.licenseInput = "PLYGLT-TEST-1234-ABCD";

    render(<SettingsPage />);

    const activateBtn = screen.getByRole("button", { name: "Activate" });
    expect(activateBtn).not.toBeDisabled();

    fireEvent.click(activateBtn);

    expect(mockActivation.handleActivate).toHaveBeenCalledTimes(1);
  });

  // Test 4: OS Triggers section renders all 3 toggles when interruptEnabled=true and isTauri=true
  it("OS Triggers section renders 3 toggles when interruptEnabled and isTauri are true", () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, wakeEnabled: true, unlockEnabled: true, idleEnabled: true });

    render(<SettingsPage />);

    expect(getSwitchByLabel("Remind on wake").getAttribute("aria-checked")).toBe("true");
    expect(getSwitchByLabel("Remind on unlock").getAttribute("aria-checked")).toBe("true");
    expect(getSwitchByLabel("Remind when idle").getAttribute("aria-checked")).toBe("true");
  });

  // Test 5: Clicking the wake toggle updates wakeEnabled in settingsStore
  it("clicking 'Remind on wake' toggle updates wakeEnabled in settingsStore", async () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, wakeEnabled: true });

    render(<SettingsPage />);

    const wakeSwitch = getSwitchByLabel("Remind on wake");
    expect(wakeSwitch.getAttribute("aria-checked")).toBe("true");

    await act(async () => { fireEvent.click(wakeSwitch); });

    expect(useSettingsStore.getState().wakeEnabled).toBe(false);
    expect(wakeSwitch.getAttribute("aria-checked")).toBe("false");
  });

  // Test 3: Interrupt engine toggle → interruptEnabled flips to true in store
  it("clicking 'Enable review reminders' toggle updates interruptEnabled in settingsStore", () => {
    useSettingsStore.setState({ interruptEnabled: false });

    render(<SettingsPage />);

    const interruptSwitch = getSwitchByLabel("Enable review reminders");
    expect(interruptSwitch.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(interruptSwitch);

    expect(useSettingsStore.getState().interruptEnabled).toBe(true);
    expect(interruptSwitch.getAttribute("aria-checked")).toBe("true");
  });
});
