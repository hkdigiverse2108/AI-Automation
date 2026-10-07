export default function Loading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-60 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-4 shadow-sm">
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded mb-3" />
            <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded-md" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border shadow-sm p-4 space-y-3">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
