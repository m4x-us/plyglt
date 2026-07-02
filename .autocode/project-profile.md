# Project Profile
Runtime: Node.js 22 LTS / Rust (Tauri 2)
Framework: Next.js 16.2.9 App Router + Tauri 2 / Zustand 5
Deployment: Desktop app (macOS/Windows/Linux via Tauri) + static web build
Key trust boundaries: Tauri IPC responses (lib/entitlement.ts:activateLicense, validateLicense, deactivateLicense); pack network fetch (lib/packLoader.ts:fetchManifest, loadPack); user backup file JSON parse (hooks/useExportImport.ts:readFile); Zustand persist deserialization (store/srsStore.ts, store/entitlementStore.ts, store/settingsStore.ts via createPlatformStorage); build-time env var inlining (lib/featureFlags.ts:getFeatureFlags)
Detection date: 2026-07-01
