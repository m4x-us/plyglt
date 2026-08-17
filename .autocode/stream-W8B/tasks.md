# Stream W8B — Wave 8 tasks

1. /task #629  — Fix requirements: The mount-fill effect never checks resumeDecision or calls peekResumableSession() before running its fill logic (introdu
2. /task #634  — Fix edge-case: The apply-resume effect has three branches (accepted&&resumedQueue, declined, null) but no branch for resumeDecision==='
3. /task #630  — Fix code-quality: hooks/useStudySession.ts is 546 lines, well over the 400-line services cap (Rule 1). This file is the center of all 7 re
4. /task #636  — Fix tests: Two of the three Task #617 CAP-guard regression tests - 'still introduces a normal-cap new card into an interrupt sessio
5. /task #640  — Fix code-quality: The Task #619 comment states up to 3 flex plus 1 normal-cap introduceCard calls can happen in one pass, implying up to 4
6. /task #639  — Fix code-quality: Task #619's async write-ordering risk (accepted as debt in round 4, unchanged this round) is documented only in this inl
