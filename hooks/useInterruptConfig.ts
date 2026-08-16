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
import { INTERRUPT_FLEX_DAILY_MAX } from "@/lib/queue";

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
  //
  // Task #604 — staleness window: canIntroduceNewCard's true/false result is only a live
  // guarantee for a caller that checks-then-acts in the same tick, which is what both
  // hooks/useStudySession.ts mount-effect call sites do (Adam's stream). This estimate is
  // different in kind: it is computed here, then handed to the native OS notification layer
  // (components/InterruptHandler.tsx), and the real consumption only happens whenever the
  // user eventually taps that notification — seconds, minutes, or never. Store state (what's
  // introduced, what's due, today's flex ceiling) can change arbitrarily in that gap. This is
  // a structural property of push-notification timing, not a bug this function can close —
  // the estimate is deliberately allowed to go stale; hooks/useStudySession.ts's own mount
  // effect re-checks canIntroduceNewCard fresh when the session actually opens, so a stale
  // "yes" here never introduces a card without a fresh, same-tick recheck at consumption time.
  function computeDue(units: Unit[]): number {
    if (units.length === 0) return 0;
    const state = useSRSStore.getState();
    const today = localDateStr();

    const reviewDue = units.reduce((sum, u) => sum + state.getStats(u.cards).due, 0);

    const allCardIds = new Set(units.flatMap((u) => u.cards.map((c) => c.id)));
    const introDue = state.getIntroductionDueCardIds(today).filter((id) => allCardIds.has(id)).length;

    // Only one new card is ever introduced per day under the normal cap — count at most 1,
    // not the full pool of untouched cards, however large.
    let hasQualifyingContent = 0;
    if (state.canIntroduceNewCard(today)) {
      for (const u of units) {
        if (state.getNewCards(u.cards, 1).length > 0) {
          hasQualifyingContent = 1;
          break;
        }
      }
    }

    // BRAND.md commits to 6-10 interrupts every day, never fewer — "nothing due" must never
    // mean the app goes quiet. If today's normal supply (reviews + introduction cadence + one
    // new card) is completely empty, flex past the daily new-card cap and check for ANY
    // untouched, prerequisite-met card anywhere in the catalog. The session itself performs the
    // matching flexed introduction on open — see hooks/useStudySession.ts's mount effect, which
    // uses the identical "would this interrupt session otherwise be empty" trigger.
    if (reviewDue === 0 && introDue === 0 && hasQualifyingContent === 0) {
      // Task #539: the same strandedAcrossDays pause AND cross-session daily
      // ceiling (INTERRUPT_FLEX_DAILY_MAX) that gates hooks/useStudySession.ts's
      // mount-effect flex fill (Task #538/#551) must gate this fire-gate too —
      // getNewCards alone only filters on FSRS progress and prerequisites, never
      // on introduction-pause state, so without this check computeDue could fire
      // an interrupt promising new-card content that the session's own flex
      // fill would refuse to honor (a stranded pause, or today's flex ceiling
      // already reached by earlier sessions).
      const flexIntroAllowed = state.canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX);
      if (flexIntroAllowed) {
        for (const u of units) {
          if (state.getNewCards(u.cards, 1).length > 0) {
            hasQualifyingContent = 1;
            break;
          }
        }
      }
      // Batch 23 — the session-floor fill can also pull a near-due review slightly
      // early (getNearDueCards), so a day where the stranded pause blocks new
      // introductions AND nothing is due can still hold a real session. Without
      // this mirror, the fire-gate would stay silent in a scenario the session
      // itself can serve — the exact computeDue/buildQueue divergence Task #523
      // existed to close.
      if (hasQualifyingContent === 0) {
        for (const u of units) {
          if (state.getNearDueCards(u.cards, 1).length > 0) {
            hasQualifyingContent = 1;
            break;
          }
        }
      }
    }

    return reviewDue + introDue + hasQualifyingContent;
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
