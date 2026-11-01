'use client';
import { CreditCard, AlertTriangle, Zap, Headphones } from 'lucide-react';
import Link from 'next/link';
import { formatDateOnly } from '../lib/utils';

export default function SubscriptionExpiredGate({ expiryDate, isPending = false }) {
  const formatted = expiryDate ? formatDateOnly(expiryDate) : null;
  const isNewAccount = isPending || !formatted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        {isNewAccount ? (
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center ring-4 ring-emerald-500/20 animate-pulse">
            <Zap className="w-10 h-10 text-emerald-400" />
          </div>
        ) : (
          <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center ring-4 ring-red-500/20 animate-pulse">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
        )}

        {/* Title & Subtitle */}
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            {isNewAccount ? 'Account Activation Required' : 'Subscription Expired'}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isNewAccount
              ? 'Please select a subscription plan to activate all WhatsApp marketing features.'
              : <>Your subscription expired on <strong className="text-red-400">{formatted}</strong></>
            }
          </p>
        </div>

        {/* Features list */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-left space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed font-medium">
            {isNewAccount ? 'Activate your account to unlock:' : 'All platform features have been disabled, including:'}
          </p>
          <ul className="text-sm text-slate-400 space-y-1.5 pl-1">
            <li className="flex items-center gap-2">
              <span className={isNewAccount ? 'text-emerald-400' : 'text-red-400'}>{isNewAccount ? '✓' : '✕'}</span>
              WhatsApp Official & Unofficial Messaging
            </li>
            <li className="flex items-center gap-2">
              <span className={isNewAccount ? 'text-emerald-400' : 'text-red-400'}>{isNewAccount ? '✓' : '✕'}</span>
              Automated Broadcast Campaigns
            </li>
            <li className="flex items-center gap-2">
              <span className={isNewAccount ? 'text-emerald-400' : 'text-red-400'}>{isNewAccount ? '✓' : '✕'}</span>
              AI & Keyword Chatbot Builder
            </li>
            <li className="flex items-center gap-2">
              <span className={isNewAccount ? 'text-emerald-400' : 'text-red-400'}>{isNewAccount ? '✓' : '✕'}</span>
              Contacts, Leads & Groups Management
            </li>
            <li className="flex items-center gap-2">
              <span className={isNewAccount ? 'text-emerald-400' : 'text-red-400'}>{isNewAccount ? '✓' : '✕'}</span>
              Meta Cloud API & Multi-agent Inbox
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/dashboard/subscription"
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-wa-green hover:bg-wa-green-hover text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30 text-sm"
          >
            <CreditCard className="w-5 h-5" />
            {isNewAccount ? 'Choose a Plan & Activate' : 'Renew Now'}
          </Link>
          <a
            href="mailto:support@hkautomation.com"
            className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold rounded-xl transition-all border border-white/10 text-sm"
          >
            <Headphones className="w-4 h-4" /> Contact Support
          </a>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          {isNewAccount
            ? 'Instant online activation via Razorpay — zero waiting time.'
            : 'Renew your plan to instantly restore all platform features.'
          }
        </p>
      </div>
    </div>
  );
}
