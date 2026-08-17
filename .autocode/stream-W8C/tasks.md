# Stream W8C — Wave 8 tasks

1. /task #633  — Fix async: The staleness check `if (seq !== configSeqRef.current) return;` exists only inside the .catch() handler of the updateInt
2. /task #641  — Fix async: The interrupt:fire listener has no re-entrancy guard or mutual-exclusion lock. src-tauri/src/interrupt.rs documents emit
3. /task #635  — Fix tests: Two tests - 'does not flex when reviews are due' and 'falls through to a near-due card when the flex introduction is blo
