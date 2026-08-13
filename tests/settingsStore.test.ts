import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useSettingsStore,
  INTERVAL_OPTIONS,
  SNOOZE_OPTIONS,
  IDLE_THRESHOLD_MIN,
  IDLE_THRESHOLD_MAX,
  dndWindowToWakingHours,
  wakingHoursToDndWindow,
} from "@/store/settingsStore";

beforeEach(() => {
  useSettingsStore.setState({
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
    idleThresholdMinutes: 15,
  });
});

describe("useSettingsStore — default values", () => {
  it("has expected defaults", () => {
    const s = useSettingsStore.getState();
    expect(s.launchAtLogin).toBe(false);
    expect(s.interruptEnabled).toBe(false);
    expect(s.intervalHours).toBe(3);
    expect(s.mandatory).toBe(false);
    expect(s.dndStart).toBe("22:00");
    expect(s.dndEnd).toBe("08:00");
    expect(s.snoozeMinutes).toBe(30);
  });

  it("has expected OS trigger defaults", () => {
    const s = useSettingsStore.getState();
    expect(s.wakeEnabled).toBe(true);
    expect(s.unlockEnabled).toBe(true);
    expect(s.idleEnabled).toBe(true);
    expect(s.idleThresholdMinutes).toBe(15);
  });

  // Task #531: the true module-level default (as opposed to this file's beforeEach, which
  // explicitly overwrites intervalHours to 3 for test isolation and would otherwise mask a
  // regression here) must be 90 minutes (1.5h), unified with mobile's
  // push_tokens.interrupt_interval_minutes default. vitest's test environment is "node"
  // (vitest.config.ts), so lib/storage.ts's localStorage accessor returns null and a freshly
  // re-imported store hydrates with no persisted data — exactly the "brand-new install" case
  // this default targets.
  it("intervalHours defaults to 1.5 (90 minutes) on a fresh, never-persisted store", async () => {
    vi.resetModules();
    const { useSettingsStore: freshStore } = await import("@/store/settingsStore");
    expect(freshStore.getState().intervalHours).toBe(1.5);
  });

  // Task #532: the default DND window must be the exact complement of mobile's push_tokens
  // waking-hours default (8-21) — 21:00-08:00, not the pre-#532 22:00-08:00 (which was one
  // hour off that complement, the mismatch docs/INTERRUPT_ARCHITECTURE.md §7 flags).
  it("dndStart/dndEnd default to 21:00/08:00 (the complement of mobile's 8-21 waking default) on a fresh, never-persisted store", async () => {
    vi.resetModules();
    const { useSettingsStore: freshStore } = await import("@/store/settingsStore");
    expect(freshStore.getState().dndStart).toBe("21:00");
    expect(freshStore.getState().dndEnd).toBe("08:00");
  });
});

describe("useSettingsStore — setters", () => {
  it("setLaunchAtLogin toggles the flag", () => {
    useSettingsStore.getState().setLaunchAtLogin(true);
    expect(useSettingsStore.getState().launchAtLogin).toBe(true);
    useSettingsStore.getState().setLaunchAtLogin(false);
    expect(useSettingsStore.getState().launchAtLogin).toBe(false);
  });

  it("setInterruptEnabled toggles the flag", () => {
    useSettingsStore.getState().setInterruptEnabled(true);
    expect(useSettingsStore.getState().interruptEnabled).toBe(true);
  });

  it("setIntervalHours accepts every valid option", () => {
    for (const hours of INTERVAL_OPTIONS) {
      useSettingsStore.getState().setIntervalHours(hours);
      expect(useSettingsStore.getState().intervalHours).toBe(hours);
    }
  });

  it("setMandatory toggles the flag", () => {
    useSettingsStore.getState().setMandatory(true);
    expect(useSettingsStore.getState().mandatory).toBe(true);
  });

  it("setDndStart updates the value", () => {
    useSettingsStore.getState().setDndStart("23:30");
    expect(useSettingsStore.getState().dndStart).toBe("23:30");
  });

  it("setDndEnd updates the value", () => {
    useSettingsStore.getState().setDndEnd("07:00");
    expect(useSettingsStore.getState().dndEnd).toBe("07:00");
  });

  it("setSnoozeMinutes accepts every valid option", () => {
    for (const mins of SNOOZE_OPTIONS) {
      useSettingsStore.getState().setSnoozeMinutes(mins);
      expect(useSettingsStore.getState().snoozeMinutes).toBe(mins);
    }
  });

  it("setWakeEnabled toggles the flag", () => {
    useSettingsStore.getState().setWakeEnabled(false);
    expect(useSettingsStore.getState().wakeEnabled).toBe(false);
    useSettingsStore.getState().setWakeEnabled(true);
    expect(useSettingsStore.getState().wakeEnabled).toBe(true);
  });

  it("setUnlockEnabled toggles the flag", () => {
    useSettingsStore.getState().setUnlockEnabled(false);
    expect(useSettingsStore.getState().unlockEnabled).toBe(false);
    useSettingsStore.getState().setUnlockEnabled(true);
    expect(useSettingsStore.getState().unlockEnabled).toBe(true);
  });

  it("setIdleEnabled toggles the flag", () => {
    useSettingsStore.getState().setIdleEnabled(false);
    expect(useSettingsStore.getState().idleEnabled).toBe(false);
    useSettingsStore.getState().setIdleEnabled(true);
    expect(useSettingsStore.getState().idleEnabled).toBe(true);
  });

  it("setIdleThresholdMinutes accepts in-range values", () => {
    useSettingsStore.getState().setIdleThresholdMinutes(30);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(30);
    useSettingsStore.getState().setIdleThresholdMinutes(IDLE_THRESHOLD_MIN);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(IDLE_THRESHOLD_MIN);
    useSettingsStore.getState().setIdleThresholdMinutes(IDLE_THRESHOLD_MAX);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(IDLE_THRESHOLD_MAX);
  });

  it("setIdleThresholdMinutes clamps below-minimum values to IDLE_THRESHOLD_MIN", () => {
    useSettingsStore.getState().setIdleThresholdMinutes(0);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(IDLE_THRESHOLD_MIN);
    useSettingsStore.getState().setIdleThresholdMinutes(-50);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(IDLE_THRESHOLD_MIN);
  });

  it("setIdleThresholdMinutes clamps above-maximum values to IDLE_THRESHOLD_MAX", () => {
    useSettingsStore.getState().setIdleThresholdMinutes(200);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(IDLE_THRESHOLD_MAX);
    useSettingsStore.getState().setIdleThresholdMinutes(99999);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(IDLE_THRESHOLD_MAX);
  });

  it("setIdleThresholdMinutes stores fractional in-range values unchanged (no implicit rounding)", () => {
    // The setter uses Math.min/max but does not round. Fractional values within [IDLE_THRESHOLD_MIN,
    // IDLE_THRESHOLD_MAX] are stored as-is. The UI number input and its onChange clamp guard
    // prevent fractional values from being submitted via normal user interaction.
    useSettingsStore.getState().setIdleThresholdMinutes(15.7);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(15.7);
  });

  it("setIdleThresholdMinutes clamps a fractional below-minimum value to IDLE_THRESHOLD_MIN", () => {
    useSettingsStore.getState().setIdleThresholdMinutes(4.9);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(IDLE_THRESHOLD_MIN);
  });

  it("setIdleThresholdMinutes clamps a fractional above-maximum value to IDLE_THRESHOLD_MAX", () => {
    useSettingsStore.getState().setIdleThresholdMinutes(120.1);
    expect(useSettingsStore.getState().idleThresholdMinutes).toBe(IDLE_THRESHOLD_MAX);
  });
});

describe("useSettingsStore — setters are independent", () => {
  it("setting one flag does not affect others", () => {
    useSettingsStore.getState().setLaunchAtLogin(true);
    const s = useSettingsStore.getState();
    expect(s.interruptEnabled).toBe(false);
    expect(s.mandatory).toBe(false);
    expect(s.intervalHours).toBe(3);
  });
});

// Task (audit fix, F8): setSourceLang had no direct test — only indirect coverage via
// app/page.test.tsx's UI click test, which only ever passes valid codes from
// SOURCE_LANGUAGES. The reject/fallback branch was completely unexercised.
describe("useSettingsStore — setSourceLang", () => {
  it("accepts a known source language code", () => {
    useSettingsStore.getState().setSourceLang("es");
    expect(useSettingsStore.getState().sourceLang).toBe("es");
  });

  it("falls back to the default for an unrecognized code", () => {
    useSettingsStore.getState().setSourceLang("xx-not-a-real-code");
    expect(useSettingsStore.getState().sourceLang).toBe("en");
  });

  it("falls back to the default for a corrupted/hostile string ('__proto__')", () => {
    // B7 target: removing isKnownSourceLangCode's guard (accepting any string) makes this
    // fail — sourceLang would become "__proto__" instead of falling back to "en".
    useSettingsStore.getState().setSourceLang("__proto__");
    expect(useSettingsStore.getState().sourceLang).toBe("en");
  });
});

// Task (audit fix, F3): zustand's persist middleware only calls `migrate` when the
// persisted version differs from the current one — a same-version hydration bypasses
// migration entirely, so `merge` is the only chokepoint that can catch a corrupted
// sourceLang on every load, not just the first one after a version bump.
describe("useSettingsStore — persist merge revalidates sourceLang on every hydration", () => {
  const merge = () => {
    const fn = useSettingsStore.persist.getOptions().merge;
    if (!fn) throw new Error("settingsStore's persist config has no merge function configured");
    return fn;
  };

  it("preserves a valid persisted sourceLang", () => {
    const result = merge()({ sourceLang: "es" }, useSettingsStore.getState()) as { sourceLang: string };
    expect(result.sourceLang).toBe("es");
  });

  it("falls back to the default for a corrupted persisted sourceLang, even at the current storage version (same-version hydration, no migrate() call)", () => {
    // B7 target: removing the merge function's own validation (reverting to zustand's
    // default shallow merge) makes this fail — result.sourceLang would be "__proto__".
    const result = merge()({ sourceLang: "__proto__" }, useSettingsStore.getState()) as { sourceLang: string };
    expect(result.sourceLang).toBe("en");
  });

  it("falls back to the default for a non-string persisted sourceLang", () => {
    const result = merge()({ sourceLang: 42 }, useSettingsStore.getState()) as { sourceLang: string };
    expect(result.sourceLang).toBe("en");
  });

  it("does not disturb other persisted fields", () => {
    const result = merge()(
      { sourceLang: "es", dndStart: "23:00", idleThresholdMinutes: 45 },
      useSettingsStore.getState()
    ) as { sourceLang: string; dndStart: string; idleThresholdMinutes: number };
    expect(result.dndStart).toBe("23:00");
    expect(result.idleThresholdMinutes).toBe(45);
  });
});

// Task #532: the real conversion bridge between desktop's DND-window framing and mobile's
// push_tokens waking-hours framing — same real-world window, opposite representation.
describe("dndWindowToWakingHours / wakingHoursToDndWindow", () => {
  it("converts the new default DND window (21:00-08:00) to mobile's default waking hours (8-21)", () => {
    expect(dndWindowToWakingHours("21:00", "08:00")).toEqual({
      wakingHoursStartLocal: 8,
      wakingHoursEndLocal: 21,
    });
  });

  it("converts mobile's default waking hours (8-21) back to the DND window shape (21:00-08:00)", () => {
    expect(wakingHoursToDndWindow(8, 21)).toEqual({ dndStart: "21:00", dndEnd: "08:00" });
  });

  it("round-trips a whole-hour DND window through both conversions unchanged", () => {
    const waking = dndWindowToWakingHours("23:00", "07:00");
    const backToDnd = wakingHoursToDndWindow(waking.wakingHoursStartLocal, waking.wakingHoursEndLocal);
    expect(backToDnd).toEqual({ dndStart: "23:00", dndEnd: "07:00" });
  });

  it("truncates non-zero minutes to the hour (documented, accepted precision loss)", () => {
    expect(dndWindowToWakingHours("21:30", "07:45")).toEqual({
      wakingHoursStartLocal: 7,
      wakingHoursEndLocal: 21,
    });
  });

  it("clamps out-of-range hour values into push_tokens' 0-23 constraint", () => {
    expect(wakingHoursToDndWindow(-3, 30)).toEqual({ dndStart: "23:00", dndEnd: "00:00" });
  });

  it("clamps an out-of-range hour parsed from a malformed DND string into 0-23", () => {
    expect(dndWindowToWakingHours("25:00", "08:00")).toEqual({
      wakingHoursStartLocal: 8,
      wakingHoursEndLocal: 23,
    });
  });

  it("falls back to hour 0 for a DND string whose hour component doesn't parse to a number", () => {
    expect(dndWindowToWakingHours("bad-input", "08:00")).toEqual({
      wakingHoursStartLocal: 8,
      wakingHoursEndLocal: 0,
    });
  });
});
