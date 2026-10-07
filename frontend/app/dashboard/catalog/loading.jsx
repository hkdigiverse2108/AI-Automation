export default function Loading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-60 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="flex gap-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-9 w-24 bg-slate-100 dark:bg-slate-800/40 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-4 shadow-sm">
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded mb-3" />
            <div className="h-7 w-14 bg-slate-200 dark:bg-slate-700 rounded-md" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
            <div className="h-8 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
