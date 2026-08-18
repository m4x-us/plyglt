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

const {
  tauriState,
  mockEnableAutostart,
  mockDisableAutostart,
  mockIsNotificationPermissionGranted,
  mockRequestNotificationPermission,
} = vi.hoisted(() => ({
  tauriState: { isTauri: false as boolean },
  mockEnableAutostart: vi.fn().mockResolvedValue(undefined),
  mockDisableAutostart: vi.fn().mockResolvedValue(undefined),
  mockIsNotificationPermissionGranted: vi.fn().mockResolvedValue(false),
  mockRequestNotificationPermission: vi.fn().mockResolvedValue("denied"),
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
  isNotificationPermissionGranted: (...args: unknown[]) => mockIsNotificationPermissionGranted(...args),
  requestNotificationPermission: (...args: unknown[]) => mockRequestNotificationPermission(...args),
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
    // Round-14 audit fix: the Review Reminders section (and its Mandatory Mode/DnD/OS Triggers
    // dependents) are now Pro-gated (isPro in page.tsx). Every pre-existing test in this file
    // was written before that gate existed and exercises those controls directly, so default
    // to Pro here; the gate's own behavior gets its own dedicated tests (Free hides the
    // controls behind an upgrade prompt) below. Tests targeting the License section's own
    // Free/Pro display differences already set licenseType explicitly and are unaffected.
    licenseType:   "subscription",
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

  // OS Triggers scope note (Task #225): the tests below (through the idle-threshold clamp
  // tests) verify only the UI/store/IPC layer — that toggles flip settingsStore fields and
  // that updateInterruptConfig is called with the right values. They do NOT and cannot verify
  // that the Rust background thread actually gates wake/unlock/idle interrupts on these flags.
  // That behavior is covered separately by 11 Rust unit tests in
  // src-tauri/src/os_events.rs (mod tests) — run via `cargo test --lib` in src-tauri/.
  // Both suites must be green for the OS trigger feature to be considered verified end-to-end.

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

  // Round-14 audit finding (4-way convergence: Agent A, B, K, W): before this fix, a Free
  // user saw the exact same fully-interactive toggle/interval/Mandatory-Mode/DnD/OS-Triggers
  // controls as a Pro user, silently inert since components/InterruptHandler.tsx's Pro gate
  // (round 13) never lets InterruptHandlerCore mount for them. Deletion Test: reverting the
  // isPro ternary back to always rendering the functional toggle makes this test's "Upgrade"
  // button assertion fail (no such button exists) and the switch-role query below succeed
  // instead of throwing.
  describe("Review Reminders — Pro gate (round-14 audit fix)", () => {
    it("shows an upgrade prompt instead of the functional toggle for a Free license", () => {
      useEntitlementStore.setState({ licenseType: "free", validUntil: null });

      render(<SettingsPage />);

      expect(screen.getByText("Proactive interruptions are a Pro feature")).toBeInTheDocument();
      expect(screen.queryByRole("switch", { name: "Enable review reminders" })).toBeNull();
    });

    it("clicking the upgrade prompt opens the checkout URL, and requests no OS notification permission", () => {
      useEntitlementStore.setState({ licenseType: "free", validUntil: null });

      render(<SettingsPage />);

      fireEvent.click(screen.getByText(/Upgrade/));

      expect(openExternalUrl).toHaveBeenCalledWith(expect.stringContaining("http"));
      // requestNotificationPermission only fires from handleInterruptToggle, which a Free
      // user can no longer reach at all — confirms no permission prompt was triggered.
      expect(mockRequestNotificationPermission).not.toHaveBeenCalled();
    });

    it("does not render Mandatory Mode, Do Not Disturb, or OS Triggers for a Free license, even with interruptEnabled true from a prior Pro session", () => {
      useEntitlementStore.setState({ licenseType: "free", validUntil: null });
      useSettingsStore.setState({ interruptEnabled: true, mandatory: true });
      tauriState.isTauri = true;

      render(<SettingsPage />);

      expect(screen.queryByText("Mandatory Mode")).toBeNull();
      expect(screen.queryByText("Do Not Disturb")).toBeNull();
      expect(screen.queryByText("OS Triggers")).toBeNull();
    });

    it("shows the functional toggle for an active subscription — control case for the gate itself", () => {
      useEntitlementStore.setState({ licenseType: "subscription", validUntil: null });

      render(<SettingsPage />);

      expect(screen.queryByText("Proactive interruptions are a Pro feature")).toBeNull();
      expect(getSwitchByLabel("Enable review reminders")).toBeInTheDocument();
    });

    it("does not render the functional toggle once a subscription's grace period has expired", () => {
      useEntitlementStore.setState({ licenseType: "subscription", validUntil: Date.now() - 1000 * 60 * 60 * 24 * 365 });

      render(<SettingsPage />);

      expect(screen.getByText("Proactive interruptions are a Pro feature")).toBeInTheDocument();
    });
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

  // Task #166 live-testing fix (2026-08-10): on Tauri, the toggle must check/request
  // permission via lib/tauri.ts's native gateway, NOT the browser Notification API —
  // the actual bug found live (the browser API can read "denied" inside a Tauri webview
  // even when the real, native permission is grantable, permanently blocking the toggle).

  it("on Tauri, checks native permission via lib/tauri.ts on mount, not the browser Notification API", async () => {
    const browserRequestPermission = vi.fn();
    vi.stubGlobal("Notification", { permission: "denied", requestPermission: browserRequestPermission });
    tauriState.isTauri = true;
    mockIsNotificationPermissionGranted.mockResolvedValue(true);
    useSettingsStore.setState({ interruptEnabled: false });

    await act(async () => { render(<SettingsPage />); });
    expect(mockIsNotificationPermissionGranted).toHaveBeenCalledTimes(1);

    const toggle = getSwitchByLabel("Enable review reminders");
    await act(async () => { fireEvent.click(toggle); });

    // Already granted natively → enables directly, no request needed, and the browser
    // API (which reports "denied") is never consulted.
    expect(mockRequestNotificationPermission).not.toHaveBeenCalled();
    expect(browserRequestPermission).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().interruptEnabled).toBe(true);
  });

  it("on Tauri, requests native permission via lib/tauri.ts and enables review reminders when granted", async () => {
    const browserRequestPermission = vi.fn();
    vi.stubGlobal("Notification", { permission: "denied", requestPermission: browserRequestPermission });
    tauriState.isTauri = true;
    mockIsNotificationPermissionGranted.mockResolvedValue(false);
    mockRequestNotificationPermission.mockResolvedValue("granted");
    useSettingsStore.setState({ interruptEnabled: false });

    await act(async () => { render(<SettingsPage />); });

    const toggle = getSwitchByLabel("Enable review reminders");
    await act(async () => { fireEvent.click(toggle); });

    expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(browserRequestPermission).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().interruptEnabled).toBe(true);
  });

  it("on Tauri, requests native permission via lib/tauri.ts and leaves review reminders disabled when refused", async () => {
    tauriState.isTauri = true;
    mockIsNotificationPermissionGranted.mockResolvedValue(false);
    mockRequestNotificationPermission.mockResolvedValue("denied");
    useSettingsStore.setState({ interruptEnabled: false });

    await act(async () => { render(<SettingsPage />); });

    const toggle = getSwitchByLabel("Enable review reminders");
    await act(async () => { fireEvent.click(toggle); });

    expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
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
