export default function StudyResumePrompt({
  resumePos,
  resumeTotal,
  onDecline,
  onAccept,
}: {
  resumePos: number;
  resumeTotal: number;
  onDecline: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-4xl mb-4">↩</div>
      <h1 className="text-2xl font-bold text-white mb-2">Resume where you left off?</h1>
      <p className="text-gray-500 mb-8">
        Card {resumePos + 1} of {resumeTotal} — session still in progress
      </p>
      <div className="flex gap-3">
        <button
          onClick={onDecline}
          className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Start over
        </button>
        <button
          onClick={onAccept}
          className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Resume →
        </button>
      </div>
    </div>
  );
}
