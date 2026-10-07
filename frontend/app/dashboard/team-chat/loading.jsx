export default function Loading() {
  return (
    <div className="flex h-full animate-pulse">
      {/* Channels sidebar */}
      <div className="w-72 border-r border-wa-border dark:border-wa-dark-border shrink-0 flex flex-col">
        <div className="p-4 border-b border-wa-border dark:border-wa-dark-border">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
          <div className="h-9 bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
        </div>
        <div className="p-2 space-y-1 flex-1">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Empty chat area */}
      <div className="flex-1 flex items-center justify-center bg-wa-bg dark:bg-wa-dark-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto" />
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
          <div className="h-4 w-56 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
