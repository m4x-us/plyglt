"use client";

// ===========================================
// AUTH SESSION LISTENER COMPONENT
// ===========================================
// Invisible component whose static `import` of store/authStore.ts forces
// that module to load on every route, not just /settings (where the sign-in
// UI lives). This app is a Next.js static export (next.config.ts's
// output:"export"), so each route ships its own JS bundle — a module
// imported only from a settings-only component never runs on any other
// page. That matters here specifically because authStore.ts's module-level
// side effect is what creates the Supabase client and subscribes to
// onAuthStateChange, which is what lets Supabase's detectSessionInUrl
// process an OAuth callback arriving in the URL. Without this mounted
// globally, a user who lands back on any page other than /settings after
// signing in gets no session at all — found via Task #516's live
// human-interactive test (2026-08-07). Calling useAuthStore() below also
// subscribes this component to future state changes, though it renders
// nothing either way — the import above is what does the actual work.
// ===========================================
// DEPENDS ON: @/store/authStore
// USED BY: app/layout.tsx
// ===========================================

import { useAuthStore } from "@/store/authStore";

export function AuthSessionListener() {
  useAuthStore();
  return null;
}
