// ============================================================
// auth.ts — cron-invocation authorization check (Task #170)
// ============================================================
// Supabase Edge Functions are public HTTPS endpoints by default. Without
// this check, anyone with the function's URL could trigger unlimited sends,
// drain the APNs/FCM quota, or spam every registered user. The matching
// pg_cron migration (20260808000001_push_dispatch_cron.sql) sends this exact
// secret as the Authorization header on every scheduled invocation.
// ============================================================
// DEPENDS ON: nothing
// USED BY: index.ts (the Deno entrypoint)
// ============================================================

/** Constant-time string comparison — avoids leaking the secret's length/content via response-timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * `cronSecret` is `undefined` when the CRON_SECRET env var was never set —
 * an unconfigured function must fail closed (reject every request), not
 * fall open just because there's nothing to compare against.
 */
export function isAuthorizedCronRequest(authHeader: string | null, cronSecret: string | undefined): boolean {
  if (!cronSecret) return false;
  return timingSafeEqual(authHeader ?? "", `Bearer ${cronSecret}`);
}
