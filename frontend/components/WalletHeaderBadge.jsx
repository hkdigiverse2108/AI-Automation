'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wallet, Plus, ArrowUpRight, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';

export default function WalletHeaderBadge() {
  const router = useRouter();
  const [balance, setBalance] = useState(null);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.get('/wallet/balance');
      if (res.data?.success) {
        setBalance(res.data.data.balance);
        setCurrency(res.data.data.currency || 'INR');
      }
    } catch (err) {
      // Fail silently if not logged in or network blip
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();

    const socket = getSocket();
    if (socket) {
      const handleBalanceUpdate = (data) => {
        if (typeof data.balance === 'number') {
          setBalance(data.balance);
          setPulse(true);
          setTimeout(() => setPulse(false), 2000);
        }
      };

      socket.on('wallet_balance_updated', handleBalanceUpdate);
      return () => {
        socket.off('wallet_balance_updated', handleBalanceUpdate);
      };
    }
  }, [fetchBalance]);

  const formattedBalance = balance !== null ? balance.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) : '0.00';

  const isLow = balance !== null && balance < 50;
  const isZero = balance !== null && balance <= 0;

  return (
    <Link
      href="/dashboard/fund-management"
      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 select-none ${
        pulse
          ? 'ring-2 ring-emerald-500 scale-105 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400'
          : isZero
          ? 'bg-rose-50/80 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50'
          : isLow
          ? 'bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border-amber-200 dark:border-amber-900/50'
          : 'bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40'
      }`}
      title="Fund Balance & Wallet — Click to manage funds"
    >
      {/* Wallet Icon with Indicator */}
      <div className="relative flex items-center justify-center">
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
            isZero
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'
              : isLow
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
        </div>
        {/* Glowing Status Dot */}
        <span
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
            isZero
              ? 'bg-rose-500 animate-ping'
              : isLow
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
        />
        <span
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
            isZero ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
      </div>

      {/* Balance Content */}
      <div className="flex flex-col text-left">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
          Fund Balance
        </span>
        <div className="flex items-center gap-1 leading-tight mt-0.5">
          <span
            className={`text-xs font-black font-mono tracking-tight ${
              isZero
                ? 'text-rose-600 dark:text-rose-400'
                : isLow
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin inline-block text-slate-400" />
            ) : (
              `₹ ${formattedBalance}`
            )}
          </span>
        </div>
      </div>

      {/* Plus / Add Shortcut Button */}
      <div
        className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
          isZero
            ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
            : isLow
            ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
            : 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
        }`}
      >
        <Plus className="w-3 h-3 stroke-[3]" />
      </div>
    </Link>
  );
}
