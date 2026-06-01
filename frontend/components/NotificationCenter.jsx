'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, X, Check, CheckCheck, Trash2, Megaphone, Users, Bot,
  MessageSquare, Shield, Loader2, Settings, ExternalLink,
  Inbox, BellOff
} from 'lucide-react';
import api from '../lib/api';
import { useRouter } from 'next/navigation';

const TYPE_CONFIG = {
  system: { icon: Shield, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  campaign: { icon: Megaphone, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  contact: { icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  bot: { icon: Bot, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  team: { icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  message: { icon: MessageSquare, color: 'text-wa-green', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread'
  const panelRef = useRef(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? '?filter=unread' : '';
      const { data } = await api.get(`/notifications${params}`);
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (err) {
      // Silently fail — notification center is non-critical
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      if (data.success) setUnreadCount(data.data.count);
    } catch {}
  }, []);

  // Fetch on open and periodically
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, filter, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {}
  };

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) markAsRead(notif._id);
    if (notif.link) {
      router.push(notif.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all duration-200"
        title="Notifications"
      >
        <Bell className={`w-5 h-5 transition-transform ${isOpen ? 'scale-110' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md border-2 border-white dark:border-wa-dark-panel-header animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-[380px] max-h-[520px] bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-up"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-wa-border dark:border-wa-dark-border bg-wa-panel-header/50 dark:bg-wa-dark-panel-header/50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-wa-green" />
              <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-wa-green/10 text-wa-green text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-wa-border dark:border-wa-dark-border">
            {['all', 'unread'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors capitalize ${
                  filter === f
                    ? 'bg-wa-green/10 text-wa-green'
                    : 'text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-wa-text-secondary">
                <BellOff className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs font-semibold">No notifications</p>
                <p className="text-[10px] mt-0.5">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/50">
                {notifications.map(notif => {
                  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
                  const Icon = config.icon;
                  return (
                    <div
                      key={notif._id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group ${
                        !notif.isRead
                          ? 'bg-wa-green/[0.03] hover:bg-wa-green/[0.06]'
                          : 'hover:bg-wa-hover/50 dark:hover:bg-wa-dark-hover/30'
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs leading-snug ${!notif.isRead ? 'font-bold text-wa-text-primary dark:text-white' : 'font-medium text-wa-text-primary dark:text-wa-dark-text-primary'}`}>
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <div className="w-2 h-2 bg-wa-green rounded-full shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary leading-snug mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[9px] text-wa-text-light mt-1 font-medium">
                          {timeAgo(notif.createdAt)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {!notif.isRead && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(notif._id); }}
                            className="p-1 rounded text-wa-text-light hover:text-wa-green transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}
                          className="p-1 rounded text-wa-text-light hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
