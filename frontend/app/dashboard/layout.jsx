'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, useThemeStore } from '../../lib/store';
import Sidebar from '../../components/Sidebar';
import NotificationCenter from '../../components/NotificationCenter';
import ConfirmModal from '../../components/ConfirmModal';
import SubscriptionExpiredGate from '../../components/SubscriptionExpiredGate';
import api from '../../lib/api';
import { Menu, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({ children }) {
  const { isAuthenticated, loading, checkAuth, user } = useAuthStore();
  const { init: initTheme } = useThemeStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [subscriptionExpiryDate, setSubscriptionExpiryDate] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  useEffect(() => {
    checkAuth();
    initTheme();
  }, []);

  // Auto-close mobile sidebar drawer on navigation change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (!loading && isAuthenticated && user?.role === 'agent') {
      const allowedPaths = [
        '/dashboard/inbox',
        '/dashboard/team-chat',
        '/dashboard/tasks',
        '/dashboard/notifications'
      ];
      const isAllowed = allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (!isAllowed) {
        router.push('/dashboard/inbox');
      }
    }
  }, [loading, isAuthenticated, user, pathname, router]);

  // Check subscription status
  useEffect(() => {
    if (!isAuthenticated || !user || user.role === 'superadmin') return;
    api.get('/subscription/current').then(res => {
      const data = res.data.data;
      setSubscriptionStatus(data.subscriptionStatus);
      setSubscriptionExpiryDate(data.subscriptionExpiryDate);
      if (data.subscriptionStatus === 'expired') {
        setSubscriptionExpired(true);
      }
    }).catch(err => {
      if (err.response?.data?.code === 'SUBSCRIPTION_EXPIRED') {
        setSubscriptionExpired(true);
        setSubscriptionExpiryDate(err.response?.data?.data?.expiryDate);
        setSubscriptionStatus('expired');
      }
    });
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wa-panel-header dark:bg-wa-dark-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-wa-green/20 border-t-wa-green rounded-full animate-spin" />
          <p className="text-wa-text-secondary font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Subscription expired gate — allow only /subscription route
  const isSubscriptionPage = pathname === '/dashboard/subscription' || pathname.startsWith('/dashboard/subscription/');
  if (subscriptionExpired && !isSubscriptionPage && user?.role !== 'superadmin') {
    return <SubscriptionExpiredGate expiryDate={subscriptionExpiryDate} />;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-wa-bg dark:bg-wa-dark-bg">
      {/* Sidebar - handles both desktop view & mobile overlay drawer */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top header - only visible on screen < lg (1024px) */}
        <header className="flex lg:hidden items-center justify-between h-12 bg-wa-panel-header dark:bg-wa-dark-panel-header px-4 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-extrabold text-sm text-wa-text-primary dark:text-white tracking-tight">
              HK Automation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <div className="w-8 h-8 rounded-full bg-wa-green/10 text-wa-green font-bold text-xs flex items-center justify-center border border-wa-green/20">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Desktop notification bar - only visible on lg+ */}
        <header className="hidden lg:flex items-center justify-between h-12 bg-white dark:bg-wa-dark-panel-header border-b border-wa-border dark:border-wa-dark-border px-6 shrink-0 z-10 shadow-sm">
          {/* Left side: Premium Search Bar */}
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-wa-text-secondary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </span>
              <input
                className="w-full pl-9 pr-4 py-1.5 bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-wa-green/25 focus:border-wa-green transition-all text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary"
                placeholder="Search conversations, campaigns..."
                type="text"
              />
            </div>
          </div>

          {/* Subscription expiry warning banner */}
          {subscriptionStatus === 'expiring_soon' && user?.role !== 'superadmin' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Subscription expiring soon</span>
              <Link href="/dashboard/subscription" className="text-xs font-bold text-wa-green hover:underline ml-1">Renew</Link>
            </div>
          )}

          {/* Right side: Actions & User Info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <NotificationCenter />
            </div>
            <div className="h-6 w-[1px] bg-wa-border dark:bg-wa-dark-border"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden xl:block">
                <p className="text-xs font-bold text-wa-text-primary dark:text-white leading-tight">{user?.name || 'User'}</p>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold uppercase tracking-wider mt-0.5">
                  {user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Org Admin' : 'Agent'}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-wa-green/10 text-wa-green font-extrabold text-sm flex items-center justify-center border border-wa-green/20 shadow-sm shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        {pathname === '/dashboard/inbox' || pathname.startsWith('/dashboard/inbox/') ? (
          <main className="flex-1 overflow-hidden focus:outline-none">
            {children}
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto focus:outline-none">
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
        )}
        <ConfirmModal />
      </div>
    </div>
  );
}
