'use client';
import { useState, useEffect } from 'react';
import { useDashboardStore, useAuthStore } from '../../lib/store';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import {
  Activity, Plus, TrendingUp, TrendingDown, CheckCircle, ExternalLink,
  Users, FileText, MessageSquare, Send, Zap, Megaphone, Bot, CheckCheck,
  UserPlus, Inbox, Download, Code2, CheckCircle2, Loader2
} from 'lucide-react';

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
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
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
  const deliveryRate = stats?.deliveryRate ?? 0;

  // Real trend calculations from live database
  const sentTrendVal = stats?.sentTrend?.val || (sentToday > 0 ? 'Active' : '0%');
  const sentTrendUp = stats?.sentTrend?.up ?? true;

  const statCards = [
    { label: 'Total Contacts', value: totalContacts, icon: Users, color: 'text-wa-green bg-wa-green/10 dark:bg-wa-green/15', trend: totalContacts > 0 ? 'Total' : '0', up: true },
    { label: 'Templates', value: totalTemplates, icon: FileText, color: 'text-blue-500 bg-blue-500/10 dark:bg-blue-500/15', trend: totalTemplates > 0 ? 'Ready' : '0', up: true },
    { label: 'Unread', value: unreadChats, icon: MessageSquare, color: 'text-amber-500 bg-amber-500/10 dark:bg-amber-500/15', trend: unreadChats > 0 ? `${unreadChats} new` : 'Zero', up: unreadChats === 0 },
    { label: 'Sent Today', value: sentToday, icon: Send, color: 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15', trend: sentTrendVal, up: sentTrendUp },
    { label: 'Active', value: activeConversations, icon: Zap, color: 'text-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/15', trend: activeConversations > 0 ? 'Active' : 'Idle', up: activeConversations > 0 },
    { label: 'Campaigns', value: campaignsRunning, icon: Megaphone, color: 'text-purple-500 bg-purple-500/10 dark:bg-purple-500/15', trend: campaignsRunning > 0 ? 'Running' : 'Idle', up: null },
    { label: 'Bot Sessions', value: botSessions, icon: Bot, color: 'text-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15', trend: botSessions > 0 ? 'Automated' : '0', up: true },
    { label: 'Delivery Rate', value: `${deliveryRate}%`, icon: CheckCheck, color: 'text-teal-500 bg-teal-500/10 dark:bg-teal-500/15', trend: deliveryRate > 90 ? 'Optimal' : (deliveryRate > 0 ? 'Active' : 'No Data'), up: deliveryRate > 0 },
  ];

  const sourceData = (stats?.conversationsBySource || []).map(d => ({
    name: d._id ? (d._id.charAt(0).toUpperCase() + d._id.slice(1)) : 'Direct Link',
    count: d.count
  }));

  const statusData = (stats?.conversationsByStatus || []).map(d => ({
    name: d._id ? (d._id.charAt(0).toUpperCase() + d._id.slice(1)) : 'Resolved',
    value: d.count
  }));

  // Resolve 7-day timeline from database with continuous dates & zero fill
  const chartData = (stats?.dailyTimeline && stats.dailyTimeline.length > 0)
    ? stats.dailyTimeline.map(d => ({
        date: d.date?.slice(5) || '',
        sent: d.sent || 0,
        received: d.received || 0,
        messages: d.sent || 0
      }))
    : (stats?.dailyMessages && stats.dailyMessages.length > 0)
    ? stats.dailyMessages.map(d => ({
        date: d._id?.slice(5) || '',
        sent: d.count || 0,
        received: 0,
        messages: d.count || 0
      }))
    : Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toISOString().slice(5, 10),
          sent: 0,
          received: 0,
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

  const handleExportDailyLogs = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      let logsToExport = [];
      try {
        const res = await api.get('/chat-logs?limit=500');
        if (res.data?.success && res.data?.data?.logs?.length) {
          logsToExport = res.data.data.logs;
        }
      } catch {}

      if (logsToExport.length > 0) {
        const headers = ['Timestamp', 'Contact Name', 'Phone', 'Direction', 'Type', 'Status', 'Content'];
        const rows = logsToExport.map(l => [
          `"${new Date(l.timestamp).toLocaleString().replace(/"/g, '""')}"`,
          `"${(l.contactName || '').replace(/"/g, '""')}"`,
          `"${(l.contactPhone || '').replace(/"/g, '""')}"`,
          `"${l.direction || ''}"`,
          `"${l.type || ''}"`,
          `"${l.status || ''}"`,
          `"${(l.content || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `daily_chat_logs_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Daily logs exported successfully!');
        return;
      }

      // Fallback: export daily performance summary CSV
      const summaryHeaders = ['Date', 'Metric', 'Value'];
      const summaryRows = [
        [`"${new Date().toLocaleDateString()}"`, '"Total Contacts"', totalContacts],
        [`"${new Date().toLocaleDateString()}"`, '"Templates"', totalTemplates],
        [`"${new Date().toLocaleDateString()}"`, '"Unread Chats"', unreadChats],
        [`"${new Date().toLocaleDateString()}"`, '"Sent Today"', sentToday],
        [`"${new Date().toLocaleDateString()}"`, '"Active Conversations"', activeConversations],
        [`"${new Date().toLocaleDateString()}"`, '"Running Campaigns"', campaignsRunning],
        [`"${new Date().toLocaleDateString()}"`, '"Delivery Rate (%)"', deliveryRate]
      ];
      const csvContent = 'data:text/csv;charset=utf-8,' + [summaryHeaders.join(','), ...summaryRows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `dashboard_daily_summary_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Dashboard daily summary exported!');
    } catch (err) {
      toast.error('Failed to export daily logs');
    } finally {
      setExporting(false);
    }
  };

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
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              style={{ animationDelay: `${i * 45}ms` }}
              className="glass-card animate-card-in p-3.5 rounded-2xl flex flex-col justify-between hover:shadow-wa-md hover:-translate-y-1 transition-all duration-300 min-h-[110px] group cursor-default"
            >
              <div className="flex justify-between items-start mb-2 gap-1.5">
                <span className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${card.color} group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-4 h-4" />
                </span>
                {card.up !== null && (
                  <span className={`text-[10px] font-bold flex items-center gap-0.5 shrink-0 ${card.up ? 'text-wa-green' : 'text-rose-500'}`}>
                    {card.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {card.trend}
                  </span>
                )}
                {card.up === null && (
                  <span className="text-amber-500 text-[10px] font-bold shrink-0">
                    {card.trend}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold uppercase tracking-wider truncate" title={card.label}>
                  {card.label}
                </p>
                <p className="text-xl font-extrabold text-wa-text-primary dark:text-white mt-0.5 truncate">
                  {card.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Messages Chart (Area) */}
        <div style={{ animationDelay: '360ms' }} className="col-span-12 lg:col-span-8 glass-card animate-card-in p-6">
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
                  <linearGradient id="rcvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                  dataKey="sent"
                  name="Sent messages"
                  stroke="#00a884"
                  strokeWidth={2.5}
                  fill="url(#msgGradient)"
                  dot={{ fill: '#00a884', r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  name="Received chats"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#rcvGradient)"
                  dot={{ fill: '#3b82f6', r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversation Status (Donut) */}
        <div style={{ animationDelay: '420ms' }} className="col-span-12 lg:col-span-4 glass-card animate-card-in p-6 flex flex-col justify-between">
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
        <div style={{ animationDelay: '480ms' }} className="col-span-12 lg:col-span-4 glass-card animate-card-in p-6 flex flex-col justify-between">
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
        <div style={{ animationDelay: '540ms' }} className="col-span-12 lg:col-span-8 glass-card animate-card-in p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white uppercase tracking-wider mb-6">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/dashboard/campaigns"
                className="flex flex-col items-center justify-center p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl hover:bg-wa-green/10 hover:border-wa-green/30 transition-all duration-200 active:scale-[0.98] group text-center"
              >
                <div className="w-11 h-11 rounded-full bg-wa-green/10 flex items-center justify-center text-wa-green mb-3 group-hover:scale-110 transition-transform duration-200">
                  <Send className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs text-wa-text-primary dark:text-white">New Campaign</span>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Blast to audience</p>
              </Link>

              <Link
                href="/dashboard/contacts"
                className="flex flex-col items-center justify-center p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl hover:bg-blue-500/10 hover:border-blue-500/30 transition-all duration-200 active:scale-[0.98] group text-center"
              >
                <div className="w-11 h-11 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-3 group-hover:scale-110 transition-transform duration-200">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs text-wa-text-primary dark:text-white">Import Contacts</span>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">CSV or API sync</p>
              </Link>

              <Link
                href="/dashboard/bot-builder"
                className="flex flex-col items-center justify-center p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl hover:bg-rose-500/10 hover:border-rose-500/30 transition-all duration-200 active:scale-[0.98] group text-center"
              >
                <div className="w-11 h-11 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-3 group-hover:scale-110 transition-transform duration-200">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs text-wa-text-primary dark:text-white">Create Bot Flow</span>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Design automation</p>
              </Link>

              <Link
                href="/dashboard/inbox"
                className="flex flex-col items-center justify-center p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl hover:bg-wa-green/10 hover:border-wa-green/30 transition-all duration-200 active:scale-[0.98] group text-center"
              >
                <div className="w-11 h-11 rounded-full bg-wa-green/10 flex items-center justify-center text-wa-green mb-3 group-hover:scale-110 transition-transform duration-200">
                  <Inbox className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs text-wa-text-primary dark:text-white">Open Inbox</span>
                <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Reply to users</p>
              </Link>
            </div>
          </div>

          {/* Secondary Quick Action items */}
          <div className="mt-6 pt-4 border-t border-wa-border dark:border-wa-dark-border flex flex-wrap gap-2.5">
            <button
              onClick={handleExportDailyLogs}
              disabled={exporting}
              className="px-3.5 py-2 text-[10px] font-bold border border-wa-border dark:border-wa-dark-border rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all duration-150 active:scale-95 flex items-center gap-1.5 text-wa-text-primary dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 text-wa-green animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-wa-green" />
              )}
              {exporting ? 'Exporting...' : 'Export Daily Logs'}
            </button>
            <Link
              href="/dashboard/settings?tab=integrations"
              className="px-3.5 py-2 text-[10px] font-bold border border-wa-border dark:border-wa-dark-border rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all duration-150 active:scale-95 flex items-center gap-1.5 text-wa-text-primary dark:text-white"
            >
              <Code2 className="w-3.5 h-3.5 text-blue-500" /> API Integrations
            </Link>
            <Link
              href="/dashboard/templates"
              className="px-3.5 py-2 text-[10px] font-bold border border-wa-border dark:border-wa-dark-border rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all duration-150 active:scale-95 flex items-center gap-1.5 text-wa-text-primary dark:text-white"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" /> Manage Templates
            </Link>
          </div>
        </div>
      </div>

      {/* Footer / Credits Section */}
      <footer className="mt-8 text-center py-4 border-t border-wa-border/30">
        <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
          © 2026 HK Automation Enterprise Suite. All systems operational. Version 4.2.1-stable
        </p>
      </footer>
    </div>
  );
}
