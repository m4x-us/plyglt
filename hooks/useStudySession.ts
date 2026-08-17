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
import { localDateStr } from "@/lib/utils";

type UseStudySessionParams = {
  initialQueue: Card[];
  allCardMap: Record<string, Card>;
  isGlobal: boolean;
  // Scopes the interrupt-floor flex fallback (see the mount effect below) to proactive
  // interrupt sessions only — a manually-opened Global Review with nothing due is allowed to
  // show the normal empty-queue screen; only the daily-interrupt promise is a hard floor.
  isInterrupt: boolean;
  unitId: string;
  getResumableSession: () => ActiveSession | null;
  // Task #608 (Wave 6): render-phase-safe pair (store/srsStore.ts, Task #597) —
  // peekResumableSession never mutates state, safe to call from useState lazy
  // initializers/useMemo bodies/useEffect alike; clearExpiredResumableSession is
  // the explicit, side-effecting purge, intended to be called from a useEffect
  // only. Together they replace getResumableSession's render-phase set() call at
  // every site in this file except the "apply resume" effect below (already
  // effect-scoped, so getResumableSession's mutation there was never unsafe).
  peekResumableSession: () => ActiveSession | null;
  clearExpiredResumableSession: () => void;
  clearActiveSession: () => void;
  commitSession: (cardId: string, grade: Grade, session: ActiveSession) => CardProgress;
  canIntroduceNewCard: (today: string, maxPerDay?: number) => boolean;
  introduceCard: (cardId: string, today: string) => void;
  // Batch 23 — interrupt-session floor fill: already-studied, not-yet-due cards
  // ordered soonest-due first (store/srsStore.ts's getNearDueCards, bound by the
  // page to the session's card scope). Injected like every other store-backed
  // action here for testability.
  getNearDueCards: (limit: number) => Card[];
  cards: Record<string, CardProgress>;
  introductions: Record<string, IntroductionRecord>;
  // Task #169 — records the review as a local sync event, queued for upload once
  // a live Supabase client exists. Injected (not a direct useSyncStore import)
  // for the same testability reason every other store-backed action here is.
  enqueueReviewEvent: (cardId: string, grade: Grade, resultingProgress: CardProgress) => void;
};

export function useStudySession({
  initialQueue,
  allCardMap,
  isGlobal,
  isInterrupt,
  unitId,
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
  // Task #608 (Wave 6): starts unresolved (null) rather than resolving via a
  // useState lazy initializer that called getResumableSession() — a mutating
  // set() call during React's render phase, unsafe under StrictMode/concurrent
  // rendering (render can run twice or be discarded entirely, either silently
  // double-firing the expiry-purge mutation or dropping it). See the
  // hydration-gated effect below for how this now actually resolves.
  const [resumeDecision, setResumeDecision] = useState<"pending" | "accepted" | "declined" | null>(null);

  const sessionStartedAtRef = useRef<number>(0);

  const resumedQueue = useMemo((): Card[] | null => {
    if (resumeDecision !== "accepted") return null;
    const saved = peekResumableSession();
    if (!saved) return null;
    return saved.queueIds.map((id) => allCardMap[id]).filter((c): c is Card => !!c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  const resumedPos = useMemo((): number => {
    if (resumeDecision !== "accepted") return 0;
    const saved = peekResumableSession();
    return saved?.position ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  const [queue, setQueue] = useState<Card[]>(initialQueue);
  const [pos, setPos] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  // True once the mount-fill effect below has CLAIMED its one real attempt — not
  // once that attempt has finished. Set at the start of the guarded block, before
  // any fill logic that can throw runs — see that effect's own try/catch/finally.
  const mountFillStartedRef = useRef(false);
  // app/study/page.tsx calls useStudySession unconditionally, before its own
  // hydration gate — on Tauri (async file-store IPC), this hook's mount-fill effect
  // can otherwise fire while `cards`/`introductions` are still pre-hydration {}
  // defaults, silently losing an introduceCard write to Zustand persist's later
  // hydrate() merge. `hydrated` gates the mount-fill effect (and, since Task #629,
  // the resume-decision effect) against that race. MUST be useIsHydratedStrict, not
  // the lenient useIsHydrated: this effect WRITES persisted state, and only the
  // strict signal never resolves true via HYDRATION_FAILSAFE_MS's timeout fallback —
  // see lib/storage.ts's own doc comment on useIsHydratedStrict for the full story.
  const hydrated = useIsHydratedStrict(useSRSStore);

  // Resolves resumeDecision via an effect using the render-safe
  // peekResumableSession/clearExpiredResumableSession pair (never a useState lazy
  // initializer — see that state's own comment) — gated on the same `hydrated`
  // signal as the mount-fill effect below, for the identical pre-hydration-defaults
  // reason. clearExpiredResumableSession runs first, since its own doc comment
  // (store/srsStore.ts) requires calling it from an effect, never during render.
  // Task #629: re-derives "is there a still-valid resumable session for THIS session
  // key" fresh at read time — shared by the resume-decision effect below and the
  // mount-fill effect further down. Deliberately NOT read via the `resumeDecision`
  // state variable in the mount-fill effect: both effects are gated on the same
  // `hydrated` dependency and fire in the same commit, in declaration order, but a
  // setState scheduled by this earlier effect isn't visible in a later effect's
  // closure until a subsequent render — only a fresh re-check sees it in time.
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

  // On mount: introduce the first qualifying new card if today's quota is open (all
  // session types), then — for interrupt sessions only — fill the queue up to
  // lib/queue.ts's INTERRUPT_SESSION_FLOOR. Fill order: (1) flex-introduce more new
  // cards, capped at INTERRUPT_SESSION_MAX_NEW and the daily INTERRUPT_FLEX_DAILY_MAX
  // ceiling; (2) near-due FSRS reviews pulled slightly early. The floor is a target,
  // not a guarantee — a stranded pause or exhausted catalog can leave a session below
  // it, or empty. Cross-tab races on the check-then-act ceiling reads below are an
  // accepted client-only honor-system trade-off (CLAUDE.md §5), not a gap to fix.
  // Full rationale, numbers, and history: docs/INTERRUPT_ARCHITECTURE.md §10.
  // hooks/useInterruptConfig.ts's computeDue mirrors this supply logic for the
  // fire-gate decision.
  // Task #643: the actual fill logic, extracted so it can be claimed and run from
  // two places — the mount-fill effect below (the ordinary path), and the
  // apply-resume effect's decline/expired-accept branch (Task #629's skip left
  // THAT session permanently unfilled otherwise, since neither effect's
  // dependency array changes on a resumeDecision transition — see both call
  // sites' own comments for the full history). Callers are responsible for their
  // own mountFillStartedRef claim before calling this — it does not check or
  // claim the ref itself, since the two call sites claim it under different
  // conditions.
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
    // app/study/page.tsx calls useStudySession unconditionally, before its own
    // packLoading early return — a session mounting while the pack is still loading
    // (cold push-tap into /study?mode=interrupt, a still-loading pack) renders this
    // hook first with an empty allCardMap/initialQueue. This effect re-fires on every
    // allCardMap/hydrated change so a later render with real data gets a fill pass;
    // mountFillStartedRef below still limits the actual fill LOGIC to exactly one
    // real attempt. allCardMap emptiness is a reliable "still loading" signal (a real
    // pack always has thousands of cards) though not proof-positive (a load error or
    // bad unitId also leaves it empty) — harmless either way, since the guard below
    // just never finds anything to fill from.
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
        // silently leave `queue` stuck at a stale value.
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

    let newQueue = queue;
    if (grade === "again") {
      newQueue = [...queue];
      newQueue.splice(Math.min(pos + 3, newQueue.length), 0, currentCard);
      setQueue(newQueue);
    }

    const resultingProgress = commitSession(currentCard.id, grade, {
      unitId: isGlobal ? "global" : unitId,
      queueIds: newQueue.map((c) => c.id),
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
