'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { LogOut, X } from 'lucide-react';
import Portal from './Portal';

export default function LogoutConfirmModal() {
  const { user, showLogoutModal, setShowLogoutModal, logout } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showLogoutModal && !loggingOut) {
        setShowLogoutModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutModal, loggingOut, setShowLogoutModal]);

  if (!showLogoutModal) return null;

  const handleConfirm = async () => {
    try {
      setLoggingOut(true);
      await logout();
      setShowLogoutModal(false);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const roleLabel =
    user?.role === 'superadmin'
      ? 'Super Admin'
      : user?.role === 'admin'
      ? 'Organization Admin'
      : user?.role === 'owner'
      ? 'Account Owner'
      : 'Team Member';

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget && !loggingOut) {
            setShowLogoutModal(false);
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150 relative overflow-hidden"
        >
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500" />

          {/* Close button */}
          <button
            onClick={() => !loggingOut && setShowLogoutModal(false)}
            disabled={loggingOut}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors disabled:opacity-50"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header with Icon */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 shadow-sm">
              <LogOut className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex-1 pr-6">
              <h3 className="text-lg font-bold text-wa-text-primary dark:text-white leading-tight">
                Confirm Logout
              </h3>
              <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">
                Are you sure you want to end your active session?
              </p>
            </div>
          </div>

          {/* User Account Info Card */}
          {user && (
            <div className="bg-wa-search dark:bg-wa-dark-search/60 border border-wa-border dark:border-wa-dark-border rounded-xl p-3 mb-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-wa-green/15 text-wa-green font-extrabold text-sm flex items-center justify-center shrink-0 border border-wa-green/30">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-wa-text-primary dark:text-white truncate">
                    {user.name || 'User'}
                  </p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/40 shrink-0">
                    {roleLabel}
                  </span>
                </div>
                <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary truncate mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
          )}

          {/* Warning / Informational note */}
          <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mb-5 leading-relaxed">
            You will need to sign in again with your email and password to access the platform. Any unsaved form changes will be lost.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-wa-border dark:border-wa-dark-border">
            <button
              type="button"
              onClick={() => setShowLogoutModal(false)}
              disabled={loggingOut}
              className="px-4 py-2.5 rounded-xl border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-white hover:bg-wa-hover dark:hover:bg-wa-dark-hover text-xs font-semibold transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loggingOut}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-red-600/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loggingOut ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Logging out...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Yes, Log Out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

