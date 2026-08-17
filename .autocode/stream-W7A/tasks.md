# Stream W7A — Wave 7 tasks

1. /task #617  — Fix requirements: hooks/useStudySession.ts:231 - if (canIntroduceNewCard(today)) introduceNext(); (the normal daily-cap introduction path)
2. /task #622  — Fix edge-case: hooks/useStudySession.ts's mount-fill effect - if getNearDueCards throws after the flex loop has already introduced 1-3
3. /task #609  — Fix async: hooks/useStudySession.ts:58-65 (resumeDecision's useState lazy initializer) and :69-82 (resumedQueue/resumedPos useMemos
4. /task #607  — Fix code-quality: Task #587's own doc comment states the mount-fill effect 'never runs against pre-hydration {} defaults... would later si
5. /task #611  — Fix code-quality: hooks/useStudySession.ts:189-199 - the Task #605 comment's 'cannot desync within one effect pass' claim is accurate as n
