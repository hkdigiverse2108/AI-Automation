'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, useThemeStore, useConversationStore } from '../lib/store';
import {
  LayoutDashboard, MessageSquare, Users, Megaphone, Bot, FileText,
  Settings, LogOut, Sun, Moon, MessageCircle, Shield,
  Users2, Clock, Zap, Terminal, PanelLeftClose, PanelLeft,
  Building, Activity, Globe, Lock, X, BarChart3, CreditCard,
  FolderOpen, Calendar, ClipboardList, ShoppingBag
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const navSections = [
  {
    title: 'Main',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/inbox', label: 'Inbox', icon: MessageSquare, badge: true },
      { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
      { href: '/dashboard/catalog', label: 'Catalog', icon: ShoppingBag },
      { href: '/dashboard/contacts/groups', label: 'Groups', icon: FolderOpen },
      { href: '/dashboard/follow-ups', label: 'Follow-Ups', icon: Calendar },
      { href: '/dashboard/tasks', label: 'Tasks', icon: ClipboardList },
      { href: '/dashboard/call-logs', label: 'Call Logs', icon: Clock },
      { href: '/dashboard/team', label: 'Team', icon: Users2 },
      { href: '/dashboard/team-chat', label: 'Team Chat', icon: MessageCircle },
    ]
  },
  {
    title: 'Marketing',
    items: [
      { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/dashboard/unofficial-campaigns', label: 'Unofficial Campaigns', icon: Zap },
      { href: '/dashboard/templates', label: 'Templates', icon: FileText },
    ]
  },
  {
    title: 'Automation',
    items: [
      { href: '/dashboard/bot-builder', label: 'Bot Builder', icon: Bot },
    ]
  },
  {
    title: 'Insights',
    items: [
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    ]
  },
  {
    title: 'System',
    items: [
      { href: '/dashboard/subscription', label: 'Subscription', icon: CreditCard },
      { href: '/dashboard/chat-logs', label: 'Chat Logs', icon: Terminal },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ]
  }
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const hasUnread = useConversationStore((state) => state.conversations.some(c => c.unreadCount > 0));
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const menuRef = useRef(null);

  // Filter navigation sections based on user role
  const allSections = user?.role === 'agent'
    ? [
        {
          title: 'Main',
          items: [
            { href: '/dashboard/inbox', label: 'Inbox', icon: MessageSquare, badge: true },
            { href: '/dashboard/tasks', label: 'Tasks', icon: ClipboardList },
            { href: '/dashboard/team-chat', label: 'Team Chat', icon: MessageCircle },
            { href: '/dashboard/catalog', label: 'Catalog', icon: ShoppingBag }
          ]
        }
      ]
    : user?.role === 'superadmin'
    ? [
        {
          title: 'Super Admin Menu',
          items: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/dashboard/admin?tab=organizations', label: 'Organizations', icon: Building },
            { href: '/dashboard/admin?tab=admins', label: 'Organization Admins', icon: Shield },
            { href: '/dashboard/team', label: 'Telecallers', icon: Users2 },
            { href: '/dashboard/team-chat', label: 'Team Chat', icon: MessageCircle },
            { href: '/dashboard/catalog', label: 'Catalog', icon: ShoppingBag },
            { href: '/dashboard/inbox', label: 'Conversations', icon: MessageSquare, badge: true },
            { href: '/dashboard/unofficial-campaigns', label: 'Unofficial Campaigns', icon: Zap },
            { href: '/dashboard/contacts/groups', label: 'Groups', icon: FolderOpen },
            { href: '/dashboard/follow-ups', label: 'Follow-Ups', icon: Calendar },
            { href: '/dashboard/tasks', label: 'Tasks', icon: ClipboardList },
            { href: '/dashboard/call-logs', label: 'Call Logs', icon: Clock },
            { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
            { href: '/dashboard/admin?tab=subscriptions', label: 'Subscriptions', icon: Zap },
            { href: '/dashboard/settings?tab=integrations', label: 'Integrations', icon: Globe },
            { href: '/dashboard/bot-builder', label: 'AI Management', icon: Bot },
            { href: '/dashboard/admin?tab=security', label: 'Security Center', icon: Lock },
            { href: '/dashboard/chat-logs', label: 'Audit Logs', icon: Terminal },
            { href: '/dashboard/admin?tab=reports', label: 'Reports', icon: FileText },
            { href: '/dashboard/settings', label: 'System Settings', icon: Settings },
            { href: '#logout', label: 'Logout', icon: LogOut, onClick: logout },
          ]
        }
      ]
    : navSections;

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* Backdrop overlay for mobile drawer */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 lg:relative flex flex-col bg-white dark:bg-wa-dark-panel border-r border-wa-border dark:border-wa-dark-border shrink-0 z-50 lg:z-20 transition-all duration-300 ease-in-out shadow-sm ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-[68px]' : 'w-[280px] lg:w-[240px]'}`}
      >
        {/* Logo & Brand */}
        <div className={`flex items-center h-12 border-b border-wa-border dark:border-wa-dark-border shrink-0 ${collapsed ? 'justify-center px-2' : 'px-4 gap-3'}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-wa-green to-wa-green-dark rounded-xl flex items-center justify-center shadow-lg shadow-wa-green/25 shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-extrabold text-wa-green dark:text-wa-green tracking-tight leading-tight truncate">
                HK Automation
              </h1>
              <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium leading-none mt-0.5">
                Enterprise Suite
              </p>
            </div>
          )}
          {/* On desktop, show collapse/expand sidebar toggle; on mobile show close drawer button */}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                if (onClose) onClose();
              } else {
                setCollapsed(!collapsed);
              }
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all duration-200 shrink-0"
            title="Toggle Menu"
          >
            <span className="lg:block hidden">
              {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </span>
            <span className="lg:hidden block">
              <X className="w-4 h-4" />
            </span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4 scrollbar-thin">
          {allSections.map((section) => (
            <div key={section.title}>
              {/* Section Title */}
              {!collapsed && (
                <p className="text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary opacity-60 uppercase tracking-[0.12em] mb-1.5 px-2.5">
                  {section.title}
                </p>
              )}
              {collapsed && (
                <div className="h-px bg-wa-border dark:bg-wa-dark-border opacity-50 mx-2 mb-1.5" />
              )}

              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon, badge, onClick }) => {
                  const isActive = href !== '#logout' && (pathname === href || (href !== '/dashboard' && pathname.startsWith(href)));
                  const showBadge = href === '/dashboard/inbox' ? hasUnread : badge;
                  const itemContent = (
                    <>
                      {/* Active indicator */}
                      {isActive && (
                        <div className={`absolute left-0 bg-wa-green rounded-r-full ${collapsed ? 'top-2 bottom-2 w-[3px]' : 'top-1.5 bottom-1.5 w-[3px]'}`} />
                      )}

                      <Icon className="w-[18px] h-[18px] shrink-0" />

                      {!collapsed && (
                        <span className="text-[13px] truncate">{label}</span>
                      )}

                      {/* Inbox badge */}
                      {showBadge && (
                        <span className={`bg-wa-green rounded-full border-2 border-wa-panel-header dark:border-wa-dark-panel-header animate-pulse-dot ${
                          collapsed
                            ? 'absolute -top-0.5 -right-0.5 w-2.5 h-2.5'
                            : 'w-2 h-2 ml-auto shrink-0'
                        }`} />
                      )}
                    </>
                  );

                  const itemClass = `
                    relative flex items-center gap-3 rounded-xl transition-all duration-200 w-full text-left
                    ${collapsed ? 'w-11 h-11 justify-center mx-auto' : 'px-3 py-2.5'}
                    ${isActive
                      ? 'text-wa-green bg-wa-green/10 dark:bg-wa-green/15 font-semibold'
                      : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-wa-dark-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                    }
                  `;

                  const handleItemClick = () => {
                    if (onClick) onClick();
                    if (onClose) onClose();
                  };

                  return (
                    <div key={href} className="relative">
                      {onClick ? (
                        <button
                          onClick={handleItemClick}
                          title={collapsed ? label : undefined}
                          className={itemClass}
                        >
                          {itemContent}
                        </button>
                      ) : (
                        <Link
                          href={href}
                          onClick={handleItemClick}
                          title={collapsed ? label : undefined}
                          onMouseEnter={() => setHoveredItem(href)}
                          onMouseLeave={() => setHoveredItem(null)}
                          className={itemClass}
                        >
                          {itemContent}
                        </Link>
                      )}

                      {/* Tooltip — only in collapsed mode */}
                      {collapsed && hoveredItem === href && (
                        <div className="wa-tooltip left-[60px] top-1/2 -translate-y-1/2 z-50">
                          {label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: Theme + User */}
        <div className="border-t border-wa-border dark:border-wa-dark-border shrink-0" ref={menuRef}>
          {/* Theme toggle */}
          <div className={`flex items-center ${collapsed ? 'justify-center py-2' : 'px-3 py-2'}`}>
            <button
              onClick={toggle}
              className={`flex items-center gap-3 rounded-xl transition-all duration-200 text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-wa-dark-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover ${
                collapsed ? 'w-11 h-11 justify-center' : 'w-full px-3 py-2.5'
              }`}
              title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {dark ? <Sun className="w-[18px] h-[18px] shrink-0" /> : <Moon className="w-[18px] h-[18px] shrink-0" />}
              {!collapsed && (
                <span className="text-[13px]">{dark ? 'Light Mode' : 'Dark Mode'}</span>
              )}
            </button>
          </div>

          {/* User profile */}
          <div className={`relative ${collapsed ? 'flex justify-center pb-3' : 'px-3 pb-3'}`}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex items-center gap-3 rounded-xl transition-all duration-200 hover:bg-wa-hover dark:hover:bg-wa-dark-hover ${
                collapsed ? 'w-11 h-11 justify-center' : 'w-full px-3 py-2.5'
              }`}
            >
              <div className="relative shrink-0">
                <div className="wa-avatar wa-avatar-sm">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="online-dot absolute -bottom-0.5 -right-0.5" />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-wa-text-primary dark:text-white truncate leading-tight">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary truncate leading-tight mt-0.5">
                    {user?.email || ''}
                  </p>
                </div>
              )}
            </button>

            {/* User dropdown */}
            {showUserMenu && (
              <div className={`absolute bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-wa-lg z-50 py-2 min-w-[200px] animate-slide-up ${
                collapsed ? 'left-[60px] bottom-0' : 'left-2 bottom-[56px]'
              }`}>
                {user && (
                  <div className="px-4 py-3 border-b border-wa-border dark:border-wa-dark-border">
                    <p className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary truncate">{user.name}</p>
                    <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary truncate">{user.email}</p>
                    {user.role && (
                      <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-wa-green/10 text-wa-green border border-wa-green/20">
                        {user.role}
                      </span>
                    )}
                  </div>
                )}
                <Link href="/dashboard/settings" className="wa-dropdown-item" onClick={() => { setShowUserMenu(false); if (onClose) onClose(); }}>
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
                <button onClick={() => { logout(); if (onClose) onClose(); }} className="wa-dropdown-item w-full text-red-500 hover:text-red-600">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
