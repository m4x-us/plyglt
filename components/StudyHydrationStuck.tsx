// ============================================================
// StudyHydrationStuck.tsx — retry screen shown when real hydration never
// resolves within useHydrationStuck's bounded window (Task #644)
// ============================================================
export default function StudyHydrationStuck() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-gray-500 text-sm px-4">
      <p>Couldn&apos;t load your progress.</p>
      <button onClick={() => window.location.reload()} className="text-yellow-600 hover:text-yellow-400 font-medium transition-colors">
        Retry
      </button>
    </div>
  );
}
