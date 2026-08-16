# Stream W5A — Wave 5 tasks

1. /task #587  — Fix data-loss: The mount-fill effect gates readiness only on allCardMap (pack-loading) and ignores SRS-store hydrat
2. /task #592  — Fix error-handling: mountFillDoneRef
3. /task #593  — Fix error-handling: An uncaught exception from the mount-fill effect body (same location as F006) propagates out of the 
4. /task #594  — Fix code-quality: mountFillDoneRef's name and its own comment describe post-completion state, but the ref is actually 
5. /task #602  — Fix code-quality: The claim that allCardMap-emptiness can only mean not-loaded-yet is technically false in two reachab
6. /task #605  — Fix async: Within the mount-fill effect, canIntroduceNewCard, introduceCard, and getNearDueCards read live stor
7. /task #588  — Fix edge-case: mountFillDoneRef permanently suppresses re-fill if allCardMap legitimately grows after the one real 
8. /task #596  — Fix async: A cross-tab race exists on the flex daily-new-card maximum
