export default function Loading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
      <div className="rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border shadow-sm overflow-hidden" style={{ minHeight: '500px' }}>
        {/* Toolbar skeleton */}
        <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex gap-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-9 w-24 bg-slate-100 dark:bg-slate-800/40 rounded-lg" />
          ))}
        </div>
        {/* Canvas area */}
        <div className="p-8 flex items-center justify-center" style={{ minHeight: '400px' }}>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto" />
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
            <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
