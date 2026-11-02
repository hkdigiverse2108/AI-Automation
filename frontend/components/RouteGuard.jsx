'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../lib/store';
import { ShieldAlert, Home, ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';

// Map URL paths to feature slugs
const routeToSlugMap = {
  '/dashboard': 'dashboard',
  '/dashboard/inbox': 'inbox',
  '/dashboard/contacts': 'contacts',
  '/dashboard/leads': 'contacts',
  '/dashboard/catalog': 'catalog',
  '/dashboard/invoice-settings': 'settings',
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

const sortedPaths = Object.keys(routeToSlugMap).sort((a, b) => b.length - a.length);

/**
 * RouteGuard - Blocks access to disabled feature routes.
 * Evaluates feature permissions synchronously to prevent double-render latency.
 */
export default function RouteGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, permissions } = useAuthStore();

  // Superadmins bypass permission checks synchronously
  let blocked = false;
  let blockedFeature = '';
  if (user && user.role !== 'superadmin' && permissions) {
    let matchedSlug = routeToSlugMap[pathname];
    if (!matchedSlug) {
      for (const routePath of sortedPaths) {
        if (routePath !== '/dashboard' && pathname.startsWith(routePath + '/')) {
          matchedSlug = routeToSlugMap[routePath];
          break;
        }
      }
    }

    if (matchedSlug && !permissions.includes(matchedSlug)) {
      blocked = true;
      blockedFeature = matchedSlug.replace(/-/g, ' ');
    }
  }

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-[#0b141a] text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-8 font-sans overflow-y-auto selection:bg-red-500/20 selection:text-red-500 animate-fadeIn">
        <div className="max-w-lg w-full my-auto bg-white dark:bg-[#111b21] rounded-3xl border border-slate-200/80 dark:border-white/5 p-8 sm:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-black/40 text-center relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center justify-center shadow-sm">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60 mb-4">
            <Lock className="w-3 h-3 text-red-500" />
            <span>403 &bull; Access Restricted</span>
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            Access Denied
          </h2>

          {/* Description */}
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-sm mx-auto">
            Your account does not have permission to access the <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">&ldquo;{blockedFeature || 'requested'}&rdquo;</span> module. Please contact your organization administrator or superadmin to request access.
          </p>

          {/* Action Button: Go to Dashboard only */}
          <div className="flex items-center justify-center max-w-xs mx-auto">
            <Link
              href="/dashboard"
              className="w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Go to Dashboard</span>
            </Link>
          </div>

          {/* Return link */}
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() => router.back()}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to previous screen</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
