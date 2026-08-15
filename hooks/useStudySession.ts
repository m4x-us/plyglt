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
  //   2. near-due FSRS reviews pulled slightly early (soonest-due first).
  // The floor is a target, not an unconditional guarantee (Task #561): a
  // stranded pause or an exhausted catalog can leave a session below 6, or
  // even empty — the Task #533/#538 backstop below only fires when the
  // pipeline can actually supply something. Non-interrupt sessions keep the
  // original one-new-card behavior; hooks/useInterruptConfig.ts's computeDue
  // mirrors this supply logic when deciding whether an interrupt fires at all.
  useEffect(() => {
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

    // Normal daily-cap path — one new card per day, every session type.
    if (canIntroduceNewCard(today)) introduceNext();

    if (isInterrupt) {
      // strandedAcrossDays check AND a real cross-session daily ceiling (Task
      // #551): canIntroduceNewCard's maxPerDay counts every card introduced
      // today across ALL of today's sessions (the introductions map is
      // persisted, not per-session-scoped), so passing INTERRUPT_FLEX_DAILY_MAX
      // — instead of the old Number.MAX_SAFE_INTEGER, which disabled the
      // numeric cap for the rest of the day — bounds total same-day flex
      // introductions while still letting the stranded pause block
      // independently of the count.
      const flexIntroAllowed = canIntroduceNewCard(today, INTERRUPT_FLEX_DAILY_MAX);
      while (
        flexIntroAllowed &&
        sessionIds.size < INTERRUPT_SESSION_FLOOR &&
        introducedIds.size < INTERRUPT_SESSION_MAX_NEW
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

      // Task #533/#538 backstop: a proactive interrupt should never be
      // completely empty when the pipeline can actually supply something —
      // but it must not bypass the stranded pause to get there. Gated on the
      // same flexIntroAllowed check as the fill loop above (the prior
      // unconditional introduceNext() call here ignored strandedAcrossDays
      // entirely, contradicting BRAND.md's "introductions pause until the
      // stranded card stabilizes" rule). When the pause is active and no
      // near-due card exists either, the session is genuinely empty — the
      // pause invariant takes priority over the never-empty guarantee in
      // this specific, rare combination, matching every other gate in this
      // effect rather than silently overriding it.
      if (sessionIds.size === 0 && flexIntroAllowed) introduceNext();
    }

    if (added.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue((prev) => {
        const have = new Set(prev.map((c) => c.id));
        return [...prev, ...added.filter((c) => !have.has(c.id))];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — one fill pass per session

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
