import { describe, it, expect } from "vitest";
import { assertNotFutureVersion } from "@/lib/storeVersionGuard";

describe("assertNotFutureVersion", () => {
  it("throws with a message naming both versions when storedVersion is newer than currentVersion", () => {
    expect(() => assertNotFutureVersion("Widget", 5, 3)).toThrow(
      "Widget store version 5 is newer than this app build understands (current 3) — refusing to apply unmigrated data"
    );
  });

  it("does not throw when storedVersion equals currentVersion", () => {
    expect(() => assertNotFutureVersion("Widget", 3, 3)).not.toThrow();
  });

  it("does not throw when storedVersion is older than currentVersion", () => {
    expect(() => assertNotFutureVersion("Widget", 1, 3)).not.toThrow();
  });
});
