// ============================================================
// FETCH WITH TIMEOUT — bounded fetch() with an independent backstop
// ============================================================
// Task #445 bounded every fetch() call in the pack-loading subsystem with an
// AbortController + setTimeout, but relied entirely on fetch() honoring the abort
// signal — a hypothetical non-conformant fetch implementation that ignores it would
// still hang forever, reproducing the original #445 bug under a narrower trigger
// condition (Task #464). Task #465 additionally found FETCH_TIMEOUT_MS declared
// independently in the 3 call sites that needed it — a fresh "parallel constant"
// violation (AGENTS.md). This module fixes both at once: one shared implementation,
// reading the one shared constant (lib/constants.ts), used by all 3 sites.
//
// The backstop: Promise.race against an independent setTimeout that rejects on its own
// timer, with no dependency on fetch() ever settling or ever checking its abort signal.
// The AbortController signal is still passed to fetch() — for a conformant
// implementation it cancels the underlying request (resource cleanup) — but this
// function's own bounded-completion guarantee no longer depends on that behavior.
// ============================================================
// DEPENDS ON: @/lib/constants (FETCH_TIMEOUT_MS)
// USED BY: lib/basePackLoader.ts, lib/specialtyPackLoader.ts, lib/packManifest.ts —
//          the 3 fetch() call sites in the pack-loading subsystem.
// ============================================================

import { FETCH_TIMEOUT_MS } from "@/lib/constants";

/**
 * fetch() bounded by FETCH_TIMEOUT_MS via two independent mechanisms: an
 * AbortController signal (cancels the underlying request for a conformant fetch
 * implementation) AND a Promise.race against a plain setTimeout (settles this
 * function's own promise even if fetch() ignores the abort signal entirely, or never
 * settles at all). Callers get exactly the same Response-or-throw contract as a bare
 * fetch() call — the timeout backstop surfaces as a rejection, handled by the same
 * catch block every existing call site already has for network errors.
 */
export async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const abortController = new AbortController();
  const abortTimeoutId = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
  let backstopTimeoutId: ReturnType<typeof setTimeout>;
  // A distinct timer from the abort timer above (not the same setTimeout reused) — the
  // whole point is independence: this timer's rejection does not depend on abort()
  // having any effect on the fetch() promise it is racing against.
  const backstop = new Promise<never>((_, reject) => {
    backstopTimeoutId = setTimeout(() => {
      reject(new Error(
        `[ERR-FETCH-TIMEOUT-BACKSTOP] fetch did not settle within ${FETCH_TIMEOUT_MS}ms and did not honor the abort signal: ${url}`
      ));
    }, FETCH_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      fetch(url, { ...init, signal: abortController.signal }),
      backstop,
    ]);
  } finally {
    clearTimeout(abortTimeoutId);
    clearTimeout(backstopTimeoutId!);
  }
}
