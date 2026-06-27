import type { NextConfig } from "next";

// Feature flags — set to "false" to disable:
// NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE — proactive desktop interrupt sessions
// NEXT_PUBLIC_FLAGS_VACATION_MODE    — redistribute overdue cards on return
// NEXT_PUBLIC_FLAGS_ANALYTICS        — session timing and retention metrics

const nextConfig: NextConfig = {
  output: "export",
  // Tauri serves files from the local filesystem; trailing slashes produce
  // index.html files that work correctly with file:// and tauri:// protocols.
  trailingSlash: true,
};

export default nextConfig;
