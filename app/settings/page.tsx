// ============================================================
// page.tsx — Settings page: interrupt schedule, DnD, snooze, and license controls
// ============================================================
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSettingsStore, INTERVAL_OPTIONS, SNOOZE_OPTIONS } from "@/store/settingsStore";
import { useEntitlementStore } from "@/store/entitlementStore";
import { ALL_PACK_CODES } from "@/lib/langRegistry";
import { runEntitlementValidation } from "@/components/EntitlementValidator";
import {
  isTauri,
  enableAutostart,
  disableAutostart,
  openExternalUrl,
  isNotificationPermissionGranted,
  requestNotificationPermission,
} from "@/lib/tauri";
import { CHECKOUT_URLS, CUSTOMER_PORTAL_URL, PRICING } from "@/lib/entitlement";
import { Section } from "@/components/settings/Section";
import { Toggle } from "@/components/settings/Toggle";
import { NotificationPermissionGate } from "@/components/NotificationPermissionGate";
import { SyncSignIn } from "@/components/SyncSignIn";
import { useExportImport } from "@/hooks/useExportImport";
import { useLicenseActivation } from "@/hooks/useLicenseActivation";

const IDLE_THRESHOLD_MIN_MINUTES = 5;
const IDLE_THRESHOLD_MAX_MINUTES = 120;

export default function SettingsPage() {
  const { launchAtLogin, interruptEnabled, intervalHours, mandatory, dndStart, dndEnd, snoozeMinutes, wakeEnabled, unlockEnabled, idleEnabled, idleThresholdMinutes, setLaunchAtLogin, setInterruptEnabled, setIntervalHours, setMandatory, setDndStart, setDndEnd, setSnoozeMinutes, setWakeEnabled, setUnlockEnabled, setIdleEnabled, setIdleThresholdMinutes } = useSettingsStore();
  const { licenseKey, licenseType, unlockedPacks, validUntil } = useEntitlementStore();
  useEffect(() => { runEntitlementValidation(useEntitlementStore.getState); }, []);
  const [notifPermission, setNotifPermission] = useState<"granted" | "denied" | "default" | "unsupported">("unsupported");
  // Task #166 live-testing fix (2026-08-10): on Tauri, check the SAME native permission
  // system components/InterruptHandler.tsx actually sends through — the browser
  // Notification Web API used below is a different, unrelated permission system that can
  // read "denied" inside a Tauri webview even when the real, relevant permission is
  // grantable, permanently blocking this toggle for no real reason (found live on Windows).
  // isPermissionGranted() only returns a boolean — Tauri doesn't expose a separate
  // "denied" state upfront; a real denial only surfaces after requestPermission() below.
  useEffect(() => {
    if (isTauri) {
      isNotificationPermissionGranted().then((granted) => {
        setNotifPermission(granted ? "granted" : "default");
      });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
  }, []);
  const { importRef, dataStatus, handleExport, handleImportFile } = useExportImport();
  const { licenseInput, setLicenseInput, licenseStatus, setLicenseStatus, handleActivate, handleValidate, handleDeactivate } = useLicenseActivation();
  // macOS-only: OS Triggers are implemented exclusively for macOS in os_events.rs (Batch 15
  // covers Windows/Linux). Hide on Windows ("Win32") and Linux ("Linux x86_64") by checking
  // navigator.platform; treat empty string (JSDOM / unset) as macOS-compatible.
  const isMacOS = isTauri && (typeof navigator === "undefined" || !navigator.platform || /mac/i.test(navigator.platform));

  async function handleInterruptToggle(v: boolean) {
    if (!v) { setInterruptEnabled(false); return; }
    if (notifPermission === "denied") return;
    if (notifPermission === "default") {
      // Task #166 live-testing fix: request through the same permission system that
      // actually gates sending (lib/tauri.ts's native gateway on Tauri; the browser
      // Notification API only in the web build, where no native plugin exists).
      const result = isTauri
        ? (await requestNotificationPermission())
        : typeof Notification !== "undefined"
          ? await Notification.requestPermission()
          : "denied";
      setNotifPermission(result);
      if (result === "granted") setInterruptEnabled(true);
      return;
    }
    setInterruptEnabled(true);
  }
  async function handleLaunchAtLogin(v: boolean) {
    setLaunchAtLogin(v);
    if (!isTauri) return;
    try {
      if (v) await enableAutostart(); else await disableAutostart();
    } catch (e) {
      console.error(`[ERR-AUTOSTART-${Date.now()}]`, e);
      setLaunchAtLogin(!v);
    }
  }
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-10">
          <Link href="/learn" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Back</Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        <div className="space-y-8">
          <Section title="Review Reminders">
            <Toggle label="Enable review reminders" description="Get reminded to review when cards are ready" checked={interruptEnabled} onChange={handleInterruptToggle} />
            <NotificationPermissionGate permission={notifPermission} />
            {interruptEnabled && (
              <div className="pt-2">
                <label className="text-sm text-gray-400 block mb-2">Remind me every</label>
                <div className="flex gap-2">
                  {INTERVAL_OPTIONS.map((h) => (
                    <button key={h} onClick={() => setIntervalHours(h)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${intervalHours === h ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>{h}h</button>
                  ))}
                </div>
              </div>
            )}
          </Section>
          {interruptEnabled && (
            <Section title="Mandatory Mode">
              <Toggle label="Block screen until review complete" description="Window locks until you finish 5 cards — always includes a Snooze button" checked={mandatory} onChange={setMandatory} />
              {mandatory && (
                <div className="pt-2">
                  <label className="text-sm text-gray-400 block mb-2">Snooze duration</label>
                  <div className="flex gap-2">
                    {SNOOZE_OPTIONS.map((m) => (
                      <button key={m} onClick={() => setSnoozeMinutes(m)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${snoozeMinutes === m ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>{m} min</button>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}
          {interruptEnabled && (
            // Task #532: this window is now the single canonical quiet-hours setting shared
            // with mobile's waking-hours concept (opposite framing, same real window — see
            // store/settingsStore.ts's dndWindowToWakingHours/wakingHoursToDndWindow and
            // docs/INTERRUPT_ARCHITECTURE.md §7). No live cross-device write-through exists
            // yet (that's the future desktop sync layer, Task #169 area), so copy below
            // deliberately does not claim a synced-across-devices behavior the app doesn't
            // perform today.
            <Section title="Do Not Disturb">
              <p className="text-gray-500 text-xs mb-4">No reminders will fire during these hours (uses your local time).</p>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">From</label>
                  <input type="time" value={dndStart} onChange={(e) => setDndStart(e.target.value)} className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-yellow-600" />
                </div>
                <span className="text-gray-600 mt-4">to</span>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">To</label>
                  <input type="time" value={dndEnd} onChange={(e) => setDndEnd(e.target.value)} className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-yellow-600" />
                </div>
              </div>
            </Section>
          )}
          {interruptEnabled && isMacOS && (
            <Section title="OS Triggers">
              <Toggle label="Remind on wake" description="Interrupt when your Mac wakes from sleep" checked={wakeEnabled} onChange={setWakeEnabled} />
              <Toggle label="Remind on unlock" description="Interrupt when you unlock your screen" checked={unlockEnabled} onChange={setUnlockEnabled} />
              <Toggle label="Remind when idle" description="Interrupt after your computer has been idle" checked={idleEnabled} onChange={setIdleEnabled} />
              {idleEnabled && (
                <div className="pt-2">
                  <label htmlFor="idle-threshold" className="text-sm text-gray-400 block mb-2">Idle threshold (minutes)</label>
                  <input id="idle-threshold" type="number" min={IDLE_THRESHOLD_MIN_MINUTES} max={IDLE_THRESHOLD_MAX_MINUTES} value={idleThresholdMinutes} onChange={(e) => setIdleThresholdMinutes(Math.min(IDLE_THRESHOLD_MAX_MINUTES, Math.max(IDLE_THRESHOLD_MIN_MINUTES, Number(e.target.value))))} className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:border-yellow-600" />
                </div>
              )}
            </Section>
          )}
          <Section title="Sync">
            <SyncSignIn />
          </Section>
          <Section title="License">
            {licenseKey ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white capitalize">{licenseType === "subscription" ? "Subscription" : "Free"} license</div>{/* display label — not a feature gate */}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {ALL_PACK_CODES.every(c => unlockedPacks.includes(c)) ? "All languages unlocked" : `${unlockedPacks.join(", ").toUpperCase()} unlocked`}
                      {validUntil && <> · active until {new Date(validUntil).toLocaleDateString()}</>}
                    </div>
                  </div>
                  <span className="text-xs bg-green-900 text-green-400 rounded-full px-2.5 py-0.5 font-semibold">Active</span>
                </div>
                <div className="flex gap-2 pt-1">
                  {/* subscription-only action — no feature flag, always visible to subscription users; isProEnabled() does not apply */}
                  {licenseType === "subscription" && (
                    <button onClick={() => openExternalUrl(CUSTOMER_PORTAL_URL)} className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors">Manage subscription →</button>
                  )}
                  <button onClick={handleValidate} disabled={licenseStatus.type === "loading"} className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1.5">Re-validate</button>
                  <button onClick={handleDeactivate} disabled={licenseStatus.type === "loading"} className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1.5 ml-auto">Deactivate</button>
                </div>
                {licenseStatus.type === "error" && <p className="text-xs text-red-400">{licenseStatus.message}</p>}
                {licenseStatus.type === "success" && <p className="text-xs text-green-400">{licenseStatus.message}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">License key</label>
                  <div className="flex gap-2">
                    <input type="text" value={licenseInput} onChange={(e) => { setLicenseInput(e.target.value); setLicenseStatus({ type: "idle" }); }} onKeyDown={(e) => e.key === "Enter" && handleActivate()} placeholder="XXXX-XXXX-XXXX-XXXX" className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-yellow-600" />
                    <button onClick={handleActivate} disabled={licenseStatus.type === "loading" || !licenseInput.trim()} className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">{licenseStatus.type === "loading" ? "…" : "Activate"}</button>
                  </div>
                </div>
                {licenseStatus.type === "error" && <p className="text-xs text-red-400">{licenseStatus.message}</p>}
                {licenseStatus.type === "success" && <p className="text-xs text-green-400">{licenseStatus.message}</p>}
                <div className="flex flex-col gap-1 pt-1">
                  <p className="text-xs text-gray-600">Don&apos;t have a license?</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openExternalUrl(CHECKOUT_URLS.annual)} className="text-xs text-yellow-600 hover:text-yellow-500 underline">Annual {PRICING.annual}</button>
                  </div>
                </div>
              </div>
            )}
          </Section>
          {isTauri && (
            <Section title="App">
              <Toggle label="Launch at login" description="Start plyglt in the background when you log in" checked={launchAtLogin} onChange={handleLaunchAtLogin} />
            </Section>
          )}
          <Section title="Your Data">
            <p className="text-xs text-gray-500">Export all progress as JSON. Use the same file to restore on another device.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={handleExport} className="text-sm bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded-lg px-4 py-1.5 transition-colors">Export progress</button>
              <button onClick={() => importRef.current?.click()} className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-4 py-1.5 transition-colors">Import progress</button>
              <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
            </div>
            {dataStatus.type === "success" && <p className="text-xs text-green-400">{dataStatus.message}</p>}
            {dataStatus.type === "error" && <p className="text-xs text-red-400">{dataStatus.message}</p>}
          </Section>
        </div>
      </div>
    </div>
  );
}
