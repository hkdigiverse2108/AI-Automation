export default function Loading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-5 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-px bg-wa-border dark:bg-wa-dark-border" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-slate-50 dark:bg-slate-800/20 p-4 space-y-2">
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl bg-slate-50 dark:bg-slate-800/20 p-4 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-56 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
