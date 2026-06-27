export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">{title}</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-4">
        {children}
      </div>
    </div>
  );
}
