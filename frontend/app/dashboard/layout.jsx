'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, useThemeStore } from '../../lib/store';
import Sidebar from '../../components/Sidebar';
import NotificationCenter from '../../components/NotificationCenter';
import ConfirmModal from '../../components/ConfirmModal';
import { Menu } from 'lucide-react';

export default function DashboardLayout({ children }) {
  const { isAuthenticated, loading, checkAuth, user } = useAuthStore();
  const { init: initTheme } = useThemeStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      if (pathname !== '/dashboard/inbox' && !pathname.startsWith('/dashboard/inbox/')) {
        router.push('/dashboard/inbox');
      }
    }
  }, [loading, isAuthenticated, user, pathname, router]);

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
              Ajnabh Connect
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
