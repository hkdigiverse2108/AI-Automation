'use client';
import { useEffect } from 'react';
import { useDashboardStore, useAuthStore } from '../../lib/store';
import { Users, MessageSquare, Radio, Megaphone, Bot, TrendingUp, ArrowUpRight, ArrowDownRight, Zap, Inbox, FileText, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import Link from 'next/link';

const COLORS = ['#00a884', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { stats, fetchStats, loading } = useDashboardStore();
  const { user } = useAuthStore();

  useEffect(() => { fetchStats(); }, []);

  const statCards = [
    { label: 'Total Contacts', value: stats?.totalContacts || 0, icon: Users, color: 'bg-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-900/15', trend: '+12%', up: true },
    { label: 'Total Templates', value: stats?.totalTemplates || 0, icon: FileText, color: 'bg-indigo-500', lightBg: 'bg-indigo-50 dark:bg-indigo-900/15', trend: 'Active', up: true },
    { label: 'Unread Chats', value: stats?.totalUnreadMessages || 0, icon: Inbox, color: 'bg-pink-500', lightBg: 'bg-pink-50 dark:bg-pink-900/15', trend: 'New', up: true },
    { label: 'Sent Today', value: stats?.sentToday || 0, icon: MessageSquare, color: 'bg-wa-green', lightBg: 'bg-emerald-50 dark:bg-emerald-900/15', trend: '+8%', up: true },
    { label: 'Active Chats', value: stats?.activeConversations || 0, icon: Radio, color: 'bg-purple-500', lightBg: 'bg-purple-50 dark:bg-purple-900/15', trend: '+3', up: true },
    { label: 'Campaigns', value: stats?.campaignsRunning || 0, icon: Megaphone, color: 'bg-amber-500', lightBg: 'bg-amber-50 dark:bg-amber-900/15', trend: '0', up: false },
    { label: 'Bot Sessions', value: stats?.conversationsByStatus?.find(s => s._id === 'bot')?.count || 0, icon: Bot, color: 'bg-cyan-500', lightBg: 'bg-cyan-50 dark:bg-cyan-900/15', trend: '+5', up: true },
    { label: 'Delivery Rate', value: `${stats?.deliveryRate || 0}%`, icon: TrendingUp, color: 'bg-rose-500', lightBg: 'bg-rose-50 dark:bg-rose-900/15', trend: '+2%', up: true },
  ];

  const dailyData = (stats?.dailyMessages || []).map(d => ({ date: d._id?.slice(5) || '', messages: d.count }));
  const sourceData = (stats?.conversationsBySource || []).map(d => ({ name: d._id || 'direct', count: d.count }));
  const statusData = (stats?.conversationsByStatus || []).map(d => ({ name: d._id, value: d.count }));

  const quickActions = [
    { label: 'New Campaign', href: '/dashboard/campaigns', icon: Megaphone, color: 'bg-wa-green' },
    { label: 'Import Contacts', href: '/dashboard/contacts', icon: Users, color: 'bg-blue-500' },
    { label: 'Create Bot Flow', href: '/dashboard/bot-builder', icon: Bot, color: 'bg-purple-500' },
    { label: 'Open Inbox', href: '/dashboard/inbox', icon: Inbox, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Here's your WhatsApp business overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-wa-green/10 text-wa-green text-xs font-medium">
            <Activity className="w-3.5 h-3.5" />
            <span>System Online</span>
          </div>
        </div>
      </div>

      {/* Stat Cards — Meta Business Suite flat style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="glass-card p-5 group hover:shadow-wa-md transition-all duration-300" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${card.lightBg} rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                <card.icon className={`w-5 h-5 ${card.color.replace('bg-', 'text-')}`} />
              </div>
              <div className={`flex items-center gap-0.5 text-xs font-medium ${card.up ? 'text-wa-green' : 'text-wa-text-light'}`}>
                {card.up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {card.trend}
              </div>
            </div>
            <p className="text-2xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">{card.value}</p>
            <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Area Chart */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary mb-4">Messages — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a884" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00a884" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
              />
              <Area type="monotone" dataKey="messages" stroke="#00a884" strokeWidth={2.5} fill="url(#msgGradient)" dot={{ fill: '#00a884', r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Source Bar Chart */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary mb-4">Conversations by Source</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sourceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Donut */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary mb-4">Conversation Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className="flex flex-col items-center gap-3 p-5 rounded-xl bg-wa-panel-header dark:bg-wa-dark-panel-header hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all duration-200 group border border-transparent hover:border-wa-border dark:hover:border-wa-dark-border"
              >
                <div className={`w-12 h-12 ${a.color} rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg ${a.color.replace('bg-', 'shadow-')}/25`}>
                  <a.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-wa-text-primary dark:text-wa-dark-text-primary">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
