# Sync Backend — What You Need To Do (Task #169)

The code side of the sync backend is ready to go for everything that doesn't need a
live server: the database design, the offline queue that records every review on
your device, and the logic that merges reviews from two devices correctly. That part
is done and tested.

What's left needs real accounts and real credentials — things only you can create,
since they involve your own Apple/Google developer identities and a new paid-if-it-
grows service (Supabase). This is a checklist for that part. Nothing here is urgent
today — do it whenever you're ready to move sync from "code exists" to "actually
syncing between your devices."

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free to start).
2. Click "New Project." Name it something like `plyglt-prod`.
3. Pick a region close to where you expect most users (US if unsure).
4. Set a strong database password — Supabase will ask you to save it. Store it
   somewhere safe (a password manager); you won't need to type it day-to-day, but
   you'd need it to recover direct database access later.
5. Wait a couple minutes for the project to provision.

**When it's ready, go to Project Settings → API and copy down two values:**
- **Project URL** (looks like `https://abcxyz.supabase.co`)
- **`anon` public key** (a long string — this one is safe to embed in the app, it's
  designed to be public and only allows what the Row Level Security rules permit)

Do **not** copy the `service_role` key anywhere in the app or send it to me in chat
— that one bypasses all security rules and should only ever live in a server-side
secret, never in client code. We won't need it for what's built so far.

## 2. Apply the database schema

The table design already exists in this repo at
`supabase/migrations/20260806000000_review_events.sql`. To apply it:

1. In your Supabase project, go to the **SQL Editor** (left sidebar).
2. Open that file in this repo, copy its entire contents, paste into the SQL Editor.
3. Click **Run**. You should see "Success. No rows returned."

That's it — the `review_events` table now exists with the right security rules
(each user can only ever see their own reviews).

## 3. Enable Apple Sign In

This is a **different** piece of Apple setup than the one already done for macOS
code signing (Task #122) — that was for notarizing the desktop app; this is for
letting users sign in with their Apple ID. You'll need your existing Apple Developer
Program membership (already active), plus a few extra steps inside it:

1. In [Apple Developer](https://developer.apple.com/account) → Certificates,
   Identifiers & Profiles → Identifiers, create a new **Services ID** (not an App
   ID — those are different things, easy to mix up).
2. Enable "Sign In with Apple" on that Services ID, and configure it with your
   domain and a redirect URL — Supabase's Auth → Providers → Apple page shows you
   the exact redirect URL to paste in once you get there, so do this step and the
   next one side-by-side.
3. Generate a "Sign in with Apple" **key** (Certificates → Keys → new key, enable
   Sign In with Apple). Download the `.p8` file it gives you — you only get to
   download it once, so save it somewhere safe immediately.
4. In Supabase → Authentication → Providers → Apple, toggle it on and paste in:
   your Services ID, your Apple Team ID (same one already used for macOS signing),
   the Key ID from step 3, and the contents of the `.p8` file.

Apple's own docs walk through this with screenshots if any step is unclear —
search "Supabase Apple Sign In setup" for a current walkthrough, since Apple's
developer portal UI changes periodically.

## 4. Enable Google Sign In

Simpler than Apple:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a new
   project (or reuse one if you already have one for something else).
2. APIs & Services → OAuth consent screen → fill in basic app info (name: plyglt,
   your email as contact).
3. APIs & Services → Credentials → Create Credentials → OAuth client ID → choose
   "Web application." Supabase's Auth → Providers → Google page shows the exact
   redirect URI to add here.
4. Copy the **Client ID** and **Client Secret** it gives you.
5. In Supabase → Authentication → Providers → Google, toggle it on and paste both
   in.

## 5. Give me the two values I actually need

Once steps 1–4 are done, the only two things I need from you to wire the real
client are:

- The **Project URL**
- The **`anon` public key**

Both are safe to paste directly in chat or drop in a `.env.local` file yourself —
neither one grants access beyond what the Row Level Security rules in the schema
already allow. Once I have them, I can wire the actual sync client, build real
sign-in screens, and verify SRS data syncing between two of your devices — the
remaining piece of Task #169's Done-When.

---

## Not needed yet

**FCM (push notifications)** — that's Task #170, a separate piece of work. No need
to touch Firebase/FCM until we get there.

**Entitlement server-authority decision** — `docs/SYNC_ARCHITECTURE.md`'s one open
question (whether license state should ever become server-authoritative via sync)
is explicitly deferred, not needed to finish Task #169.
