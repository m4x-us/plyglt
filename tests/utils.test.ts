// tests/utils.test.ts — Known-answer tests for lib/utils.ts pure helpers.
// sha256Hex uses the Web Crypto API (globalThis.crypto.subtle in Node.js 20+).
// No stub needed — the real Node.js webcrypto is available in the test environment.
// The pinned hex value below was verified against Node.js createHash and webcrypto.subtle.

import { describe, it, expect } from "vitest";
import { sha256Hex, packUrl, localDateStr } from "@/lib/utils";

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
