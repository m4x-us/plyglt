// ============================================================
// SyncSignIn.tsx — Sign in with Apple/Google to enable sync (Task #516)
// ============================================================
// Renders inside app/settings/page.tsx's "Sync" Section. Reads/writes
// store/authStore.ts only — no direct Supabase import (single-gateway rule,
// see lib/supabaseClient.ts's own header comment).
"use client";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";

export function SyncSignIn() {
  const { status, email, signInWithApple, signInWithGoogle, signOut } = useAuthStore();
  const [pendingProvider, setPendingProvider] = useState<"apple" | "google" | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(provider: "apple" | "google") {
    setError(null);
    setPendingProvider(provider);
    const result = provider === "apple" ? await signInWithApple() : await signInWithGoogle();
    setPendingProvider(null);
    if (!result.ok) setError(result.error ?? "Sign in failed.");
  }

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    if (!result.ok) setError(result.error ?? "Sign out failed.");
  }

  if (status === "loading") {
    return <p className="text-xs text-gray-500">Checking sign-in status…</p>;
  }

  if (status === "signed-in") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white">{email ?? "Account connected"}</div>
          <span className="text-xs bg-green-900 text-green-400 rounded-full px-2.5 py-0.5 font-semibold">Signed in</span>
        </div>
        <button onClick={handleSignOut} disabled={signingOut} className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 transition-colors px-2 py-1.5">Sign out</button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Sign in to sync review progress across devices.</p>
      <div className="flex gap-2">
        <button
          onClick={() => handleSignIn("apple")}
          disabled={pendingProvider !== null}
          className="text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white border border-gray-700 rounded-lg px-4 py-1.5 transition-colors"
        >
          {pendingProvider === "apple" ? "…" : "Sign in with Apple"}
        </button>
        <button
          onClick={() => handleSignIn("google")}
          disabled={pendingProvider !== null}
          className="text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white border border-gray-700 rounded-lg px-4 py-1.5 transition-colors"
        >
          {pendingProvider === "google" ? "…" : "Sign in with Google"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
