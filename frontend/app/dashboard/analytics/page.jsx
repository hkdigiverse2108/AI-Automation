'use client';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  BarChart3, TrendingUp, Users, MessageSquare, Target, Zap,
  Calendar, ArrowUpRight, ArrowDownRight, Loader2, RefreshCw,
  Send, Eye, Reply, Activity, Clock, Flame, FileText, CheckCheck,
  XCircle, Download, FileSpreadsheet, AlertTriangle, ShieldCheck
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../../lib/api';
import { useMultiPageData } from '../../../lib/usePageData';
import { LOGO_BASE64 } from '../../../lib/logoBase64';

const COLORS = ['#00a884', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-xl p-3 text-xs z-50">
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
  // Top-level View Toggle: 'analytics' (default) vs 'reports'
  const [pageTab, setPageTab] = useState('analytics');

  // Analytics tab period selector (7, 30, 90 days)
  const [period, setPeriod] = useState(30);

  // Reports tab filter: 'daily', 'weekly', 'monthly'
  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Analytics data fetcher
  const fetchers = useCallback(() => ({
    overview: () => api.get('/analytics/overview').then(r => r.data.success ? r.data.data : null),
    trends: () => api.get(`/analytics/message-trends?days=${period}`).then(r => r.data.success ? (r.data.data.trends || []) : []),
    growth: () => api.get(`/analytics/contact-growth?days=${period}`).then(r => r.data.success ? (r.data.data.growth || []) : []),
    campaigns: () => api.get('/analytics/campaign-performance').then(r => r.data.success ? (r.data.data.campaigns || []) : []),
    heatmap: () => api.get(`/analytics/hourly-activity?days=${period}`).then(r => r.data.success ? (r.data.data.heatmap || []) : []),
    convStats: () => api.get('/analytics/conversation-stats').then(r => r.data.success ? r.data.data : { byStatus: [], bySource: [] }),
  }), [period]);

  const { data: allData, loading, refresh: fetchAll } = useMultiPageData(fetchers(), { deps: [period] });

  const overview = allData.overview;
  const messageTrends = allData.trends || [];
  const contactGrowth = allData.growth || [];
  const campaignPerf = allData.campaigns || [];
  const heatmap = allData.heatmap || [];
  const convStats = allData.convStats || { byStatus: [], bySource: [] };

  // Fetch Reports data
  const fetchReports = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await api.get(`/analytics/reports?period=${reportPeriod}`);
      if (res.data.success) {
        setReportData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
      toast.error('Failed to load reports data');
    } finally {
      setReportLoading(false);
    }
  }, [reportPeriod]);

  // Load reports when tab switches or report period changes
  useEffect(() => {
    if (pageTab === 'reports') {
      fetchReports();
    }
  }, [pageTab, reportPeriod, fetchReports]);

  // Export report to CSV
  const exportReportCsv = () => {
    if (!reportData || !reportData.timeline?.length) {
      toast.error('No report data available to export');
      return;
    }
    const m = reportData.metrics || {};
    const headers = ['Time/Date', 'Message Sent', 'Delivered', 'Read', 'Failed', 'Inbound Replies', 'Delivery Rate (%)', 'Read Rate (%)'];
    const rows = reportData.timeline.map(item => [
      `"${item.fullDate || item.label}"`,
      item.sent || 0,
      item.delivered || 0,
      item.read || 0,
      item.failed || 0,
      item.inbound || 0,
      item.sent > 0 ? Math.round((item.delivered / item.sent) * 100) : 0,
      item.delivered > 0 ? Math.round((item.read / item.delivered) * 100) : 0,
    ]);

    // Totals footer row
    rows.push([
      '"TOTAL / SUMMARY"',
      m.sent || 0,
      m.delivered || 0,
      m.read || 0,
      m.failed || 0,
      m.inbound || 0,
      m.deliveryRate || 0,
      m.readRate || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `whatsapp_report_${reportPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report downloaded as CSV!');
  };

  // Export report to PDF with Company Logo
  const exportReportPdf = () => {
    if (!reportData || !reportData.timeline?.length) {
      toast.error('No report data available to export');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const primaryColor = [18, 140, 126]; // #128c7e WhatsApp green
      const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const m = reportData.metrics || {};

      // 1. Top green brand accent stripe
      doc.setFillColor(18, 140, 126);
      doc.rect(0, 0, pageWidth, 4, 'F');

      // 2. Company Brand Logo (HariKrushn DigiVerse LLP)
      let logoDrawn = false;
      try {
        if (LOGO_BASE64) {
          // 342x97 ratio ~3.525 -> w: 130pt, h: 37pt
          doc.addImage(LOGO_BASE64, 'PNG', 36, 14, 130, 37);
          logoDrawn = true;
        }
      } catch (err) {
        console.warn('Logo render fallback:', err);
      }

      if (!logoDrawn) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(18, 140, 126);
        doc.text('HariKrushn DigiVerse LLP', 36, 36);
      }

      // 3. Right Header Info
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('WhatsApp Performance Report', pageWidth - 36, 26, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Generated: ${generatedDate} IST`, pageWidth - 36, 39, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(18, 140, 126); // emerald green
      const periodLabel = reportPeriod === 'daily'
        ? 'Daily Report (Last 24 Hours)'
        : reportPeriod === 'weekly'
        ? 'Weekly Report (Last 7 Days)'
        : 'Monthly Report (Last 30 Days)';
      doc.text(`Period: ${periodLabel}`, pageWidth - 36, 51, { align: 'right' });

      // Subtle separator line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.75);
      doc.line(36, 58, pageWidth - 36, 58);

      // 4. Executive Summary KPI Block (Table of 7 metrics)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Executive Performance Metrics', 36, 75);

      const kpiHeaders = ['Metric Name', 'Count / Value', 'Benchmark / Ratio', 'Status'];
      const kpiRows = [
        ['Message Sent', (m.sent || 0).toLocaleString(), 'Total Outbound Dispatched', reportData?.comparisons?.sentChange || 'Active'],
        ['Delivered', (m.delivered || 0).toLocaleString(), `${m.deliveryRate || 0}% Delivery Rate`, reportData?.comparisons?.deliveredChange || 'High'],
        ['Read', (m.read || 0).toLocaleString(), `${m.readRate || 0}% Read Rate`, reportData?.comparisons?.readChange || 'Good'],
        ['Failed', (m.failed || 0).toLocaleString(), 'Delivery Failure Errors', m.failed === 0 ? 'Zero Errors' : `${m.failed} Failed`],
        ['Reply Rate', `${m.replyRate || 0}%`, `${(m.inbound || 0).toLocaleString()} Customer Replies`, 'Engagement'],
        ['Response Time', m.responseTime || 'N/A', 'Average Reply Turnaround', 'Speed'],
        ['Active Users', (m.activeUsers || 0).toLocaleString(), 'Unique Engaged Contacts', 'Active Reach'],
      ];

      autoTable(doc, {
        head: [kpiHeaders],
        body: kpiRows,
        startY: 83,
        theme: 'striped',
        margin: { left: 36, right: 36 },
        headStyles: {
          fillColor: [30, 41, 59], // dark slate
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 130, fontStyle: 'bold' },
          1: { cellWidth: 90, fontStyle: 'bold', halign: 'right' },
          2: { cellWidth: 200 },
          3: { halign: 'center', textColor: [18, 140, 126], fontStyle: 'bold' },
        },
      });

      // 5. Detailed Breakdown Table
      const finalY = doc.lastAutoTable.finalY + 18;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`2. Detailed Timeline Breakdown (${reportPeriod.toUpperCase()})`, 36, finalY);

      const tableHeaders = [
        reportPeriod === 'daily' ? 'Hour' : 'Date',
        'Sent',
        'Delivered',
        'Read',
        'Failed',
        'Replies',
        'Delivery %',
        'Read %'
      ];

      const tableRows = reportData.timeline.map(item => [
        item.label,
        (item.sent || 0).toLocaleString(),
        (item.delivered || 0).toLocaleString(),
        (item.read || 0).toLocaleString(),
        (item.failed || 0).toLocaleString(),
        (item.inbound || 0).toLocaleString(),
        item.sent > 0 ? `${Math.round((item.delivered / item.sent) * 100)}%` : '-',
        item.delivered > 0 ? `${Math.round((item.read / item.delivered) * 100)}%` : '-',
      ]);

      // Total summary row
      tableRows.push([
        'TOTAL',
        (m.sent || 0).toLocaleString(),
        (m.delivered || 0).toLocaleString(),
        (m.read || 0).toLocaleString(),
        (m.failed || 0).toLocaleString(),
        (m.inbound || 0).toLocaleString(),
        `${m.deliveryRate || 0}%`,
        `${m.readRate || 0}%`,
      ]);

      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: finalY + 8,
        theme: 'striped',
        margin: { left: 36, right: 36, bottom: 35 },
        headStyles: {
          fillColor: primaryColor, // emerald green
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' },
          2: { halign: 'right', textColor: [16, 185, 129] },
          3: { halign: 'right', textColor: [99, 102, 241] },
          4: { halign: 'right', textColor: [239, 68, 68] },
          5: { halign: 'right', textColor: [236, 72, 153] },
          6: { halign: 'right', fontStyle: 'bold' },
          7: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
          }
        },
        didDrawPage: (data) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'HariKrushn DigiVerse LLP • WhatsApp Marketing Platform | Confidential',
            36,
            pageHeight - 16
          );
          doc.text(
            `Page ${data.pageNumber}`,
            pageWidth - 36,
            pageHeight - 16,
            { align: 'right' }
          );
        },
      });

      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`WhatsApp_Performance_Report_${reportPeriod}_${dateStr}.pdf`);
      toast.success('PDF Report downloaded successfully!');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to export PDF report');
    }
  };

  // Heatmap helper
  const getHeatmapColor = (count) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count < 5) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (count < 20) return 'bg-emerald-300 dark:bg-emerald-700/50';
    if (count < 50) return 'bg-emerald-500 dark:bg-emerald-600/70';
    return 'bg-emerald-700 dark:bg-emerald-500';
  };

  if (loading && !overview && pageTab === 'analytics') {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
          <span className="text-sm font-semibold text-wa-text-secondary">Loading analytics...</span>
        </div>
      </div>
    );
  }

  // 6 Analytics default stat cards
  const analyticsStatCards = [
    { label: 'Total Contacts', value: overview?.totalContacts || 0, icon: Users, color: '#3b82f6', change: `+${overview?.newContacts30d || 0} this month`, up: true },
    { label: 'Total Messages', value: overview?.totalMessages || 0, icon: MessageSquare, color: '#00a884', change: `${overview?.messagesSent7d || 0} sent 7d`, up: true },
    { label: 'Delivery Rate', value: `${overview?.deliveryRate || 0}%`, icon: Send, color: '#8b5cf6', change: 'Outbound', up: overview?.deliveryRate > 80 },
    { label: 'Read Rate', value: `${overview?.readRate || 0}%`, icon: Eye, color: '#f59e0b', change: 'Of delivered', up: overview?.readRate > 50 },
    { label: 'Reply Rate', value: `${overview?.replyRate || 0}%`, icon: Reply, color: '#ec4899', change: 'Engagement', up: overview?.replyRate > 20 },
    { label: 'Conversations', value: overview?.totalConversations || 0, icon: Activity, color: '#06b6d4', change: 'All time', up: true },
  ];

  // 7 Reports requested metrics:
  // 1. Message Sent
  // 2. Delivered
  // 3. Read
  // 4. Failed
  // 5. Reply Rate
  // 6. Response Time
  // 7. Active Users
  const reportStatCards = [
    {
      label: 'Message Sent',
      value: reportData?.metrics?.sent ?? 0,
      icon: Send,
      color: '#3b82f6',
      subtext: 'Total Outbound',
      change: reportData?.comparisons?.sentChange || '0%',
      isPositive: !reportData?.comparisons?.sentChange?.startsWith('-'),
    },
    {
      label: 'Delivered',
      value: reportData?.metrics?.delivered ?? 0,
      icon: CheckCheck,
      color: '#10b981',
      subtext: `${reportData?.metrics?.deliveryRate ?? 0}% delivery rate`,
      change: reportData?.comparisons?.deliveredChange || '0%',
      isPositive: !reportData?.comparisons?.deliveredChange?.startsWith('-'),
    },
    {
      label: 'Read',
      value: reportData?.metrics?.read ?? 0,
      icon: Eye,
      color: '#6366f1',
      subtext: `${reportData?.metrics?.readRate ?? 0}% read rate`,
      change: reportData?.comparisons?.readChange || '0%',
      isPositive: !reportData?.comparisons?.readChange?.startsWith('-'),
    },
    {
      label: 'Failed',
      value: reportData?.metrics?.failed ?? 0,
      icon: XCircle,
      color: '#ef4444',
      subtext: 'Delivery failures',
      change: reportData?.comparisons?.failedChange || '0%',
      isPositive: reportData?.comparisons?.failedChange?.startsWith('-'),
    },
    {
      label: 'Reply Rate',
      value: `${reportData?.metrics?.replyRate ?? 0}%`,
      icon: Reply,
      color: '#ec4899',
      subtext: `${reportData?.metrics?.inbound ?? 0} customer replies`,
      change: reportData?.comparisons?.replyRateChange || '0%',
      isPositive: !reportData?.comparisons?.replyRateChange?.startsWith('-'),
    },
    {
      label: 'Response Time',
      value: reportData?.metrics?.responseTime || 'N/A',
      icon: Clock,
      color: '#f59e0b',
      subtext: 'Avg reply turnaround',
      change: 'Avg speed',
      isPositive: true,
    },
    {
      label: 'Active Users',
      value: reportData?.metrics?.activeUsers ?? 0,
      icon: Users,
      color: '#8b5cf6',
      subtext: 'Engaged contacts',
      change: reportData?.comparisons?.activeUsersChange || '0%',
      isPositive: !reportData?.comparisons?.activeUsersChange?.startsWith('-'),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
              {pageTab === 'analytics' ? (
                <>
                  <BarChart3 className="w-6 h-6 text-wa-green" />
                  Analytics & Insights
                </>
              ) : (
                <>
                  <FileText className="w-6 h-6 text-wa-green" />
                  Performance Reports
                </>
              )}
            </h2>
            <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
              {pageTab === 'analytics'
                ? 'Deep dive into your WhatsApp business performance metrics'
                : 'Detailed delivery, engagement, and customer response analytics'}
            </p>
          </div>

          {/* Primary View Toggle: Analytics vs Reports */}
          <div className="flex items-center bg-gray-100 dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl p-1 shadow-xs self-start sm:self-auto">
            <button
              onClick={() => setPageTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pageTab === 'analytics'
                  ? 'bg-wa-green text-white shadow-sm'
                  : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </button>
            <button
              onClick={() => setPageTab('reports')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pageTab === 'reports'
                  ? 'bg-wa-green text-white shadow-sm'
                  : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Reports
            </button>
          </div>
        </div>

        {/* Action Controls for each tab */}
        <div className="flex items-center gap-2.5">
          {pageTab === 'analytics' ? (
            <>
              {/* Analytics period selector: 7d, 30d, 90d */}
              <div className="flex items-center bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl p-1 shadow-xs">
                {[7, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => setPeriod(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      period === d
                        ? 'bg-wa-green text-white shadow-sm'
                        : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <button
                onClick={fetchAll}
                className="flex items-center gap-2 px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl text-xs font-semibold text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </>
          ) : (
            <>
              {/* Reports period toggle: Daily, Weekly, Monthly */}
              <div className="flex items-center bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl p-1 shadow-xs">
                {[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setReportPeriod(p.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      reportPeriod === p.id
                        ? 'bg-wa-green text-white shadow-sm'
                        : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Export PDF Button with Logo */}
              <button
                onClick={exportReportPdf}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shadow-xs"
                title="Export report as PDF with Company Logo"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span className="hidden sm:inline">Export PDF</span>
              </button>

              {/* Export CSV Button */}
              <button
                onClick={exportReportCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-xs"
                title="Export report as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                onClick={fetchReports}
                disabled={reportLoading}
                className="flex items-center gap-2 px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl text-xs font-semibold text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reportLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: DEFAULT ANALYTICS VIEW                                */}
      {/* ============================================================ */}
      {pageTab === 'analytics' && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {analyticsStatCards.map((card, i) => (
              <div
                key={i}
                className="glass-card animate-card-in p-4 group hover:shadow-wa-md transition-all duration-300 hover:-translate-y-1 cursor-default"
                style={{ animationDelay: `${i * 50}ms` }}
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

          {/* Charts Row 1: Message Trends + Conversation Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Message Volume Trends */}
            <div style={{ animationDelay: '300ms' }} className="lg:col-span-2 glass-card animate-card-in p-6">
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
                    {convStats.byStatus?.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {convStats.byStatus?.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-wa-text-secondary capitalize">{s.name}: <span className="font-bold text-wa-text-primary dark:text-white">{s.value}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 2: Contact Growth + Activity Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Acquisition Growth */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Cumulative Contact Growth
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={contactGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickFormatter={v => v?.slice(5)} />
                  <YAxis stroke="var(--text-secondary)" fontSize={10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="total" name="Total Contacts" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="newContacts" name="New Daily" stroke="#10b981" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Hourly Activity Heatmap */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Peak Activity Hours
              </h3>
              <div className="space-y-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                  const dayData = heatmap.filter(h => h.day === day);
                  return (
                    <div key={day} className="flex items-center gap-1.5">
                      <span className="w-8 text-[10px] font-bold text-wa-text-secondary">{day}</span>
                      <div className="flex-1 grid grid-cols-24 gap-0.5">
                        {Array.from({ length: 24 }).map((_, h) => {
                          const cell = dayData.find(d => d.hour === h);
                          const count = cell?.count || 0;
                          return (
                            <div
                              key={h}
                              className={`h-4 rounded-[2px] transition-all hover:scale-125 cursor-pointer ${getHeatmapColor(count)}`}
                              title={`${day} ${h}:00 — ${count} messages`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-2 text-[9px] text-wa-text-secondary">
                  <span>12 AM</span>
                  <span>6 AM</span>
                  <span>12 PM</span>
                  <span>6 PM</span>
                  <span>11 PM</span>
                </div>
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
      )}

      {/* ============================================================ */}
      {/* TAB 2: REPORTS VIEW (Daily, Weekly, Monthly)                 */}
      {/* ============================================================ */}
      {pageTab === 'reports' && (
        <div className="space-y-6">
          {reportLoading && !reportData ? (
            <div className="h-[50vh] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
                <span className="text-sm font-semibold text-wa-text-secondary">Generating {reportPeriod} report...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Period Context Badge */}
              <div className="flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-wa-green">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-wa-text-primary dark:text-white capitalize">
                      {reportPeriod} Performance Summary
                    </h3>
                    <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                      {reportPeriod === 'daily'
                        ? 'Reporting data for the last 24 hours (hourly breakdown)'
                        : reportPeriod === 'weekly'
                        ? 'Reporting data for the last 7 days (day-by-day progression)'
                        : 'Reporting data for the last 30 days (monthly timeline)'}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border text-wa-text-secondary">
                  <Activity className="w-3.5 h-3.5 text-wa-green" />
                  Real-time Synced
                </div>
              </div>

              {/* 7 Requested Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
                {reportStatCards.map((card, i) => (
                  <div
                    key={i}
                    className="glass-card animate-card-in p-4 group hover:shadow-wa-md transition-all duration-300 hover:-translate-y-1 cursor-default border border-wa-border dark:border-wa-dark-border rounded-2xl"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs"
                        style={{ backgroundColor: card.color + '15' }}
                      >
                        <card.icon className="w-4.5 h-4.5" style={{ color: card.color }} />
                      </div>
                      <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        card.isPositive
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {card.isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        <span>{card.change}</span>
                      </div>
                    </div>
                    <p className="text-xl font-extrabold text-wa-text-primary dark:text-wa-dark-text-primary tabular-nums tracking-tight">
                      {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    </p>
                    <p className="text-[11px] font-bold text-wa-text-primary dark:text-white mt-1">
                      {card.label}
                    </p>
                    <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5 font-medium truncate">
                      {card.subtext}
                    </p>
                  </div>
                ))}
              </div>

              {/* Delivery & Engagement Funnel Banner */}
              <div className="glass-card p-5 border border-wa-border dark:border-wa-dark-border rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                    <Zap className="w-4 h-4 text-wa-green" />
                    Delivery & Engagement Funnel
                  </h3>
                  <span className="text-xs text-wa-text-secondary">
                    Overall Conversion Progression
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Step 1: Sent */}
                  <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                    <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" /> 1. Sent
                      </span>
                      <span>100%</span>
                    </div>
                    <p className="text-lg font-black text-wa-text-primary dark:text-white">
                      {(reportData?.metrics?.sent ?? 0).toLocaleString()}
                    </p>
                    <div className="w-full bg-blue-200 dark:bg-blue-900/50 h-2 rounded-full mt-2 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full w-full" />
                    </div>
                  </div>

                  {/* Step 2: Delivered */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                    <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <CheckCheck className="w-3.5 h-3.5" /> 2. Delivered
                      </span>
                      <span>{reportData?.metrics?.deliveryRate ?? 0}%</span>
                    </div>
                    <p className="text-lg font-black text-wa-text-primary dark:text-white">
                      {(reportData?.metrics?.delivered ?? 0).toLocaleString()}
                    </p>
                    <div className="w-full bg-emerald-200 dark:bg-emerald-900/50 h-2 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, reportData?.metrics?.deliveryRate ?? 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Step 3: Read */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                    <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> 3. Read
                      </span>
                      <span>{reportData?.metrics?.readRate ?? 0}%</span>
                    </div>
                    <p className="text-lg font-black text-wa-text-primary dark:text-white">
                      {(reportData?.metrics?.read ?? 0).toLocaleString()}
                    </p>
                    <div className="w-full bg-indigo-200 dark:bg-indigo-900/50 h-2 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, reportData?.metrics?.readRate ?? 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Step 4: Replied */}
                  <div className="p-3.5 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/40">
                    <div className="flex items-center justify-between text-xs text-pink-700 dark:text-pink-300 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <Reply className="w-3.5 h-3.5" /> 4. Replied
                      </span>
                      <span>{reportData?.metrics?.replyRate ?? 0}%</span>
                    </div>
                    <p className="text-lg font-black text-wa-text-primary dark:text-white">
                      {(reportData?.metrics?.inbound ?? 0).toLocaleString()}
                    </p>
                    <div className="w-full bg-pink-200 dark:bg-pink-900/50 h-2 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-pink-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, reportData?.metrics?.replyRate ?? 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reports Chart: Volume and Flow Timeline */}
              <div className="glass-card p-6 border border-wa-border dark:border-wa-dark-border rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-wa-green" />
                    {reportPeriod === 'daily'
                      ? 'Hourly Activity Flow (24h)'
                      : reportPeriod === 'weekly'
                      ? 'Weekly Message Breakdown'
                      : 'Monthly Trend Progression'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-wa-text-secondary">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00a884]" /> Sent
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Delivered
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#6366f1]" /> Read
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ec4899]" /> Inbound
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Failed
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={290}>
                  <AreaChart data={reportData?.timeline || []}>
                    <defs>
                      <linearGradient id="reportSentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00a884" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#00a884" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="reportDelivGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="reportReadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="reportInboundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={10} />
                    <YAxis stroke="var(--text-secondary)" fontSize={10} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="sent" name="Sent" stroke="#00a884" strokeWidth={2} fill="url(#reportSentGrad)" dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#10b981" strokeWidth={2} fill="url(#reportDelivGrad)" dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="read" name="Read" stroke="#6366f1" strokeWidth={2} fill="url(#reportReadGrad)" dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="inbound" name="Inbound Replies" stroke="#ec4899" strokeWidth={2} fill="url(#reportInboundGrad)" dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Detailed Report Table with PDF & CSV Export Options */}
              <div className="glass-card overflow-hidden border border-wa-border dark:border-wa-dark-border rounded-2xl">
                <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-wa-green" />
                      Detailed Breakdown Table
                    </h3>
                    <p className="text-xs text-wa-text-secondary mt-0.5">
                      Period breakdown with status ratios and delivery success rates
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportReportPdf}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      title="Download formatted PDF Report with Company Logo"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Download PDF
                    </button>
                    <button
                      onClick={exportReportCsv}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      title="Download as CSV spreadsheet"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download CSV
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-wa-border dark:border-wa-dark-border text-wa-text-secondary uppercase text-[10px] tracking-wider bg-wa-panel-header/50 dark:bg-wa-dark-panel-header/20">
                        <th className="py-3 px-4 font-bold">{reportPeriod === 'daily' ? 'Hour' : 'Date'}</th>
                        <th className="py-3 px-4 font-bold text-right text-blue-600 dark:text-blue-400">Sent</th>
                        <th className="py-3 px-4 font-bold text-right text-emerald-600 dark:text-emerald-400">Delivered</th>
                        <th className="py-3 px-4 font-bold text-right text-indigo-600 dark:text-indigo-400">Read</th>
                        <th className="py-3 px-4 font-bold text-right text-red-500">Failed</th>
                        <th className="py-3 px-4 font-bold text-right text-pink-500">Inbound Replies</th>
                        <th className="py-3 px-4 font-bold text-right">Delivery Rate</th>
                        <th className="py-3 px-4 font-bold text-right">Read Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border">
                      {reportData?.timeline?.map((item, idx) => {
                        const delivPct = item.sent > 0 ? Math.round((item.delivered / item.sent) * 100) : 0;
                        const readPct = item.delivered > 0 ? Math.round((item.read / item.delivered) * 100) : 0;
                        return (
                          <tr key={idx} className="hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/10 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-wa-text-primary dark:text-white font-mono">
                              {item.label}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-wa-text-primary dark:text-white">
                              {item.sent.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                              {item.delivered.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                              {item.read.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono">
                              <span className={item.failed > 0 ? 'text-red-500 font-bold' : 'text-wa-text-secondary'}>
                                {item.failed.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-pink-600 dark:text-pink-400 font-semibold">
                              {item.inbound.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span className={`font-bold ${delivPct >= 80 ? 'text-emerald-500' : delivPct >= 50 ? 'text-amber-500' : 'text-wa-text-secondary'}`}>
                                {item.sent > 0 ? `${delivPct}%` : '-'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span className={`font-bold ${readPct >= 50 ? 'text-indigo-500' : readPct >= 25 ? 'text-amber-500' : 'text-wa-text-secondary'}`}>
                                {item.delivered > 0 ? `${readPct}%` : '-'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Summary Totals Row */}
                    <tfoot>
                      <tr className="border-t-2 border-wa-border dark:border-wa-dark-border bg-wa-panel-header/60 dark:bg-wa-dark-panel-header/40 font-bold">
                        <td className="py-3 px-4 text-wa-text-primary dark:text-white uppercase tracking-wider text-[11px]">
                          TOTAL / SUMMARY
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-blue-600 dark:text-blue-400">
                          {(reportData?.metrics?.sent ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {(reportData?.metrics?.delivered ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                          {(reportData?.metrics?.read ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-red-500">
                          {(reportData?.metrics?.failed ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-pink-600 dark:text-pink-400">
                          {(reportData?.metrics?.inbound ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-600 font-bold">
                          {reportData?.metrics?.deliveryRate ?? 0}%
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-600 font-bold">
                          {reportData?.metrics?.readRate ?? 0}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
