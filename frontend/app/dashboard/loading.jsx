export default function DashboardLoading() {
  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>

      {/* Grid cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main content box skeleton */}
      <div className="rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-6 shadow-sm min-h-[360px] space-y-4">
        <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-px bg-slate-100 dark:bg-slate-800/80 w-full" />
        <div className="space-y-3 pt-2">
          <div className="h-12 w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl" />
          <div className="h-12 w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl" />
          <div className="h-12 w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl" />
          <div className="h-12 w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
