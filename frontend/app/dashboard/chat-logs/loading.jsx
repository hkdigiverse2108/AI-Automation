export default function Loading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border shadow-sm">
        <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex gap-3">
          <div className="h-9 flex-1 max-w-xs bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
          <div className="h-9 w-28 bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
        </div>
        <div className="p-4 space-y-2">
          {[1,2,3,4,5,6,7,8,9,10].map(i => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/20">
              <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 flex-1 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
