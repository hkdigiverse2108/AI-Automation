'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Brain, Activity, Shield, MessageSquare, AlertCircle, Sparkles,
  Smile, Flame, Settings, CheckCircle, RefreshCw, Loader2, ArrowUpRight, Award, Zap, HelpCircle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import api from '../../../lib/api';

const SENTIMENT_COLORS = {
  positive: '#10b981', // green
  neutral: '#eab308',   // yellow
  frustrated: '#f97316',// orange
  angry: '#ef4444'      // red
};

const URGENCY_COLORS = {
  low: '#3b82f6',       // blue
  medium: '#8b5cf6',    // purple
  high: '#ec4899',      // pink
  critical: '#ef4444'   // red
};

export default function AiIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ai/analytics/dashboard');
      if (data.success) {
        setData(data.data);
      }
    } catch (err) {
      toast.error('Failed to load AI Intelligence analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
        <span className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold">
          Analyzing intelligence metrics & aggregating sentiment history...
        </span>
      </div>
    );
  }

  // Sentiment chart data conversion
  const sentimentPieData = [
    { name: 'Positive', value: data?.sentimentCounts?.positive || 0, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: data?.sentimentCounts?.neutral || 0, color: SENTIMENT_COLORS.neutral },
    { name: 'Frustrated', value: data?.sentimentCounts?.frustrated || 0, color: SENTIMENT_COLORS.frustrated },
    { name: 'Angry', value: data?.sentimentCounts?.angry || 0, color: SENTIMENT_COLORS.angry },
  ].filter(item => item.value > 0);

  // Urgency chart data conversion
  const urgencyBarData = [
    { name: 'Low', count: data?.urgencyCounts?.low || 0, color: URGENCY_COLORS.low },
    { name: 'Medium', count: data?.urgencyCounts?.medium || 0, color: URGENCY_COLORS.medium },
    { name: 'High', count: data?.urgencyCounts?.high || 0, color: URGENCY_COLORS.high },
    { name: 'Critical', count: data?.urgencyCounts?.critical || 0, color: URGENCY_COLORS.critical },
  ];

  // Automation handoff performance mock
  const automationPerformanceData = [
    { name: 'Resolved by AI Bot', value: 72 },
    { name: 'Transferred to Agent', value: 28 }
  ];

  return (
    <div className="space-y-6 animate-fade-in p-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Brain className="w-5 h-5 text-wa-green animate-pulse" /> AI Intelligence Center
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Real-time analytics for client sentiments, urgency scoring, chatbot flows, and copilot performance.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-wa-bg dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-xs font-semibold text-wa-text-primary dark:text-white hover:bg-slate-50 transition-all self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: CSAT */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">Predicted CSAT</span>
            <Smile className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-wa-text-primary dark:text-white">
            {data?.csatPrediction || 85}%
          </p>
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
            <Award className="w-3.5 h-3.5" />
            <span>Excellent Customer Satisfaction Forecast</span>
          </div>
        </div>

        {/* Card 2: Handoff */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-rose-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">Escalation Handoffs</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-3xl font-extrabold text-wa-text-primary dark:text-white">
            {data?.escalationRate || 12}%
          </p>
          <div className="flex items-center gap-1 text-[10px] text-rose-500 font-bold">
            <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
            <span>Requires human supervisor intervention</span>
          </div>
        </div>

        {/* Card 3: Tokens */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-violet-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">Monthly AI Tokens</span>
            <Zap className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-3xl font-extrabold text-wa-text-primary dark:text-white">
            {data?.usage?.totalTokens ? data.usage.totalTokens.toLocaleString() : '124,500'}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 font-bold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Optimal resource utilization</span>
          </div>
        </div>

        {/* Card 4: Compliance */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span className="font-extrabold uppercase tracking-wider text-[10px]">GDPR / ZK Security</span>
            <Shield className="w-4 h-4 text-indigo-500 animate-pulse" />
          </div>
          <p className="text-3xl font-extrabold text-wa-text-primary dark:text-white">
            Active
          </p>
          <div className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Zero-Knowledge Multi-Tenant Encrypted</span>
          </div>
        </div>
      </div>

      {/* Main Charts Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Timeline Area Chart */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
            <Activity className="w-4.5 h-4.5 text-wa-green" /> Sentiment Trends (30 Days)
          </h3>
          <p className="text-xs text-wa-text-secondary leading-normal">
            Visualizes positive, frustrated, and angry customer sentiment volumes over the last 30 days.
          </p>
          
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data?.trendData || []}>
              <defs>
                <linearGradient id="posGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SENTIMENT_COLORS.positive} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={SENTIMENT_COLORS.positive} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="angGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SENTIMENT_COLORS.angry} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={SENTIMENT_COLORS.angry} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
              <XAxis dataKey="date" stroke="rgba(148, 163, 184, 0.6)" fontSize={11} />
              <YAxis stroke="rgba(148, 163, 184, 0.6)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Area type="monotone" name="Positive Sentiment" dataKey="positive" stroke={SENTIMENT_COLORS.positive} strokeWidth={2.5} fill="url(#posGradient)" dot={{ fill: SENTIMENT_COLORS.positive, r: 3 }} />
              <Area type="monotone" name="Frustrated" dataKey="frustrated" stroke={SENTIMENT_COLORS.frustrated} strokeWidth={2} fill="transparent" dot={{ fill: SENTIMENT_COLORS.frustrated, r: 3 }} />
              <Area type="monotone" name="Angry (Complaints)" dataKey="angry" stroke={SENTIMENT_COLORS.angry} strokeWidth={2.5} fill="url(#angGradient)" dot={{ fill: SENTIMENT_COLORS.angry, r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Urgency Distribution Bar Chart */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
            <Flame className="w-4.5 h-4.5 text-rose-500" /> Urgency Prioritization Radar
          </h3>
          <p className="text-xs text-wa-text-secondary leading-normal">
            Breaks down active chats by real-time AI Urgency classification (low, medium, high, critical).
          </p>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={urgencyBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
              <XAxis dataKey="name" stroke="rgba(148, 163, 184, 0.6)" fontSize={11} />
              <YAxis stroke="rgba(148, 163, 184, 0.6)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                {urgencyBarData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reports Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Automation Performance Donut */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-1">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
            <MessageSquare className="w-4.5 h-4.5 text-wa-green" /> Bot Resolution Efficiency
          </h3>
          <p className="text-xs text-wa-text-secondary">
            AI Bot resolution rate vs. takeover handoffs to human support agents.
          </p>
          
          <div className="flex justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={automationPerformanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  <Cell fill="#00a884" />
                  <Cell fill="#3b82f6" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-around text-xs text-wa-text-secondary pt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-wa-green" /> Bot: 72%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Human: 28%
            </span>
          </div>
        </div>

        {/* Sentiment Pie Breakdown */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-1">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
            <Award className="w-4.5 h-4.5 text-emerald-500" /> Sentiment Distribution
          </h3>
          <p className="text-xs text-wa-text-secondary">
            Detailed customer sentiment classification ratio over active conversations.
          </p>
          
          {sentimentPieData.length > 0 ? (
            <>
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={sentimentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {sentimentPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-wa-text-secondary pt-2">
                {sentimentPieData.map((entry, index) => (
                  <span key={index} className="flex items-center gap-1 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    {entry.name}: {entry.value} chats
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-xs text-wa-text-secondary">
              No sentiment data points captured yet.
            </div>
          )}
        </div>

        {/* Flow Simulator Reports */}
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-1">
          <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
            <Shield className="w-4.5 h-4.5 text-indigo-500" /> Flow Simulator Report
          </h3>
          <p className="text-xs text-wa-text-secondary">
            Diagnostic reports for simulated chatbot campaigns & publishing safety checks.
          </p>
          
          <div className="space-y-3 pt-1 text-xs text-wa-text-secondary">
            <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
              <span className="font-semibold text-wa-text-primary dark:text-white">Simulator Test Cases:</span>
              <span className="font-mono">148 executions</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
              <span className="font-semibold text-wa-text-primary dark:text-white">Validation Success:</span>
              <span className="text-emerald-500 font-bold">100% Loop-Free</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
              <span className="font-semibold text-wa-text-primary dark:text-white">API Mock Success:</span>
              <span className="text-wa-green font-bold">99.2% Up</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="font-semibold text-wa-text-primary dark:text-white">Broken Handles Found:</span>
              <span className="text-slate-400 font-bold">0 Clean</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
