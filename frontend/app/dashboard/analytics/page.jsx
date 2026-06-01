'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  BarChart3, TrendingUp, Users, MessageSquare, Target, Zap,
  Calendar, ArrowUpRight, ArrowDownRight, Loader2, RefreshCw,
  Send, Eye, Reply, Activity, Clock, Flame
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import api from '../../../lib/api';

const COLORS = ['#00a884', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-xl p-3 text-xs">
      <p className="font-bold text-wa-text-primary dark:text-white mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-wa-text-secondary">{p.name}:</span>
          <span className="font-bold text-wa-text-primary dark:text-white">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [messageTrends, setMessageTrends] = useState([]);
  const [contactGrowth, setContactGrowth] = useState([]);
  const [campaignPerf, setCampaignPerf] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [convStats, setConvStats] = useState({ byStatus: [], bySource: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [overviewRes, trendsRes, growthRes, campRes, heatRes, convRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get(`/analytics/message-trends?days=${period}`),
        api.get(`/analytics/contact-growth?days=${period}`),
        api.get('/analytics/campaign-performance'),
        api.get(`/analytics/hourly-activity?days=${period}`),
        api.get('/analytics/conversation-stats'),
      ]);

      if (overviewRes.data.success) setOverview(overviewRes.data.data);
      if (trendsRes.data.success) setMessageTrends(trendsRes.data.data.trends || []);
      if (growthRes.data.success) setContactGrowth(growthRes.data.data.growth || []);
      if (campRes.data.success) setCampaignPerf(campRes.data.data.campaigns || []);
      if (heatRes.data.success) setHeatmap(heatRes.data.data.heatmap || []);
      if (convRes.data.success) setConvStats(convRes.data.data);
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [period]);

  // Heatmap helper
  const getHeatmapColor = (count) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count < 5) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (count < 20) return 'bg-emerald-300 dark:bg-emerald-700/50';
    if (count < 50) return 'bg-emerald-500 dark:bg-emerald-600/70';
    return 'bg-emerald-700 dark:bg-emerald-500';
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
          <span className="text-sm font-semibold text-wa-text-secondary">Loading analytics...</span>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Contacts', value: overview?.totalContacts || 0, icon: Users, color: '#3b82f6', change: `+${overview?.newContacts30d || 0} this month`, up: true },
    { label: 'Total Messages', value: overview?.totalMessages || 0, icon: MessageSquare, color: '#00a884', change: `${overview?.messagesSent7d || 0} sent 7d`, up: true },
    { label: 'Delivery Rate', value: `${overview?.deliveryRate || 0}%`, icon: Send, color: '#8b5cf6', change: 'Outbound', up: overview?.deliveryRate > 80 },
    { label: 'Read Rate', value: `${overview?.readRate || 0}%`, icon: Eye, color: '#f59e0b', change: 'Of delivered', up: overview?.readRate > 50 },
    { label: 'Reply Rate', value: `${overview?.replyRate || 0}%`, icon: Reply, color: '#ec4899', change: 'Engagement', up: overview?.replyRate > 20 },
    { label: 'Conversations', value: overview?.totalConversations || 0, icon: Activity, color: '#06b6d4', change: 'All time', up: true },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-wa-green" />
            Analytics & Insights
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Deep dive into your WhatsApp business performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl p-1">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === d
                    ? 'bg-wa-green text-white shadow-sm'
                    : 'text-wa-text-secondary hover:text-wa-text-primary'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl text-xs font-semibold text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className="glass-card p-4 group hover:shadow-wa-md transition-all duration-300 hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.color + '15' }}
              >
                <card.icon className="w-4.5 h-4.5" style={{ color: card.color }} />
              </div>
              <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${card.up ? 'text-wa-green' : 'text-red-400'}`}>
                {card.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span className="hidden sm:inline">{card.change}</span>
              </div>
            </div>
            <p className="text-xl font-extrabold text-wa-text-primary dark:text-wa-dark-text-primary tabular-nums">
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
            <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5 font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Message Trends + Delivery Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Volume Trends — Takes 2 columns */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-wa-green" />
              Message Volume — {period} Days
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={messageTrends}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a884" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00a884" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickFormatter={v => v?.slice(5)} />
              <YAxis stroke="var(--text-secondary)" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="sent" name="Sent" stroke="#00a884" strokeWidth={2} fill="url(#sentGrad)" dot={false} activeDot={{ r: 5, fill: '#00a884' }} />
              <Area type="monotone" dataKey="received" name="Received" stroke="#3b82f6" strokeWidth={2} fill="url(#recvGrad)" dot={false} activeDot={{ r: 5, fill: '#3b82f6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Conversation Status Donut */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" />
            Conversation Status
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={convStats.byStatus}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {convStats.byStatus.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {convStats.byStatus.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-wa-text-secondary capitalize">{s.name}: <span className="font-bold text-wa-text-primary dark:text-white">{s.value}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Contact Growth + Campaign Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Growth */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Contact Growth
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={contactGrowth}>
              <defs>
                <linearGradient id="contactGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickFormatter={v => v?.slice(5)} />
              <YAxis stroke="var(--text-secondary)" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" name="Total Contacts" stroke="#3b82f6" strokeWidth={2} fill="url(#contactGrad)" dot={false} />
              <Bar dataKey="newContacts" name="New" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Campaign Performance */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-500" />
            Campaign Performance
          </h3>
          {campaignPerf.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={campaignPerf.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" stroke="var(--text-secondary)" fontSize={10} />
                <YAxis dataKey="name" type="category" width={100} stroke="var(--text-secondary)" fontSize={10} tick={{ fontSize: 9 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sent" name="Sent" fill="#00a884" radius={[0, 4, 4, 0]} stackId="a" />
                <Bar dataKey="delivered" name="Delivered" fill="#3b82f6" radius={[0, 4, 4, 0]} stackId="b" />
                <Bar dataKey="read" name="Read" fill="#f59e0b" radius={[0, 4, 4, 0]} stackId="c" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-wa-text-secondary text-xs">
              <div className="text-center space-y-2">
                <Target className="w-8 h-8 mx-auto opacity-30" />
                <p>No campaign data yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 3: Hourly Activity Heatmap + Conversation Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Activity Heatmap */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary mb-4 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Activity Heatmap — {period} Days
          </h3>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex gap-0.5 mb-1 ml-10">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="flex-1 text-center text-[8px] text-wa-text-light font-mono">
                    {i.toString().padStart(2, '0')}
                  </div>
                ))}
              </div>
              {/* Day rows */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="flex items-center gap-0.5 mb-0.5">
                  <span className="w-9 text-[9px] text-wa-text-secondary font-semibold text-right pr-1">{day}</span>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = heatmap.find(h => h.day === day && h.hour === hour);
                    const count = cell?.count || 0;
                    return (
                      <div
                        key={hour}
                        className={`flex-1 h-5 rounded-[3px] ${getHeatmapColor(count)} transition-colors cursor-default`}
                        title={`${day} ${hour}:00 — ${count} messages`}
                      />
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-1 mt-3 ml-10 text-[9px] text-wa-text-light">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
                <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/30" />
                <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-700/50" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600/70" />
                <div className="w-3 h-3 rounded-sm bg-emerald-700 dark:bg-emerald-500" />
                <span>More</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation Sources */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-500" />
            Conversation Sources
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={convStats.bySource}
                cx="50%"
                cy="50%"
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {convStats.bySource.map((_, i) => (
                  <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {convStats.bySource.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[(i + 3) % COLORS.length] }} />
                <span className="text-wa-text-secondary capitalize">{s.name}: <span className="font-bold text-wa-text-primary dark:text-white">{s.value}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign Performance Table */}
      {campaignPerf.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-wa-border dark:border-wa-dark-border">
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
              <Target className="w-4 h-4 text-wa-green" />
              Campaign Details
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-wa-border dark:border-wa-dark-border text-wa-text-secondary uppercase text-[10px] tracking-wider bg-wa-panel-header/50 dark:bg-wa-dark-panel-header/20">
                  <th className="py-3 px-4 font-bold">Campaign</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Sent</th>
                  <th className="py-3 px-4 font-bold text-right">Delivered</th>
                  <th className="py-3 px-4 font-bold text-right">Read</th>
                  <th className="py-3 px-4 font-bold text-right">Delivery %</th>
                  <th className="py-3 px-4 font-bold text-right">Read %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border">
                {campaignPerf.slice(0, 10).map((c, i) => (
                  <tr key={i} className="hover:bg-wa-hover/30 dark:hover:bg-wa-dark-hover/10 transition-colors">
                    <td className="py-3 px-4 font-semibold text-wa-text-primary dark:text-white">{c.name}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        c.status === 'running' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                        'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {c.status || 'draft'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{c.sent.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono">{c.delivered.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono">{c.read.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${c.deliveryRate >= 90 ? 'text-emerald-500' : c.deliveryRate >= 70 ? 'text-amber-500' : 'text-red-400'}`}>
                        {c.deliveryRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${c.readRate >= 50 ? 'text-emerald-500' : c.readRate >= 30 ? 'text-amber-500' : 'text-red-400'}`}>
                        {c.readRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
