// StatsProGate.tsx — Upgrade prompt shown on app/stats/page.tsx when the user does not have
// Pro access (analytics feature flag off or licenseType !== "subscription"). Renders a centred
// message and a Home link. Receives no props — all content is static.
"use client";

import Link from "next/link";

export function StatsProGate() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-4xl mb-4">📊</div>
      <h1 className="text-xl font-bold text-white mb-2">Learning Stats</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">Detailed analytics are a Pro feature.</p>
      <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Home</Link>
    </div>
  );
}
