// ============================================================
// useStudySession.ts — Hook: manages the study queue, position, ratings, and session commit
// ============================================================
"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import type { Card } from "@/content/types";
import type { IntroductionRecord } from "@/content/types";
import { selectQualifyingNewCard, type Grade, type CardProgress } from "@/lib/srs";
import { INTERRUPT_SESSION_FLOOR, INTERRUPT_SESSION_CAP, INTERRUPT_SESSION_MAX_NEW } from "@/lib/queue";
import { useSRSStore, type ActiveSession } from "@/store/srsStore";
import { useIsHydratedStrict } from "@/lib/storage";
import { canFlexIntroduceToday } from "@/hooks/useInterruptConfig";
import { useInterruptSessionGrowth } from "@/hooks/useInterruptSessionGrowth";
import { localDateStr } from "@/lib/utils";

type UseStudySessionParams = {
  initialQueue: Card[];
  allCardMap: Record<string, Card>;
  isGlobal: boolean;
  // Scopes the interrupt-floor flex fallback to proactive interrupt sessions only — a
  // manually-opened Global Review with nothing due shows the normal empty-queue screen.
  isInterrupt: boolean;
  unitId: string;
  sessionTargetSeconds: number; // interrupt-only time budget — see useInterruptSessionGrowth.ts
  getResumableSession: () => ActiveSession | null;
  // Task #608 (Wave 6): render-phase-safe pair — never mutates state, safe from useState
  // lazy initializers/useMemo/useEffect. Replaces getResumableSession's render-phase set()
  // call everywhere except the effect-scoped "apply resume" effect below (already safe).
  peekResumableSession: () => ActiveSession | null;
  clearExpiredResumableSession: () => void;
  clearActiveSession: () => void;
  commitSession: (cardId: string, grade: Grade, session: ActiveSession) => CardProgress;
  canIntroduceNewCard: (today: string, maxPerDay?: number) => boolean;
  introduceCard: (cardId: string, today: string) => void;
  // Batch 23 — already-studied, not-yet-due cards ordered soonest-due first
  // (store/srsStore.ts's getNearDueCards, bound by the page to the session's card scope).
  // Also the source pool for useInterruptSessionGrowth.ts. Injected for testability.
  getNearDueCards: (limit: number) => Card[];
  cards: Record<string, CardProgress>;
  introductions: Record<string, IntroductionRecord>;
  // Task #169 — records the review as a local sync event. Injected (not a direct
  // useSyncStore import) for the same testability reason as every store-backed action here.
  enqueueReviewEvent: (cardId: string, grade: Grade, resultingProgress: CardProgress) => void;
};

export function useStudySession({
  initialQueue,
  allCardMap,
  isGlobal,
  isInterrupt,
  unitId,
  sessionTargetSeconds,
  getResumableSession,
  peekResumableSession,
  clearExpiredResumableSession,
  clearActiveSession,
  commitSession,
  canIntroduceNewCard,
  introduceCard,
  getNearDueCards,
  cards,
  introductions,
  enqueueReviewEvent,
}: UseStudySessionParams) {
  // Task #608 (Wave 6): starts unresolved (null) rather than a useState lazy initializer
  // calling getResumableSession() — a mutating set() during React's render phase, unsafe
  // under StrictMode/concurrent rendering. See the hydration-gated effect below for how
  // this now actually resolves.
  const [resumeDecision, setResumeDecision] = useState<"pending" | "accepted" | "declined" | null>(null);

  const sessionStartedAtRef = useRef<number>(0);

  // Round-12 audit finding (3-way convergent): round 11's handleRate fix only stops an
  // "again" requeue from growing an interrupt queue PAST INTERRUPT_SESSION_CAP going
  // forward — a session persisted oversized before that fix (or by any future bug) would
  // resume unclamped otherwise. Mirrors useStudyQueueSetup.ts's own .slice(0, CAP).
  const resumedQueue = useMemo((): Card[] | null => {
    if (resumeDecision !== "accepted") return null;
    const saved = peekResumableSession();
    if (!saved) return null;
    const filtered = saved.queueIds.map((id) => allCardMap[id]).filter((c): c is Card => !!c);
    return isInterrupt ? filtered.slice(0, INTERRUPT_SESSION_CAP) : filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  // Fixes resumedQueue/resumedPos desync (debt.md, round 9): saved.position indexes the RAW
  // queueIds; recomputed via surviving-entries-before-position, then clamped to CAP (round 13)
  // to mirror resumedQueue's own slice — else pos could exceed queue.length, forcing isDone.
  const resumedPos = useMemo((): number => {
    if (resumeDecision !== "accepted") return 0;
    const saved = peekResumableSession();
    if (!saved) return 0;
    const rawPos = saved.queueIds.slice(0, saved.position).filter((id) => allCardMap[id]).length;
    return isInterrupt ? Math.min(rawPos, INTERRUPT_SESSION_CAP) : rawPos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  const [queue, setQueue] = useState<Card[]>(initialQueue);
  const [pos, setPos] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  // True once the mount-fill effect CLAIMED its one attempt (set before any fill logic that
  // can throw — see that effect's try/catch/finally).
  const mountFillStartedRef = useRef(false);
  const growInterruptQueue = useInterruptSessionGrowth(getNearDueCards); // hooks/useInterruptSessionGrowth.ts
  // Must be useIsHydratedStrict: this effect WRITES persisted state (introduceCard) — pre-
  // hydration writes on Tauri's async IPC would silently lose the write. Only the strict
  // signal never resolves via HYDRATION_FAILSAFE_MS's timeout — see lib/storage.ts.
  const hydrated = useIsHydratedStrict(useSRSStore);

  // Re-derives "still-valid resumable session for THIS key" fresh at read time — shared by
  // the resume-decision effect and the mount-fill effect. NOT read via `resumeDecision`
  // state in the mount-fill effect: both fire in the same commit, but a setState from the
  // earlier effect isn't visible there until a later render — only a fresh check sees it.
  const hasPendingResumableSession = (): boolean => {
    const saved = peekResumableSession();
    const sessionKey = isGlobal ? "global" : unitId;
    return !!saved && saved.unitId === sessionKey && saved.position < saved.queueIds.length;
  };

  useEffect(() => {
    if (!hydrated) return;
    clearExpiredResumableSession();
    if (hasPendingResumableSession()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResumeDecision("pending");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // On mount: introduce the first qualifying new card if today's quota is open, then —
  // interrupt sessions only — fill to lib/queue.ts's INTERRUPT_SESSION_FLOOR: (1) flex-
  // introduce more new cards (capped at INTERRUPT_SESSION_MAX_NEW / INTERRUPT_FLEX_DAILY_MAX),
  // (2) near-due FSRS reviews pulled slightly early. Floor is a target, not a guarantee.
  // Full rationale: docs/INTERRUPT_ARCHITECTURE.md §10; useInterruptConfig.ts's computeDue
  // mirrors this for the fire-gate decision. Task #643: extracted so it can be claimed and
  // run from two places — this effect, and the apply-resume effect's decline/expired-accept
  // branch — each claiming mountFillStartedRef itself under different conditions. Round-7
  // (CONTRACT): NOT purely additive — its first statement (setQueue(initialQueue))
  // unconditionally replaces the visible queue (no-op on mount; a real reset on decline).
  const runFillPass = () => {
    // Declared outside the try so the finally block can flush whatever succeeded
    // even if something below throws.
    const added: Card[] = [];

    // The sessionIds/introducedIds construction below lives INSIDE the try,
    // alongside the fill logic itself: a throw from any of them (e.g. a malformed
    // initialQueue entry) must not propagate uncaught (no error boundary on the
    // /study route). The catch logs explicitly; the finally still flushes
    // whatever made it into `added` before the failure.
    try {
      // Sync queue to THIS render's real initialQueue — a no-op on a normal mount
      // where the pack was already loaded (same array reference useState's
      // initializer already captured, so React bails out with no extra render); a
      // real resync on the cold-start path below, replacing the stale empty
      // snapshot captured on an earlier, pack-still-loading render, or on the
      // decline/expired-accept path, the fresh initialQueue this fill is about to
      // build on top of.
      setQueue(initialQueue);

      const today = localDateStr();
      // sessionIds tracks the full session content (initial queue + everything this
      // pass adds) for both dedupe and the floor arithmetic. The normal daily-intro
      // path may pick a card already sitting in the queue (unit sessions interleave
      // new cards via buildQueue) — that introduction still happens, it just
      // appends nothing. canIntroduceNewCard/introduceCard/getNearDueCards below
      // read LIVE store state; `cards`/`introductions`/`allCardMap` are read once
      // from this render's closure — safe within one pass since every statement
      // here is synchronous JS with no yield point for anything else to run.
      const sessionIds = new Set<string>(initialQueue.map((c) => c.id));
      const introducedIds = new Set<string>();

      // Async write-ordering risk with multiple introduceCard calls in one pass:
      // accepted debt, see .autocode/debt.md (Task #619/#639) for the full
      // investigation and reasoning.
      const introduceNext = (): boolean => {
        const next = selectQualifyingNewCard(allCardMap, cards, introductions, introducedIds);
        if (!next) return false;
        introduceCard(next.id, today);
        introducedIds.add(next.id);
        if (!sessionIds.has(next.id)) {
          sessionIds.add(next.id);
          added.push(next);
        }
        return true;
      };

      // Normal daily-cap path — one new card per day, every session type. Shares
      // `introducedIds` with the interrupt flex loop below (not additive with it —
      // Task #574 seam-tests this). Gated on INTERRUPT_SESSION_CAP for interrupt
      // sessions specifically (`!isInterrupt ||` short-circuits it for unit/global,
      // which have no size cap): without this, a backlog day's CAP-sliced
      // initialQueue could still grow past CAP via an unrelated normal-cap
      // introduction, contradicting the client/server notification clamps that both
      // announce "at most CAP." Checked against CAP, not FLOOR — this is the
      // ceiling this path was missing, not the floor the flex/near-due tiers target.
      if (canIntroduceNewCard(today) && (!isInterrupt || sessionIds.size < INTERRUPT_SESSION_CAP)) {
        introduceNext();
      }

      if (isInterrupt) {
        // canFlexIntroduceToday (hooks/useInterruptConfig.ts, shared with
        // computeDue there) is re-evaluated on every loop iteration, not computed
        // once before the loop — it reads live introductions state, so each
        // iteration correctly reflects this pass's own introduceCard calls,
        // genuinely enforcing INTERRUPT_FLEX_DAILY_MAX per-introduction rather than
        // per-session. A false return has two causes (the stranded-pause invariant,
        // or the daily flex ceiling) that this loop deliberately doesn't
        // distinguish — both legitimately stop flexing, and near-due fill below
        // still runs regardless of which one stopped it. Full history:
        // docs/INTERRUPT_ARCHITECTURE.md §10.3.
        while (
          sessionIds.size < INTERRUPT_SESSION_FLOOR &&
          introducedIds.size < INTERRUPT_SESSION_MAX_NEW &&
          canFlexIntroduceToday(canIntroduceNewCard, today)
        ) {
          if (!introduceNext()) break;
        }

        // If getNearDueCards below throws after this loop already introduced 1-3
        // cards, those stay recorded (consuming the daily ceiling) even though
        // near-due padding never ran — correct, not a gap: the try/catch/finally
        // below flushes whatever made it into `added` on any throw, so every
        // flex-introduced card still reaches the visible queue.
        if (sessionIds.size < INTERRUPT_SESSION_FLOOR) {
          // Requests the full near-due pool rather than a
          // INTERRUPT_SESSION_FLOOR + sessionIds.size heuristic, which only
          // over-fetches enough if cards already in the session cluster at the
          // front of the sorted pool — a mathematically sufficient bound instead
          // of an unproven one. getNearDueCards filters+sorts the entire catalog
          // per call (O(n log n), accepted cost at current curriculum scale — see
          // docs/INTERRUPT_ARCHITECTURE.md §10.5 for the full trade-off).
          for (const card of getNearDueCards(Number.MAX_SAFE_INTEGER)) {
            if (sessionIds.size >= INTERRUPT_SESSION_FLOOR) break;
            if (sessionIds.has(card.id)) continue;
            sessionIds.add(card.id);
            added.push(card);
          }
        }

        // No post-loop "never-empty" backstop: introduceNext() is a pure function
        // of (allCardMap, cards, introductions, introducedIds), unchanged since the
        // while loop's last attempt — a repeat call against the same frozen inputs
        // cannot succeed where the loop already failed. A session that reaches
        // this point with zero content is genuinely empty (§10.4: the floor is a
        // target, not a guarantee).
      }
    } catch (e) {
      console.error(
        `[ERR-STUDY-SESSION-FILL-${Date.now()}] mount-fill effect threw mid-pass — showing whatever was successfully added before the failure`,
        e
      );
    } finally {
      if (added.length > 0) {
        setQueue((prev) => {
          const have = new Set(prev.map((c) => c.id));
          return [...prev, ...added.filter((c) => !have.has(c.id))];
        });
      }
    }
  };

  useEffect(() => {
    // A session mounting while the pack is still loading (cold push-tap, a
    // still-loading pack) renders this hook first with an empty allCardMap —
    // re-fires on every allCardMap/hydrated change so a later render with real
    // data gets a fill pass; mountFillStartedRef still limits the fill LOGIC to
    // one real attempt. Empty allCardMap is a reliable "still loading" signal
    // (a real pack always has thousands of cards) — harmless even if not
    // proof-positive, since the guard below just never finds anything to fill.
    if (Object.keys(allCardMap).length === 0) return;
    // `hydrated` must stay wired to useIsHydratedStrict (see its own declaration
    // above) — this guard exists specifically so no introduceCard call in the fill
    // logic below ever runs against pre-hydration {} defaults.
    if (!hydrated) return;
    // Task #629: a resumable session for this key is about to be offered via
    // StudyResumePrompt — skip the fill pass here rather than burning real
    // introduceCard/flex budget on content that gets replaced if the user accepts.
    // Deliberately does NOT claim mountFillStartedRef — this render never
    // attempted a fill, so it hasn't used its one real attempt; the decline /
    // expired-accept branch below claims it and runs the fill instead, once it's
    // clear there's nothing left to resume (Task #643 — see that branch's own
    // comment for why this session previously never got a fill attempt at all).
    if (hasPendingResumableSession()) return;
    if (mountFillStartedRef.current) return;
    mountFillStartedRef.current = true;
    runFillPass();
    // mountFillStartedRef makes this a true one-shot per session instance — a later
    // allCardMap growth (e.g. a specialty-pack merge after mount) is not picked up
    // by a second pass; accepted, since no specialty pack is registered ready:true
    // today (lib/langRegistry.ts). Deliberately narrowed to [allCardMap, hydrated]:
    // initialQueue/cards/introductions are read once from the closure the one time
    // the guards above let the fill logic run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCardMap, hydrated]);

  // Apply resume when decision is made.
  // Multiple synchronous setState calls inside this effect are intentional —
  // React 18 batches them into a single re-render.
  useEffect(() => {
    if (resumeDecision === "accepted" && resumedQueue) {
      const saved = getResumableSession();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue(resumedQueue);
      setPos(resumedPos);
      setSessionCorrect(saved?.sessionCorrect ?? 0);
      setSessionTotal(saved?.sessionTotal ?? 0);
      sessionStartedAtRef.current = saved?.startedAt ?? Date.now();
    } else if (resumeDecision === "declined" || (resumeDecision === "accepted" && !resumedQueue)) {
      // Task #634: "accepted" with a null resumedQueue is a narrow race — the
      // resumable session expired between the 'pending' read and this 'accepted'
      // read (resumedQueue's own useMemo re-derives from peekResumableSession() at
      // that moment). Nothing is left to resume; without this branch the click was
      // a silent no-op — sessionStartedAtRef stayed at its initial 0 and queue/pos/
      // counters never reset. Treated identically to a decline: start fresh from
      // initialQueue, since that's the only content left to show.
      //
      // Task #643: this session's mount-fill effect deliberately skipped its one
      // real attempt while this resumable session was pending (see that effect's
      // own comment) — the fix's original claim that the fill effect's work
      // "gets replaced regardless of accept/decline" was true for accept, but
      // false for decline/expired-accept: nothing ever gave this branch a fill
      // pass of its own. mountFillStartedRef is guaranteed false here (the only
      // way to reach "declined" or "accepted"+expired is via "pending", which the
      // mount-fill effect only reaches by skipping without claiming the ref) —
      // claim it now and run the exact same fill pass an ordinary mount with no
      // resumable session would have gotten.
      clearActiveSession();
      setPos(0);
      setSessionCorrect(0);
      setSessionTotal(0);
      sessionStartedAtRef.current = Date.now();
      if (!mountFillStartedRef.current) {
        mountFillStartedRef.current = true;
        runFillPass();
      } else {
        // Unreachable under current logic (see comment above) — defensive
        // fallback so a future change to the pending-detection logic can't
        // silently leave `queue` stuck at a stale value. See .autocode/debt.md
        // (round-7 audit) for why this doesn't contradict #647's opposite call.
        setQueue(initialQueue);
      }
    } else if (resumeDecision === null) {
      sessionStartedAtRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  useEffect(() => {
    if (pos >= queue.length && queue.length > 0) clearActiveSession();
  }, [pos, queue.length, clearActiveSession]);

  const handleRate = (grade: Grade) => {
    const wasCorrect = grade !== "again";
    const newTotal = sessionTotal + 1;
    const newCorrect = wasCorrect ? sessionCorrect + 1 : sessionCorrect;
    const newPos = pos + 1;
    const currentCard = queue[pos]!;

    // Round-11 fix: this requeue was unscoped to isInterrupt with no cap check, so a
    // wrong answer grew an interrupt queue unbounded, defeating INTERRUPT_SESSION_CAP.
    // At the cap, a wrong answer scores and returns via normal FSRS scheduling instead of
    // immediate in-session retry. Non-interrupt sessions are unaffected.
    let finalQueue = queue;
    if (grade === "again") {
      const atInterruptCap = isInterrupt && queue.length >= INTERRUPT_SESSION_CAP;
      if (!atInterruptCap) {
        finalQueue = [...queue];
        finalQueue.splice(Math.min(pos + 3, finalQueue.length), 0, currentCard);
      }
    }

    // Task (2026-08-21): grows an interrupt session by one near-due card per rating,
    // within the user's time budget — no-ops for non-interrupt sessions. See
    // hooks/useInterruptSessionGrowth.ts.
    finalQueue = growInterruptQueue(isInterrupt, finalQueue, sessionStartedAtRef.current, sessionTargetSeconds);

    if (finalQueue !== queue) setQueue(finalQueue); // covers both the "again" requeue and growth above

    const resultingProgress = commitSession(currentCard.id, grade, {
      unitId: isGlobal ? "global" : unitId,
      queueIds: finalQueue.map((c) => c.id),
      position: newPos,
      sessionCorrect: newCorrect,
      sessionTotal: newTotal,
      startedAt: sessionStartedAtRef.current,
    });
    enqueueReviewEvent(currentCard.id, grade, resultingProgress);

    setSessionTotal(newTotal);
    if (wasCorrect) setSessionCorrect(newCorrect);
    setPos(newPos);
  };

  const resetToQueue = (fresh: Card[]) => {
    setQueue(fresh);
    setPos(0);
    setSessionCorrect(0);
    setSessionTotal(0);
    sessionStartedAtRef.current = Date.now();
  };

  return { queue, pos, sessionCorrect, sessionTotal, resumeDecision, setResumeDecision, handleRate, resetToQueue };
}
