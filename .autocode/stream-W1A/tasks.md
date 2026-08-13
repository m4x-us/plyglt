# Stream W1A Task State

### Task #524 | correctness | severity 6
**What:** Two coupled fixes to the desktop interrupt engine's Rust core, landed together: (1) unlock/wake/idle-return (`src-tauri/src/os_events.rs`, all three platform blocks — macOS poll loop, Windows wndproc, Linux D-Bus handlers) currently bypass `interval_secs` entirely per the module's own comment ("OS events intentionally bypass interval_secs") — add the same interval-elapsed gate the scheduled poll (`interrupt.rs`) already uses, so an OS event is a *check-in moment* against the schedule, not an independent trigger. (2) The "last fired" clock currently advances the instant a check happens (`interrupt.rs`'s poll loop sets `last_triggered_secs = now` before the JS layer even evaluates due-count; `os_events.rs`'s `emit_interrupt` helper does the same on every OS-triggered emit) — stop advancing it automatically on emit. Add a new Tauri command (e.g. `mark_interrupt_fired`) that becomes the *only* thing that advances `last_triggered_secs`, called by the JS layer only when it actually shows real content (wired in Task #526, a later wave).
**Why:** Without (1), lock your screen 15 times a day with anything due each time and you get 15 interrupts, not 6–10 — the core complaint that started this whole redesign. Without (2), an empty check (nothing due) silently spends a full interval for nothing, pushing the next *possible* interrupt further out than intended — the opposite failure mode, also wrong. See `docs/INTERRUPT_ARCHITECTURE.md` §3–§4.
**File:** `src-tauri/src/interrupt.rs`, `src-tauri/src/os_events.rs`
**Severity:** 6 | **DoD Tier:** 2
**Complexity:** ⚡ Direct — 2 files, no package boundary, no matched scope-trigger word (rubric-mechanical label; real coupling risk across 3 platform blocks noted in the batch header's parallelism rationale, not reflected by this label alone)
**Blocked by:** Nothing | **Blocks:** #526
**Done when:** New unit tests (matching `os_events.rs`'s existing pure-guard-function test pattern) prove: an OS event with `now - last_triggered < interval_secs` does not fire even when due; a scheduled or OS-triggered check that finds nothing due does not change `last_triggered_secs`. `mark_interrupt_fired` command exists and is the only writer of `last_triggered_secs`. `cargo check`/`cargo test` clean on macOS host (does not compile-check Windows/Linux `cfg` blocks — same caveat as Tasks #166/#167; a real CI build on each target is still required before calling this done end-to-end).
**Owner:** Architecture Agent

---

### Task #531 | product-decision | severity 3
**What:** Unify desktop's `interrupt.rs` `interval_secs` default (currently 3 hours) with mobile's already-correctly-calibrated `push_tokens.interrupt_interval_minutes` default (90 minutes — lands at ≈8.7 interrupts over a 13-hour waking window, matching BRAND.md's 6–10/day target; desktop's 3-hour default only reaches ≈4.3/day over the same window).
**Why:** Two independently-picked numbers for what should be one product-level cadence decision. See `docs/INTERRUPT_ARCHITECTURE.md` §7 and Open Question 1.
**File:** `src-tauri/src/interrupt.rs` (default), `store/settingsStore.ts` / `store/migrations.ts` (if a version bump is needed for existing users' persisted default)
**Severity:** 3 | **DoD Tier:** 1
**Complexity:** ⚡ Direct — default-value change, not a structural one
**Blocked by:** Nothing — RESOLVED 2026-08-13: Max confirmed 90 minutes, unified across both platforms. | **Blocks:** Nothing
**Done when:** Desktop's default is 90 minutes. Existing users' already-persisted custom interval settings are untouched (this only changes the *default* for new installs / never-configured users).
**Owner:** Architecture Agent

---

### Task #532 | product-decision | severity 4
**What:** Merge desktop's DND start/end (`store/settingsStore.ts`) and mobile's waking-hours window (`push_tokens.waking_hours_start_local`/`_end_local`) into one literally-shared, synced setting.
**Why:** Same practical effect for a single contiguous window today, but they're framed oppositely (DND = "don't interrupt during this window" vs. waking hours = "only ever interrupt during this window") and nothing currently ties them together across platforms. See `docs/INTERRUPT_ARCHITECTURE.md` §7 and Open Question 4.
**File:** `store/settingsStore.ts`, `store/migrations.ts`, `push_tokens` schema, UI in `app/settings/page.tsx`
**Severity:** 4 | **DoD Tier:** 2
**Complexity:** 🔧 Full — a real schema/sync decision, not a default tweak
**Blocked by:** Nothing — RESOLVED 2026-08-13: Max confirmed merge into one shared, synced setting (not "keep separate"). | **Blocks:** Nothing
**Done when:** One synced setting governs both desktop and mobile's quiet-hours behavior, replacing the two independent concepts. `docs/INTERRUPT_ARCHITECTURE.md`'s "Open questions" section already reflects this decision.
**Owner:** Architecture Agent
