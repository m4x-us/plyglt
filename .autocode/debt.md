# Debt Register

Deferred WorldClass gaps. Direct items are candidates for casual batching into nearby tasks. Full items require their own dedicated task.

| Date | Source | Category | Description | Severity | Complexity | Reason deferred |
|------|--------|----------|-------------|----------|------------|-----------------|
| 2026-06-27 | Batch 1+2 deep review | tests | components/StudyCard.test.tsx:104 — `expect(screen.getByText(...)).toBeDefined()` is redundant; getByText throws on miss so toBeDefined adds zero signal. Cargo-cult pattern risk. | 3 | Direct | Below threshold — not pseudocode, just noisy |
| 2026-06-27 | Batch 1+2 deep review | tests | components/StudyCard.test.tsx — no test for "close" feedback path: wasClose=true → yellow border + closeFeedback string rendered. autoRate path is covered in srs.test.ts; the UI render is the gap. | 3 | Direct | Below threshold — production impact is cosmetic |
