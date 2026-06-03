'use client';
import { CreditCard, AlertTriangle, Headphones } from 'lucide-react';
import Link from 'next/link';

export default function SubscriptionExpiredGate({ expiryDate }) {
  const formatted = expiryDate
    ? new Date(expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center ring-4 ring-red-500/20 animate-pulse">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl font-extrabold text-white">Subscription Expired</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Your subscription expired on <strong className="text-red-400">{formatted}</strong>
          </p>
        </div>

        {/* Message */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-left space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">
            All platform features have been disabled, including:
          </p>
          <ul className="text-sm text-slate-400 space-y-1.5 pl-1">
            <li className="flex items-center gap-2"><span className="text-red-400">✕</span> WhatsApp Messaging</li>
            <li className="flex items-center gap-2"><span className="text-red-400">✕</span> Bulk Campaigns</li>
            <li className="flex items-center gap-2"><span className="text-red-400">✕</span> Auto-Reply Bots</li>
            <li className="flex items-center gap-2"><span className="text-red-400">✕</span> Contacts & Analytics</li>
            <li className="flex items-center gap-2"><span className="text-red-400">✕</span> Meta Integration</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/dashboard/subscription"
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-wa-green hover:bg-wa-green-hover text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30 text-sm"
          >
            <CreditCard className="w-5 h-5" /> Renew Now
          </Link>
          <a
            href="mailto:support@ajnabh.com"
            className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold rounded-xl transition-all border border-white/10 text-sm"
          >
            <Headphones className="w-4 h-4" /> Contact Support
          </a>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Renew your plan to instantly restore all platform features.
        </p>
      </div>
    </div>
  );
}
