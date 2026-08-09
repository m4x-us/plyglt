// tests/utils.test.ts — Known-answer tests for lib/utils.ts pure helpers.
// sha256Hex uses the Web Crypto API (globalThis.crypto.subtle in Node.js 20+).
// No stub needed — the real Node.js webcrypto is available in the test environment.
// The pinned hex value below was verified against Node.js createHash and webcrypto.subtle.

import { describe, it, expect } from "vitest";
import { sha256Hex, packUrl, localDateStr, formatRelativeTime } from "@/lib/utils";

// SHA-256("abc") as computed by this runtime (Node.js webcrypto.subtle + createHash agree).
// Pinned so any change to the hex-encoding logic in sha256Hex is immediately caught.
const SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("sha256Hex", () => {
  it('returns the pinned digest for "abc"', async () => {
    expect(await sha256Hex("abc")).toBe(SHA256_ABC);
  });

  it("returns a 64-character lowercase hex string", async () => {
    const result = await sha256Hex("hello world");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("packUrl", () => {
  it("returns /packs/{lang}.json", () => {
    expect(packUrl("it")).toBe("/packs/it.json");
    expect(packUrl("es")).toBe("/packs/es.json");
  });
});

describe("localDateStr", () => {
  it("returns YYYY-MM-DD for a known date", () => {
    expect(localDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatRelativeTime", () => {
  const NOW = 1_700_000_000_000;

  it("returns 'just now' for a delta under 1 minute", () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("just now");
  });

  it("returns 'just now' for a delta of exactly 0ms", () => {
    expect(formatRelativeTime(NOW, NOW)).toBe("just now");
  });

  it("returns '1m ago' at exactly the 1-minute boundary", () => {
    expect(formatRelativeTime(NOW - 60_000, NOW)).toBe("1m ago");
  });

  it("returns '59m ago' just under the 1-hour boundary", () => {
    expect(formatRelativeTime(NOW - 59 * 60_000, NOW)).toBe("59m ago");
  });

  it("returns '1h ago' at exactly the 1-hour boundary", () => {
    expect(formatRelativeTime(NOW - 60 * 60_000, NOW)).toBe("1h ago");
  });

  it("returns '23h ago' just under the 1-day boundary", () => {
    expect(formatRelativeTime(NOW - 23 * 60 * 60_000, NOW)).toBe("23h ago");
  });

  it("returns '1d ago' at exactly the 1-day boundary", () => {
    expect(formatRelativeTime(NOW - 24 * 60 * 60_000, NOW)).toBe("1d ago");
  });

  it("returns '5d ago' for a 5-day-old timestamp", () => {
    expect(formatRelativeTime(NOW - 5 * 24 * 60 * 60_000, NOW)).toBe("5d ago");
  });

  it("treats a future timestamp (clock skew) as 'just now' rather than a negative duration", () => {
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe("just now");
  });

  it("defaults nowMs to the real current time when omitted", () => {
    const oneMinuteAgo = Date.now() - 61_000;
    expect(formatRelativeTime(oneMinuteAgo)).toBe("1m ago");
  });

  it("treats a non-finite pastMs (NaN/Infinity) as 'just now' rather than rendering 'NaNd ago'", () => {
    expect(formatRelativeTime(NaN, NOW)).toBe("just now");
    expect(formatRelativeTime(Infinity, NOW)).toBe("just now");
  });
});
