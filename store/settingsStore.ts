// ============================================================
// settingsStore.ts — Zustand store: user preferences persisted to platform storage
// ============================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createPlatformStorage } from "@/lib/storage";
import { SETTINGS_VERSION, migrateSettingsStore, IDLE_THRESHOLD_DEFAULT_MINUTES } from "@/store/migrations";
import { DEFAULT_SOURCE_LANG_CODE, isKnownSourceLangCode } from "@/lib/language";

// Task #531: 1.5h (90 minutes) added as the unified cross-platform default — matches mobile's
// push_tokens.interrupt_interval_minutes default (90) exactly. See
// docs/INTERRUPT_ARCHITECTURE.md §7 and src-tauri/src/interrupt.rs's InterruptState::default().
export const INTERVAL_OPTIONS = [1.5, 2, 3, 4, 6] as const;
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
  // Task #532: dndStart/dndEnd is now THE single shared quiet-hours setting for both desktop
  // and mobile — replacing what used to be two independently-configured concepts (desktop's
  // "don't interrupt during this window" vs. mobile's push_tokens.waking_hours_start_local/
  // _end_local "only ever interrupt during this window"). Same real-world window, framed as
  // its complement on each platform. Field names/shape are UNCHANGED from pre-#532 (still
  // "HH:MM" strings, still consumed as dndStart/dndEnd by hooks/useInterruptConfig.ts and
  // isInDnd below) — #532 changes the semantics (one canonical setting, not two) and the
  // default (see below), not the wire shape, so existing callers keep compiling unmodified.
  // dndWindowToWakingHours/wakingHoursToDndWindow (bottom of this file) are the real,
  // tested conversion bridge to mobile's push_tokens column shape — ready for the future
  // desktop sync layer (docs/INTERRUPT_ARCHITECTURE.md §5, "Task #169 area") to call; no
  // live cross-device write-through exists yet, since that layer isn't built.
  dndStart: string; // "HH:MM" 24-hour, e.g. "21:00" — complements mobile's waking_hours_end_local default (21)
  dndEnd: string;   // "HH:MM" 24-hour, e.g. "08:00" — complements mobile's waking_hours_start_local default (8)
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
      // Task #531: unified default is 90 minutes (1.5h), matching mobile exactly. Existing
      // users' already-persisted intervalHours value is untouched — zustand's persist middleware
      // only falls back to this default when there is no persisted state at all (a brand-new
      // install), never for a returning user who already has a stored value (even one that
      // happens to equal the old 3h default).
      intervalHours: 1.5,
      mandatory: false,
      // Task #532: 21:00–08:00 is the exact complement of mobile's push_tokens default waking
      // window (8–21) — a fresh install on either platform now represents the identical
      // effective quiet-hours window, not two independently-chosen defaults that happened to
      // be close (the pre-#532 default was 22:00, one hour off mobile's complement).
      dndStart: "21:00",
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

/**
 * Converts desktop's "don't interrupt" window (dndStart/dndEnd, "HH:MM") to mobile's
 * "only interrupt" window shape (push_tokens.waking_hours_start_local/_end_local,
 * whole-hour smallints 0-23) — same real-world window, opposite framing (Task #532,
 * docs/INTERRUPT_ARCHITECTURE.md §7). Waking hours = the complement of the DND window:
 * waking starts when DND ends, and ends when DND starts.
 *
 * Known, accepted precision loss: push_tokens' columns are whole hours only, so a
 * dndStart/dndEnd with non-zero minutes (e.g. "21:30") is truncated to its hour component.
 * This mirrors the project's existing convention for documented, accepted platform
 * asymmetries (e.g. os_events.rs's Linux IdleHint-vs-raw-idle-seconds gap) rather than
 * expanding push_tokens' schema to minute precision it doesn't otherwise need.
 */
export function dndWindowToWakingHours(dndStart: string, dndEnd: string): {
  wakingHoursStartLocal: number;
  wakingHoursEndLocal: number;
} {
  const clampHour = (h: number) => Math.min(23, Math.max(0, h));
  const dndStartHour = clampHour(Number(dndStart.split(":")[0]) || 0);
  const dndEndHour = clampHour(Number(dndEnd.split(":")[0]) || 0);
  // Waking hours begin when DND ends, and end when DND begins.
  return { wakingHoursStartLocal: dndEndHour, wakingHoursEndLocal: dndStartHour };
}

/**
 * Inverse of dndWindowToWakingHours — converts mobile's waking-hours shape back to
 * desktop's "HH:MM" DND window strings. Round-trips exactly for whole-hour DND values
 * (the only kind this function's output can ever produce), by construction lossy for a
 * DND window that had non-zero minutes to begin with (see dndWindowToWakingHours's doc
 * comment).
 */
export function wakingHoursToDndWindow(wakingHoursStartLocal: number, wakingHoursEndLocal: number): {
  dndStart: string;
  dndEnd: string;
} {
  const toHHMM = (h: number) => `${String(Math.min(23, Math.max(0, h))).padStart(2, "0")}:00`;
  // DND begins when waking ends, and ends when waking begins.
  return { dndStart: toHHMM(wakingHoursEndLocal), dndEnd: toHHMM(wakingHoursStartLocal) };
}
