# Project Profile
Runtime: Node.js 22 LTS / Rust (Tauri 2)
Framework: Next.js 16 App Router / Tauri 2 / Zustand 5
Deployment: Desktop app (Mac/Windows/Linux via Tauri) + web layer
Key trust boundaries: Tauri IPC (ls_activate_license/ls_validate_license/ls_deactivate_license in lib/entitlement.ts), network fetch (lib/packLoader.ts fetchManifest + loadPack), Zustand persist deserialization (store/srsStore.ts + store/entitlementStore.ts via createPlatformStorage), user file upload JSON parse (app/settings/page.tsx handleImportFile)
Detection date: 2026-06-26
