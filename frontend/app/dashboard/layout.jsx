'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, useThemeStore } from '../../lib/store';
import Sidebar from '../../components/Sidebar';
import NotificationCenter from '../../components/NotificationCenter';
import ConfirmModal from '../../components/ConfirmModal';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';
import SubscriptionExpiredGate from '../../components/SubscriptionExpiredGate';
import RouteGuard from '../../components/RouteGuard';
import WalletHeaderBadge from '../../components/WalletHeaderBadge';
import api from '../../lib/api';
import { Menu, AlertTriangle, LogOut } from 'lucide-react';
import Link from 'next/link';

// Check if we have a cached auth state for instant render (avoids flash of spinner)
function getCachedAuth() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('_cachedAuthState');
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedAuth(user, permissions) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('_cachedAuthState', JSON.stringify({ user, permissions, ts: Date.now() }));
  } catch {}
}

function clearCachedAuth() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem('_cachedAuthState'); } catch {}
}

export default function DashboardLayout({ children }) {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, loading, checkAuth, user, permissions, requestLogout } = useAuthStore();
  const { init: initTheme } = useThemeStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [subscriptionExpiryDate, setSubscriptionExpiryDate] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [hasPreviousSubscription, setHasPreviousSubscription] = useState(false);
  const prefetchedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    // Restore cached auth on client mount immediately so UI renders without delay
    const cached = getCachedAuth();
    if (cached?.user && localStorage.getItem('accessToken')) {
      useAuthStore.setState({
        user: cached.user,
        permissions: cached.permissions || null,
        isAuthenticated: true,
        loading: false,
      });
    }
    checkAuth();
    initTheme();
  }, []);

  // Cache auth state whenever it changes so next visit is instant
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      setCachedAuth(user, permissions);
    } else if (!loading && !isAuthenticated) {
      clearCachedAuth();
    }
  }, [loading, isAuthenticated, user, permissions]);

  // Prefetch top routes eagerly on mount for instant navigation
  useEffect(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const topRoutes = ['/dashboard', '/dashboard/inbox', '/dashboard/contacts', '/dashboard/campaigns', '/dashboard/settings'];
    topRoutes.forEach(route => router.prefetch(route));
  }, [router]);

  // Auto-close mobile sidebar drawer on navigation change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isUnpaid = user?.role !== 'superadmin' && (subscriptionStatus === 'pending' || subscriptionStatus === 'expired' || subscriptionExpired);
  const isSubscriptionPage = pathname === '/dashboard/subscription' || pathname.startsWith('/dashboard/subscription/');

  // Redirect unpaid users to subscription page automatically
  useEffect(() => {
    if (!loading && isAuthenticated && isUnpaid && !isSubscriptionPage) {
      router.replace('/dashboard/subscription');
    }
  }, [loading, isAuthenticated, isUnpaid, isSubscriptionPage, router]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    } else if (!loading && isAuthenticated && user?.role === 'agent') {
      if (!permissions) return;

      const routeToSlugMap = {
        '/dashboard': 'dashboard',
        '/dashboard/inbox': 'inbox',
        '/dashboard/contacts': 'contacts',
        '/dashboard/leads': 'contacts',
        '/dashboard/catalog': 'catalog',
        '/dashboard/contacts/groups': 'groups',
        '/dashboard/follow-ups': 'follow-ups',
        '/dashboard/tasks': 'tasks',
        '/dashboard/call-logs': 'call-logs',
        '/dashboard/team': 'team',
        '/dashboard/team-chat': 'team-chat',
        '/dashboard/campaigns': 'campaigns',
        '/dashboard/unofficial-campaigns': 'unofficial-campaigns',
        '/dashboard/templates': 'templates',
        '/dashboard/bot-builder': 'bot-builder',
        '/dashboard/analytics': 'analytics',
        '/dashboard/subscription': 'subscription',
        '/dashboard/chat-logs': 'chat-logs',
        '/dashboard/settings': 'settings',
      };

      let matchedSlug = routeToSlugMap[pathname];
      if (!matchedSlug) {
        const sortedPaths = Object.keys(routeToSlugMap).sort((a, b) => b.length - a.length);
        for (const routePath of sortedPaths) {
          if (routePath !== '/dashboard' && pathname.startsWith(routePath + '/')) {
            matchedSlug = routeToSlugMap[routePath];
            break;
          }
        }
      }

      if (matchedSlug && !permissions.includes(matchedSlug)) {
        router.replace('/dashboard/inbox');
      }
    }
  }, [loading, isAuthenticated, user, permissions, pathname, router]);

  // Check subscription status (non-blocking — uses cache if available)
  useEffect(() => {
    if (!isAuthenticated || !user || user.role === 'superadmin') return;

    // Try cached subscription status first for instant render
    try {
      const cachedSub = localStorage.getItem('_cachedSubStatus');
      if (cachedSub) {
        const parsed = JSON.parse(cachedSub);
        // Use cache if less than 5 minutes old
        if (Date.now() - parsed.ts < 5 * 60 * 1000) {
          const hasPrev = !!parsed.hasPreviousSubscription;
          const status = (!hasPrev && parsed.status === 'expired') ? 'pending' : parsed.status;
          setSubscriptionStatus(status);
          setSubscriptionExpiryDate(parsed.expiryDate);
          setHasPreviousSubscription(hasPrev);
          if (status === 'expired' || status === 'pending') {
            setSubscriptionExpired(true);
          }
        }
      }
    } catch {}

    const loadSub = () => {
      api.get('/subscription/current').then(res => {
        const data = res.data.data;
        const hasPrev = !!data.hasPreviousSubscription;
        const status = (!hasPrev && data.subscriptionStatus === 'expired') ? 'pending' : data.subscriptionStatus;
        setSubscriptionStatus(status);
        setSubscriptionExpiryDate(data.subscriptionExpiryDate);
        setHasPreviousSubscription(hasPrev);
        if (status === 'expired' || status === 'pending') {
          setSubscriptionExpired(true);
        } else {
          setSubscriptionExpired(false);
        }
        // Cache subscription status
        try {
          localStorage.setItem('_cachedSubStatus', JSON.stringify({
            status,
            expiryDate: data.subscriptionExpiryDate,
            hasPreviousSubscription: hasPrev,
            ts: Date.now()
          }));
        } catch {}
      }).catch(err => {
        if (err.response?.data?.code === 'SUBSCRIPTION_EXPIRED' || err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
          setSubscriptionExpired(true);
          setSubscriptionExpiryDate(err.response?.data?.data?.expiryDate);
          const hasPrev = !!err.response?.data?.data?.hasPreviousSubscription;
          const isPending = err.response?.data?.data?.isPending || err.response?.data?.code === 'SUBSCRIPTION_REQUIRED' || !hasPrev;
          setSubscriptionStatus(isPending ? 'pending' : 'expired');
          setHasPreviousSubscription(hasPrev);
        }
      });
    };

    loadSub();

    // Listen for real-time subscription update event (fired after Razorpay payment success)
    const handleSubUpdated = () => {
      setSubscriptionStatus('active');
      setSubscriptionExpired(false);
      loadSub();
    };

    window.addEventListener('subscription_updated', handleSubUpdated);
    return () => window.removeEventListener('subscription_updated', handleSubUpdated);
  }, [isAuthenticated, user]);

  // Uniform initial render on SSR and client to prevent React hydration errors
  if (!mounted || (loading && !isAuthenticated)) {
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

  // Dedicated Activation / Renew View for unpaid users (No Sidebar!)
  if (isUnpaid) {
    return (
      <div className="min-h-screen flex flex-col bg-wa-bg dark:bg-wa-dark-bg">
        {/* Focused Header without sidebar */}
        <header className="h-14 bg-white dark:bg-wa-dark-panel-header border-b border-wa-border dark:border-wa-dark-border px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-wa-green/10 flex items-center justify-center border border-wa-green/20">
              <span className="text-wa-green font-black text-sm">HK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-wa-text-primary dark:text-white tracking-tight">
                HK Automation
              </span>
              <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                subscriptionStatus === 'pending' || !hasPreviousSubscription
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800'
              }`}>
                {subscriptionStatus === 'pending' || !hasPreviousSubscription ? '⚡ Plan Required' : '⚠️ Plan Expired'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-wa-text-primary dark:text-white leading-tight">{user?.name || 'User'}</p>
              <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
                {user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Org Admin' : 'Agent'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-wa-green/10 text-wa-green font-extrabold text-xs flex items-center justify-center border border-wa-green/20 shadow-sm shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <button
              onClick={requestLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        {/* Content Body: Subscription Page (without sidebar) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {isSubscriptionPage ? children : (
            <SubscriptionExpiredGate
              expiryDate={subscriptionExpiryDate}
              isPending={subscriptionStatus === 'pending' || !hasPreviousSubscription}
            />
          )}
        </main>

        <ConfirmModal />
        <LogoutConfirmModal />
      </div>
    );
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
            <WalletHeaderBadge />
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
          <div className="flex items-center gap-5">
            <WalletHeaderBadge />
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
              <button
                onClick={requestLogout}
                title="Log Out"
                className="p-1.5 rounded-lg text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        {pathname === '/dashboard/inbox' || pathname.startsWith('/dashboard/inbox/') ? (
          <main key={pathname} className="flex-1 overflow-hidden focus:outline-none">
            <RouteGuard>{children}</RouteGuard>
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto focus:outline-none">
            <div key={pathname} className="p-4 sm:p-6 lg:p-8">
              <RouteGuard>{children}</RouteGuard>
            </div>
          </main>
        )}
        <ConfirmModal />
        <LogoutConfirmModal />
      </div>
    </div>
  );
}
