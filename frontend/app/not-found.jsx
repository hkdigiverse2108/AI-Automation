'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, MessageSquare, ArrowLeft, Search, ShieldAlert, Sparkles } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b141a] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-emerald-500/20 selection:text-emerald-500">
      {/* Top Brand Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
         
        
        </div>
       
      </header>

      {/* Main Content Card */}
      <main className="max-w-xl w-full mx-auto my-auto py-12 px-6 sm:px-10 bg-white dark:bg-[#111b21] rounded-3xl border border-slate-200/80 dark:border-white/5 shadow-2xl shadow-slate-200/50 dark:shadow-black/40 text-center relative overflow-hidden animate-fadeIn">
        {/* Decorative Background Glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 404 Visual Hero */}
        <div className="relative mb-6 inline-block">
          <div className="text-8xl sm:text-9xl mb-3 font-black font-mono tracking-tighter bg-gradient-to-br from-emerald-500 via-teal-400 to-emerald-600 bg-clip-text text-transparent select-none drop-shadow-sm">
            404
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-sm whitespace-nowrap flex items-center gap-1.5">
            <Search className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Page Not Found</span>
          </div>
        </div>

        {/* Heading & Context */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
          Lost in the Automation Flow?
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-md mx-auto">
          The link you followed may be broken, the address was mistyped, or the page has been moved to a new destination.
        </p>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex-1 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </Link>
         
          
        </div>

        {/* Back Button */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
          <button
            onClick={() => router.back()}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to previous screen</span>
          </button>
        </div>
      </main>

      
    </div>
  );
}

