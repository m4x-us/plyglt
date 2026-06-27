"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSettingsStore, INTERVAL_OPTIONS, SNOOZE_OPTIONS } from "@/store/settingsStore";
import { useEntitlementStore, ALL_KNOWN_PACKS } from "@/store/entitlementStore";
import { useSRSStore } from "@/store/srsStore";
import { activateLicense, deactivateLicense, validateLicense, CHECKOUT_URLS, CUSTOMER_PORTAL_URL, PRICING } from "@/lib/entitlement";
import { runEntitlementValidation } from "@/components/EntitlementValidator";
import { isTauri, enableAutostart, disableAutostart, openExternalUrl } from "@/lib/tauri";
import { parseBackup, CURRENT_BACKUP_VERSION } from "@/lib/importBackup";
import { LANG_PAIR_KEY } from "@/lib/constants";

export default function SettingsPage() {
  const {
    launchAtLogin,
    interruptEnabled,
    intervalHours,
    mandatory,
    dndStart,
    dndEnd,
    snoozeMinutes,
    setLaunchAtLogin,
    setInterruptEnabled,
    setIntervalHours,
    setMandatory,
    setDndStart,
    setDndEnd,
    setSnoozeMinutes,
  } = useSettingsStore();

  const {
    licenseKey,
    instanceId,
    licenseType,
    unlockedPacks,
    validUntil,
    setEntitlement,
    clearEntitlement,
    markValidated,
  } = useEntitlementStore();

  // Intentional: re-validate when the user opens settings specifically.
  // EntitlementValidator runs at app startup; this handles the case where the
  // user navigates to settings after an extended session without relaunching.
  useEffect(() => {
    runEntitlementValidation(useEntitlementStore.getState);
  }, []);

  const [licenseInput, setLicenseInput] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<
    { type: "idle" } | { type: "loading" } | { type: "error"; message: string } | { type: "success"; message: string }
  >({ type: "idle" });

  async function handleActivate() {
    if (!licenseInput.trim()) return;
    setLicenseStatus({ type: "loading" });
    const result = await activateLicense(licenseInput);
    if (result.ok) {
      setEntitlement({
        licenseKey: result.licenseKey,
        instanceId: result.instanceId,
        licenseType: result.licenseType,
        unlockedPacks: result.unlockedPacks,
        validUntil: result.validUntil,
      });
      setLicenseInput("");
      setLicenseStatus({ type: "success", message: "License activated." });
    } else {
      setLicenseStatus({ type: "error", message: result.error });
    }
  }

  async function handleValidate() {
    if (!licenseKey || !instanceId) return;
    setLicenseStatus({ type: "loading" });
    const result = await validateLicense(licenseKey, instanceId);
    if (result.ok) {
      markValidated(result.validUntil);
      setLicenseStatus({ type: "success", message: "License is valid." });
    } else {
      setLicenseStatus({ type: "error", message: result.error });
    }
  }

  async function handleDeactivate() {
    if (!licenseKey || !instanceId) return;
    setLicenseStatus({ type: "loading" });
    const result = await deactivateLicense(licenseKey, instanceId);
    if (!result.ok) {
      setLicenseStatus({ type: "error", message: result.error });
      return; // Do NOT clear entitlement — the license slot is still occupied
    }
    clearEntitlement();
    setLicenseStatus({ type: "idle" });
  }

  async function handleLaunchAtLogin(v: boolean) {
    setLaunchAtLogin(v);
    if (isTauri) {
      try {
        if (v) await enableAutostart();
        else await disableAutostart();
      } catch (e) {
        console.error(`[SETTINGS_AUTOSTART_FAIL-${Date.now()}]`, e);
        setLaunchAtLogin(!v); // rollback optimistic update
      }
    }
  }

  // ── Data export / import ────────────────────────────────────────────────────
  const importRef = useRef<HTMLInputElement>(null);
  const [dataStatus, setDataStatus] = useState<
    { type: "idle" } | { type: "success"; message: string } | { type: "error"; message: string }
  >({ type: "idle" });

  function handleExport() {
    const srs = useSRSStore.getState();
    const entitlement = useEntitlementStore.getState();
    const payload = JSON.stringify(
      {
        _version: CURRENT_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        langPair: window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it",
        srs: {
          cards: srs.cards,
          streak: srs.streak,
          lastStudiedDate: srs.lastStudiedDate,
        },
        entitlement: {
          licenseKey: entitlement.licenseKey,
          instanceId: entitlement.instanceId,
          licenseType: entitlement.licenseType,
          unlockedPacks: entitlement.unlockedPacks,
          validUntil: entitlement.validUntil,
        },
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plyglt-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDataStatus({ type: "success", message: "Progress exported — check your Downloads folder." });
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = (event) => {
      const domError = (event.target as FileReader).error;
      console.error(`[SETTINGS_IMPORT_FILEREADER_FAIL-${Date.now()}]`, domError);
      setDataStatus({ type: "error", message: "Could not read the file." });
      if (importRef.current) importRef.current.value = "";
    };
    reader.onload = () => {
      try {
        const result = parseBackup(JSON.parse(reader.result as string));
        if (!result.ok) {
          setDataStatus({ type: "error", message: result.error });
          if (importRef.current) importRef.current.value = "";
          return;
        }
        const activeLangPair = window.localStorage.getItem(LANG_PAIR_KEY) ?? "en-it";
        if (result.langPair !== activeLangPair) {
          setDataStatus({
            type: "error",
            message: `This backup is for ${result.langPair} but you are studying ${activeLangPair}. Switch languages first, then import.`,
          });
          if (importRef.current) importRef.current.value = "";
          return;
        }
        useSRSStore.setState({ ...result.srs, activeSession: null });
        const { licenseKey, instanceId } = result.entitlement;
        if (licenseKey && instanceId) {
          useEntitlementStore.getState().setEntitlement({ ...result.entitlement, licenseKey, instanceId });
        }
        const skippedNote = result.skippedCardCount > 0
          ? ` (${result.skippedCardCount} card(s) skipped — corrupted data)`
          : "";
        setDataStatus({ type: "success", message: `Restored ${result.validCardCount} card(s) of progress.${skippedNote}` });
      } catch (e) {
        console.error(`[SETTINGS_IMPORT_PARSE_FAIL-${Date.now()}]`, e);
        setDataStatus({ type: "error", message: "Could not read the file — is it a valid backup?" });
      }
      // Reset file input so the same file can be re-imported if needed
      if (importRef.current) importRef.current.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Link
            href="/learn"
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        <div className="space-y-8">
          {/* ── Review Reminders ─────────────────────────────────────── */}
          <Section title="Review Reminders">
            <Toggle
              label="Enable review reminders"
              description="Get reminded to review when cards are ready"
              checked={interruptEnabled}
              onChange={setInterruptEnabled}
            />

            {interruptEnabled && (
              <>
                <div className="pt-2">
                  <label className="text-sm text-gray-400 block mb-2">Remind me every</label>
                  <div className="flex gap-2">
                    {INTERVAL_OPTIONS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setIntervalHours(h)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          intervalHours === h
                            ? "bg-yellow-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* ── Mandatory Mode ────────────────────────────────────────── */}
          {interruptEnabled && (
            <Section title="Mandatory Mode">
              <Toggle
                label="Block screen until review complete"
                description="Window locks until you finish 5 cards — always includes a Snooze button"
                checked={mandatory}
                onChange={setMandatory}
              />

              {mandatory && (
                <div className="pt-2">
                  <label className="text-sm text-gray-400 block mb-2">Snooze duration</label>
                  <div className="flex gap-2">
                    {SNOOZE_OPTIONS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setSnoozeMinutes(m)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          snoozeMinutes === m
                            ? "bg-yellow-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* ── Do Not Disturb ────────────────────────────────────────── */}
          {interruptEnabled && (
            <Section title="Do Not Disturb">
              <p className="text-gray-500 text-xs mb-4">
                No reminders will fire during these hours (uses your local time).
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">From</label>
                  <input
                    type="time"
                    value={dndStart}
                    onChange={(e) => setDndStart(e.target.value)}
                    className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-yellow-600"
                  />
                </div>
                <span className="text-gray-600 mt-4">to</span>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">To</label>
                  <input
                    type="time"
                    value={dndEnd}
                    onChange={(e) => setDndEnd(e.target.value)}
                    className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-yellow-600"
                  />
                </div>
              </div>
            </Section>
          )}

          {/* ── License ──────────────────────────────────────────────── */}
          <Section title="License">
            {licenseKey ? (
              <div className="space-y-3">
                {/* Active license info */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white capitalize">
                      {licenseType === "subscription" ? "Subscription" : "Free"} license
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {unlockedPacks.length >= ALL_KNOWN_PACKS.length
                        ? "All languages unlocked"
                        : `${unlockedPacks.join(", ").toUpperCase()} unlocked`}
                      {validUntil && (
                        <> · active until {new Date(validUntil).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <span className="text-xs bg-green-900 text-green-400 rounded-full px-2.5 py-0.5 font-semibold">
                    Active
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {licenseType === "subscription" && (
                    <button
                      onClick={() => openExternalUrl(CUSTOMER_PORTAL_URL)}
                      className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Manage subscription →
                    </button>
                  )}
                  <button
                    onClick={handleValidate}
                    disabled={licenseStatus.type === "loading"}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1.5"
                  >
                    Re-validate
                  </button>
                  <button
                    onClick={handleDeactivate}
                    disabled={licenseStatus.type === "loading"}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1.5 ml-auto"
                  >
                    Deactivate
                  </button>
                </div>

                {licenseStatus.type === "error" && (
                  <p className="text-xs text-red-400">{licenseStatus.message}</p>
                )}
                {licenseStatus.type === "success" && (
                  <p className="text-xs text-green-400">{licenseStatus.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">License key</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={licenseInput}
                      onChange={(e) => {
                        setLicenseInput(e.target.value);
                        setLicenseStatus({ type: "idle" });
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-yellow-600"
                    />
                    <button
                      onClick={handleActivate}
                      disabled={licenseStatus.type === "loading" || !licenseInput.trim()}
                      className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      {licenseStatus.type === "loading" ? "…" : "Activate"}
                    </button>
                  </div>
                </div>

                {licenseStatus.type === "error" && (
                  <p className="text-xs text-red-400">{licenseStatus.message}</p>
                )}
                {licenseStatus.type === "success" && (
                  <p className="text-xs text-green-400">{licenseStatus.message}</p>
                )}

                <div className="flex flex-col gap-1 pt-1">
                  <p className="text-xs text-gray-600">Don&apos;t have a license?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openExternalUrl(CHECKOUT_URLS.monthly)}
                      className="text-xs text-yellow-600 hover:text-yellow-500 underline"
                    >
                      Monthly {PRICING.monthly}
                    </button>
                    <span className="text-gray-700">·</span>
                    <button
                      onClick={() => openExternalUrl(CHECKOUT_URLS.annual)}
                      className="text-xs text-yellow-600 hover:text-yellow-500 underline"
                    >
                      Annual {PRICING.annual}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </Section>

          {/* ── App ──────────────────────────────────────────────────── */}
          {isTauri && (
            <Section title="App">
              <Toggle
                label="Launch at login"
                description="Start plyglt in the background when you log in"
                checked={launchAtLogin}
                onChange={handleLaunchAtLogin}
              />
            </Section>
          )}

          {/* ── Data ─────────────────────────────────────────────────── */}
          <Section title="Your Data">
            <p className="text-xs text-gray-500">
              Export all progress as JSON. Use the same file to restore on another device.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleExport}
                className="text-sm bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded-lg px-4 py-1.5 transition-colors"
              >
                Export progress
              </button>
              <button
                onClick={() => importRef.current?.click()}
                className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-4 py-1.5 transition-colors"
              >
                Import progress
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
            {dataStatus.type === "success" && (
              <p className="text-xs text-green-400">{dataStatus.message}</p>
            )}
            {dataStatus.type === "error" && (
              <p className="text-xs text-red-400">{dataStatus.message}</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">{title}</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none ${
          checked ? "bg-yellow-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
