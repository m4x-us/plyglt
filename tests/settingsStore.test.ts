import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore, INTERVAL_OPTIONS, SNOOZE_OPTIONS } from "@/store/settingsStore";

beforeEach(() => {
  useSettingsStore.setState({
    launchAtLogin: false,
    interruptEnabled: false,
    intervalHours: 3,
    mandatory: false,
    dndStart: "22:00",
    dndEnd: "08:00",
    snoozeMinutes: 30,
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
