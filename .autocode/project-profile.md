# Project Profile
Runtime: Node.js (TypeScript) + Rust (Tauri backend)
Framework: Next.js 16 (App Router) + Tauri 2
Deployment: Desktop app (macOS/Windows/Linux via Tauri) + static web export
Key trust boundaries: Tauri IPC gateway (lib/tauri.ts), persisted Zustand store hydration (lib/storage.ts), SHA-256-verified network pack fetch (lib/packLoader.ts), third-party licensing API via IPC, CI content-validation pipeline (scripts/*.ts)
Detection date: 2026-08-06
