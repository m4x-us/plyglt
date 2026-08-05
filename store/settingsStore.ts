// ============================================================
// settingsStore.ts — Zustand store: user preferences persisted to platform storage
// ============================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createPlatformStorage } from "@/lib/storage";
import { SETTINGS_VERSION, migrateSettingsStore, IDLE_THRESHOLD_DEFAULT_MINUTES } from "@/store/migrations";
import { DEFAULT_SOURCE_LANG_CODE, isKnownSourceLangCode } from "@/lib/language";

export const INTERVAL_OPTIONS = [2, 3, 4, 6] as const;
export const SNOOZE_OPTIONS = [15, 30, 60] as const;
export const IDLE_THRESHOLD_MIN = 5;
export const IDLE_THRESHOLD_MAX = 120;

export type IntervalHours = (typeof INTERVAL_OPTIONS)[number];
export type SnoozeMinutes = (typeof SNOOZE_OPTIONS)[number];

interface SettingsState {
  launchAtLogin: boolean;
  interruptEnabled: boolean;
  intervalHours: IntervalHours;
  mandatory: boolean;
  dndStart: string; // "HH:MM" 24-hour, e.g. "22:00"
  dndEnd: string;   // "HH:MM" 24-hour, e.g. "08:00"
  snoozeMinutes: SnoozeMinutes;
  wakeEnabled: boolean;
  unlockEnabled: boolean;
  idleEnabled: boolean;
  idleThresholdMinutes: number;
  // The learner's interface language for produce/recognize card prompts — deliberately
  // independent of target-language selection. See lib/language.ts's SOURCE_LANGUAGES doc
  // comment for why this must never be folded into lib/constants.ts's LANG_PAIR_KEY /
  // target-language storage partitioning.
  sourceLang: string;

  setLaunchAtLogin: (v: boolean) => void;
  setInterruptEnabled: (v: boolean) => void;
  setIntervalHours: (v: IntervalHours) => void;
  setMandatory: (v: boolean) => void;
  setDndStart: (v: string) => void;
  setDndEnd: (v: string) => void;
  setSnoozeMinutes: (v: SnoozeMinutes) => void;
  setWakeEnabled: (v: boolean) => void;
  setUnlockEnabled: (v: boolean) => void;
  setIdleEnabled: (v: boolean) => void;
  setIdleThresholdMinutes: (v: number) => void;
  setSourceLang: (v: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      launchAtLogin: false,
      interruptEnabled: false,
      intervalHours: 3,
      mandatory: false,
      dndStart: "22:00",
      dndEnd: "08:00",
      snoozeMinutes: 30,
      wakeEnabled: true,
      unlockEnabled: true,
      idleEnabled: true,
      idleThresholdMinutes: IDLE_THRESHOLD_DEFAULT_MINUTES,
      sourceLang: DEFAULT_SOURCE_LANG_CODE,

      setLaunchAtLogin: (v) => set({ launchAtLogin: v }),
      setInterruptEnabled: (v) => set({ interruptEnabled: v }),
      setIntervalHours: (v) => set({ intervalHours: v }),
      setMandatory: (v) => set({ mandatory: v }),
      setDndStart: (v) => set({ dndStart: v }),
      setDndEnd: (v) => set({ dndEnd: v }),
      setSnoozeMinutes: (v) => set({ snoozeMinutes: v }),
      setWakeEnabled: (v) => set({ wakeEnabled: v }),
      setUnlockEnabled: (v) => set({ unlockEnabled: v }),
      setIdleEnabled: (v) => set({ idleEnabled: v }),
      setIdleThresholdMinutes: (v) => set({ idleThresholdMinutes: Math.min(IDLE_THRESHOLD_MAX, Math.max(IDLE_THRESHOLD_MIN, v)) }),
      // Same defensive validation as the v2->v3 migration (store/migrations.ts) — a caller
      // passing an unrecognized code (a stale UI, a future build's code not yet supported
      // here) falls back to the default rather than reaching getPrompt/getAccepted with a
      // code that has no real content behind it.
      setSourceLang: (v) => set({ sourceLang: isKnownSourceLangCode(v) ? v : DEFAULT_SOURCE_LANG_CODE }),
    }),
    {
      name: "settings-v1",
      version: SETTINGS_VERSION,
      migrate: migrateSettingsStore,
      // Task (audit fix, F3): zustand's persist middleware only calls `migrate` when the
      // persisted `_version` differs from `version` above — once storage is already at
      // SETTINGS_VERSION 3 (the common case for every hydration after the first one), the
      // v2->v3 migration's isKnownSourceLangCode validation never runs again, and the
      // default `merge` (shallow {...currentState, ...persistedState}) would pass a
      // corrupted/hand-edited sourceLang value (e.g. "__proto__") straight through to
      // getPrompt/getAccepted's dynamic property lookup. Re-validate on every hydration,
      // migrated or not — cheap, and closes the gap the migration alone cannot.
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<SettingsState>) };
        return {
          ...merged,
          sourceLang: typeof merged.sourceLang === "string" && isKnownSourceLangCode(merged.sourceLang)
            ? merged.sourceLang
            : DEFAULT_SOURCE_LANG_CODE,
        };
      },
      storage: createJSONStorage(() => createPlatformStorage("settings-v1")),
    }
  )
);

/** Returns true if local time falls within the DND window. Handles overnight ranges. */
export function isInDnd(dndStart: string, dndEnd: string, now = new Date()): boolean {
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = dndStart.split(":").map(Number);
  const [eh, em] = dndEnd.split(":").map(Number);
  const startMins = (sh ?? 0) * 60 + (sm ?? 0);
  const endMins = (eh ?? 0) * 60 + (em ?? 0);

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  // Overnight: e.g. 22:00–08:00
  return currentMins >= startMins || currentMins < endMins;
}
