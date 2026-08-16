# Stream W6A — Wave 6 tasks

1. /task #618  — Fix code-quality: hooks/useInterruptConfig.ts's computeDue and hooks/useStudySession.ts's mount-fill effect hand-duplicate the identical 3
2. /task #610  — Fix async: hooks/useInterruptConfig.ts:52-115 (computeDue) reads live SRS-store state with no hydration gate, and is called from co
3. /task #608  — Fix requirements: store/srsStore.ts:88-96 (peekResumableSession) and :189-201 (clearExpiredResumableSession) were built specifically to re
4. /task #612  — Fix code-quality: app/study/page.tsx is 181 lines against CLAUDE.md's documented 150-line cap for this exact route (confirmed by hooks/use
5. /task #615  — Fix error-handling: hooks/useStudySession.ts:173-201 - mountFillStartedRef.current=true (174), setQueue(initialQueue) (181), and the session
6. /task #619  — Fix async: hooks/useStudySession.ts's mount-fill effect - up to 3 sequential introduceCard() calls within one effect pass each trig
7. /task #620  — Fix performance: hooks/useStudySession.ts's near-due fill step calls getNearDueCards(Number.MAX_SAFE_INTEGER), forcing an O(n log n) filt
