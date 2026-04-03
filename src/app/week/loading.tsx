export default function WeekLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 bg-[#1C2541]/50 rounded" />
        <div className="h-8 w-16 bg-[#1C2541]/50 rounded" />
      </div>
      <div className="h-16 bg-[#1C2541]/30 rounded-xl" />
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex-1 h-12 bg-[#1C2541]/30 rounded-lg" />
        ))}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 bg-[#1C2541]/30 rounded-xl" />
      ))}
    </div>
  );
}
