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

/**
 * Task #618 (Wave 6): the shared "is the flex (past-normal-daily-cap) new-card
 * introduction gate open today" check. This exact condition was previously
 * hand-duplicated between this file's computeDue and hooks/useStudySession.ts's
 * mount-fill effect with no shared function — a duplication this project's own
 * history already blames for two real divergence bugs: Task #523 (the near-due
 * fallback tier existed in one file and not the other) and Task #539 (this
 * flex gate — stranded-pause + INTERRUPT_FLEX_DAILY_MAX ceiling — existed in one
 * file and not the other). Both call sites now import this single function
 * instead of each independently calling
 * `canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)`, so a future change to
 * what "flex is allowed" means (e.g. Wave 7's #617, adding
 * lib/queue.ts's INTERRUPT_SESSION_CAP-awareness) only needs to happen in one
 * place and cannot miss the sibling call site by construction.
 *
 * Deliberately narrow — this is the ONE condition that has actually drifted
 * before, not an attempt to unify the two files' entire 3-tier decision. The
 * "does a qualifying card exist" search itself legitimately differs in scope
 * between the two callers (computeDue probes per-unit via getNewCards;
 * useStudySession probes the whole session's allCardMap via
 * selectQualifyingNewCard) and is left in each file — forcing those together
 * would trade real, working code for a forced abstraction. Natural long-term
 * home is probably lib/queue.ts, pure, alongside INTERRUPT_FLEX_DAILY_MAX
 * itself (or a new small lib/ module) — kept here for now since lib/queue.ts
 * was outside this stream's file ownership this wave; relocating it later is a
 * pure move, not a behavior change.
 */
export function canFlexIntroduceToday(
  canIntroduceNewCard: (today: string, maxPerDay?: number) => boolean,
  today: string
): boolean {
  return canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX);
}

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

  // Estimates what a real interrupt session will end up containing: FSRS-due
  // reviews, introduction-cadence cards due for their next appearance, and (capped at
  // one, matching the daily introduction cap) a qualifying new card. Round-7 audit
  // finding (naive-reader lane, informational): the new-card figure is NOT pulled by
  // lib/queue.ts's buildQueue for an interrupt session — buildQueue's newCards path is
  // dead when globalMode is true (isGlobal || isInterrupt), so buildQueue always
  // contributes newCards=[] here. The real new-card pull happens later, in
  // hooks/useStudySession.ts's own mount-fill effect (a separate code path this
  // estimate mirrors, not one it reads from) — both independently gate on the same
  // canIntroduceNewCard(today), which is what keeps the two numbers in agreement.
  // Docs: docs/INTERRUPT_ARCHITECTURE.md §2.
  //
  // Task #604 — staleness window: canIntroduceNewCard's true/false result is only a live
  // guarantee for a caller that checks-then-acts in the same tick, which is what both
  // of hooks/useStudySession.ts's runFillPass call sites do (the mount-fill effect and
  // the apply-resume effect's decline/expired-accept branch, Task #643). This estimate is
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
    // Task #610 (Wave 6): computeDue reads live SRS-store state with no hydration
    // gate, and is called from components/InterruptHandler.tsx's interrupt:fire
    // event-handler closure — NOT render output — so this checks the store's own
    // live hydration flag directly at call time (a plain method call, not a React
    // hook), the same style as the `useSRSStore.getState()` read immediately
    // below, rather than a React-reactive value captured at last render (which
    // would need a new hook call in useInterruptConfig() purely to serve one
    // event-time check). On the same slow-hydration window hooks/useStudySession.ts's
    // Task #587 fix addresses (Tauri's async file-store IPC), this stops
    // computeDue from deciding fire/no-fire off pre-hydration {} defaults for one
    // cycle. Returning 0 is the safe direction: it can only cause a missed/
    // delayed fire this one cycle, never a false-positive fire promising content
    // that isn't really there — the next cycle (well within BRAND.md's 90-minute
    // interval) recomputes against real, hydrated data regardless. Optional
    // chaining on `.persist` is defense against a test double that stubs
    // useSRSStore without the real persist() wrapper (a genuine Zustand
    // persist-created store always has it) — never undefined in production.
    if (useSRSStore.persist?.hasHydrated() === false) return 0;
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
      // Task #539 (shared via canFlexIntroduceToday, Task #618/Wave 6): the same
      // strandedAcrossDays pause AND cross-session daily ceiling
      // (INTERRUPT_FLEX_DAILY_MAX) that gates hooks/useStudySession.ts's
      // mount-effect flex fill (Task #538/#551) must gate this fire-gate too —
      // getNewCards alone only filters on FSRS progress and prerequisites, never
      // on introduction-pause state, so without this check computeDue could fire
      // an interrupt promising new-card content that the session's own flex
      // fill would refuse to honor (a stranded pause, or today's flex ceiling
      // already reached by earlier sessions). Both files now call the same
      // canFlexIntroduceToday (defined above) instead of hand-rolling this
      // condition — see its own doc comment for why that matters.
      const flexIntroAllowed = canFlexIntroduceToday(state.canIntroduceNewCard, today);
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
      // existed to close. This "tier 3" search is NOT extracted into a shared
      // function like canFlexIntroduceToday above — it legitimately searches a
      // different shape (per-unit here vs. the session's whole allCardMap in
      // hooks/useStudySession.ts's near-due loop) — but if you change WHAT counts
      // as near-due-fallback-worthy here, check that mount-fill effect's matching
      // "Task #541" block too, and vice versa (Task #618).
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
