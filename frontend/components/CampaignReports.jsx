'use client';
import { useState, useMemo } from 'react';
import {
  BarChart2, TrendingUp, CheckCircle2, AlertTriangle, Eye, Reply,
  Calendar, Download, ArrowUpRight, Search, Filter, Megaphone,
  CheckCheck, Clock, Layers, Sparkles, RefreshCw, ChevronDown, History
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { formatDate } from '../lib/utils';

export default function CampaignReports({ campaigns = [], onRefresh, loading = false, onViewLogs }) {
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'today' | '7d' | '30d'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'running' | 'failed' | 'scheduled'
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter campaigns based on user selections
  const filteredCampaigns = useMemo(() => {
    const now = new Date();
    return campaigns.filter(c => {
      // Date filter
      if (timeFilter !== 'all') {
        const cDate = new Date(c.createdAt || c.startedAt);
        if (timeFilter === 'today') {
          const isToday = cDate.toDateString() === now.toDateString();
          if (!isToday) return false;
        } else if (timeFilter === '7d') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (cDate < sevenDaysAgo) return false;
        } else if (timeFilter === '30d') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (cDate < thirtyDaysAgo) return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (c.status !== statusFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const templateMatch = (c.templateName || '').toLowerCase().includes(q);
        if (!nameMatch && !templateMatch) return false;
      }

      return true;
    });
  }, [campaigns, timeFilter, statusFilter, searchQuery]);

  // 2. Aggregate KPI Metrics
  const metrics = useMemo(() => {
    let totalTargeted = 0;
    let totalSent = 0;
    let totalDelivered = 0;
    let totalRead = 0;
    let totalReplied = 0;
    let totalFailed = 0;

    filteredCampaigns.forEach(c => {
      totalTargeted += (c.audience?.totalCount || c.stats?.sent || 0);
      totalSent += (c.stats?.sent || 0);
      totalDelivered += (c.stats?.delivered || 0);
      totalRead += (c.stats?.read || 0);
      totalReplied += (c.stats?.replied || 0);
      totalFailed += (c.stats?.failed || 0);
    });

    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
    const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;
    const replyRate = totalDelivered > 0 ? Math.round((totalReplied / totalDelivered) * 100) : 0;
    const failRate = totalSent + totalFailed > 0 ? Math.round((totalFailed / (totalSent + totalFailed)) * 100) : 0;

    return {
      totalCampaigns: filteredCampaigns.length,
      completedCount: filteredCampaigns.filter(c => c.status === 'completed').length,
      runningCount: filteredCampaigns.filter(c => c.status === 'running').length,
      scheduledCount: filteredCampaigns.filter(c => c.status === 'scheduled').length,
      failedCount: filteredCampaigns.filter(c => c.status === 'failed').length,
      totalTargeted,
      totalSent,
      totalDelivered,
      totalRead,
      totalReplied,
      totalFailed,
      deliveryRate,
      readRate,
      replyRate,
      failRate,
    };
  }, [filteredCampaigns]);

  // 3. Time Series Data for Trend Chart
  const trendData = useMemo(() => {
    const sorted = [...filteredCampaigns].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return sorted.map(c => ({
      name: c.name?.length > 15 ? c.name.slice(0, 15) + '...' : c.name,
      fullName: c.name,
      date: formatDate(c.createdAt),
      sent: c.stats?.sent || 0,
      delivered: c.stats?.delivered || 0,
      read: c.stats?.read || 0,
      failed: c.stats?.failed || 0,
      replied: c.stats?.replied || 0,
    }));
  }, [filteredCampaigns]);

  // 4. Template Performance Breakdown
  const templateBreakdown = useMemo(() => {
    const map = {};
    filteredCampaigns.forEach(c => {
      const tName = c.templateName || 'custom';
      if (!map[tName]) {
        map[tName] = {
          name: tName,
          campaignsCount: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          replied: 0,
          failed: 0,
        };
      }
      map[tName].campaignsCount += 1;
      map[tName].sent += (c.stats?.sent || 0);
      map[tName].delivered += (c.stats?.delivered || 0);
      map[tName].read += (c.stats?.read || 0);
      map[tName].replied += (c.stats?.replied || 0);
      map[tName].failed += (c.stats?.failed || 0);
    });

    return Object.values(map).map(item => ({
      ...item,
      deliveryRate: item.sent > 0 ? Math.round((item.delivered / item.sent) * 100) : 0,
      readRate: item.delivered > 0 ? Math.round((item.read / item.delivered) * 100) : 0,
    })).sort((a, b) => b.sent - a.sent);
  }, [filteredCampaigns]);

  // 5. Export to CSV Function
  const handleExportCSV = () => {
    if (filteredCampaigns.length === 0) {
      return alert('No campaigns available to export in this filter.');
    }

    const headers = [
      'Campaign Name',
      'Template Name',
      'Status',
      'Audience Type',
      'Total Targeted',
      'Sent',
      'Delivered',
      'Delivery Rate (%)',
      'Read',
      'Read Rate (%)',
      'Replied',
      'Failed',
      'Last Error',
      'Created Date',
      'Completed Date'
    ];

    const rows = filteredCampaigns.map(c => {
      const sent = c.stats?.sent || 0;
      const delivered = c.stats?.delivered || 0;
      const read = c.stats?.read || 0;
      const replied = c.stats?.replied || 0;
      const failed = c.stats?.failed || 0;
      const dRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
      const rRate = delivered > 0 ? Math.round((read / delivered) * 100) : 0;

      return [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.templateName || '').replace(/"/g, '""')}"`,
        `"${c.status || 'draft'}"`,
        `"${c.audience?.type || 'all'}"`,
        c.audience?.totalCount || sent,
        sent,
        delivered,
        `${dRate}%`,
        read,
        `${rRate}%`,
        replied,
        failed,
        `"${(c.lastError || '').replace(/"/g, '""')}"`,
        `"${c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}"`,
        `"${c.completedAt ? new Date(c.completedAt).toLocaleString() : ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `campaign_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Recharts Tooltip
  const CustomChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-3 rounded-xl shadow-lg text-xs space-y-1">
        <p className="font-bold text-wa-text-primary dark:text-white border-b pb-1 dark:border-wa-dark-border">
          {data?.fullName || label}
        </p>
        <div className="flex justify-between gap-4 text-emerald-600">
          <span>Sent:</span>
          <span className="font-semibold">{data?.sent}</span>
        </div>
        <div className="flex justify-between gap-4 text-blue-500">
          <span>Delivered:</span>
          <span className="font-semibold">{data?.delivered}</span>
        </div>
        <div className="flex justify-between gap-4 text-indigo-500">
          <span>Read:</span>
          <span className="font-semibold">{data?.read}</span>
        </div>
        {data?.failed > 0 && (
          <div className="flex justify-between gap-4 text-red-500 font-semibold">
            <span>Failed:</span>
            <span>{data?.failed}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filter and Action Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-wa-text-secondary" />
            <input
              type="text"
              placeholder="Search campaign or template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-wa-search dark:bg-wa-dark-search rounded-lg border border-wa-border dark:border-wa-dark-border focus:outline-none focus:ring-1 focus:ring-wa-green text-wa-text-primary dark:text-wa-dark-text-primary"
            />
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-1 bg-wa-search dark:bg-wa-dark-search p-1 rounded-lg border border-wa-border dark:border-wa-dark-border text-xs">
            {['all', 'today', '7d', '30d'].map((t) => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-all ${
                  timeFilter === t
                    ? 'bg-white dark:bg-wa-dark-panel text-wa-green font-semibold shadow-xs'
                    : 'text-wa-text-secondary hover:text-wa-text-primary'
                }`}
              >
                {t === 'all' ? 'All Time' : t === 'today' ? 'Today' : t === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-3 bg-wa-search dark:bg-wa-dark-search rounded-lg border border-wa-border dark:border-wa-dark-border text-wa-text-secondary focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed Only</option>
            <option value="running">Running Only</option>
            <option value="failed">Failed Only</option>
            <option value="scheduled">Scheduled Only</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {onViewLogs && (
            <button
              onClick={onViewLogs}
              className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5 hover:shadow-xs text-wa-text-primary dark:text-white"
            >
              <History className="w-3.5 h-3.5 text-wa-green" />
              <span>Activity Logs</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5 hover:shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Campaigns */}
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Campaigns</span>
            <Megaphone className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">
            {metrics.totalCampaigns}
          </div>
          <div className="text-[10px] text-wa-text-secondary">
            {metrics.completedCount} completed · {metrics.failedCount} failed
          </div>
        </div>

        {/* Total Sent */}
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Total Sent</span>
            <BarChart2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">
            {metrics.totalSent.toLocaleString()}
          </div>
          <div className="text-[10px] text-wa-text-secondary">
            Targeted: {metrics.totalTargeted.toLocaleString()} contacts
          </div>
        </div>

        {/* Delivery Rate */}
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Delivery Rate</span>
            <CheckCheck className="w-4 h-4 text-wa-green" />
          </div>
          <div className="text-2xl font-bold text-wa-green">
            {metrics.deliveryRate}%
          </div>
          <div className="text-[10px] text-wa-text-secondary">
            {metrics.totalDelivered.toLocaleString()} delivered to handsets
          </div>
        </div>

        {/* Read Rate */}
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Read / Open Rate</span>
            <Eye className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {metrics.readRate}%
          </div>
          <div className="text-[10px] text-wa-text-secondary">
            {metrics.totalRead.toLocaleString()} messages read
          </div>
        </div>

        {/* Reply Rate */}
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Reply Rate</span>
            <Reply className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {metrics.replyRate}%
          </div>
          <div className="text-[10px] text-wa-text-secondary">
            {metrics.totalReplied.toLocaleString()} direct customer replies
          </div>
        </div>

        {/* Failed Messages */}
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Failed / Bounced</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className={`text-2xl font-bold ${metrics.totalFailed > 0 ? 'text-red-500' : 'text-wa-text-primary dark:text-white'}`}>
            {metrics.totalFailed.toLocaleString()}
          </div>
          <div className="text-[10px] text-wa-text-secondary">
            {metrics.failRate}% failure rate
          </div>
        </div>
      </div>

      {/* Visual Conversion Funnel Card */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-wa-green" />
              Campaign Delivery Funnel
            </h3>
            <p className="text-xs text-wa-text-secondary">
              Progression from audience targeting to actual message reads and replies.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-wa-green/10 text-wa-green">
            Overall Health: {metrics.deliveryRate >= 80 ? 'Excellent 🌟' : metrics.deliveryRate >= 50 ? 'Good 👍' : 'Needs Attention ⚠️'}
          </span>
        </div>

        {/* Funnel Pipeline Stages */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          {/* Stage 1: Sent */}
          <div className="p-3.5 rounded-xl border border-wa-border dark:border-wa-dark-border bg-wa-panel-header/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-wa-text-secondary">1. Sent</span>
              <span className="font-bold text-blue-600">100%</span>
            </div>
            <div className="text-xl font-bold text-wa-text-primary dark:text-white">
              {metrics.totalSent.toLocaleString()}
            </div>
            <div className="w-full bg-wa-search dark:bg-wa-dark-search h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-2 rounded-full w-full" />
            </div>
            <p className="text-[10px] text-wa-text-secondary">Total messages blasted</p>
          </div>

          {/* Stage 2: Delivered */}
          <div className="p-3.5 rounded-xl border border-wa-border dark:border-wa-dark-border bg-wa-panel-header/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-wa-text-secondary">2. Delivered</span>
              <span className="font-bold text-emerald-600">{metrics.deliveryRate}%</span>
            </div>
            <div className="text-xl font-bold text-emerald-600">
              {metrics.totalDelivered.toLocaleString()}
            </div>
            <div className="w-full bg-wa-search dark:bg-wa-dark-search h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(metrics.deliveryRate, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-wa-text-secondary">Reached recipient handset</p>
          </div>

          {/* Stage 3: Read */}
          <div className="p-3.5 rounded-xl border border-wa-border dark:border-wa-dark-border bg-wa-panel-header/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-wa-text-secondary">3. Read</span>
              <span className="font-bold text-indigo-600">{metrics.readRate}%</span>
            </div>
            <div className="text-xl font-bold text-indigo-600">
              {metrics.totalRead.toLocaleString()}
            </div>
            <div className="w-full bg-wa-search dark:bg-wa-dark-search h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(metrics.readRate, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-wa-text-secondary">Opened by customer (blue ticks)</p>
          </div>

          {/* Stage 4: Replied */}
          <div className="p-3.5 rounded-xl border border-wa-border dark:border-wa-dark-border bg-wa-panel-header/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-wa-text-secondary">4. Replied</span>
              <span className="font-bold text-purple-600">{metrics.replyRate}%</span>
            </div>
            <div className="text-xl font-bold text-purple-600">
              {metrics.totalReplied.toLocaleString()}
            </div>
            <div className="w-full bg-wa-search dark:bg-wa-dark-search h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(metrics.replyRate, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-wa-text-secondary">Inbound replies received</p>
          </div>
        </div>
      </div>

      {/* Middle Row: Trend Chart & Template Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart (2 columns) */}
        <div className="glass-card p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Campaign Performance Timeline
              </h3>
              <p className="text-xs text-wa-text-secondary">Sent vs Delivered vs Read messages per campaign</p>
            </div>
          </div>

          {trendData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-wa-text-secondary text-xs">
              <BarChart2 className="w-8 h-8 opacity-20 mb-2" />
              <span>No campaign activity found for this period.</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-wa-border dark:text-wa-dark-border opacity-50" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-wa-text-secondary" />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-wa-text-secondary" />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="sent" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSent)" name="Sent" />
                  <Area type="monotone" dataKey="delivered" stroke="#10b981" fillOpacity={1} fill="url(#colorDelivered)" name="Delivered" />
                  <Area type="monotone" dataKey="read" stroke="#6366f1" fillOpacity={1} fill="url(#colorRead)" name="Read" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Template Leaderboard (1 column) */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Template Performance
            </h3>
            <span className="text-[10px] text-wa-text-secondary">Ranked by volume</span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {templateBreakdown.length === 0 ? (
              <p className="text-xs text-wa-text-secondary text-center py-8">No templates used yet.</p>
            ) : (
              templateBreakdown.map((t, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-wa-border/60 dark:border-wa-dark-border/60 bg-wa-panel-header/20 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold font-mono text-wa-text-primary dark:text-white truncate max-w-[130px]">
                      {t.name}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                      {t.readRate}% Read
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-wa-text-secondary">
                    <span>{t.campaignsCount} campaigns · {t.sent} sent</span>
                    <span>{t.deliveryRate}% delivered</span>
                  </div>
                  <div className="w-full bg-wa-search dark:bg-wa-dark-search h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${t.deliveryRate}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Campaigns Detailed Report Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header/50">
          <div>
            <h3 className="font-semibold text-sm text-wa-text-primary dark:text-wa-dark-text-primary">
              Campaign Breakdown Log ({filteredCampaigns.length})
            </h3>
            <p className="text-xs text-wa-text-secondary">Detailed delivery & read analytics for each blast</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-wa-border dark:border-wa-dark-border uppercase text-wa-text-secondary bg-wa-panel-header/30 font-semibold">
                <th className="px-6 py-3.5">Campaign</th>
                <th className="px-6 py-3.5">Template</th>
                <th className="px-6 py-3.5">Audience</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5 text-center">Sent</th>
                <th className="px-6 py-3.5">Delivery</th>
                <th className="px-6 py-3.5">Read Rate</th>
                <th className="px-6 py-3.5 text-center">Replies</th>
                <th className="px-6 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/50">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-wa-text-secondary">
                    No campaigns matching the filter.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => {
                  const sent = c.stats?.sent || 0;
                  const delivered = c.stats?.delivered || 0;
                  const read = c.stats?.read || 0;
                  const replied = c.stats?.replied || 0;
                  const failed = c.stats?.failed || 0;
                  const total = c.audience?.totalCount || sent || 1;
                  const dRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
                  const rRate = delivered > 0 ? Math.round((read / delivered) * 100) : 0;

                  return (
                    <tr key={c._id} className="hover:bg-wa-hover/50 dark:hover:bg-wa-dark-hover/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-wa-text-primary dark:text-white block">
                          {c.name}
                        </span>
                        {c.lastError && failed > 0 && (
                          <span className="text-[10px] text-red-500 truncate block max-w-xs mt-0.5" title={c.lastError}>
                            ⚠ {c.lastError}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-wa-text-secondary">
                        {c.templateName}
                      </td>
                      <td className="px-6 py-4 text-wa-text-secondary text-[11px]">
                        {c.audience?.type === 'group'
                          ? `Group: ${c.audience.groupIds?.[0]?.name || 'Selected'}`
                          : c.audience?.type === 'tag'
                          ? `Tags: ${c.audience.tags?.join(', ') || ''}`
                          : 'All Contacts'}
                      </td>
                      <td className="px-6 py-4 text-wa-text-secondary text-[11px]">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-wa-text-primary dark:text-white">
                        {sent}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 min-w-[110px]">
                          <div className="flex justify-between text-[11px] font-medium text-wa-text-secondary">
                            <span>{dRate}%</span>
                            <span>{delivered}/{sent}</span>
                          </div>
                          <div className="w-full bg-wa-search dark:bg-wa-dark-search rounded-full h-1.5 overflow-hidden">
                            <div className="bg-wa-green h-1.5 rounded-full" style={{ width: `${dRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 min-w-[110px]">
                          <div className="flex justify-between text-[11px] font-medium text-wa-text-secondary">
                            <span>{rRate}%</span>
                            <span>{read} read</span>
                          </div>
                          <div className="w-full bg-wa-search dark:bg-wa-dark-search rounded-full h-1.5 overflow-hidden">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${rRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-purple-600 dark:text-purple-400">
                        {replied}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          c.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                            : c.status === 'failed'
                            ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                            : c.status === 'running'
                            ? 'bg-wa-green/10 text-wa-green animate-pulse'
                            : c.status === 'scheduled'
                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                            : 'bg-wa-search dark:bg-wa-dark-search text-wa-text-secondary'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
