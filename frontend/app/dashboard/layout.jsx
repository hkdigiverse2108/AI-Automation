'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../lib/store';
import Sidebar from '../../components/Sidebar';
import NotificationCenter from '../../components/NotificationCenter';
import { Menu } from 'lucide-react';

export default function DashboardLayout({ children }) {
  const { isAuthenticated, loading, checkAuth, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkAuth();
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
        <header className="flex lg:hidden items-center justify-between h-[60px] bg-wa-panel-header dark:bg-wa-dark-panel-header border-b border-wa-border dark:border-wa-dark-border px-4 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
              title="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-extrabold text-sm text-wa-text-primary dark:text-white tracking-tight">
              WA Chatbox
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
        <header className="hidden lg:flex items-center justify-end h-[48px] bg-wa-panel-header/50 dark:bg-wa-dark-panel-header/50 border-b border-wa-border/50 dark:border-wa-dark-border/50 px-6 shrink-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <div className="flex items-center gap-2 pl-3 border-l border-wa-border dark:border-wa-dark-border">
              <div className="w-7 h-7 rounded-full bg-wa-green/10 text-wa-green font-bold text-[10px] flex items-center justify-center border border-wa-green/20">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-semibold text-wa-text-primary dark:text-white hidden xl:inline">{user?.name || 'User'}</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto focus:outline-none">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
