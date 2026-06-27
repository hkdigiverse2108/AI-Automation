'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../lib/store';
import { useEffect, useState } from 'react';
import { ShieldX } from 'lucide-react';

// Map URL paths to feature slugs
const routeToSlugMap = {
  '/dashboard': 'dashboard',
  '/dashboard/inbox': 'inbox',
  '/dashboard/contacts': 'contacts',
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

/**
 * RouteGuard - Blocks access to disabled feature routes.
 * Wraps page content and checks if current route's feature is enabled.
 * If disabled, shows a 403 forbidden screen instead of the page content.
 */
export default function RouteGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, permissions } = useAuthStore();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // Superadmins bypass permission checks
    if (!user || user.role === 'superadmin') {
      setBlocked(false);
      return;
    }

    // No permissions loaded yet - allow (will be checked on next render)
    if (!permissions) {
      setBlocked(false);
      return;
    }

    // Find the matching feature slug for this path
    // Check exact match first, then prefix match for nested routes
    let matchedSlug = routeToSlugMap[pathname];
    if (!matchedSlug) {
      // Try prefix matching for nested routes like /dashboard/inbox/123
      const sortedPaths = Object.keys(routeToSlugMap).sort((a, b) => b.length - a.length);
      for (const routePath of sortedPaths) {
        if (routePath !== '/dashboard' && pathname.startsWith(routePath + '/')) {
          matchedSlug = routeToSlugMap[routePath];
          break;
        }
      }
    }

    // If no matching slug found (e.g. /dashboard/admin pages), allow access
    if (!matchedSlug) {
      setBlocked(false);
      return;
    }

    // Check if the feature is in the allowed list
    if (!permissions.includes(matchedSlug)) {
      setBlocked(true);
    } else {
      setBlocked(false);
    }
  }, [pathname, user, permissions]);

  if (blocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-wa-text-primary dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mb-6">
            You don&apos;t have permission to access this module. Contact your Super Admin to enable this feature.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 bg-wa-green hover:bg-wa-green-dark text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-wa-green/25"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return children;
}
