/**
 * useInterruptConfig — hook facade for interrupt-engine configuration.
 * Wraps store/ imports so components/InterruptHandler.tsx stays within the
 * components/ → hooks/ layer boundary (CLAUDE.md: "components/ — Import from hooks/ and lib/ only").
 */
import type { Unit } from "@/content/types";
import { useSettingsStore, isInDnd } from "@/store/settingsStore";
import { useSRSStore } from "@/store/srsStore";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { localDateStr } from "@/lib/utils";

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

  // Task #529: identifiers the shared cross-device interrupt gate (lib/interruptGate.ts)
  // needs — userId scopes the gate read/write to this user; deviceId is diagnostic-only on
  // the write (docs/INTERRUPT_ARCHITECTURE.md §5). Both come from store/, wrapped here so
  // components/InterruptHandler.tsx (a components/ file) never imports store/ directly.
  const userId = useAuthStore((s) => s.userId);
  const deviceId = useSyncStore((s) => s.deviceId);

  // Mirrors what lib/queue.ts's buildQueue actually pulls into a session: FSRS-due
  // reviews, introduction-cadence cards due for their next appearance, and (capped at
  // one, matching the daily introduction cap) a qualifying new card — not just FSRS due
  // reviews. Docs: docs/INTERRUPT_ARCHITECTURE.md §2.
  function computeDue(units: Unit[]): number {
    if (units.length === 0) return 0;
    const state = useSRSStore.getState();
    const today = localDateStr();

    const reviewDue = units.reduce((sum, u) => sum + state.getStats(u.cards).due, 0);

    const allCardIds = new Set(units.flatMap((u) => u.cards.map((c) => c.id)));
    const introDue = state.getIntroductionDueCardIds(today).filter((id) => allCardIds.has(id)).length;

    // Only one new card is ever introduced per day (store's own cap) — count at most 1,
    // not the full pool of untouched cards, however large.
    let newCardDue = 0;
    if (state.canIntroduceNewCard(today)) {
      for (const u of units) {
        if (state.getNewCards(u.cards, 1).length > 0) {
          newCardDue = 1;
          break;
        }
      }
    }

    return reviewDue + introDue + newCardDue;
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
    userId,
    deviceId,
    computeDue,
  };
}
