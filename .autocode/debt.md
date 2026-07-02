# Debt Register

Deferred WorldClass gaps. Direct items are candidates for casual batching into nearby tasks. Full items require their own dedicated task.

| Date | Source | Category | Description | Severity | Complexity | Reason deferred |
|------|--------|----------|-------------|----------|------------|-----------------|
| 2026-06-29 | Task #110 | diagnostics | lib/entitlement.ts:activateLicense:143-144 — !res.license_key guard returns ERR_LICENSE_NOT_ACTIVE without console.error; all adjacent guards (lines 140, 146, 150) log before returning | 2 | Direct | auto — pre-existing; spot check warn |
