'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../lib/store';
import Sidebar from '../../components/Sidebar';

export default function DashboardLayout({ children }) {
  const { isAuthenticated, loading, checkAuth, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkAuth();
  }, []);

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
    <div className="flex h-screen overflow-hidden bg-wa-bg dark:bg-wa-dark-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
