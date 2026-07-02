// ============================================================
// utils.ts — Shared pure utilities (no React, no Zustand)
// ============================================================

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
