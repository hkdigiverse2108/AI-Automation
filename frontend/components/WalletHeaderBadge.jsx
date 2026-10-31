'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '../lib/store';
import { CreditCard, Sparkles, AlertCircle, RefreshCw, Crown, ShoppingBag, IndianRupee, ArrowUpRight } from 'lucide-react';
import api from '../lib/api';

export default function WalletHeaderBadge() {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState(null);
  const [adminRevenue, setAdminRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;
    if (user.role === 'superadmin') {
      try {
        const res = await api.get('/subscription/admin/dashboard');
        if (res.data?.success) {
          const rev = res.data.data.totalRevenue ?? res.data.data.yearlyRevenue ?? 0;
          setAdminRevenue(rev);
        }
      } catch (err) {
        // Fail silently
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const res = await api.get('/subscription/current');
      if (res.data?.success) {
        setSubscription(res.data.data);
      }
    } catch (err) {
      // Fail silently if not logged in
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // SuperAdmin Header Badge - Shows Total Revenue Collection Balance
  if (user?.role === 'superadmin') {
    return (
      <Link
        href="/dashboard/admin?tab=subscriptions&sub=history"
        className="group relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-emerald-300/80 dark:border-emerald-800/60 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 text-emerald-800 dark:text-emerald-200 hover:shadow-md hover:shadow-emerald-900/10 hover:border-emerald-400 dark:hover:border-emerald-700 transition-all duration-300 select-none cursor-pointer overflow-hidden"
        title="Super Admin • Total Subscription Collections (Click to view Payment History)"
      >
        {/* Left Side: Rupee Coin */}
        <div className="w-5 h-5 rounded-lg bg-emerald-600 group-hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-all duration-300">
          <IndianRupee className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>

        {/* Right Side: Presentation Slide-Up Carousel (Hover me slide change hoti hai niche se uper) */}
        <div className="relative h-8 overflow-hidden flex flex-col justify-center min-w-[105px]">
          {/* Slide 1: Resting State (slides UP and OUT on hover) */}
          <div className="flex flex-col text-left transition-all duration-300 ease-out transform group-hover:-translate-y-8 group-hover:opacity-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 leading-none">
                Total Collections
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <span className="text-xs font-black tracking-tight text-emerald-950 dark:text-white leading-tight mt-0.5 font-mono">
              {loading ? (
                <RefreshCw className="w-3 h-3 animate-spin inline-block text-emerald-500" />
              ) : (
                `₹${(adminRevenue ?? 0).toLocaleString('en-IN')}`
              )}
            </span>
          </div>

          {/* Slide 2: Hover State (slides UP from BOTTOM into view) */}
          <div className="absolute inset-0 flex flex-col justify-center text-left transition-all duration-300 ease-out transform translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 leading-none">
                View History
              </span>
              <ArrowUpRight className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-black tracking-tight text-emerald-950 dark:text-white leading-tight mt-0.5 flex items-center gap-1">
              <span>Payment Feed</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">➔</span>
            </span>
          </div>
        </div>
      </Link>
    );
  }

  const status = subscription?.subscriptionStatus || 'trial';
  const remainingDays = subscription?.remainingDays ?? 0;
  const hasExpiryDate = Boolean(subscription?.subscriptionExpiryDate);
  const hasSubscription = Boolean(subscription?.subscription);

  // Distinguish between brand-new user (never bought a plan) vs expired user
  const isNewAccount = !hasExpiryDate && !hasSubscription && status !== 'active';
  const isExpired = !isNewAccount && (status === 'expired' || (hasExpiryDate && remainingDays === 0));
  const isExpiringSoon = !isNewAccount && !isExpired && (status === 'expiring_soon' || (remainingDays > 0 && remainingDays <= 5));
  const isTrial = !isNewAccount && !isExpired && status === 'trial' && remainingDays > 0;
  const isActive = !isNewAccount && !isExpired && !isExpiringSoon && !isTrial && (status === 'active' || remainingDays > 0);

  return (
    <Link
      href="/dashboard/subscription"
      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 select-none ${
        isNewAccount
          ? 'bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
          : isExpired
          ? 'bg-rose-50/80 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400'
          : isExpiringSoon
          ? 'bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400'
          : 'bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
      }`}
      title="Platform Subscription • Click to view or buy plan"
    >
      <div className="relative flex items-center justify-center">
        <div
          className={`w-5 h-5 rounded-lg flex items-center justify-center ${
            isNewAccount
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600'
              : isExpired
              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600'
              : isExpiringSoon
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600'
              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
          }`}
        >
          {isNewAccount ? (
            <ShoppingBag className="w-3.5 h-3.5" />
          ) : isExpired ? (
            <AlertCircle className="w-3.5 h-3.5" />
          ) : isExpiringSoon ? (
            <Sparkles className="w-3.5 h-3.5" />
          ) : (
            <CreditCard className="w-3.5 h-3.5" />
          )}
        </div>
        <span
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
            isNewAccount
              ? 'bg-amber-500 animate-pulse'
              : isExpired
              ? 'bg-rose-500 animate-ping'
              : isExpiringSoon
              ? 'bg-amber-500 animate-pulse'
              : 'bg-emerald-500'
          }`}
        />
        <span
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
            isNewAccount
              ? 'bg-amber-500'
              : isExpired
              ? 'bg-rose-500'
              : isExpiringSoon
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
        />
      </div>

      <div className="flex flex-col text-left">
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 leading-none">
          Platform Plan
        </span>
        <div className="flex items-center gap-1 leading-tight mt-0.5">
          <span className="text-xs font-black tracking-tight">
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin inline-block text-slate-400" />
            ) : isNewAccount ? (
              'No Plan Active'
            ) : isExpired ? (
              'Plan Expired'
            ) : isExpiringSoon ? (
              `Renew (${remainingDays}d)`
            ) : isTrial ? (
              `Trial (${remainingDays}d)`
            ) : (
              `Active (${remainingDays}d)`
            )}
          </span>
        </div>
      </div>

      <div
        className={`ml-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-transform group-hover:scale-105 ${
          isNewAccount
            ? 'bg-emerald-600 text-white shadow-sm'
            : isExpired
            ? 'bg-rose-600 text-white'
            : isExpiringSoon
            ? 'bg-amber-500 text-white'
            : 'bg-emerald-600 text-white'
        }`}
      >
        {isNewAccount ? 'Buy Plan' : isExpired ? 'Renew' : 'Manage'}
      </div>
    </Link>
  );
}
