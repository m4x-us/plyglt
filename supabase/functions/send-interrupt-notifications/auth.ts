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

// Fixed comparison length for the padded constant-time compare below — comfortably
// longer than any real "Bearer <CRON_SECRET>" value this function will ever see.
const COMPARISON_LENGTH = 256;

/**
 * Constant-time string comparison. Pads both inputs to a fixed length and always
 * walks the full fixed length, so execution time never varies with either input's
 * real length — the previous `a.length !== b.length` early return leaked the
 * correct secret's length via response timing to a remote prober (debt.md,
 * 2026-08-08). The final `a.length ^ b.length` XOR (itself an O(1), branch-free
 * operation — it adds no timing signal) still rejects a length mismatch; without
 * it, two inputs differing only in the padded region (e.g. an over-length probe
 * sharing the first COMPARISON_LENGTH characters with the real secret) would
 * incorrectly compare equal.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const paddedA = a.padEnd(COMPARISON_LENGTH, "\0");
  const paddedB = b.padEnd(COMPARISON_LENGTH, "\0");
  let diff = 0;
  for (let i = 0; i < COMPARISON_LENGTH; i++) diff |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
  diff |= a.length ^ b.length;
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
