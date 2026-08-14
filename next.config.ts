import type { NextConfig } from "next";

// Feature flags — set to "false" to disable:
// NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE — proactive desktop interrupt sessions
// NEXT_PUBLIC_FLAGS_VACATION_MODE    — redistribute overdue cards on return
// NEXT_PUBLIC_FLAGS_ANALYTICS        — session timing and retention metrics

// Task #522 (real iOS Simulator run) found that Tauri's iOS webview loads the dev server's
// HTML through its own internal `tauri://localhost` scheme handler rather than navigating the
// document itself to the external dev server origin — desktop platforms navigate directly to
// devUrl and never hit this. Every relative-URL script/chunk reference (and the HMR websocket,
// which Next.js derives from the same asset-prefix logic — see
// https://github.com/vercel/next.js/pull/30632, "Account for assetPrefix when initializing HMR
// connection") then resolved against the wrong origin and silently failed to load, leaving a
// blank screen. An absolute assetPrefix fixes both: every asset/script tag and the HMR
// websocket URL get built with the real dev server's origin regardless of what origin the
// document itself was loaded under. Dev-only — the production static export (output: "export",
// used by `tauri build`) is unaffected; on desktop this is a no-op since the document's own
// origin already matches devUrl. Port 3050 matches tauri.conf.json's devUrl/beforeDevCommand.
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "export",
  // Tauri serves files from the local filesystem; trailing slashes produce
  // index.html files that work correctly with file:// and tauri:// protocols.
  trailingSlash: true,
  ...(isDev ? { assetPrefix: "http://localhost:3050" } : {}),
};

export default nextConfig;
