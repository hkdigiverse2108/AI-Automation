export default function Loading() {
  return (
    <div className="flex h-full animate-pulse">
      {/* Conversation list sidebar */}
      <div className="w-80 border-r border-wa-border dark:border-wa-dark-border shrink-0 flex flex-col">
        <div className="p-3 border-b border-wa-border dark:border-wa-dark-border">
          <div className="h-9 bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
        </div>
        <div className="p-2 space-y-1 flex-1">
          {[1,2,3,4,5,6,7,8,9,10].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
              <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-10 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
                <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Empty chat area */}
      <div className="flex-1 flex items-center justify-center bg-wa-bg dark:bg-wa-dark-bg">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto" />
          <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
