# Task #518 — Live Sync Verification Walkthrough

This is the last piece of Batch 16. Everything else is built, tested, and
independently audited — this document is just you clicking through it once,
for real, so we can mark it proven instead of "should work."

Total time: ~15 minutes, most of it waiting on a 5-minute background sync
timer. Nothing here is destructive or hard to undo.

---

## What you're proving

1. Signing in with a real Google or Apple account works end-to-end on macOS.
2. A review you do on the desktop app shows up as a real row in the Supabase
   database.
3. A second signed-in client (we'll use a browser tab — no second computer
   needed) sees that review and stays in sync.
4. If the *same* flashcard gets reviewed on both clients before they've had a
   chance to sync with each other, nothing gets lost or corrupted — both
   reviews end up recorded, and both clients agree on the card's state
   afterward.

---

## Step 1 — Open the built app

I've built a signed macOS `.app` from the current code. Once it's ready I'll
tell you exactly where it is (under `src-tauri/target/release/bundle/macos/`).
Double-click it to launch, same as any Mac app.

## Step 2 — Sign in (Client 1 = the desktop app)

1. Go to **Settings** inside the app.
2. Find the **Sync** section.
3. Click **Sign in with Google** or **Sign in with Apple** — whichever
   account you want to test with.
4. This opens your regular web browser (not a window inside the app) to do
   the actual login. Sign in normally.
5. After you approve, the browser should hand control back to the app
   automatically (you may see a "Redirecting to plyglt..." moment). Back in
   the app, the Sync section should now show your email and a green
   "Signed in" badge.

**If step 5 doesn't return you to the app:** that's the one thing actually
being tested here (the deep-link handoff) — tell me exactly what you saw
(stuck browser tab? error page? nothing happened?) and I'll dig in.

## Step 3 — Do a review on the desktop app

Go study a few cards — any unit, doesn't matter. Do at least one full review
(answer a card). Note which card you reviewed (the Italian word is enough).

The app syncs automatically in the background — there's no "sync now"
button. It syncs once right after you sign in, then every 5 minutes while
you're signed in. **Don't wait yet — move to Step 4 first**, then come back.

## Step 4 — Sign in as Client 2 (a browser tab)

This is the second "device" — same account, different client, running in a
completely separate browser tab. This is enough to prove real multi-client
sync; you don't need a second physical machine.

I'll start the app in a browser tab for you (`npm run dev`, opens at
`http://localhost:3000` or similar — I'll confirm the exact address). Sign in
there with **the same account** you used in Step 2.

## Step 5 — Create the conflict scenario

While the two clients haven't synced with each other yet:

1. In the **browser tab** (Client 2), find the *same card* you reviewed in
   Step 3 and review it again — answer it (correct or wrong, doesn't
   matter).

Now both clients have recorded a review of the same card, and neither has
told the other about it yet. This is the exact scenario Task #518 needs to
prove works.

## Step 6 — Let both clients sync

Just wait about 5–6 minutes with both the app and the browser tab open and
signed in (don't close either). Both will auto-sync on their own timer. If
you want it to happen faster, sign out and back in on each client — that
forces an immediate sync.

## Step 7 — Check Supabase directly

1. Open this link in your browser (you'll need to be logged into your
   Supabase account): 
   `https://supabase.com/dashboard/project/ivtrndmqshlfobonxdmv/editor`
2. Find the **`review_events`** table in the left sidebar and click it.
3. Look for **two separate rows** for the card you reviewed twice — same
   `card_id`, but different `device_id` and different `reviewed_at`
   timestamps. Both rows existing is the proof: nothing overwrote or dropped
   either review.

## Step 8 — Confirm both clients agree afterward

Back in both the app and the browser tab, find that same card again (e.g.
check when it's next "ready" for review, or its stats if visible). Both
clients should show the same outcome for that card — they've converged on
one shared state, built from both reviews, not just whichever synced last.

---

## What "done" looks like

Once you've done the above, tell me:
- Whether sign-in worked cleanly on both clients (Step 2/4)
- Whether you saw two rows in `review_events` for the same card (Step 7)
- Whether both clients agreed on the card's state afterward (Step 8)

I'll log the result in `.autocode/tasks.md` and close out Task #518 (which
also closes #517, #519, and the whole Task #169 sync effort — unblocking
push notifications, Task #170).

If anything looks wrong at any step, stop there and tell me what you saw —
that's a real bug we need to fix, not something to work around.
