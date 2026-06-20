'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Bell, Search, RefreshCw, Loader2, Check, CheckCheck, Trash2,
  Calendar, ShoppingBag, Shield, Megaphone, Users, Bot, MessageSquare,
  ChevronLeft, ChevronRight, Inbox, BellOff, Filter, ExternalLink
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../lib/store';
import { useRouter } from 'next/navigation';

const TYPE_CONFIG = {
  system: { icon: Shield, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  campaign: { icon: Megaphone, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  contact: { icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  bot: { icon: Bot, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  team: { icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  message: { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  appointment: { icon: Calendar, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20' },
  order: { icon: ShoppingBag, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' }
};

export default function NotificationsDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();

  // State Variables
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'unread', 'read'

  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        filter: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter || undefined,
        search: search || undefined
      };

      const { data } = await api.get('/notifications', { params });
      if (data.success) {
        setNotifications(data.data.notifications || []);
        setTotal(data.data.total || 0);
        setPages(data.data.pages || 1);
      }
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Actions
  const handleMarkAsRead = async (id) => {
    try {
      const { data } = await api.put(`/notifications/${id}/read`);
      if (data.success) {
        setNotifications(prev =>
          prev.map(n => n._id === id ? { ...n, isRead: true } : n)
        );
        toast.success('Marked as read');
        // Refresh unread count globally if needed (poller handles it, but let's refresh immediately)
        window.dispatchEvent(new Event('refresh_notification_badge'));
      }
    } catch (err) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { data } = await api.put('/notifications/read-all');
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        toast.success('All marked as read');
        window.dispatchEvent(new Event('refresh_notification_badge'));
      }
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDeleteNotification = async (id) => {
    try {
      const { data } = await api.delete(`/notifications/${id}`);
      if (data.success) {
        setNotifications(prev => prev.filter(n => n._id !== id));
        toast.success('Notification deleted');
      }
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      return;
    }
    try {
      const { data } = await api.delete('/notifications/delete-all');
      if (data.success) {
        setNotifications([]);
        setTotal(0);
        setPages(1);
        toast.success('All notifications deleted');
      }
    } catch (err) {
      toast.error('Failed to delete notifications');
    }
  };

  const handleNotificationRedirect = (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif._id);
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-slate-50 dark:bg-wa-dark-bg p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-wa-text-primary dark:text-white tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-wa-green" /> Central Notification Center
          </h1>
          <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
            Monitor real-time system alerts, campaign delivery updates, tasks, team chats, appointments, and orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <>
              <button
                onClick={handleMarkAllAsRead}
                className="btn btn-secondary py-2 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-wa-text-primary dark:text-white"
              >
                <CheckCheck className="w-4 h-4 text-wa-green" /> Mark All Read
              </button>
              <button
                onClick={handleDeleteAll}
                className="btn btn-danger py-2 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-950/20 text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Panel Box */}
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl flex flex-col shadow-sm overflow-hidden">
        {/* Filters and Controls */}
        <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-wa-hover dark:bg-wa-dark-panel-header">
          {/* Left Side Tabs */}
          <div className="flex items-center gap-1 bg-white dark:bg-wa-dark-panel p-1 border border-wa-border dark:border-wa-dark-border rounded-xl">
            {['all', 'unread', 'read'].map(tab => (
              <button
                key={tab}
                onClick={() => { setStatusFilter(tab); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === tab
                    ? 'bg-wa-green/10 text-wa-green dark:bg-wa-green/15'
                    : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Right Side Search and Selection */}
          <div className="flex flex-wrap items-center gap-2 flex-grow justify-end">
            <div className="relative min-w-[200px] flex-grow max-w-sm">
              <Search className="w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search alerts or messages..."
                className="w-full bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-wa-green text-wa-text-primary dark:text-white"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl px-3 py-2 text-xs text-wa-text-primary dark:text-white focus:outline-none"
            >
              <option value="">All Categories</option>
              <option value="system">System / Health</option>
              <option value="campaign">WhatsApp Broadcasts</option>
              <option value="contact">Contacts & Lists</option>
              <option value="bot">AI Bot Automation</option>
              <option value="team">Team Assignments</option>
              <option value="message">Team Chat Messages</option>
              <option value="appointment">Appointments</option>
              <option value="order">Order Tracking</option>
            </select>

            <button
              onClick={fetchNotifications}
              className="p-2 border border-wa-border dark:border-wa-dark-border rounded-xl hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white bg-white dark:bg-wa-dark-panel"
              title="Refresh list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* List Layout */}
        <div className="flex-1 overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-wa-text-secondary">
              <Loader2 className="w-7 h-7 animate-spin text-wa-green" />
              <p className="text-xs font-semibold">Updating notification dashboard...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-24 text-center text-wa-text-secondary">
              <BellOff className="w-12 h-12 stroke-[1] mx-auto mb-3 opacity-40 text-wa-text-secondary" />
              <p className="text-sm font-bold">No notifications found</p>
              <p className="text-xs text-wa-text-secondary/75 mt-0.5">
                Try adjusting your search criteria, category filters, or select a different status.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-wa-dark-border/40">
              {notifications.map((notif) => {
                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
                const Icon = config.icon;

                return (
                  <div
                    key={notif._id}
                    className={`p-4 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-wa-dark-hover/40 transition-colors ${
                      !notif.isRead ? 'bg-wa-green/[0.02]' : ''
                    }`}
                  >
                    {/* Circle Category Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>

                    {/* Main Content Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm leading-snug ${!notif.isRead ? 'font-bold text-wa-text-primary dark:text-white' : 'font-medium text-wa-text-primary dark:text-wa-dark-text-primary'}`}>
                          {notif.title}
                        </h3>
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-wa-green shrink-0" />
                        )}
                        <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary bg-slate-100 dark:bg-wa-dark-border/30 px-2 py-0.5 rounded-md capitalize font-semibold font-mono ml-auto">
                          {notif.type}
                        </span>
                      </div>
                      <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed mt-1">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-wa-text-light font-medium">
                        <span>{new Date(notif.createdAt).toLocaleString()}</span>
                        {notif.link && (
                          <button
                            onClick={() => handleNotificationRedirect(notif)}
                            className="text-wa-green hover:underline flex items-center gap-1 font-bold"
                          >
                            Go to reference <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      {!notif.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notif._id)}
                          className="p-1.5 border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-hover dark:hover:bg-wa-dark-hover rounded-xl text-wa-text-secondary hover:text-wa-green transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(notif._id)}
                        className="p-1.5 border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-red-50 hover:text-red-500 rounded-xl text-wa-text-secondary transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && pages > 1 && (
          <div className="p-4 border-t border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-wa-hover dark:bg-wa-dark-panel-header text-xs text-wa-text-secondary">
            <span>Showing page {page} of {pages} ({total} total alerts)</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel hover:text-wa-text-primary dark:hover:text-white disabled:opacity-50 text-[11px] font-bold flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                disabled={page === pages}
                onClick={() => setPage(prev => Math.min(pages, prev + 1))}
                className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel hover:text-wa-text-primary dark:hover:text-white disabled:opacity-50 text-[11px] font-bold flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
