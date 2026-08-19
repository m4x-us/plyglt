# Push Dispatch Monitoring — What You Need To Do (Task #656)

The code side is done and tested: the push dispatch Edge Function now pings a
health-check endpoint after every run — success on a healthy tick, failure on a
real operational problem (missing config, a tokens-fetch abort, an uncaught
exception, or every attempted send failing at once — the last one is a proxy
for "APNs/FCM credentials look expired"). It also now catches a genuinely
unexpected exception with a top-level `try/catch` instead of silently losing
the whole cron tick's batch, and caps the total extra retry cost one sustained
outage can add to a single invocation.

What's left needs a real account — a free one, no card required — since it's
an external service only you can create. Nothing here is urgent: the pipeline
runs exactly as it does today (pings are a no-op) until you set the one env
var below.

---

## 1. Create a Healthchecks.io account and check

Chosen over Supabase's own log-based alerting (needs a paid Log Drains add-on
plus a downstream processor just to notice "this returned 5xx" — more standing
infra than a one-person team needs) and over a custom GitHub Actions cron
health-check (reinvents a dead-man's-switch that already exists for free, with
its own reliability caveats — scheduled workflow runs can slip by up to
~30min).

1. Go to [healthchecks.io](https://healthchecks.io) and sign up (free tier —
   20 checks, email/Slack/Discord/webhook alerting).
2. Create a new check, name it something like `plyglt-push-dispatch`.
3. Set its **period** to 5 minutes (matches the pg_cron schedule) and its
   **grace time** to something like 5–10 minutes — this is what covers "the
   pg_cron job failed to fire on schedule" with zero code: if no ping arrives
   within period + grace, Healthchecks.io alerts on its own.
4. Set up how you want to be alerted (email is enabled by default; add
   Slack/Discord/SMS under the check's Integrations tab if you want something
   louder than email).
5. Copy the check's **ping URL** — looks like `https://hc-ping.com/<uuid>`.

## 2. Set the one env var

```
supabase secrets set HEALTHCHECK_PING_URL=https://hc-ping.com/<your-uuid>
```

That's it. The next cron tick starts pinging automatically — no redeploy
needed, since the Edge Function reads it from `Deno.env` on every invocation.

## 3. Verify it actually fires (the acceptance criterion this task named)

This is the one step worth doing deliberately, since it means briefly breaking
something real. Two failure modes are deliberately NOT pinged, so don't use
them for this test: a wrong `CRON_SECRET` returns 401 before the healthcheck
URL is ever read (a stray unauthenticated hit to the public endpoint isn't a
real operational failure), and `PUSH_DISPATCH_ENABLED=false` is a deliberate,
intentional pause, not a failure. Use this instead:

1. Temporarily unset the service-role key: `supabase secrets unset SUPABASE_SERVICE_ROLE_KEY`.
   This hits the function's "missing Supabase service credentials" 500 path,
   which does ping fail.
2. Wait for the next pg_cron tick (up to 5 minutes), then check the
   Healthchecks.io dashboard — the check should show "Down," with the ping's
   detail message readable in its ping log.
3. **Restore the real key immediately after confirming the alert fired:**
   `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<the real value>` — this
   key is required for every real dispatch to work, so don't leave it unset
   longer than the one tick needed to see the alert.
4. Wait for the next healthy tick and confirm the check flips back to "Up."

## 4. Existing test-mode/founder artifacts

Not applicable to this task — see Task #655's own checklist for Lemon Squeezy
test-mode licenses, a separate concern.

---

## Not needed yet

**A minimum-sample-size threshold on the "every attempt failed" heuristic** —
today it can fire on a small batch (e.g. 2 attempted, both failed) even if
that's just an ordinary pair of unrelated transient failures, not real
credential expiry. Deliberately left simple for a one-person team: an
occasional honest "0/2 sent" ping costs 10 seconds to glance at and dismiss,
which is cheaper than the added complexity of a significance threshold.
Revisit only if false-positive pings become a real annoyance in practice.
