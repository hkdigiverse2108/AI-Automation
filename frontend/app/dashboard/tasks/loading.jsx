export default function Loading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
      <div className="flex gap-2 border-b border-wa-border dark:border-wa-dark-border pb-2">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-9 w-24 bg-slate-100 dark:bg-slate-800/40 rounded-lg" />
        ))}
      </div>
      <div className="rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border shadow-sm p-4 space-y-3">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20">
            <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
            <div className="h-6 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
