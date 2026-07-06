// @vitest-environment jsdom
// ============================================================
// page.test.tsx — Behavioural tests for app/settings/page.tsx (Task #106)
// ============================================================
// Covers: handleLaunchAtLogin → enableAutostart, Activate button wiring,
// interrupt engine toggle → settingsStore.interruptEnabled, OS trigger
// toggles (wake/unlock/idle) and idle threshold input (#163/#164), plus
// license section, notification permission flow, mandatory mode, and snooze
// duration controls.
// ============================================================
// NOTE: Toggle renders role="switch" with the label text in a sibling div (not
// inside the button), so aria accessible-name queries don't work. Tests use
// closest("div.flex") DOM traversal to reach the switch within the right group.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { useSettingsStore } from "@/store/settingsStore";
import { useEntitlementStore, ALL_KNOWN_PACKS } from "@/store/entitlementStore";
import { openExternalUrl } from "@/lib/tauri";
import type { LicenseStatus } from "@/hooks/useLicenseActivation";

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
    licenseStatus: { type: "idle" } as LicenseStatus,
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
  mockActivation.licenseStatus = { type: "idle" };
  // clearAllMocks resets call counts but preserves mock implementations
  vi.clearAllMocks();
  resetStores();
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

// ── Helper: the idle-threshold <input> has no htmlFor/id association with its
// <label> — find it via the label text's parent container instead.
function queryIdleThresholdInput(): HTMLInputElement | null {
  const labelEl = screen.queryByText("Idle threshold (minutes)");
  if (!labelEl) return null;
  return labelEl.parentElement!.querySelector("input") as HTMLInputElement | null;
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

  // Test 3: OS Triggers section renders all 3 toggles when interruptEnabled=true and isTauri=true
  it("OS Triggers section renders 3 toggles when interruptEnabled and isTauri are true", () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, wakeEnabled: true, unlockEnabled: true, idleEnabled: true });

    render(<SettingsPage />);

    expect(getSwitchByLabel("Remind on wake").getAttribute("aria-checked")).toBe("true");
    expect(getSwitchByLabel("Remind on unlock").getAttribute("aria-checked")).toBe("true");
    expect(getSwitchByLabel("Remind when idle").getAttribute("aria-checked")).toBe("true");
  });

  // Test 4: Clicking the wake toggle updates wakeEnabled in settingsStore
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

  // Test 5: Interrupt engine toggle → interruptEnabled flips to true in store
  it("clicking 'Enable review reminders' toggle updates interruptEnabled in settingsStore", () => {
    useSettingsStore.setState({ interruptEnabled: false });

    render(<SettingsPage />);

    const interruptSwitch = getSwitchByLabel("Enable review reminders");
    expect(interruptSwitch.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(interruptSwitch);

    expect(useSettingsStore.getState().interruptEnabled).toBe(true);
    expect(interruptSwitch.getAttribute("aria-checked")).toBe("true");
  });

  // Test 6: OS Triggers section is absent in web mode even when interruptEnabled=true
  it("OS Triggers section does not render when isTauri is false", () => {
    tauriState.isTauri = false;
    useSettingsStore.setState({ interruptEnabled: true });

    render(<SettingsPage />);

    expect(screen.queryByText("OS Triggers")).toBeNull();
    expect(screen.queryByText("Remind on wake")).toBeNull();
  });

  // Test 7: OS Triggers section is absent when interruptEnabled=false, even on Tauri
  it("OS Triggers section does not render when interruptEnabled is false", () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: false });

    render(<SettingsPage />);

    expect(screen.queryByText("OS Triggers")).toBeNull();
  });

  // Test 8: Clicking the unlock toggle updates unlockEnabled in settingsStore
  it("clicking 'Remind on unlock' toggle updates unlockEnabled in settingsStore", async () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, unlockEnabled: true });

    render(<SettingsPage />);

    const unlockSwitch = getSwitchByLabel("Remind on unlock");
    expect(unlockSwitch.getAttribute("aria-checked")).toBe("true");

    await act(async () => { fireEvent.click(unlockSwitch); });

    expect(useSettingsStore.getState().unlockEnabled).toBe(false);
    expect(unlockSwitch.getAttribute("aria-checked")).toBe("false");
  });

  // Test 9: Clicking the idle toggle updates idleEnabled and hides the threshold input
  it("clicking 'Remind when idle' toggle updates idleEnabled and hides the threshold input", async () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, idleEnabled: true, idleThresholdMinutes: 15 });

    render(<SettingsPage />);

    expect(queryIdleThresholdInput()?.value).toBe("15");
    const idleSwitch = getSwitchByLabel("Remind when idle");
    expect(idleSwitch.getAttribute("aria-checked")).toBe("true");

    await act(async () => { fireEvent.click(idleSwitch); });

    expect(useSettingsStore.getState().idleEnabled).toBe(false);
    expect(queryIdleThresholdInput()).toBeNull();
  });

  // Test 10: Idle threshold input is not rendered when idleEnabled is false
  it("idle threshold input is not rendered when idleEnabled is false", () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, idleEnabled: false });

    render(<SettingsPage />);

    expect(getSwitchByLabel("Remind when idle").getAttribute("aria-checked")).toBe("false");
    expect(queryIdleThresholdInput()).toBeNull();
  });

  // Test 11: Changing the idle threshold input updates idleThresholdMinutes in settingsStore
  it("changing the idle threshold input updates idleThresholdMinutes in settingsStore", () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, idleEnabled: true, idleThresholdMinutes: 15 });

    render(<SettingsPage />);

    const input = queryIdleThresholdInput();
    expect(input?.value).toBe("15");

    fireEvent.change(input!, { target: { value: "45" } });

    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(45);
  });

  // ── Tests 26–28: Task #210 regression — idle threshold input clamp (#209 gate) ───────────
  // These three tests prove the onChange handler in page.tsx clamps out-of-range and
  // NaN-producing values before calling setIdleThresholdMinutes, so update_interrupt_config
  // never receives a value outside [5, 120] from UI interaction.
  // ─────────────────────────────────────────────────────────────────────────────────────────

  // Test 26: negative value typed → clamped to minimum (5)
  it("idle threshold input clamps a negative typed value to the minimum (5)", () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, idleEnabled: true, idleThresholdMinutes: 15 });

    render(<SettingsPage />);

    fireEvent.change(queryIdleThresholdInput()!, { target: { value: "-10" } });

    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(5);
  });

  // Test 27: value above 120 typed → clamped to maximum (120)
  it("idle threshold input clamps a typed value above 120 to the maximum (120)", () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, idleEnabled: true, idleThresholdMinutes: 15 });

    render(<SettingsPage />);

    fireEvent.change(queryIdleThresholdInput()!, { target: { value: "200" } });

    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(120);
  });

  // Test 28: empty string (Number("") = 0 < 5) → clamped to minimum (5); proves NaN blast radius blocked
  it("idle threshold input clamps an empty string value to the minimum (5)", () => {
    tauriState.isTauri = true;
    useSettingsStore.setState({ interruptEnabled: true, idleEnabled: true, idleThresholdMinutes: 15 });

    render(<SettingsPage />);

    fireEvent.change(queryIdleThresholdInput()!, { target: { value: "" } });

    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(5);
  });

  // ── Tests 12–25: License section, notification flow, mandatory mode, snooze ──────────────
  // These tests cover features outside Task #163's OS-trigger scope. They were separately
  // authorized during Task #164 to close a settings-page coverage gap that predated that task.
  // ─────────────────────────────────────────────────────────────────────────────────────────

  // Test 12: Active subscription license renders label, Active badge, all-languages message,
  // validUntil date, and a Manage subscription button
  it("renders active subscription license with all-languages unlocked and validUntil date", () => {
    const validUntil = new Date("2027-03-01T00:00:00Z").getTime();
    useEntitlementStore.setState({
      licenseKey: "PLYGLT-ABCD-1234-EFGH",
      instanceId: "inst-1",
      licenseType: "subscription",
      unlockedPacks: [...ALL_KNOWN_PACKS],
      lastValidated: Date.now(),
      validUntil,
    });

    render(<SettingsPage />);

    expect(screen.getByText("Subscription license")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("All languages unlocked", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`· active until ${new Date(validUntil).toLocaleDateString()}`, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage subscription →" })).toBeInTheDocument();
  });

  // Test 13: Free license (licenseType !== "subscription") shows "Free license" and hides
  // the Manage subscription button; partial unlockedPacks lists specific codes
  it("renders free license type without a Manage subscription button, listing specific unlocked packs", () => {
    useEntitlementStore.setState({
      licenseKey: "PLYGLT-FREE-0000-0000",
      instanceId: "inst-2",
      licenseType: "free",
      unlockedPacks: ["it"],
      lastValidated: 0,
      validUntil: null,
    });

    render(<SettingsPage />);

    expect(screen.getByText("Free license")).toBeInTheDocument();
    expect(screen.getByText("IT unlocked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage subscription →" })).toBeNull();
  });

  // Test 14: Clicking Manage subscription calls openExternalUrl with the customer portal URL
  it("clicking 'Manage subscription' calls openExternalUrl with the customer portal URL", () => {
    useEntitlementStore.setState({ licenseKey: "PLYGLT-ABCD-1234-EFGH", licenseType: "subscription" });

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Manage subscription →" }));

    expect(openExternalUrl).toHaveBeenCalledWith("https://pay.example.com/portal");
  });

  // Test 15: Clicking Re-validate and Deactivate call their respective handlers
  it("clicking Re-validate and Deactivate call handleValidate and handleDeactivate", () => {
    useEntitlementStore.setState({ licenseKey: "PLYGLT-ABCD-1234-EFGH", licenseType: "subscription" });

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Re-validate" }));
    expect(mockActivation.handleValidate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(mockActivation.handleDeactivate).toHaveBeenCalledTimes(1);
  });

  // Test 16: Error and success licenseStatus messages render with their exact text
  // in the licenseKey-set (active license) branch
  it("renders licenseStatus error and success messages when a license is active", () => {
    useEntitlementStore.setState({ licenseKey: "PLYGLT-ABCD-1234-EFGH", licenseType: "subscription" });
    mockActivation.licenseStatus = { type: "error", message: "Validation failed — check your connection." };

    const { unmount } = render(<SettingsPage />);
    expect(screen.getByText("Validation failed — check your connection.")).toBeInTheDocument();
    unmount();

    mockActivation.licenseStatus = { type: "success", message: "License re-validated." };
    render(<SettingsPage />);
    expect(screen.getByText("License re-validated.")).toBeInTheDocument();
  });

  // Test 17: Error and success licenseStatus messages render in the no-license (activation form) branch
  it("renders licenseStatus error and success messages on the license activation form", () => {
    mockActivation.licenseStatus = { type: "error", message: "Activation failed." };

    const { unmount } = render(<SettingsPage />);
    expect(screen.getByText("Activation failed.")).toBeInTheDocument();
    unmount();

    mockActivation.licenseStatus = { type: "success", message: "License activated." };
    render(<SettingsPage />);
    expect(screen.getByText("License activated.")).toBeInTheDocument();
  });

  // Test 18: handleInterruptToggle returns early (does not enable) when notification
  // permission is already "denied"
  it("does not enable review reminders when notification permission is denied", async () => {
    vi.stubGlobal("Notification", { permission: "denied", requestPermission: vi.fn() });
    useSettingsStore.setState({ interruptEnabled: false });

    render(<SettingsPage />);

    const toggle = getSwitchByLabel("Enable review reminders");
    await act(async () => { fireEvent.click(toggle); });

    expect(useSettingsStore.getState().interruptEnabled).toBe(false);
  });

  // Test 19: handleInterruptToggle requests permission when "default", then enables on grant
  it("requests notification permission and enables review reminders when granted", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    useSettingsStore.setState({ interruptEnabled: false });

    render(<SettingsPage />);

    const toggle = getSwitchByLabel("Enable review reminders");
    await act(async () => { fireEvent.click(toggle); });

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().interruptEnabled).toBe(true);
  });

  // Test 20: handleInterruptToggle requests permission when "default", stays disabled on refusal
  it("requests notification permission and leaves review reminders disabled when refused", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    useSettingsStore.setState({ interruptEnabled: false });

    render(<SettingsPage />);

    const toggle = getSwitchByLabel("Enable review reminders");
    await act(async () => { fireEvent.click(toggle); });

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().interruptEnabled).toBe(false);
  });

  // Test 21: Mandatory mode toggle reveals snooze duration buttons; clicking one updates snoozeMinutes
  it("enabling mandatory mode reveals snooze duration options and updates snoozeMinutes on click", () => {
    useSettingsStore.setState({ interruptEnabled: true, mandatory: true, snoozeMinutes: 15 });

    render(<SettingsPage />);

    const thirtyMinBtn = screen.getByRole("button", { name: "30 min" });
    expect(useSettingsStore.getState().snoozeMinutes).toBe(15);

    fireEvent.click(thirtyMinBtn);

    expect(useSettingsStore.getState().snoozeMinutes).toBe(30);
  });

  // Test 22: Snooze duration options are absent when mandatory mode is off
  it("does not render snooze duration options when mandatory mode is off", () => {
    useSettingsStore.setState({ interruptEnabled: true, mandatory: false });

    render(<SettingsPage />);

    expect(screen.queryByText("Snooze duration")).toBeNull();
  });

  // Test 23: License activation button shows the loading indicator and is disabled while loading
  it("disables the Activate button and shows a loading indicator while licenseStatus is loading", () => {
    mockActivation.licenseStatus = { type: "loading" };
    mockActivation.licenseInput = "PLYGLT-TEST-1234-ABCD";

    render(<SettingsPage />);

    const activateBtn = screen.getByRole("button", { name: "…" });
    expect(activateBtn).toBeDisabled();
  });

  // Test 24: Pressing Enter in the license key input triggers handleActivate
  it("pressing Enter in the license key input calls handleActivate", () => {
    render(<SettingsPage />);

    const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockActivation.handleActivate).toHaveBeenCalledTimes(1);
  });

  // Test 25: Pressing a non-Enter key in the license key input does not trigger handleActivate
  it("pressing a non-Enter key in the license key input does not call handleActivate", () => {
    render(<SettingsPage />);

    const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX-XXXX");
    fireEvent.keyDown(input, { key: "Tab" });

    expect(mockActivation.handleActivate).not.toHaveBeenCalled();
  });
});
