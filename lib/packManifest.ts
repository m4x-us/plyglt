// ============================================================
// PACK MANIFEST — fetches, verifies, and shape-validates public/packs/manifest.json
// ============================================================
// fetchManifest and its supporting shape validation, extracted from lib/packLoader.ts
// under Rule 1 (Task #463) — self-contained: no dependency on packLoader.ts's in-flight
// base-load registry or any other module-private state there.
// ============================================================
// DEPENDS ON: @/lib/packTypes (Manifest type), @/lib/fetchWithTimeout (bounded fetch — Task #464/#465)
// USED BY: lib/packLoader.ts ONLY — re-exports fetchManifest for its own callers
//          (hooks/useLangPack.ts via lib/packResolver.ts). Import fetchManifest from
//          lib/packLoader.ts, not this module, to keep one canonical import path.
// ============================================================

import type { Manifest } from "@/lib/packTypes";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

function manifestUrl(): string {
  return `/packs/manifest.json`;
}

// Multiple useLangPack instances mount concurrently in production (InterruptHandler in the
// global layout plus page components) and each triggers a manifest fetch on mount — share
// one in-flight request so N instances cost one network round-trip, mirroring the base-pack
// dedup in lib/packLoader.ts. Cleared on settle so a later refresh still refetches. (#378 WorldClass V2)
let inFlightManifest: Promise<Manifest | null> | null = null;

// A sha256 digest, hex-encoded, is always exactly 64 hex characters (sha256Hex in
// lib/utils.ts produces lowercase; accept either case — a manifest entry's exact casing
// is not this codebase's to dictate, only well-formedness is). #431: typeof "string" alone
// let a manifest entry with sha256:"" or sha256:"x" pass shape validation, degrading to
// "checksum never matches" (every download rejected as checksum_mismatch, indistinguishable
// from real corruption) instead of a clear, distinct rejection at the validation boundary.
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Structural gate for the manifest (#379): a CDN can return an HTTP-200 error envelope
 * (valid JSON, wrong shape) that the former bare `as Manifest` cast waved through — loadPack
 * then saw packs === undefined and silently skipped sha256 verification for the session.
 * Checks exactly the fields loadPack consumes: a packs object whose every entry carries a
 * string version and a well-formed 64-char hex sha256 digest (#431). Anything else is "no
 * manifest" — same degradation as a network failure, but LOGGED (Rule 8).
 */
function isValidManifestShape(raw: unknown): raw is Manifest {
  if (typeof raw !== "object" || raw === null) return false;
  const packs = (raw as { packs?: unknown }).packs;
  // Arrays satisfy typeof "object", and .every() is vacuously true on empty collections —
  // either would pass a truncated/wrong body and reproduce the exact silent-skip failure
  // this gate exists to close. The real exporter always emits ≥1 entry, so an empty packs
  // record is treated as malformed, not as a valid empty manifest. (#379 spot check DSC-2)
  if (typeof packs !== "object" || packs === null || Array.isArray(packs)) return false;
  if (Object.keys(packs).length === 0) return false;
  return Object.values(packs).every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { version?: unknown }).version === "string" &&
      typeof (entry as { sha256?: unknown }).sha256 === "string" &&
      SHA256_HEX_PATTERN.test((entry as { sha256: string }).sha256)
  );
}

/**
 * Fetches, parses, and shape-validates the pack manifest. Concurrent callers share one
 * request. Returns null when the network is unavailable, the server errors, or the body is
 * not a structurally valid manifest — every null path logs a ref ID (a silent null makes
 * loadPack skip SHA-256 verification, which is a security downgrade).
 */
export function fetchManifest(): Promise<Manifest | null> {
  if (inFlightManifest) return inFlightManifest;
  const request = (async (): Promise<Manifest | null> => {
    // #445: bounded so a hung TCP connection can't leave inFlightManifest permanently
    // pending — every concurrent AND future caller would otherwise piggyback on the dead
    // promise for the rest of the process's life. Task #464/#465: fetchWithTimeout owns
    // the AbortController + independent Promise.race backstop and the shared
    // FETCH_TIMEOUT_MS constant — see lib/fetchWithTimeout.ts. A timeout (abort-honored
    // or backstop-forced) surfaces as a rejected fetch, indistinguishable from a real
    // network error here, and is handled identically by the existing catch block below.
    try {
      const res = await fetchWithTimeout(manifestUrl(), { cache: "no-store" });
      if (!res.ok) {
        // #379: this branch previously returned null with zero logging, unlike the catch
        // below — an operator had no signal that every fresh download was unverified.
        console.error(`[MANIFEST_FETCH_HTTP-${res.status}-${Date.now()}] manifest request failed — loads consuming this result fall back to unverified downloads`);
        return null;
      }
      const raw: unknown = await res.json();
      if (!isValidManifestShape(raw)) {
        console.error(`[MANIFEST_SHAPE_INVALID-${Date.now()}] manifest body parsed but failed structural validation — treating as no manifest; loads consuming this result fall back to unverified downloads`);
        return null;
      }
      return raw;
    } catch (err) {
      // Log before returning null — a silent network error here causes loadPack to skip
      // SHA-256 verification, which is a silent security downgrade. Ref ID aids diagnosis.
      console.error(`[MANIFEST_FETCH_FAIL-${Date.now()}]`, err);
      return null;
    }
  })();
  inFlightManifest = request;
  const release = () => { if (inFlightManifest === request) inFlightManifest = null; };
  void request.then(release, release);
  return request;
}
