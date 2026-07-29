// ============================================================
// tauriConfig.test.ts — Structural checks on src-tauri/tauri.conf.json
// ============================================================
// tauri.conf.json's `plugins` section is deserialized by Tauri core against
// each registered plugin's own config schema. A plugin with no config schema
// (tauri-plugin-autostart's init() takes no JSON-driven config at all — see
// src-tauri/src/lib.rs) expects nothing ("unit") under its name; providing an
// object there crashes the app on startup with a deserialization panic. This
// crash is NOT caught by tsc/vitest/lint/npm-build — it only surfaces when the
// compiled Tauri binary actually launches, which nothing in CI exercises
// (ci.yml runs on ubuntu-latest; the Tauri desktop binary is macOS/Windows/
// Linux-target only). Discovered 2026-07-29 by literally launching the app
// for the first time via `npm run tauri:dev` — it had been silently broken
// since the autostart feature was built (Batch 14).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf-8")
);

describe("tauri.conf.json — plugins section", () => {
  it("does not configure autostart via JSON (its config lives entirely in src-tauri/src/lib.rs's init() call)", () => {
    expect(config.plugins.autostart).toBeUndefined();
  });

  it("updater plugin has a real pubkey, not a placeholder", () => {
    expect(config.plugins.updater.pubkey).not.toBe("REPLACE_WITH_TAURI_SIGNING_PUBLIC_KEY");
    expect(typeof config.plugins.updater.pubkey).toBe("string");
    expect(config.plugins.updater.pubkey.length).toBeGreaterThan(0);
  });

  it("updater endpoint points to a real repo, not the REPLACE_WITH_REPO placeholder", () => {
    const endpoint = config.plugins.updater.endpoints[0];
    expect(endpoint).not.toContain("REPLACE_WITH_REPO");
    expect(endpoint).toBe("https://github.com/m4x-us/plyglt/releases/latest/download/latest.json");
  });
});
