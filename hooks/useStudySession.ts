// ============================================================
// useStudySession.ts — Hook: manages the study queue, position, ratings, and session commit
// ============================================================
"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import type { Card } from "@/content/types";
import type { IntroductionRecord } from "@/content/types";
import { selectQualifyingNewCard, type Grade, type CardProgress } from "@/lib/srs";
import { INTERRUPT_SESSION_FLOOR, INTERRUPT_SESSION_MAX_NEW, INTERRUPT_FLEX_DAILY_MAX } from "@/lib/queue";
import type { ActiveSession } from "@/store/srsStore";
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
  clearActiveSession,
  commitSession,
  canIntroduceNewCard,
  introduceCard,
  getNearDueCards,
  cards,
  introductions,
  enqueueReviewEvent,
}: UseStudySessionParams) {
  const [resumeDecision, setResumeDecision] = useState<"pending" | "accepted" | "declined" | null>(() => {
    const saved = getResumableSession();
    const sessionKey = isGlobal ? "global" : unitId;
    if (saved && saved.unitId === sessionKey && saved.position < saved.queueIds.length) {
      return "pending";
    }
    return null;
  });

  const sessionStartedAtRef = useRef<number>(0);

  const resumedQueue = useMemo((): Card[] | null => {
    if (resumeDecision !== "accepted") return null;
    const saved = getResumableSession();
    if (!saved) return null;
    return saved.queueIds.map((id) => allCardMap[id]).filter((c): c is Card => !!c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  const resumedPos = useMemo((): number => {
    if (resumeDecision !== "accepted") return 0;
    const saved = getResumableSession();
    return saved?.position ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDecision]);

  const [queue, setQueue] = useState<Card[]>(initialQueue);
  const [pos, setPos] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  // Task #573 (Wave 3): guards the mount-fill effect below so its real fill logic
  // runs exactly once per session, same as the old `useEffect(..., [])` intent —
  // see the effect's own comment for why this can no longer simply be an empty
  // dependency array.
  const mountFillDoneRef = useRef(false);

  // On mount: introduce the first qualifying new card if today's quota is open
  // (all session types), then — for interrupt sessions only — fill the queue up
  // to lib/queue.ts's INTERRUPT_SESSION_FLOOR (Batch 23, owner-ratified spec:
  // every interrupt targets 45-90 seconds ≈ 6 cards; a 1-card burst spends the
  // attention cost of an interruption on almost no learning). Fill order:
  //   1. more NEW cards (Max's ratified fill choice — starvation is cold-start-
  //      shaped, exactly when extra intros are pure ramp-up), hard-capped at
  //      INTERRUPT_SESSION_MAX_NEW (3) per session — the working-memory limit —
  //      and gated on both the introduction engine's strandedAcrossDays pause
  //      AND lib/queue.ts's INTERRUPT_FLEX_DAILY_MAX, a real cross-session
  //      daily ceiling (Task #551 — the numeric per-session cap deliberately
  //      flexes here, Task #533, but the flex itself is bounded, not unlimited).
  //      Task #577 (Wave 3): this ceiling is enforced via a check-then-act read
  //      of in-memory Zustand state (canIntroduceNewCard, then introduceCard) —
  //      two browser tabs/windows signed into the same account can each
  //      independently pass the check and each flex up to INTERRUPT_SESSION_MAX_NEW
  //      cards, exceeding the intended daily ceiling. No cross-tab lock is added
  //      here: entitlement/session state in this app is already an intentional,
  //      owner-confirmed client-only honor-system trade-off (CLAUDE.md §5), and a
  //      real cross-tab coordination mechanism (BroadcastChannel, storage events,
  //      a server-side counter) is disproportionate to the actual cost of this
  //      race — a handful of extra new-card introductions on a day the user
  //      happens to run two tabs at once, not data loss or a security boundary.
  //   2. near-due FSRS reviews pulled slightly early (soonest-due first).
  // The floor is a target, not an unconditional guarantee (Task #561): a
  // stranded pause or an exhausted catalog can leave a session below 6, or
  // even empty. Non-interrupt sessions keep the original one-new-card
  // behavior; hooks/useInterruptConfig.ts's computeDue mirrors this supply
  // logic when deciding whether an interrupt fires at all.
  useEffect(() => {
    // Task #573 (Wave 3): app/study/page.tsx calls useStudySession unconditionally,
    // before its own packLoading early return — any session that mounts while the
    // pack is still loading (a still-loading es-language pack, a specialty-pack
    // load, or a cold push-tap launch straight into /study?mode=interrupt) renders
    // this hook FIRST with an empty allCardMap/initialQueue. useState(initialQueue)
    // only consumes its initializer on that first render, and this effect used to
    // have an empty [] dependency array (mount only) — so the fill pass ran exactly
    // once against that empty snapshot and never got a second chance once real pack
    // data actually arrived, permanently freezing the queue empty (a regression
    // Task #552's useMemo-only fix did not address, since the stale closure lived
    // here, not in the useMemo). allCardMap is the ready-signal: a real language
    // pack always has thousands of cards, so an empty allCardMap can only mean
    // "not loaded yet," never a legitimate steady state. mountFillDoneRef preserves
    // the original "exactly one real fill pass per session" guarantee — this effect
    // re-fires on every allCardMap reference change, but the guard below makes the
    // actual fill logic run exactly once, on whichever render is the FIRST to have
    // real data, rather than unconditionally (and possibly vacuously) on render 1.
    if (Object.keys(allCardMap).length === 0) return;
    if (mountFillDoneRef.current) return;
    mountFillDoneRef.current = true;

    // Sync queue to THIS render's real initialQueue — a no-op on a normal mount
    // where the pack was already loaded (same array reference useState's
    // initializer already captured, so React bails out with no extra render); a
    // real resync on the cold-start path above, replacing the stale empty
    // snapshot captured on an earlier, pack-still-loading render.
    setQueue(initialQueue);

    const today = localDateStr();
    // sessionIds tracks the full session content (initial queue + everything this
    // pass adds) for both dedupe and the floor arithmetic; `added` holds only the
    // cards that actually need appending. The normal daily-intro path may pick a
    // card already sitting in the queue (unit sessions interleave new cards via
    // buildQueue) — that introduction still happens, it just appends nothing.
    const sessionIds = new Set<string>(initialQueue.map((c) => c.id));
    const added: Card[] = [];
    const introducedIds = new Set<string>();

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
    // `introducedIds` with the interrupt flex loop below: a normal-cap
    // introduction here counts as one of the flex loop's INTERRUPT_SESSION_MAX_NEW
    // slots, it is not additive with them (Task #574 seam-tests this interaction).
    if (canIntroduceNewCard(today)) introduceNext();

    if (isInterrupt) {
      // Task #562 (Wave 3): canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX) is
      // re-evaluated on every loop iteration, as part of the while-condition itself,
      // rather than computed once before the loop started. The real store action
      // reads live introductions state (store/srsStore.ts), so a per-iteration call
      // correctly reflects each introduceCard this same pass already committed,
      // genuinely enforcing INTERRUPT_FLEX_DAILY_MAX per-introduction rather than
      // per-session. The previous once-per-mount version let repeated same-day
      // interrupt sessions each pass a count-based check still under the ceiling
      // and each be granted a full INTERRUPT_SESSION_MAX_NEW batch, overshooting
      // INTERRUPT_FLEX_DAILY_MAX by up to 2 cards across a day's sessions.
      //
      // Task #566: canIntroduceNewCard returning false here has two distinct
      // causes — the stranded-pause invariant (an introduction record failed 3x in
      // a row and hasn't yet recovered with a correct answer) OR the daily flex
      // ceiling (INTERRUPT_FLEX_DAILY_MAX) being reached — and this loop
      // deliberately does not distinguish them: both are legitimate reasons to stop
      // flexing new cards, and the near-due fill below still runs regardless of
      // which one stopped the loop.
      while (
        sessionIds.size < INTERRUPT_SESSION_FLOOR &&
        introducedIds.size < INTERRUPT_SESSION_MAX_NEW &&
        canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX)
      ) {
        if (!introduceNext()) break;
      }

      if (sessionIds.size < INTERRUPT_SESSION_FLOOR) {
        // Task #541: request the full near-due pool rather than a
        // INTERRUPT_SESSION_FLOOR + sessionIds.size heuristic. That heuristic
        // only over-fetches enough if cards already in the session cluster at
        // the front of the sorted pool — if they're interleaved instead, the
        // slice can run out before the floor is reached even though enough
        // near-due cards exist. getNearDueCards already filters+sorts the
        // ENTIRE catalog before slicing to `limit` (store/srsStore.ts), so
        // asking for everything adds no real cost — it's a mathematically
        // sufficient bound instead of an unproven one.
        for (const card of getNearDueCards(Number.MAX_SAFE_INTEGER)) {
          if (sessionIds.size >= INTERRUPT_SESSION_FLOOR) break;
          if (sessionIds.has(card.id)) continue;
          sessionIds.add(card.id);
          added.push(card);
        }
      }

      // Task #565 (Wave 3): the former post-loop "never-empty" backstop
      // (`if (sessionIds.size === 0 && flexIntroAllowed) introduceNext();`) was
      // removed — it was structurally dead code. introduceNext() is a pure
      // function of (allCardMap, cards, introductions, introducedIds), none of
      // which change between the while loop's last attempt and this point, so
      // whenever that guard's condition was true, the while loop had already
      // tried and failed with bit-identical arguments and the backstop was
      // guaranteed to fail again. The #562 per-iteration recheck above does not
      // change this analysis — it only changes WHEN the loop stops, never whether
      // a repeat call against the same frozen inputs can succeed where the loop's
      // own attempt didn't. A session that reaches this point with zero content
      // (no flex-introduced card, no near-due card) is genuinely empty — Task
      // #561 already documents the floor as a target, not an unconditional
      // guarantee.
    }

    if (added.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue((prev) => {
        const have = new Set(prev.map((c) => c.id));
        return [...prev, ...added.filter((c) => !have.has(c.id))];
      });
    }
    // Deliberately narrowed to [allCardMap]: initialQueue/cards/introductions/etc.
    // are read from this render's closure the one time the guard above lets the
    // fill logic actually run, matching the original "run (essentially) once per
    // session" intent — see the Task #573 comment above for why allCardMap alone
    // is the correct re-run trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCardMap]);

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
    } else if (resumeDecision === "declined") {
      clearActiveSession();
      setQueue(initialQueue);
      setPos(0);
      setSessionCorrect(0);
      setSessionTotal(0);
      sessionStartedAtRef.current = Date.now();
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
