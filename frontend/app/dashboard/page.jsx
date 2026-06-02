'use client';
import { useEffect } from 'react';
import { useDashboardStore, useAuthStore } from '../../lib/store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import { Activity, Plus, TrendingUp, TrendingDown, CheckCircle, ExternalLink } from 'lucide-react';

const COLORS = ['#00a884', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { stats, fetchStats, loading } = useDashboardStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-wa-green/20 border-t-wa-green rounded-full animate-spin" />
          <p className="text-wa-text-secondary font-medium animate-pulse">Loading dashboard insights...</p>
        </div>
      </div>
    );
  }

  // Mappings for stats
  const totalContacts = stats?.totalContacts || 0;
  const totalTemplates = stats?.totalTemplates || 0;
  const unreadChats = stats?.totalUnreadMessages || 0;
  const sentToday = stats?.sentToday || 0;
  const activeConversations = stats?.activeConversations || 0;
  const campaignsRunning = stats?.campaignsRunning || 0;
  const botSessions = stats?.conversationsByStatus?.find(s => s._id === 'bot')?.count || 0;
  const deliveryRate = stats?.deliveryRate || 99.4;

  const statCards = [
    { label: 'Total Contacts', value: totalContacts, icon: 'group', color: 'text-primary bg-primary/10', trend: '12%', up: true },
    { label: 'Templates', value: totalTemplates, icon: 'description', color: 'text-status-info bg-status-info/10', trend: '4%', up: true },
    { label: 'Unread', value: unreadChats, icon: 'mark_chat_unread', color: 'text-status-warn bg-status-warn/10', trend: '2%', up: false },
    { label: 'Sent Today', value: sentToday, icon: 'send', color: 'text-primary bg-primary/10', trend: '28%', up: true },
    { label: 'Active', value: activeConversations, icon: 'bolt', color: 'text-status-info bg-status-info/10', trend: '1.2%', up: true },
    { label: 'Campaigns', value: campaignsRunning, icon: 'campaign', color: 'text-primary bg-primary/10', trend: 'Steady', up: null },
    { label: 'Bot Sessions', value: botSessions, icon: 'smart_toy', color: 'text-tertiary bg-tertiary/10', trend: '15%', up: true },
    { label: 'Delivery Rate', value: `${deliveryRate}%`, icon: 'done_all', color: 'text-primary bg-primary/10', trend: 'Max', up: true },
  ];

  const dailyData = (stats?.dailyMessages || []).map(d => ({
    date: d._id?.slice(5) || '',
    messages: d.count
  }));

  const sourceData = (stats?.conversationsBySource || []).map(d => ({
    name: d._id ? (d._id.charAt(0).toUpperCase() + d._id.slice(1)) : 'Direct Link',
    count: d.count
  }));

  const statusData = (stats?.conversationsByStatus || []).map(d => ({
    name: d._id ? (d._id.charAt(0).toUpperCase() + d._id.slice(1)) : 'Resolved',
    value: d.count
  }));

  // Resolve items from database stats
  const chartData = dailyData.length ? dailyData : Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().slice(5, 10),
      messages: 0
    };
  });

  const donutData = statusData.length ? statusData : [
    { name: 'Resolved', value: 0 },
    { name: 'Bot', value: 0 },
    { name: 'Human', value: 0 },
    { name: 'AI', value: 0 },
    { name: 'Waiting', value: 0 }
  ];

  const progressSources = sourceData.length ? sourceData : [
    { name: 'Website', count: 0 },
    { name: 'Instagram', count: 0 },
    { name: 'Facebook', count: 0 },
    { name: 'Direct Link', count: 0 },
  ];

  const maxSourceCount = Math.max(...progressSources.map(s => s.count), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-wa-text-primary dark:text-white">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'User'} 👋
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-wa-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-wa-green"></span>
            </span>
            <span className="text-wa-green font-bold">System Online</span>
            <span className="text-wa-text-secondary dark:text-wa-dark-text-secondary">• All nodes functioning at 99.9% uptime</span>
          </div>
        </div>
        <Link
          href="/dashboard/campaigns"
          className="btn-primary flex items-center justify-center gap-2 self-start sm:self-auto text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </Link>
      </div>

      {/* Horizontal Stats Scroll/Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className="glass-card p-4 rounded-2xl flex flex-col justify-between hover:shadow-wa-md hover:-translate-y-1 transition-all duration-300 min-h-[110px]"
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`material-symbols-outlined ${card.color} p-1.5 rounded-lg text-lg shrink-0`}>
                {card.icon}
              </span>
              {card.up !== null && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${card.up ? 'text-wa-green' : 'text-rose-500'}`}>
                  {card.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {card.trend}
                </span>
              )}
              {card.up === null && (
                <span className="text-amber-500 text-[10px] font-bold">
                  {card.trend}
                </span>
              )}
            </div>
            <div>
              <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold uppercase tracking-wider truncate">
                {card.label}
              </p>
              <p className="text-xl font-extrabold text-wa-text-primary dark:text-white mt-0.5">
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Messages Chart (Area) */}
        <div className="col-span-12 lg:col-span-8 glass-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white uppercase tracking-wider">
              Messages Last 7 Days
            </h3>
            <div className="flex gap-2 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 bg-wa-green/10 text-wa-green px-2.5 py-1 rounded-full border border-wa-green/20">
                <span className="w-1.5 h-1.5 rounded-full bg-wa-green"></span> Sent messages
              </span>
              <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-full border border-blue-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Received chats
              </span>
            </div>
          </div>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00a884" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00a884" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.5} />
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stroke="#00a884"
                  strokeWidth={2.5}
                  fill="url(#msgGradient)"
                  dot={{ fill: '#00a884', r: 4, strokeWidth: 1 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversation Status (Donut) */}
        <div className="col-span-12 lg:col-span-4 glass-card p-6 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-white uppercase tracking-wider mb-4">
            Conversation Status
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-44 h-44 my-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-wa-text-primary dark:text-white">
                  {donutData.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
                <span className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold uppercase tracking-wider mt-0.5">
                  Total
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 w-full gap-3 mt-4">
              {donutData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate text-wa-text-primary dark:text-white leading-tight">
                      {d.name}
                    </span>
                    <span className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                      {d.value} sessions
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conversations by Source (Bar progress) */}
        <div className="col-span-12 lg:col-span-4 glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white uppercase tracking-wider mb-6">
              Conversations by Source
            </h3>
            <div className="space-y-4">
              {progressSources.map((s, i) => {
                const pct = Math.round((s.count / maxSourceCount) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-bold text-wa-text-primary dark:text-white">{s.name}</span>
                      <span className="text-wa-text-secondary dark:text-wa-dark-text-secondary font-semibold">{s.count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-wa-panel-header dark:bg-wa-dark-panel-header rounded-full overflow-hidden">
                      <div
                        className="h-full bg-wa-green rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-wa-border dark:border-wa-dark-border text-center">
            <Link
              href="/dashboard/analytics"
              className="text-wa-green hover:text-wa-green-dark font-bold text-xs inline-flex items-center gap-1 hover:underline"
            >
              <span>View Detailed Source Report</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="col-span-12 lg:col-span-8 glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white uppercase tracking-wider mb-6">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/dashboard/campaigns"
                className="flex flex-col items-center justify-center p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl hover:bg-wa-green/10 hover:border-wa-green/30 transition-all group text-center"
              >
                <div className="w-11 h-11 rounded-full bg-wa-green/10 flex items-center justify-center text-wa-green mb-3 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl">send</span>
                </div>
                <span className="font-bold text-xs text-wa-text-primary dark:text-white">New Campaign</span>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Blast to audience</p>
              </Link>

              <Link
                href="/dashboard/contacts"
                className="flex flex-col items-center justify-center p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group text-center"
              >
                <div className="w-11 h-11 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-3 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl">person_add</span>
                </div>
                <span className="font-bold text-xs text-wa-text-primary dark:text-white">Import Contacts</span>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">CSV or API sync</p>
              </Link>

              <Link
                href="/dashboard/bot-builder"
                className="flex flex-col items-center justify-center p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl hover:bg-rose-500/10 hover:border-rose-500/30 transition-all group text-center"
              >
                <div className="w-11 h-11 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-3 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl">account_tree</span>
                </div>
                <span className="font-bold text-xs text-wa-text-primary dark:text-white">Create Bot Flow</span>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Design automation</p>
              </Link>

              <Link
                href="/dashboard/inbox"
                className="flex flex-col items-center justify-center p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl hover:bg-wa-green/10 hover:border-wa-green/30 transition-all group text-center"
              >
                <div className="w-11 h-11 rounded-full bg-wa-green/10 flex items-center justify-center text-wa-green mb-3 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-xl">inbox</span>
                </div>
                <span className="font-bold text-xs text-wa-text-primary dark:text-white">Open Inbox</span>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Reply to users</p>
              </Link>
            </div>
          </div>

          {/* Secondary Quick Action items */}
          <div className="mt-6 pt-4 border-t border-wa-border dark:border-wa-dark-border flex flex-wrap gap-2.5">
            <button className="px-3.5 py-2 text-[10px] font-bold border border-wa-border dark:border-wa-dark-border rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors flex items-center gap-1.5 text-wa-text-primary dark:text-white">
              <span className="material-symbols-outlined text-sm">download</span> Export Daily Logs
            </button>
            <Link
              href="/dashboard/settings?tab=integrations"
              className="px-3.5 py-2 text-[10px] font-bold border border-wa-border dark:border-wa-dark-border rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors flex items-center gap-1.5 text-wa-text-primary dark:text-white"
            >
              <span className="material-symbols-outlined text-sm">settings_ethernet</span> API Integrations
            </Link>
            <Link
              href="/dashboard/templates"
              className="px-3.5 py-2 text-[10px] font-bold border border-wa-border dark:border-wa-dark-border rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors flex items-center gap-1.5 text-wa-text-primary dark:text-white"
            >
              <span className="material-symbols-outlined text-sm">verified</span> Manage Templates
            </Link>
          </div>
        </div>
      </div>

      {/* Footer / Credits Section */}
      <footer className="mt-8 text-center py-4 border-t border-wa-border/30">
        <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
          © 2026 Ajnabh Connect Enterprise Suite. All systems operational. Version 4.2.1-stable
        </p>
      </footer>
    </div>
  );
}
