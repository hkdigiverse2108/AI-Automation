export default function Loading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>
      <div className="flex gap-2 border-b border-wa-border dark:border-wa-dark-border pb-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-9 w-28 bg-slate-100 dark:bg-slate-800/40 rounded-lg" />
        ))}
      </div>
      <div className="rounded-2xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-6 shadow-sm space-y-6">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
          </div>
        ))}
        <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl mt-4" />
      </div>
    </div>
  );
}
