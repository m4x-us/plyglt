-- ===========================================
-- PUSH DISPATCH CRON — schedules the send-interrupt-notifications Edge Function (Task #170)
-- ===========================================
-- Fires every 5 minutes via pg_cron + pg_net. The Edge Function itself decides
-- which individual tokens are actually due (supabase/functions/
-- send-interrupt-notifications/dueSelection.ts) — this job just wakes it up
-- on a fixed cadence; 5 minutes keeps worst-case delivery latency well inside
-- a user's configured interrupt_interval_minutes without invoking the
-- function so often that overlapping in-flight runs become likely.
--
-- MANUAL DEPLOY STEP THIS MIGRATION CANNOT PERFORM (same category as
-- store/authStore.ts's documented Supabase redirect-URL-allowlist step):
-- `app.cron_secret` (a Postgres server setting, not a table) must be set to
-- the same value as the Edge Function's own CRON_SECRET env var, e.g. via
-- the Supabase SQL editor:
--   alter database postgres set app.cron_secret = '<value>';
-- and `supabase secrets set CRON_SECRET=<same value>`. Until both are set,
-- current_setting('app.cron_secret', true) below returns null and the
-- Authorization header sent is "Bearer ", which the Edge Function's own
-- constant-time comparison (index.ts) always rejects — a safe fail-closed
-- default, not a silent no-op.
-- ===========================================
-- DEPENDS ON: pg_cron, pg_net extensions (enabled by default on Supabase projects)
-- USED BY: supabase/functions/send-interrupt-notifications/index.ts
-- ===========================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-interrupt-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_functions_url', true) || '/send-interrupt-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.cron_secret', true), '')
    ),
    body := '{}'::jsonb
  );
  $$
);
