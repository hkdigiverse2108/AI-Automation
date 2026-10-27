'use client';
import { useState, useMemo } from 'react';
import { 
  Users, Award, XCircle, TrendingUp, DollarSign, Clock, Calendar, 
  ArrowRight, Download, Filter, UserCheck, AlertTriangle, CheckCircle2,
  PieChart as PieIcon, BarChart3, ChevronDown, RefreshCw, FileSpreadsheet,
  Briefcase, MapPin, Search, FileText, ArrowDown, Layers, HelpCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  CartesianGrid, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { toast } from 'react-hot-toast';
import { LOGO_BASE64 } from '../lib/logoBase64';

// Soft, harmonious modern pastel palette
const SOFT_PALETTE = {
  emerald: '#34d399', // soft mint
  sky: '#60a5fa',     // soft sky blue
  amber: '#fbbf24',   // soft warm honey
  cyan: '#22d3ee',    // soft cyan
  rose: '#fb7185',    // soft blush coral
  peach: '#fb923c',   // soft peach orange
  indigo: '#818cf8',  // soft periwinkle
  purple: '#a78bfa',  // soft lavender
  teal: '#2dd4bf',    // soft seafoam
};

const PIE_COLORS = [
  SOFT_PALETTE.rose,
  SOFT_PALETTE.amber,
  SOFT_PALETTE.sky,
  SOFT_PALETTE.indigo,
  SOFT_PALETTE.teal,
  SOFT_PALETTE.purple,
  SOFT_PALETTE.peach
];

const WIN_PIE_COLORS = [
  SOFT_PALETTE.emerald,
  SOFT_PALETTE.teal,
  SOFT_PALETTE.cyan,
  SOFT_PALETTE.sky,
  SOFT_PALETTE.indigo,
  SOFT_PALETTE.amber,
  SOFT_PALETTE.purple
];

// Helper to clean text for standard Latin-1 PDF Helvetica
const sanitizeForPdf = (str) => {
  if (str === null || str === undefined) return '';
  let s = String(str);
  s = s.replace(/🏠/g, '[Home] ')
       .replace(/🏢/g, '[Office] ')
       .replace(/👋/g, '[Hello] ')
       .replace(/📞/g, '[Call] ')
       .replace(/✅/g, '[Approved] ')
       .replace(/❌/g, '[Lost] ')
       .replace(/🏆/g, '[Won] ')
       .replace(/⏱️|⏳/g, '[Pending] ')
       .replace(/💰/g, '[Budget] ')
       .replace(/⚠️/g, '[Warning] ');

  const cleaned = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code >= 160 && code <= 255)) {
      cleaned.push(s[i]);
    }
  }
  return cleaned.join('').replace(/[ \t]+/g, ' ').trim();
};

// Custom high-contrast tooltip for Deal Win Pie Chart
const CustomWinPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl border border-emerald-500/40 shadow-2xl text-xs space-y-1 z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span 
            className="w-2.5 h-2.5 rounded-full shrink-0" 
            style={{ backgroundColor: data.payload?.fill || data.color }} 
          />
          <span className="font-bold text-white text-xs leading-tight">{data.name}</span>
        </div>
        <div className="text-[11px] font-bold text-emerald-400 pl-4.5">
          {data.value} {data.value === 1 ? 'deal' : 'deals'} ({data.payload?.percentage}%)
        </div>
      </div>
    );
  }
  return null;
};

// Custom high-contrast tooltip for Lead Drop Pie Chart
const CustomLossPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl border border-rose-500/40 shadow-2xl text-xs space-y-1 z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span 
            className="w-2.5 h-2.5 rounded-full shrink-0" 
            style={{ backgroundColor: data.payload?.fill || data.color }} 
          />
          <span className="font-bold text-white text-xs leading-tight">{data.name}</span>
        </div>
        <div className="text-[11px] font-bold text-rose-400 pl-4.5">
          {data.value} {data.value === 1 ? 'lead' : 'leads'} ({data.payload?.percentage}%)
        </div>
      </div>
    );
  }
  return null;
};

// Custom high-contrast tooltip for Funnel Bar Chart
const CustomFunnelTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl border border-slate-700 shadow-2xl text-xs space-y-1 z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span 
            className="w-2.5 h-2.5 rounded-full shrink-0" 
            style={{ backgroundColor: data.payload?.fill || data.color }} 
          />
          <span className="font-bold text-white text-xs">{data.payload?.stage || data.payload?.shortTitle}</span>
        </div>
        <div className="text-[11px] text-slate-300 pl-4.5">
          {data.payload?.desc}
        </div>
        <div className="text-xs font-bold text-emerald-400 pl-4.5">
          {data.value} Leads ({data.payload?.percentage}% of pipeline)
        </div>
      </div>
    );
  }
  return null;
};

export default function LeadAnalyticsView({ allLeads = [], agents = [], onBackToLeads }) {
  const [timeRange, setTimeRange] = useState('ALL'); // 'ALL' | 'THIS_MONTH' | 'THIS_WEEK' | 'TODAY'
  const [selectedAgentId, setSelectedAgentId] = useState('ALL');
  const [funnelViewType, setFunnelViewType] = useState('flow'); // 'flow' (Step Cards) | 'chart' (Bar Chart)
  const [auditRosterTab, setAuditRosterTab] = useState('won'); // 'won' | 'lost'

  // Filter leads based on timeRange and selectedAgentId
  const filteredLeads = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return allLeads.filter(lead => {
      // Time filter
      if (timeRange !== 'ALL') {
        const leadDate = lead.createdAt ? new Date(lead.createdAt) : (lead.lastMessageAt ? new Date(lead.lastMessageAt) : null);
        if (leadDate) {
          if (timeRange === 'TODAY' && leadDate < startOfToday) return false;
          if (timeRange === 'THIS_WEEK' && leadDate < startOfWeek) return false;
          if (timeRange === 'THIS_MONTH' && leadDate < startOfMonth) return false;
        }
      }

      // Agent filter
      if (selectedAgentId !== 'ALL') {
        const agentId = lead.assignedAgent?._id || (typeof lead.assignedAgent === 'string' ? lead.assignedAgent : null);
        if (selectedAgentId === 'UNASSIGNED') {
          if (agentId) return false;
        } else {
          if (agentId !== selectedAgentId) return false;
        }
      }

      return true;
    });
  }, [allLeads, timeRange, selectedAgentId]);

  // Derive Lost Reasons
  const getLossReason = (lead) => {
    if (lead.lossReason) return lead.lossReason;
    if (lead.customFields?.lossReason) return lead.customFields.lossReason;
    if (lead.customFields?.dropReason) return lead.customFields.dropReason;
    const notesLower = (lead.notes || '').toLowerCase();
    if (notesLower.includes('budget') || notesLower.includes('expensive') || notesLower.includes('price') || notesLower.includes('cost') || notesLower.includes('rate')) {
      return 'Price / Budget Issue';
    }
    if (notesLower.includes('competitor') || notesLower.includes('other company') || notesLower.includes('other agency')) {
      return 'Chose Competitor';
    }
    if (notesLower.includes('no response') || notesLower.includes('ghost') || notesLower.includes('unreachable') || notesLower.includes('call cut') || notesLower.includes('not picking')) {
      return 'No Response / Ghosted';
    }
    if (notesLower.includes('delay') || notesLower.includes('postpone') || notesLower.includes('next month') || notesLower.includes('later')) {
      return 'Postponed / Timing Issue';
    }
    if (notesLower.includes('location') || notesLower.includes('city') || notesLower.includes('area') || notesLower.includes('distance')) {
      return 'Service Area Mismatch';
    }
    if (notesLower.includes('fake') || notesLower.includes('test') || notesLower.includes('not interested') || notesLower.includes('wrong number')) {
      return 'Not Interested / Invalid';
    }
    return 'Other / Unspecified';
  };

  // Derive Win Reasons (Kyu Jeeti / Kyu Convert Hui)
  const getWinReason = (lead) => {
    if (lead.winReason) return lead.winReason;
    if (lead.customFields?.winReason) return lead.customFields.winReason;
    if (lead.customFields?.wonReason) return lead.customFields.wonReason;
    const notesLower = (lead.notes || '').toLowerCase();
    if (notesLower.includes('price') || notesLower.includes('budget') || notesLower.includes('affordable') || notesLower.includes('cost') || notesLower.includes('value') || notesLower.includes('package')) {
      return 'Competitive Pricing & Value';
    }
    if (notesLower.includes('fast') || notesLower.includes('quick') || notesLower.includes('speed') || notesLower.includes('turnaround') || notesLower.includes('response') || notesLower.includes('follow')) {
      return 'Fast Response & Follow-up';
    }
    if (notesLower.includes('demo') || notesLower.includes('portfolio') || notesLower.includes('trust') || notesLower.includes('credibility') || notesLower.includes('case study')) {
      return 'Trust, Demo & Portfolio';
    }
    if (notesLower.includes('custom') || notesLower.includes('requirement') || notesLower.includes('feature') || notesLower.includes('solution') || notesLower.includes('matched')) {
      return 'Custom Requirements Matched';
    }
    if (notesLower.includes('referral') || notesLower.includes('recommend') || notesLower.includes('client') || notesLower.includes('word of mouth')) {
      return 'Client Referral / Recommendation';
    }
    if (notesLower.includes('discount') || notesLower.includes('deal') || notesLower.includes('offer') || notesLower.includes('promotional') || notesLower.includes('special')) {
      return 'Special Discount / Promotional Deal';
    }
    return 'Competitive Pricing & Value';
  };

  // Agent Performance Calculations
  const agentStats = useMemo(() => {
    const statsMap = {};

    agents.forEach(ag => {
      statsMap[ag._id] = {
        id: ag._id,
        name: ag.name || ag.email || 'Agent',
        email: ag.email || '',
        role: ag.role || 'Agent',
        avatar: ag.avatar || '',
        totalAssigned: 0,
        won: 0,
        lost: 0,
        inProgress: 0,
        lossReasons: {},
        winReasons: {}
      };
    });

    statsMap['UNASSIGNED'] = {
      id: 'UNASSIGNED',
      name: 'Unassigned Leads',
      email: 'Not assigned to any team member',
      role: 'System Pool',
      avatar: '',
      totalAssigned: 0,
      won: 0,
      lost: 0,
      inProgress: 0,
      lossReasons: {},
      winReasons: {}
    };

    filteredLeads.forEach(lead => {
      const agentId = lead.assignedAgent?._id || (typeof lead.assignedAgent === 'string' ? lead.assignedAgent : null) || 'UNASSIGNED';
      
      if (!statsMap[agentId]) {
        statsMap[agentId] = {
          id: agentId,
          name: lead.assignedAgent?.name || 'Unknown Agent',
          email: lead.assignedAgent?.email || '',
          role: lead.assignedAgent?.role || 'Agent',
          avatar: lead.assignedAgent?.avatar || '',
          totalAssigned: 0,
          won: 0,
          lost: 0,
          inProgress: 0,
          lossReasons: {},
          winReasons: {}
        };
      }

      const ag = statsMap[agentId];
      ag.totalAssigned += 1;

      const s = (lead.status || 'new').toLowerCase();
      if (s === 'won' || s === 'closed') {
        ag.won += 1;
        const wReason = getWinReason(lead);
        ag.winReasons[wReason] = (ag.winReasons[wReason] || 0) + 1;
      } else if (s === 'lost') {
        ag.lost += 1;
        const reason = getLossReason(lead);
        ag.lossReasons[reason] = (ag.lossReasons[reason] || 0) + 1;
      } else {
        ag.inProgress += 1;
      }
    });

    return Object.values(statsMap)
      .filter(ag => ag.totalAssigned > 0 || ag.id !== 'UNASSIGNED')
      .map(ag => {
        const closed = ag.won + ag.lost;
        const conversionRate = closed > 0 ? Math.round((ag.won / closed) * 100) : (ag.totalAssigned > 0 ? Math.round((ag.won / ag.totalAssigned) * 100) : 0);
        const topLossReason = Object.entries(ag.lossReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        const topWinReason = Object.entries(ag.winReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        return {
          ...ag,
          conversionRate,
          topLossReason,
          topWinReason
        };
      })
      .sort((a, b) => b.totalAssigned - a.totalAssigned);
  }, [filteredLeads, agents]);

  // Overall Totals
  const totalLeads = filteredLeads.length;
  const wonLeads = filteredLeads.filter(l => l.status === 'won' || l.status === 'closed').length;
  const lostLeads = filteredLeads.filter(l => l.status === 'lost').length;
  const inProgressLeads = totalLeads - wonLeads - lostLeads;
  const overallWinRate = totalLeads > 0 ? Math.round((wonLeads / (wonLeads + lostLeads || totalLeads)) * 100) : 0;

  // Pipeline Stages Funnel with Soft Palette & Conversions
  const funnelData = useMemo(() => {
    const stageCounts = {
      new: 0,
      qualified: 0,
      proposal_sent: 0,
      invoice_generated: 0,
      payment_due: 0,
      won: 0,
      lost: 0
    };

    filteredLeads.forEach(l => {
      const s = l.status || 'new';
      if (s === 'closed') stageCounts.won += 1;
      else if (stageCounts[s] !== undefined) stageCounts[s] += 1;
      else stageCounts.new += 1;
    });

    // Progressive funnel stages
    const baseTotal = totalLeads || 1;
    return [
      {
        id: 'new',
        stage: '1. New Inquiries',
        shortTitle: 'New Inquiries',
        desc: 'Inbound chat & bot capture',
        count: stageCounts.new,
        percentage: Math.round((stageCounts.new / baseTotal) * 100),
        fill: SOFT_PALETTE.amber,
        badgeBg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40',
        barColor: 'from-amber-300/80 to-amber-400'
      },
      {
        id: 'qualified',
        stage: '2. Qualified Leads',
        shortTitle: 'Qualified',
        desc: 'Requirements & budget matched',
        count: stageCounts.qualified,
        percentage: Math.round((stageCounts.qualified / baseTotal) * 100),
        fill: SOFT_PALETTE.emerald,
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/40',
        barColor: 'from-emerald-300/80 to-emerald-400'
      },
      {
        id: 'proposal_sent',
        stage: '3. Proposal Sent',
        shortTitle: 'Proposal Sent',
        desc: 'Quotation sent & in review',
        count: stageCounts.proposal_sent,
        percentage: Math.round((stageCounts.proposal_sent / baseTotal) * 100),
        fill: SOFT_PALETTE.sky,
        badgeBg: 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200/50 dark:border-sky-800/40',
        barColor: 'from-sky-300/80 to-sky-400'
      },
      {
        id: 'invoice_generated',
        stage: '4. Invoice Raised',
        shortTitle: 'Invoice Raised',
        desc: 'Billing created, awaiting payment',
        count: stageCounts.invoice_generated,
        percentage: Math.round((stageCounts.invoice_generated / baseTotal) * 100),
        fill: SOFT_PALETTE.cyan,
        badgeBg: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200/50 dark:border-cyan-800/40',
        barColor: 'from-cyan-300/80 to-cyan-400'
      },
      {
        id: 'payment_due',
        stage: '5. Payment Due',
        shortTitle: 'Payment Due',
        desc: 'Follow-up for payment receipt',
        count: stageCounts.payment_due,
        percentage: Math.round((stageCounts.payment_due / baseTotal) * 100),
        fill: SOFT_PALETTE.peach,
        badgeBg: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200/50 dark:border-orange-800/40',
        barColor: 'from-orange-300/80 to-orange-400'
      },
      {
        id: 'won',
        stage: '6. Won & Closed',
        shortTitle: 'Won & Closed',
        desc: 'Deal successfully converted',
        count: stageCounts.won,
        percentage: Math.round((stageCounts.won / baseTotal) * 100),
        fill: SOFT_PALETTE.teal,
        badgeBg: 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200/50 dark:border-teal-800/40',
        barColor: 'from-teal-300/80 to-emerald-400'
      },
    ];
  }, [filteredLeads, totalLeads]);

  // Loss Reasons Breakdown with Soft Colors
  const lossReasonsData = useMemo(() => {
    const reasonsMap = {};
    const lostList = filteredLeads.filter(l => l.status === 'lost');

    lostList.forEach(l => {
      const r = getLossReason(l);
      reasonsMap[r] = (reasonsMap[r] || 0) + 1;
    });

    return Object.entries(reasonsMap).map(([reason, count]) => ({
      name: reason,
      value: count,
      percentage: lostList.length ? Math.round((count / lostList.length) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [filteredLeads]);

  // Win Reasons Breakdown with Soft Emerald Colors (Kyu Convert Hui)
  const winReasonsData = useMemo(() => {
    const reasonsMap = {};
    const wonList = filteredLeads.filter(l => l.status === 'won' || l.status === 'closed');

    wonList.forEach(l => {
      const r = getWinReason(l);
      reasonsMap[r] = (reasonsMap[r] || 0) + 1;
    });

    return Object.entries(reasonsMap).map(([reason, count]) => ({
      name: reason,
      value: count,
      percentage: wonList.length ? Math.round((count / wonList.length) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [filteredLeads]);

  // EXPORT 1: PDF REPORT GENERATION
  const handleExportPDF = async () => {
    const toastId = toast.loading('Generating Executive Lead Analytics PDF...');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const primaryGreen = [18, 140, 126];
      const slateDark = [15, 23, 42];
      const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      // --- SECTION 1: KPI OVERVIEW BOX ---
      const kpiHeaders = ['Performance Metric', 'Metric Value', 'Analysis Context'];
      const kpiRows = [
        ['Total Leads Inflow', `${totalLeads} Leads`, `Time period filter: ${timeRange}`],
        ['Leads Won / Converted', `${wonLeads} (${overallWinRate}% Win Rate)`, 'Successfully closed deals'],
        ['Leads Lost / Dropped', `${lostLeads} (${totalLeads ? Math.round((lostLeads / totalLeads) * 100) : 0}% Drop)`, 'Detailed reasons analyzed in Section 3'],
        ['Active in Pipeline', `${inProgressLeads} Deals`, 'Under active proposal, invoice or qualification'],
        ['Assigned Sales Reps', `${agentStats.length} Agents Evaluated`, selectedAgentId === 'ALL' ? 'All Team Members' : `Agent ID: ${selectedAgentId}`]
      ];

      autoTable(doc, {
        head: [kpiHeaders],
        body: kpiRows,
        startY: 68,
        theme: 'grid',
        margin: { top: 68, left: 36, right: 36, bottom: 35 },
        headStyles: {
          fillColor: slateDark,
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          cellPadding: 4,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: slateDark,
          cellPadding: 4.5,
        },
        columnStyles: {
          0: { cellWidth: 150, fontStyle: 'bold' },
          1: { cellWidth: 180, fontStyle: 'bold', textColor: [18, 140, 126] },
          2: { cellWidth: 193, textColor: [100, 116, 139] }
        }
      });

      // --- SECTION 2: SALES PIPELINE FUNNEL (STAGE PROGRESSION) ---
      const funnelHeaders = ['Funnel Stage Name', 'Stage Description', 'Current Leads', 'Pipeline Share (%)'];
      const funnelRows = funnelData.map(f => [
        f.stage,
        f.desc,
        `${f.count} Leads`,
        `${f.percentage}%`
      ]);

      autoTable(doc, {
        head: [funnelHeaders],
        body: funnelRows,
        startY: doc.lastAutoTable.finalY + 14,
        theme: 'striped',
        margin: { top: 68, left: 36, right: 36, bottom: 35 },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 4,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: slateDark,
          cellPadding: 4.5,
        },
        columnStyles: {
          0: { cellWidth: 140, fontStyle: 'bold' },
          1: { cellWidth: 200, textColor: [100, 116, 139] },
          2: { cellWidth: 90, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 93, halign: 'center', fontStyle: 'bold', textColor: [18, 140, 126] }
        }
      });

      // --- SECTION 3: TEAM & AGENT PERFORMANCE SCORECARD ---
      const agentHeaders = ['Agent / Sales Person', 'Assigned', 'Won Deals', 'Lost Deals', 'In Pipeline', 'Win Rate (%)', 'Top Win Factor', 'Primary Loss Reason'];
      const agentRows = agentStats.map(a => [
        sanitizeForPdf(a.name),
        `${a.totalAssigned}`,
        `${a.won}`,
        `${a.lost}`,
        `${a.inProgress}`,
        `${a.conversionRate}%`,
        sanitizeForPdf(a.topWinReason),
        sanitizeForPdf(a.topLossReason)
      ]);

      autoTable(doc, {
        head: [agentHeaders],
        body: agentRows,
        startY: doc.lastAutoTable.finalY + 14,
        theme: 'striped',
        margin: { top: 68, left: 36, right: 36, bottom: 35 },
        headStyles: {
          fillColor: primaryGreen,
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          cellPadding: 4,
        },
        bodyStyles: {
          fontSize: 7,
          textColor: slateDark,
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 95, fontStyle: 'bold' },
          1: { cellWidth: 46, halign: 'center' },
          2: { cellWidth: 46, halign: 'center', textColor: [22, 163, 74], fontStyle: 'bold' },
          3: { cellWidth: 46, halign: 'center', textColor: [220, 38, 38], fontStyle: 'bold' },
          4: { cellWidth: 46, halign: 'center' },
          5: { cellWidth: 55, halign: 'center', fontStyle: 'bold', textColor: primaryGreen },
          6: { cellWidth: 95 },
          7: { cellWidth: 95 }
        }
      });

      // --- SECTION 4: DEAL WIN DRIVERS BREAKDOWN (KYU CONVERT HUI) ---
      if (winReasonsData.length > 0) {
        const winHeaders = ['Deal Win Reason (Success Factor)', 'Converted Deals', 'Share of Total Wins (%)'];
        const winRows = winReasonsData.map(r => [
          sanitizeForPdf(r.name),
          `${r.value} Deals`,
          `${r.percentage}%`
        ]);

        autoTable(doc, {
          head: [winHeaders],
          body: winRows,
          startY: doc.lastAutoTable.finalY + 14,
          theme: 'grid',
          margin: { top: 68, left: 36, right: 36, bottom: 35 },
          headStyles: {
            fillColor: [16, 185, 129], // Emerald green
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            cellPadding: 4,
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: slateDark,
            cellPadding: 4.5,
          },
          columnStyles: {
            0: { cellWidth: 260, fontStyle: 'bold' },
            1: { cellWidth: 130, halign: 'center' },
            2: { cellWidth: 133, halign: 'center', fontStyle: 'bold', textColor: [16, 185, 129] }
          }
        });
      }

      // --- SECTION 5: DROP REASONS BREAKDOWN (KYU GAYI) ---
      if (lossReasonsData.length > 0) {
        const reasonHeaders = ['Lead Drop Reason', 'Number of Dropped Leads', 'Percentage (%)'];
        const reasonRows = lossReasonsData.map(r => [
          sanitizeForPdf(r.name),
          `${r.value} Leads`,
          `${r.percentage}%`
        ]);

        autoTable(doc, {
          head: [reasonHeaders],
          body: reasonRows,
          startY: doc.lastAutoTable.finalY + 14,
          theme: 'grid',
          margin: { top: 68, left: 36, right: 36, bottom: 35 },
          headStyles: {
            fillColor: [225, 29, 72], // Rose red
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            cellPadding: 4,
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: slateDark,
            cellPadding: 4.5,
          },
          columnStyles: {
            0: { cellWidth: 260, fontStyle: 'bold' },
            1: { cellWidth: 130, halign: 'center' },
            2: { cellWidth: 133, halign: 'center', fontStyle: 'bold', textColor: [220, 38, 38] }
          }
        });
      }

      // --- SECTION 5: RECENT LOST LEADS DETAIL ROSTER ---
      const lostSample = filteredLeads.filter(l => l.status === 'lost').slice(0, 15);
      if (lostSample.length > 0) {
        const lostRosterHeaders = ['Customer', 'Phone', 'Assigned Agent', 'Service', 'Loss Reason', 'Feedback / Notes'];
        const lostRosterRows = lostSample.map(l => [
          sanitizeForPdf(l.name || 'Anonymous'),
          sanitizeForPdf(l.phone || ''),
          sanitizeForPdf(l.assignedAgent?.name || 'Unassigned'),
          sanitizeForPdf(l.serviceRequired || 'General'),
          sanitizeForPdf(getLossReason(l)),
          sanitizeForPdf((l.notes || l.customFields?.currentStep || '-').slice(0, 80))
        ]);

        autoTable(doc, {
          head: [lostRosterHeaders],
          body: lostRosterRows,
          startY: doc.lastAutoTable.finalY + 14,
          theme: 'striped',
          margin: { top: 68, left: 36, right: 36, bottom: 35 },
          headStyles: {
            fillColor: [71, 85, 105],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold',
            cellPadding: 4,
          },
          bodyStyles: {
            fontSize: 7,
            textColor: slateDark,
            cellPadding: 4,
          },
          columnStyles: {
            0: { cellWidth: 80, fontStyle: 'bold' },
            1: { cellWidth: 70 },
            2: { cellWidth: 80 },
            3: { cellWidth: 80 },
            4: { cellWidth: 93, fontStyle: 'bold', textColor: [220, 38, 38] },
            5: { cellWidth: 120 }
          }
        });
      }

      // Branded Header & Footer on all pages
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Top green brand accent stripe
        doc.setFillColor(18, 140, 126);
        doc.rect(0, 0, pageWidth, 4, 'F');

        // Logo
        try {
          if (LOGO_BASE64) {
            doc.addImage(LOGO_BASE64, 'PNG', 36, 12, 134, 38);
          }
        } catch {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(18, 140, 126);
          doc.text('HariKrushn DigiVerse', 36, 36);
        }

        // Header Text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('Lead Analytics & Team Performance Report', pageWidth - 36, 26, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${generatedDate} IST`, pageWidth - 36, 39, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(18, 140, 126);
        doc.text(`Scope: ${timeRange} | ${totalLeads} Total Leads`, pageWidth - 36, 50, { align: 'right' });

        // Separator line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.75);
        doc.line(36, 58, pageWidth - 36, 58);

        // Footer
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          'HariKrushn DigiVerse LLP • WhatsApp CRM & Automation Platform | Confidential',
          36,
          pageHeight - 16
        );
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - 36,
          pageHeight - 16,
          { align: 'right' }
        );
      }

      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`HK_Lead_Analytics_${dateStr}.pdf`);
      toast.success('Lead Analytics PDF report downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF report', { id: toastId });
    }
  };

  // EXPORT 2: EXCEL WORKBOOK GENERATION
  const handleExportExcel = async () => {
    const toastId = toast.loading('Generating Lead Analytics Excel workbook (.xlsx)...');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive Overview
      const overviewData = [
        ['Lead Analytics & Team Performance Report'],
        ['Generated Date', new Date().toLocaleString('en-IN')],
        ['Time Period Scope', timeRange],
        ['Selected Agent Scope', selectedAgentId === 'ALL' ? 'All Agents' : selectedAgentId],
        [],
        ['KEY PERFORMANCE INDICATORS', 'VALUE'],
        ['Total Leads Inflow', totalLeads],
        ['Leads Won / Converted', wonLeads],
        ['Leads Lost / Dropped', lostLeads],
        ['Active in Pipeline', inProgressLeads],
        ['Overall Conversion Rate', `${overallWinRate}%`],
      ];
      const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
      wsOverview['!cols'] = [{ wch: 32 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

      // Sheet 2: Pipeline Funnel Progression
      const funnelHeaders = ['Stage #', 'Stage Name', 'Stage Description', 'Leads Count', 'Pipeline Share (%)'];
      const funnelRows = funnelData.map(f => [
        f.id,
        f.shortTitle,
        f.desc,
        f.count,
        `${f.percentage}%`
      ]);
      const wsFunnel = XLSX.utils.aoa_to_sheet([funnelHeaders, ...funnelRows]);
      wsFunnel['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 34 }, { wch: 16 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsFunnel, 'Sales Funnel');

      // Sheet 3: Agent Performance Table
      const agentHeaders = [
        'Agent Name', 'Email', 'Role', 'Total Leads Assigned', 
        'Leads Won', 'Leads Lost', 'Active in Pipeline', 'Conversion Rate (%)',
        'Top Win Factor', 'Primary Loss Reason'
      ];
      const agentRows = agentStats.map(a => [
        a.name,
        a.email,
        a.role,
        a.totalAssigned,
        a.won,
        a.lost,
        a.inProgress,
        `${a.conversionRate}%`,
        a.topWinReason,
        a.topLossReason
      ]);
      const wsAgents = XLSX.utils.aoa_to_sheet([agentHeaders, ...agentRows]);
      wsAgents['!cols'] = [
        { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 22 },
        { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 },
        { wch: 28 }, { wch: 28 }
      ];
      XLSX.utils.book_append_sheet(wb, wsAgents, 'Agent Scorecard');

      // Sheet 4: Deal Win Drivers Breakdown
      const winReasonHeaders = ['Deal Win Reason (Success Factor)', 'Number of Deals', 'Percentage (%)'];
      const winReasonRows = winReasonsData.map(r => [r.name, r.value, `${r.percentage}%`]);
      const wsWinReasons = XLSX.utils.aoa_to_sheet([winReasonHeaders, ...winReasonRows]);
      wsWinReasons['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsWinReasons, 'Win Drivers Analysis');

      // Sheet 5: Won Leads Specific Roster
      const wonLeadsRoster = filteredLeads
        .filter(l => l.status === 'won' || l.status === 'closed')
        .map(l => [
          l.name || 'Unknown',
          l.phone || '',
          l.assignedAgent?.name || 'Unassigned',
          l.serviceRequired || '',
          getWinReason(l),
          l.notes || '',
          l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN') : ''
        ]);
      const wonHeaders = ['Customer Name', 'Phone', 'Assigned Agent', 'Service', 'Win Reason', 'Notes', 'Date'];
      const wsWon = XLSX.utils.aoa_to_sheet([wonHeaders, ...wonLeadsRoster]);
      wsWon['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 28 }, { wch: 35 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsWon, 'Won Deals Detail');

      // Sheet 6: Loss Reasons Breakdown
      const reasonHeaders = ['Loss Reason', 'Number of Leads', 'Percentage (%)'];
      const reasonRows = lossReasonsData.map(r => [r.name, r.value, `${r.percentage}%`]);
      const wsReasons = XLSX.utils.aoa_to_sheet([reasonHeaders, ...reasonRows]);
      wsReasons['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsReasons, 'Drop Reasons Analysis');

      // Sheet 7: Lost Leads Specific Roster
      const lostLeadsRoster = filteredLeads
        .filter(l => l.status === 'lost')
        .map(l => [
          l.name || 'Unknown',
          l.phone || '',
          l.assignedAgent?.name || 'Unassigned',
          l.serviceRequired || '',
          getLossReason(l),
          l.notes || '',
          l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN') : ''
        ]);
      const lostHeaders = ['Customer Name', 'Phone', 'Assigned Agent', 'Service', 'Loss Reason', 'Notes', 'Date'];
      const wsLost = XLSX.utils.aoa_to_sheet([lostHeaders, ...lostLeadsRoster]);
      wsLost['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 26 }, { wch: 35 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsLost, 'Lost Leads Detail');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Lead_Analytics_Report_${dateStr}.xlsx`);
      toast.success('Analytics Excel workbook exported successfully!', { id: toastId });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export Excel report', { id: toastId });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Navigation & Controls Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-wa-border/80 dark:border-wa-dark-border/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-wa-text-primary dark:text-white flex items-center gap-2">
                <span>Lead Analytics & Team Performance</span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 uppercase tracking-wide">
                  Live Insights
                </span>
              </h2>
              <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                Analyze lead distribution, agent win/loss performance, sales pipeline funnel, and drop reasons.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Filters & PDF / Excel Downloads */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Range Filter */}
          <div className="flex items-center bg-wa-panel-header dark:bg-wa-dark-panel-header p-1 rounded-xl border border-wa-border/70 dark:border-wa-dark-border/70 text-xs">
            <button
              onClick={() => setTimeRange('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${timeRange === 'ALL' ? 'bg-white dark:bg-wa-dark-panel text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-wa-text-secondary'}`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('THIS_MONTH')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${timeRange === 'THIS_MONTH' ? 'bg-white dark:bg-wa-dark-panel text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-wa-text-secondary'}`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeRange('THIS_WEEK')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${timeRange === 'THIS_WEEK' ? 'bg-white dark:bg-wa-dark-panel text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-wa-text-secondary'}`}
            >
              This Week
            </button>
            <button
              onClick={() => setTimeRange('TODAY')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${timeRange === 'TODAY' ? 'bg-white dark:bg-wa-dark-panel text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-wa-text-secondary'}`}
            >
              Today
            </button>
          </div>

          {/* Agent Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-wa-search dark:bg-wa-dark-search border border-wa-border/80 dark:border-wa-dark-border/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Agents ({agents.length})</option>
              {agents.map(ag => (
                <option key={ag._id} value={ag._id}>
                  {ag.name || ag.email}
                </option>
              ))}
              <option value="UNASSIGNED">Unassigned Pool</option>
            </select>
          </div>

          {/* DOWNLOAD REPORT BUTTONS: PDF & EXCEL */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPDF}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-wa-text-primary dark:text-white hover:border-rose-400 dark:hover:border-rose-800 transition-colors"
              title="Download Executive PDF Report"
            >
              <FileText className="w-3.5 h-3.5 text-rose-500" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-wa-text-primary dark:text-white hover:border-emerald-400 dark:hover:border-emerald-800 transition-colors"
              title="Download Excel Analytics Workbook (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlight Summary Cards with Soft Border Accents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inflow */}
        <div className="glass-card p-5 relative overflow-hidden border-l-4 border-l-sky-400 bg-sky-500/5 dark:bg-sky-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-wa-text-secondary">
              Total Leads Inflow
            </span>
            <span className="p-2 rounded-xl bg-sky-400/10 text-sky-600 dark:text-sky-400">
              <Users className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-wa-text-primary dark:text-white">
              {totalLeads}
            </span>
            <span className="text-xs text-wa-text-secondary font-medium">leads captured</span>
          </div>
          <p className="text-[11px] text-wa-text-light mt-1">
            Across WhatsApp bot, inquiries & campaigns
          </p>
        </div>

        {/* Won Leads (Converted) */}
        <div className="glass-card p-5 relative overflow-hidden border-l-4 border-l-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-wa-text-secondary">
              Leads Won / Converted
            </span>
            <span className="p-2 rounded-xl bg-emerald-400/10 text-emerald-600 dark:text-emerald-400">
              <Award className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {wonLeads}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
              {overallWinRate}% Win Rate
            </span>
          </div>
          <p className="text-[11px] text-wa-text-light mt-1">
            Successfully closed & converted deals
          </p>
        </div>

        {/* Lost / Dropped Leads */}
        <div className="glass-card p-5 relative overflow-hidden border-l-4 border-l-rose-400 bg-rose-500/5 dark:bg-rose-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-wa-text-secondary">
              Leads Lost / Dropped
            </span>
            <span className="p-2 rounded-xl bg-rose-400/10 text-rose-500 dark:text-rose-400">
              <XCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
              {lostLeads}
            </span>
            <span className="text-xs text-wa-text-secondary font-medium">
              ({totalLeads ? Math.round((lostLeads / totalLeads) * 100) : 0}% drop rate)
            </span>
          </div>
          <p className="text-[11px] text-wa-text-light mt-1">
            See Drop Reasons breakdown below
          </p>
        </div>

        {/* Active In Pipeline */}
        <div className="glass-card p-5 relative overflow-hidden border-l-4 border-l-amber-400 bg-amber-500/5 dark:bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-wa-text-secondary">
              Active in Pipeline
            </span>
            <span className="p-2 rounded-xl bg-amber-400/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {inProgressLeads}
            </span>
            <span className="text-xs text-wa-text-secondary font-medium">ongoing deals</span>
          </div>
          <p className="text-[11px] text-wa-text-light mt-1">
            In qualification, proposal & invoice stages
          </p>
        </div>
      </div>

      {/* SALES PIPELINE FUNNEL: SUPERIOR VISUAL CASCADE WITH SOFT COLORS */}
      <div className="glass-card p-5 space-y-5 border border-wa-border/80 dark:border-wa-dark-border/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-wa-border/60 dark:border-wa-dark-border/60 pb-3.5">
          <div>
            <h3 className="font-extrabold text-sm text-wa-text-primary dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-500" />
              <span>Sales Pipeline Funnel (Stage Progression)</span>
            </h3>
            <p className="text-[11px] text-wa-text-secondary mt-0.5">
              Live funnel progression tracking drop-off and conversion rates through every sales stage.
            </p>
          </div>

          {/* Toggle between Step Flow and Bar Chart */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center p-0.5 bg-wa-panel-header dark:bg-wa-dark-panel-header rounded-xl border border-wa-border/70 dark:border-wa-dark-border/70 text-xs">
              <button
                type="button"
                onClick={() => setFunnelViewType('flow')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${funnelViewType === 'flow' ? 'bg-white dark:bg-wa-dark-panel text-sky-600 dark:text-sky-400 shadow-xs' : 'text-wa-text-secondary'}`}
              >
                Funnel Stages
              </button>
              <button
                type="button"
                onClick={() => setFunnelViewType('chart')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${funnelViewType === 'chart' ? 'bg-white dark:bg-wa-dark-panel text-sky-600 dark:text-sky-400 shadow-xs' : 'text-wa-text-secondary'}`}
              >
                Chart View
              </button>
            </div>
            <span className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-200/50 dark:border-sky-800/40">
              {totalLeads} Total Leads
            </span>
          </div>
        </div>

        {funnelViewType === 'flow' ? (
          /* High-Impact Step Cascading Funnel */
          <div className="space-y-2.5 pt-1">
            {funnelData.map((step, idx) => {
              // Calculate progression drop from previous stage
              const prevCount = idx > 0 ? funnelData[idx - 1].count : totalLeads;
              const dropPercent = prevCount > 0 ? Math.max(0, Math.round(((prevCount - step.count) / prevCount) * 100)) : 0;
              const isFirst = idx === 0;

              return (
                <div key={step.id} className="group relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50/60 dark:bg-wa-dark-header/40 border border-wa-border/60 dark:border-wa-dark-border/60 hover:border-wa-green/30 dark:hover:border-wa-green/30 transition-all duration-200 shadow-2xs">
                    {/* Stage Label & Details */}
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className="w-7 h-7 rounded-full bg-white dark:bg-wa-dark-panel border border-wa-border/80 dark:border-wa-dark-border/80 flex items-center justify-center font-bold text-xs text-wa-text-secondary shrink-0 shadow-2xs">
                        0{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-wa-text-primary dark:text-white flex items-center gap-1.5">
                          <span>{step.shortTitle}</span>
                        </h4>
                        <p className="text-[10px] text-wa-text-light">{step.desc}</p>
                      </div>
                    </div>

                    {/* Progress Bar & Visual Fill */}
                    <div className="flex-1 max-w-xl mx-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-wa-text-secondary mb-1">
                        <span>Pipeline Share</span>
                        <span className="font-bold text-wa-text-primary dark:text-white">{step.percentage}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-wa-search dark:bg-wa-dark-search overflow-hidden">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${step.barColor} transition-all duration-700`}
                          style={{ width: `${Math.max(step.percentage, step.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>

                    {/* Count & Stage Badge */}
                    <div className="flex items-center gap-3 sm:justify-end shrink-0">
                      <div className="text-right">
                        <span className="text-base font-black text-wa-text-primary dark:text-white">
                          {step.count}
                        </span>
                        <span className="block text-[10px] text-wa-text-light">leads</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${step.badgeBg}`}>
                        {step.count > 0 ? `${step.percentage}% Active` : '0 Active'}
                      </span>
                    </div>
                  </div>

                  {/* Inter-stage conversion connector */}
                  {idx < funnelData.length - 1 && (
                    <div className="flex items-center gap-2 pl-7 py-0.5 text-[10px] text-wa-text-light">
                      <ArrowDown className="w-3 h-3 text-wa-border dark:text-wa-dark-border" />
                      <span>
                        Stage transition: <strong className="text-wa-text-secondary">{funnelData[idx + 1].count}</strong> reached next stage
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Recharts Horizontal Bar Chart with Soft Tones */
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                <XAxis type="number" fontSize={10} tick={{ fill: '#94a3b8' }} />
                <YAxis dataKey="shortTitle" type="category" fontSize={11} width={110} tick={{ fill: 'currentColor' }} />
                <Tooltip
                  content={<CustomFunnelTooltip />}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* TEAM & AGENT PERFORMANCE MATRIX (Kis person ke pass kitni aayi, kitni gayi) */}
      <div className="glass-card overflow-hidden border border-wa-border/80 dark:border-wa-dark-border/80">
        <div className="p-4 border-b border-wa-border dark:border-wa-dark-border bg-wa-panel-header dark:bg-wa-dark-panel-header/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-wa-text-primary dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span>Team & Agent Performance Scorecard</span>
            </h3>
            <p className="text-[11px] text-wa-text-secondary mt-0.5">
              Breakdown of lead allocation, conversions, drops, and win rate per salesperson.
            </p>
          </div>
          <div className="text-xs font-semibold text-wa-text-secondary">
            {agentStats.length} Sales Reps Evaluated
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-wa-border dark:border-wa-dark-border bg-wa-bg dark:bg-wa-dark-header/40 text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">
                <th className="px-5 py-3.5">Sales Person / Agent</th>
                <th className="px-5 py-3.5 text-center">Total Assigned</th>
                <th className="px-5 py-3.5 text-center">Won Deals (Convert)</th>
                <th className="px-5 py-3.5 text-center">Lost Deals</th>
                <th className="px-5 py-3.5 text-center">In Pipeline</th>
                <th className="px-5 py-3.5">Conversion / Win Rate</th>
                <th className="px-5 py-3.5 text-emerald-700 dark:text-emerald-400 font-bold">🏆 Top Win Factor</th>
                <th className="px-5 py-3.5 text-rose-700 dark:text-rose-400 font-bold text-right">❌ Primary Loss Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/40">
              {agentStats.map((ag) => {
                const isUnassigned = ag.id === 'UNASSIGNED';

                return (
                  <tr 
                    key={ag.id}
                    className={`hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/10 transition-colors ${isUnassigned ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}`}
                  >
                    {/* Agent Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isUnassigned ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'}`}>
                          {isUnassigned ? '⚠️' : (ag.name.substring(0, 2).toUpperCase())}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-wa-text-primary dark:text-white truncate">
                            {ag.name}
                          </p>
                          <p className="text-[10px] text-wa-text-secondary truncate">
                            {ag.role || (isUnassigned ? 'Unassigned Lead Pool' : ag.email)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Total Assigned */}
                    <td className="px-5 py-3.5 text-center font-bold text-sm text-wa-text-primary dark:text-white">
                      {ag.totalAssigned}
                    </td>

                    {/* Won */}
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                        🏆 {ag.won}
                      </span>
                    </td>

                    {/* Lost */}
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40">
                        ❌ {ag.lost}
                      </span>
                    </td>

                    {/* In Progress */}
                    <td className="px-5 py-3.5 text-center font-semibold text-wa-text-secondary">
                      {ag.inProgress}
                    </td>

                    {/* Win Rate Progress Bar */}
                    <td className="px-5 py-3.5 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-wa-search dark:bg-wa-dark-search h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              ag.conversionRate >= 30 ? 'bg-emerald-400' : ag.conversionRate >= 15 ? 'bg-amber-400' : 'bg-rose-400'
                            }`}
                            style={{ width: `${Math.min(ag.conversionRate, 100)}%` }}
                          />
                        </div>
                        <span className="font-bold text-xs w-9 text-right text-wa-text-primary dark:text-white">
                          {ag.conversionRate}%
                        </span>
                      </div>
                    </td>

                    {/* Top Win Factor */}
                    <td className="px-5 py-3.5 font-medium text-[11px] text-emerald-700 dark:text-emerald-400 truncate max-w-[160px]" title={ag.topWinReason}>
                      {ag.topWinReason !== '-' ? `🏆 ${ag.topWinReason}` : '-'}
                    </td>

                    {/* Top Loss Reason */}
                    <td className="px-5 py-3.5 text-right font-medium text-[11px] text-rose-700 dark:text-rose-400 truncate max-w-[160px]" title={ag.topLossReason}>
                      {ag.topLossReason !== '-' ? `❌ ${ag.topLossReason}` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DUAL OUTCOME REASONS: WIN DRIVERS ("Kyu Convert Hui") & LOSS FACTORS ("Kyu Gayi") */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: DEAL WIN DRIVERS (Winning Reasons Analysis) */}
        <div className="glass-card p-5 space-y-4 border border-emerald-500/30 dark:border-emerald-500/20 shadow-xs">
          <div className="flex items-center justify-between border-b border-wa-border/60 dark:border-wa-dark-border/60 pb-3">
            <div>
              <h4 className="font-bold text-sm text-wa-text-primary dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" />
                <span>Deal Win Drivers (Winning Reasons)</span>
              </h4>
              <p className="text-[11px] text-wa-text-secondary">
                Why deals closed successfully
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
              <span>🏆</span>
              <span>{wonLeads} Converted Deals</span>
            </span>
          </div>

          {winReasonsData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-wa-text-secondary text-xs">
              <Award className="w-8 h-8 text-emerald-400 mb-2 opacity-50" />
              <span>No won deals recorded in this period yet.</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={winReasonsData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={4}
                    >
                      {winReasonsData.map((entry, index) => (
                        <Cell key={`win-cell-${index}`} fill={WIN_PIE_COLORS[index % WIN_PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomWinPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Win Reasons Legend List */}
              <div className="space-y-2 text-xs max-h-48 overflow-y-auto scrollbar-thin pr-1">
                {winReasonsData.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/15 border border-emerald-500/20">
                    <div className="flex items-center gap-2.5 truncate">
                      <span 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: WIN_PIE_COLORS[idx % WIN_PIE_COLORS.length] }} 
                      />
                      <span className="font-semibold text-wa-text-primary dark:text-white truncate">
                        {entry.name}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0 ml-2">
                      {entry.value} ({entry.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CARD 2: LEAD DROP ANALYSIS (Loss Reasons Breakdown) */}
        <div className="glass-card p-5 space-y-4 border border-rose-500/30 dark:border-rose-500/20 shadow-xs">
          <div className="flex items-center justify-between border-b border-wa-border/60 dark:border-wa-dark-border/60 pb-3">
            <div>
              <h4 className="font-bold text-sm text-wa-text-primary dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Lead Drop Analysis (Loss Reasons)</span>
              </h4>
              <p className="text-[11px] text-wa-text-secondary">
                Top reasons why inquiries failed to convert
              </p>
            </div>
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-800/40 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
              <span>❌</span>
              <span>{lostLeads} Dropped Inquiries</span>
            </span>
          </div>

          {lossReasonsData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-wa-text-secondary text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2 opacity-60" />
              <span>Great job! No dropped leads recorded in this period.</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lossReasonsData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={4}
                    >
                      {lossReasonsData.map((entry, index) => (
                        <Cell key={`loss-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomLossPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Loss Reasons Legend List */}
              <div className="space-y-2 text-xs max-h-48 overflow-y-auto scrollbar-thin pr-1">
                {lossReasonsData.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-rose-50/30 dark:bg-rose-950/15 border border-rose-500/20">
                    <div className="flex items-center gap-2.5 truncate">
                      <span 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} 
                      />
                      <span className="font-semibold text-wa-text-primary dark:text-white truncate">
                        {entry.name}
                      </span>
                    </div>
                    <span className="font-bold text-rose-700 dark:text-rose-400 shrink-0 ml-2">
                      {entry.value} ({entry.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AUDIT ROSTER DEEP-DIVE (Tabbed Won vs Lost Detailed Feedback) */}
      {(wonLeads > 0 || lostLeads > 0) && (
        <div className="glass-card overflow-hidden border border-wa-border/80 dark:border-wa-dark-border/80">
          <div className="p-4 border-b border-wa-border dark:border-wa-dark-border bg-wa-panel-header dark:bg-wa-dark-panel-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-wa-text-primary dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>Deal Audit & Reason Feedback Roster</span>
              </h4>
              <p className="text-[11px] text-wa-text-secondary mt-0.5">
                Review specific client win factors and loss objections to refine your sales playbook.
              </p>
            </div>

            {/* Toggle Tabs: Won Deals vs Lost Deals */}
            <div className="flex items-center p-1 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => setAuditRosterTab('won')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  auditRosterTab === 'won'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
                }`}
              >
                <span>🏆 Won Deals</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${auditRosterTab === 'won' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'}`}>
                  {wonLeads}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAuditRosterTab('lost')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  auditRosterTab === 'lost'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
                }`}
              >
                <span>❌ Lost Deals</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${auditRosterTab === 'lost' ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'}`}>
                  {lostLeads}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[340px] scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-wa-dark-header z-10">
                <tr className="border-b border-wa-border dark:border-wa-dark-border text-[10px] uppercase font-bold text-wa-text-secondary">
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Assigned Agent</th>
                  <th className="px-4 py-2.5">Service Inquiry</th>
                  <th className="px-4 py-2.5">{auditRosterTab === 'won' ? 'Win Reason' : 'Loss Reason'}</th>
                  <th className="px-4 py-2.5">{auditRosterTab === 'won' ? 'Deal Notes / Success Factor' : 'Objection / Feedback'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/40">
                {auditRosterTab === 'won' ? (
                  filteredLeads
                    .filter(l => l.status === 'won' || l.status === 'closed')
                    .slice(0, 25)
                    .map((lead) => (
                      <tr key={lead._id} className="hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-wa-text-primary dark:text-white">
                          {lead.name || 'Anonymous Client'}
                          <span className="block text-[10px] font-normal text-wa-text-secondary">{lead.phone}</span>
                        </td>
                        <td className="px-4 py-2.5 text-wa-text-secondary font-medium">
                          {lead.assignedAgent?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-2.5 text-wa-text-primary dark:text-white font-medium">
                          {lead.serviceRequired || 'General Package'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
                            <span>🏆</span>
                            <span>{getWinReason(lead)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-wa-text-secondary truncate max-w-[280px]">
                          {lead.notes || lead.customFields?.currentStep || 'Closed deal successfully'}
                        </td>
                      </tr>
                    ))
                ) : (
                  filteredLeads
                    .filter(l => l.status === 'lost')
                    .slice(0, 25)
                    .map((lead) => (
                      <tr key={lead._id} className="hover:bg-rose-50/20 dark:hover:bg-rose-950/10 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-wa-text-primary dark:text-white">
                          {lead.name || 'Anonymous Inquiry'}
                          <span className="block text-[10px] font-normal text-wa-text-secondary">{lead.phone}</span>
                        </td>
                        <td className="px-4 py-2.5 text-wa-text-secondary font-medium">
                          {lead.assignedAgent?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-2.5 text-wa-text-primary dark:text-white font-medium">
                          {lead.serviceRequired || 'General'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40">
                            <span>❌</span>
                            <span>{getLossReason(lead)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-wa-text-secondary truncate max-w-[280px]">
                          {lead.notes || lead.customFields?.currentStep || '-'}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
