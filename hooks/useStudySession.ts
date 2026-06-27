"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import type { Card } from "@/content/types";
import type { Grade } from "@/lib/srs";
import type { ActiveSession } from "@/store/srsStore";

type UseStudySessionParams = {
  initialQueue: Card[];
  allCardMap: Record<string, Card>;
  isGlobal: boolean;
  unitId: string;
  getResumableSession: () => ActiveSession | null;
  clearActiveSession: () => void;
  commitSession: (cardId: string, grade: Grade, session: ActiveSession) => void;
};

export function useStudySession({
  initialQueue,
  allCardMap,
  isGlobal,
  unitId,
  getResumableSession,
  clearActiveSession,
  commitSession,
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

  // Apply resume when decision is made.
  // Multiple synchronous setState calls inside this effect are intentional —
  // React 18 batches them into a single re-render.
  useEffect(() => {
    if (resumeDecision === "accepted" && resumedQueue) {
      const saved = getResumableSession();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue(resumedQueue);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPos(resumedPos);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionCorrect(saved?.sessionCorrect ?? 0);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionTotal(saved?.sessionTotal ?? 0);
      sessionStartedAtRef.current = saved?.startedAt ?? Date.now();
    } else if (resumeDecision === "declined") {
      clearActiveSession();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue(initialQueue);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPos(0);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionCorrect(0);
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

    commitSession(currentCard.id, grade, {
      unitId: isGlobal ? "global" : unitId,
      queueIds: newQueue.map((c) => c.id),
      position: newPos,
      sessionCorrect: newCorrect,
      sessionTotal: newTotal,
      startedAt: sessionStartedAtRef.current,
    });

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
