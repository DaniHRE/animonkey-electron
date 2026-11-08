export function LoadingGrid() {
  return (
    <div className="grid grid-cols-6 gap-x-5 gap-y-8">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-[0.71] rounded-xl bg-white/[0.055]" />
          <div className="mt-3 h-3 w-4/5 rounded bg-white/[0.055]" />
          <div className="mt-2 h-2.5 w-2/5 rounded bg-white/[0.035]" />
        </div>
      ))}
    </div>
  );
}
