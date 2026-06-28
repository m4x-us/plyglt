# Debt Register

Deferred WorldClass gaps. Direct items are candidates for casual batching into nearby tasks. Full items require their own dedicated task.

| Date | Source | Category | Description | Severity | Complexity | Reason deferred |
|------|--------|----------|-------------|----------|------------|-----------------|
| 2026-06-28 | Task #048 | code-quality | lib/queue.ts:buildQueue inline date computation duplicates pattern from lib/introduction.ts; could drift if one is updated; candidate for lib/utils extraction | 2 | Direct | auto — Direct spot check warn |
| 2026-06-28 | Task #053 | consistency | lib/entitlement.ts:158,162,182,186,190 — 5 inline error strings remain (2 in activateLicense, 3 in validateLicense) after constants extracted for activate-network and deactivate-network paths; follow-on extraction needed for consistency | 4 | Full | auto — audit non-blocker (F3) |
| 2026-06-28 | Task #053 | security | lib/entitlement.ts:206 — String(e) in deactivateLicense catch log may embed full license key via IPC error message, defeating the deliberate 8-char truncation on the licenseKey field | 4 | Direct | auto — audit non-blocker (F6) |
| 2026-06-28 | Task #053 | security | lib/entitlement.ts:149,190 — activateLicense and validateLicense return raw res.error from Lemon Squeezy to caller/UI; deactivateLicense was hardened but activate/validate were not | 5 | Full | auto — audit non-blocker (F7); pre-existing, not introduced by #053 |
| 2026-06-28 | Task #053 | naming | lib/entitlement.ts:19-20 — ERR_ACTIVATE_NETWORK/ERR_DEACTIVATE_NETWORK used for both network catch AND null-response path; name implies network but null response may indicate serialization failure | 3 | Direct | auto — audit non-blocker (F9) |
