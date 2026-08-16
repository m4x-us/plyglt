# Stream W5B — Wave 5 tasks

1. /task #600  — Fix requirements: The Study more handler's buildQueue call omits the getIntroductionDueCardIds parameter that initialQ
2. /task #590  — Fix tests: A comment claims a cited sibling test already proves global mode gets a null onStudyMore handler, bu
3. /task #599  — Fix code-quality: const currentCard = queue[pos]! is evaluated before the if (isDone) branch that would make pos a val
4. /task #595  — Fix auth: mode is read directly from useSearchParams with no entitlement or Pro check anywhere
