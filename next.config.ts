import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Tauri serves files from the local filesystem; trailing slashes produce
  // index.html files that work correctly with file:// and tauri:// protocols.
  trailingSlash: true,
};

export default nextConfig;
