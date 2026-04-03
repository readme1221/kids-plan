export default function DayLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-gray-700/50 rounded" />
        <div className="h-8 w-20 bg-gray-700/50 rounded" />
      </div>
      <div className="h-16 bg-gray-700/30 rounded-xl" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-16 bg-gray-700/40 rounded" />
          <div className="h-14 bg-gray-700/30 rounded-xl" />
          <div className="h-14 bg-gray-700/30 rounded-xl" />
        </div>
      ))}
    </div>
  );
}
