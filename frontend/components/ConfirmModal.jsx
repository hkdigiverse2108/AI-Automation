'use client';
import { useConfirmStore } from '../lib/store';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal() {
  const { isOpen, message, title, resolve } = useConfirmStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop with soft blur */}
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300 animate-fade-in"
        onClick={() => resolve(false)}
      />

      {/* Modal Card with premium dark/light styling and scale animation */}
      <div className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl transition-all duration-300 animate-zoom-in backdrop-blur-xl">
        
        {/* Header Icon & Close button */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            onClick={() => resolve(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
          {title}
        </h3>

        {/* Message */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => resolve(false)}
            className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => resolve(true)}
            className="px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/15 hover:scale-[1.02] active:scale-[0.98]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
