// ============================================================
// utils.ts — Shared pure utilities (no React, no Zustand)
// ============================================================

// Shape-only regex for YYYY-MM-DD date strings. Exported so that lib/introduction.ts and
// store/migrations.ts share a single canonical copy — there must never be two DATE_RE definitions.
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns true if str is both shape-valid (YYYY-MM-DD) AND calendar-valid.
// Two-pass guard: isNaN catches month-overflow ("2026-13-45" → Invalid Date).
// Round-trip check catches day-of-month rollover: "2026-02-30" passes isNaN because
// JS Date normalises it to March 2nd; re-formatting the parsed UTC date back to
// YYYY-MM-DD exposes the mismatch ("2026-03-02" !== "2026-02-30" → false).
// Uses UTC methods because ISO-format date-only strings are parsed as UTC midnight.
export function isCalendarValidDate(str: string): boolean {
  if (!DATE_RE.test(str)) return false;
  const ms = new Date(str).getTime();
  if (isNaN(ms)) return false;
  const d = new Date(ms);
  const reFormatted = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return reFormatted === str;
}

// Returns the current local date as an ISO YYYY-MM-DD string.
// Uses local time, not UTC, so the string matches the user's calendar day.
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Returns the SHA-256 hex digest of a UTF-8 string via the Web Crypto API.
// Security-critical: used by packLoader and specialtyPackLoader to verify
// pack integrity before serving or caching. Single canonical copy — never duplicate.
export async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Returns the URL for a pack JSON file given its language code.
// lang must be validated against ALL_PACK_CODES by the caller before use.
export function packUrl(lang: string): string {
  return `/packs/${lang}.json`;
}

// Formats a past unix-ms timestamp as a short relative-time string ("just now",
// "3m ago", "2h ago", "5d ago"). Task #520: used by components/SyncSignIn.tsx's
// "last synced" line. Deliberately coarser than the day-granularity framing
// app/stats/page.tsx uses for "last seen Nd ago" — a sync that just ran needs
// to visibly read as recent (BRAND.md: never make the user feel behind), and
// "0d ago" for anything under 24h would read as stale when it isn't.
// A future timestamp (clock skew) is treated as "just now" rather than
// producing a nonsensical negative duration. A non-finite pastMs (NaN/Infinity)
// is treated the same way — store/syncMigrations.ts's migration already rejects
// these before they reach persisted state, but this function is a shared utility
// callable from anywhere, so it does not rely solely on that upstream guard.
export function formatRelativeTime(pastMs: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(pastMs)) return "just now";
  const deltaMs = Math.max(0, nowMs - pastMs);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
