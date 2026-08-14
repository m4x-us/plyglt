import type { NextConfig } from "next";

// Feature flags — set to "false" to disable:
// NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE — proactive desktop interrupt sessions
// NEXT_PUBLIC_FLAGS_VACATION_MODE    — redistribute overdue cards on return
// NEXT_PUBLIC_FLAGS_ANALYTICS        — session timing and retention metrics

// iOS live dev (Task #522): Tauri only routes the webview through its internal
// tauri://localhost scheme-handler proxy when devUrl's host is literally "localhost" or an
// IP address (tauri source: manager/webview.rs `is_local_network_url`) — the proxy origin
// is what made asset loading from a `tauri ios dev` webview fail (WebKit mixed content
// against plain HTTP; Next.js's cross-origin dev-resource block against HTTPS, which 403s
// any absolute-URL asset fetch from a tauri:// document because WKWebView sends no Referer
// from custom-scheme origins, so allowedDevOrigins can never match — see
// next/dist/esm/server/lib/router-utils/block-cross-site-dev.js). The fix avoids the proxy
// entirely: src-tauri/tauri.ios.conf.json points devUrl at https://plyglt.localhost:3050
// (macOS resolves *.localhost to loopback natively; the non-"localhost" hostname makes
// Tauri navigate the webview DIRECTLY to the dev server, exactly like desktop, served over
// HTTPS by `npm run dev:https`'s mkcert certificate — see that script in package.json).
// The document origin then IS the dev server origin, so relative asset URLs and the HMR
// websocket are all same-origin and no assetPrefix is needed on any platform. Desktop
// `tauri dev` navigates directly to its plain-HTTP devUrl and is likewise same-origin.
// The production static export (output: "export", used by `tauri build`) never involves a
// dev server at all.
const nextConfig: NextConfig = {
  output: "export",
  // Tauri serves files from the local filesystem; trailing slashes produce
  // index.html files that work correctly with file:// and tauri:// protocols.
  trailingSlash: true,
};

export default nextConfig;
