/**
 * useInterruptConfig — hook facade for interrupt-engine configuration.
 * Wraps store/ imports so components/InterruptHandler.tsx stays within the
 * components/ → hooks/ layer boundary (CLAUDE.md: "components/ — Import from hooks/ and lib/ only").
 */
import type { Unit } from "@/content/types";
import { useSettingsStore, isInDnd } from "@/store/settingsStore";
import { useSRSStore } from "@/store/srsStore";

export { isInDnd };

export function useInterruptConfig() {
  const {
    interruptEnabled,
    intervalHours,
    mandatory,
    dndStart,
    dndEnd,
    wakeEnabled,
    unlockEnabled,
    idleEnabled,
    idleThresholdMinutes,
  } = useSettingsStore();

  function computeDue(units: Unit[]): number {
    if (units.length === 0) return 0;
    const state = useSRSStore.getState();
    return units.reduce((sum, u) => sum + state.getStats(u.cards).due, 0);
  }

  return {
    interruptEnabled,
    intervalHours,
    mandatory,
    dndStart,
    dndEnd,
    wakeEnabled,
    unlockEnabled,
    idleEnabled,
    idleThresholdMinutes,
    computeDue,
  };
}
