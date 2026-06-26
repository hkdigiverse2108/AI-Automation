'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Search, Loader2, ChevronLeft, ChevronRight, RefreshCw, User, Clock,
  FileSpreadsheet, Plus, Trash2, CheckCircle2, AlertCircle, HelpCircle,
  Volume2, ShieldAlert, BarChart3, Settings, Users, Play, Pause
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore, useThemeStore } from '../../../lib/store';
import { formatDate } from '../../../lib/utils';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell
} from 'recharts';

export default function TelephonyCRMPage() {
  const { user } = useAuthStore();
  const { dark } = useThemeStore();
  const isAdmin = ['superadmin', 'owner', 'admin'].includes(user?.role);

  // Tabs: 'overview', 'calls', 'complaints', 'lost-found', 'callbacks', 'voice-config', 'staff'
  const [activeTab, setActiveTab] = useState('overview');

  // Common Loading & Pagination States
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 15;

  // Data States
  const [analytics, setAnalytics] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [lostItems, setLostItems] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [parkConfig, setParkConfig] = useState({
    park_name: '',
    voice_id: '',
    timings: '',
    address: '',
    ticket_prices: { adult: 0, child: 0, senior: 0 },
    multilingual: { custom_texts: { en: '', hi: '', gu: '' } },
    audio_urls: { en: '', hi: '', gu: '' }
  });

  // Action / Form States
  const [savingConfig, setSavingConfig] = useState(false);
  const [dialingPhone, setDialingPhone] = useState(null);
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'agent' });

  // Audio Playback Preview State
  const [playingAudio, setPlayingAudio] = useState(null); // 'en' | 'hi' | 'gu' | null
  const [audioObj, setAudioObj] = useState(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page on search or filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, activeTab]);

  // Load active tab data
  useEffect(() => {
    fetchTabData();
  }, [activeTab, page, debouncedSearch, statusFilter]);

  const fetchTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const { data } = await api.get('/admin/analytics');
        if (data.success) setAnalytics(data.data);
      } else if (activeTab === 'calls') {
        const { data } = await api.get('/telephony/call-logs', {
          params: { page, limit, search: debouncedSearch || undefined, callType: statusFilter || undefined }
        });
        if (data.success) {
          setCallLogs(data.data.logs);
          setTotalPages(data.data.pagination.pages || 1);
          setTotalCount(data.data.pagination.total || 0);
        }
      } else if (activeTab === 'complaints') {
        const { data } = await api.get('/admin/complaints', {
          params: { page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined }
        });
        if (data.success) {
          setComplaints(data.data.complaints);
          setTotalPages(data.data.pagination.pages || 1);
          setTotalCount(data.data.pagination.total || 0);
        }
      } else if (activeTab === 'lost-found') {
        const { data } = await api.get('/admin/lost-items', {
          params: { page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined }
        });
        if (data.success) {
          setLostItems(data.data.lostItems);
          setTotalPages(data.data.pagination.pages || 1);
          setTotalCount(data.data.pagination.total || 0);
        }
      } else if (activeTab === 'callbacks') {
        const { data } = await api.get('/admin/callbacks', {
          params: { page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined }
        });
        if (data.success) {
          setCallbacks(data.data.callbacks);
          setTotalPages(data.data.pagination.pages || 1);
          setTotalCount(data.data.pagination.total || 0);
        }
      } else if (activeTab === 'voice-config') {
        const { data } = await api.get('/admin/park-config');
        if (data.success && data.data) {
          setParkConfig(data.data);
        }
      } else if (activeTab === 'staff') {
        if (isAdmin) {
          const { data } = await api.get('/admin/users');
          if (data.success) setStaffList(data.data);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load tab data');
    } finally {
      setLoading(false);
    }
  };

  // Click to Call OBD Dialing
  const triggerClickToCall = async (phone) => {
    setDialingPhone(phone);
    try {
      const { data } = await api.post('/admin/click-to-call', { phone });
      if (data.success) {
        toast.success(data.message || 'Call triggered successfully via OBD');
        if (activeTab === 'calls') fetchTabData();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Click-to-call dialing failed');
    } finally {
      setDialingPhone(null);
    }
  };

  // Ticket Status Changes
  const updateTicketStatus = async (modelType, id, newStatus) => {
    setUpdatingTicketId(id);
    try {
      let endpoint = '';
      if (modelType === 'complaints') endpoint = `/admin/complaints/${id}`;
      else if (modelType === 'lost-items') endpoint = `/admin/lost-items/${id}`;
      else if (modelType === 'callbacks') endpoint = `/admin/callbacks/${id}`;

      const { data } = await api.put(endpoint, { status: newStatus });
      if (data.success) {
        toast.success('Status updated successfully');
        fetchTabData();
      }
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // Staff Account Addition
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setCreatingStaff(true);
    try {
      const { data } = await api.post('/admin/users', staffForm);
      if (data.success) {
        toast.success('Staff member registered successfully');
        setStaffForm({ name: '', email: '', password: '', role: 'agent' });
        fetchTabData();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register staff account');
    } finally {
      setCreatingStaff(false);
    }
  };

  // Staff Account Removal
  const handleDeleteStaff = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this staff member?')) return;
    try {
      const { data } = await api.delete(`/admin/users/${id}`);
      if (data.success) {
        toast.success('Staff member deleted successfully');
        fetchTabData();
      }
    } catch (err) {
      toast.error('Failed to delete staff member');
    }
  };

  // Save Voice / Park Config
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const payload = {
        park_name: parkConfig.park_name,
        voice_id: parkConfig.voice_id,
        timings: parkConfig.timings,
        address: parkConfig.address,
        ticket_prices: parkConfig.ticket_prices,
        custom_texts: parkConfig.multilingual?.custom_texts
      };
      const { data } = await api.put('/admin/park-config', payload);
      if (data.success) {
        toast.success('Voice configurator settings updated successfully');
        setParkConfig(data.data);
      }
    } catch (err) {
      toast.error('Failed to save configs');
    } finally {
      setSavingConfig(false);
    }
  };

  // CSV Exporter Helper
  const handleExportCSV = (tab) => {
    let csvData = [];
    let headers = [];
    let fileName = `export_${tab}_${new Date().toISOString().split('T')[0]}`;

    const cleanCSVCell = (val) => {
      if (val === null || val === undefined) return '';
      return String(val).replace(/"/g, '""').replace(/\n/g, ' ');
    };

    if (tab === 'calls') {
      headers = ['Call Date', 'Session ID', 'From Number', 'To Number', 'Duration (s)', 'Status', 'Intent', 'Recording URL'];
      csvData = callLogs.map(log => [
        formatDate(log.timestamp || log.createdAt),
        log.session_id || 'N/A',
        log.from_number || log.phone || '',
        log.to_number || '',
        log.duration || 0,
        log.status || '',
        log.last_intent || '',
        log.recording_url || ''
      ]);
    } else if (tab === 'complaints') {
      headers = ['Date Filed', 'Caller Name', 'Phone Number', 'Visit Date', 'Complaint Text', 'Status', 'Recording URL'];
      csvData = complaints.map(c => [
        formatDate(c.createdAt),
        c.name || '',
        c.phone_number || '',
        formatDate(c.visit_date),
        c.complaint || '',
        c.status || '',
        c.recording_url || ''
      ]);
    } else if (tab === 'lost-found') {
      headers = ['Date Filed', 'Caller Name', 'Phone Number', 'Lost Item', 'Date Lost', 'Status', 'Recording URL'];
      csvData = lostItems.map(item => [
        formatDate(item.createdAt),
        item.name || '',
        item.phone_number || '',
        item.lost_item || '',
        formatDate(item.date_lost),
        item.status || '',
        item.recording_url || ''
      ]);
    } else if (tab === 'callbacks') {
      headers = ['Date Filed', 'Caller Name', 'Phone Number', 'Status'];
      csvData = callbacks.map(c => [
        formatDate(c.createdAt),
        c.name || '',
        c.phone_number || '',
        c.status || ''
      ]);
    }

    if (csvData.length === 0) {
      toast.error('No data available to export');
      return;
    }

    const csvRows = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cleanCSVCell(cell)}"`).join(','))
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${tab} export downloaded!`);
  };

  // Audio Playback Controls
  const togglePlayAudio = (lang, relativeUrl) => {
    if (!relativeUrl) {
      toast.error('TTS Audio has not been generated yet. Please save configurator scripts first.');
      return;
    }

    const apiBase = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (process.env.NEXT_PUBLIC_API_URL || '').includes('localhost'))
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_API_URL || window.location.origin);
    const fullAudioUrl = `${apiBase.replace(/\/$/, '')}${relativeUrl}`;

    if (playingAudio === lang) {
      audioObj.pause();
      setPlayingAudio(null);
    } else {
      if (audioObj) {
        audioObj.pause();
      }
      const newAudio = new Audio(fullAudioUrl);
      newAudio.play().catch(() => toast.error('Error playing cached TTS audio'));
      newAudio.onended = () => setPlayingAudio(null);
      setAudioObj(newAudio);
      setPlayingAudio(lang);
    }
  };

  // Helper: Format duration to readable text
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Recharts color palettes
  const COLORS = ['#f59e0b', '#3b82f6', '#10b981'];

  return (
    <div className="space-y-6 text-themeTextPrimary min-h-screen pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-themeBorder pb-5">
        <div>
          <h2 className="text-2xl font-bold text-themeTextPrimary flex items-center gap-2 tracking-tight">
            <Phone className="w-7 h-7 text-[#10b981] animate-pulse" />
            IVR Telephony & CRM Dashboard
          </h2>
          <p className="text-sm text-themeTextSecondary mt-1">
            Centrally manage MyOperator webhooks, ElevenLabs multilingual TTS config, ticketing workflows, and outbound calls.
          </p>
        </div>
        <button
          onClick={fetchTabData}
          className="flex items-center gap-2 bg-themeCard hover:bg-themeCardHover text-sm font-semibold py-2 px-4 rounded-xl border border-themeBorder transition-all self-start md:self-auto text-themeTextPrimary"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs Layout */}
      <div className="flex flex-wrap gap-2 border-b border-themeBorder pb-3">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'calls', label: 'Call Log history', icon: Clock },
          { id: 'complaints', label: 'Complaints CRM', icon: ShieldAlert },
          { id: 'lost-found', label: 'Lost & Found', icon: Search },
          { id: 'callbacks', label: 'Callback Queue', icon: PhoneOutgoing },
          { id: 'voice-config', label: 'Voice Configurator', icon: Volume2 },
          ...(isAdmin ? [{ id: 'staff', label: 'Staff Management', icon: Users }] : [])
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearch('');
                setStatusFilter('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${isActive
                  ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'bg-themeCard hover:bg-themeCardHover text-themeTextSecondary border-themeBorder'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ============================================================================== */}
      {/* 1. OVERVIEW & ANALYTICS TAB */}
      {/* ============================================================================== */}
      {activeTab === 'overview' && analytics && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Calls Synced', val: analytics.totalCalls, desc: 'Incoming & OBD' },
              { label: 'Lost & Found reported', val: analytics.lostItemsCount, desc: 'CRM item tickets' },
              { label: 'Active Complaints', val: analytics.complaintBreakdown.pending + analytics.complaintBreakdown.investigating, desc: 'In investigating / pending state' },
              { label: 'Callback queue size', val: analytics.callbackQueue, desc: 'Pending agent callout' }
            ].map((metric, i) => (
              <div key={i} className="glass-card bg-themeCard p-5 rounded-2xl border border-themeBorder shadow-sm relative overflow-hidden group hover:border-[#10b981]/30 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#10b981]/5 to-transparent rounded-bl-full pointer-events-none" />
                <p className="text-xs font-semibold uppercase tracking-wider text-themeMuted">{metric.label}</p>
                <p className="text-3xl font-extrabold text-themeTextPrimary mt-2 tracking-tight group-hover:scale-105 transition-transform origin-left">{metric.val}</p>
                <p className="text-[11px] text-themeTextSecondary mt-1">{metric.desc}</p>
              </div>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Calls Line Chart */}
            <div className="lg:col-span-2 glass-card bg-themeCard p-5 rounded-2xl border border-themeBorder shadow-sm">
              <h3 className="text-sm font-bold text-themeTextPrimary uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#10b981]" /> Daily Call Volume (7 Days)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.dailyCalls} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1f2937' : '#E5E7EB'} />
                    <XAxis dataKey="date" stroke={dark ? '#9ca3af' : '#6B7280'} fontSize={11} />
                    <YAxis stroke={dark ? '#9ca3af' : '#6B7280'} fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: dark ? '#111827' : '#ffffff', borderColor: dark ? '#1f2937' : '#E5E7EB', color: dark ? '#fff' : '#111827' }} />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Complaint Breakdown Doughnut */}
            <div className="glass-card bg-themeCard p-5 rounded-2xl border border-themeBorder shadow-sm flex flex-col justify-between">
              <h3 className="text-sm font-bold text-themeTextPrimary uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#10b981]" /> Complaints ticket status
              </h3>
              <div className="h-44 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pending', value: analytics.complaintBreakdown.pending },
                        { name: 'Investigating', value: analytics.complaintBreakdown.investigating },
                        { name: 'Resolved', value: analytics.complaintBreakdown.resolved }
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { name: 'Pending', color: '#f59e0b' },
                        { name: 'Investigating', color: '#3b82f6' },
                        { name: 'Resolved', color: '#10b981' }
                      ].map((cell, idx) => (
                        <Cell key={`cell-${idx}`} fill={cell.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: dark ? '#111827' : '#ffffff', borderColor: dark ? '#1f2937' : '#E5E7EB', color: dark ? '#fff' : '#111827' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {[
                  { name: 'Pending', color: 'bg-amber-500', count: analytics.complaintBreakdown.pending },
                  { name: 'Investigating', color: 'bg-blue-500', count: analytics.complaintBreakdown.investigating },
                  { name: 'Resolved', color: 'bg-emerald-500', count: analytics.complaintBreakdown.resolved }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-themeTextSecondary">
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      {item.name}
                    </span>
                    <span className="font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 2. CALL LOGS TAB */}
      {/* ============================================================================== */}
      {activeTab === 'calls' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-themeCardHover p-4 rounded-2xl border border-themeBorder">
            <div className="flex flex-1 gap-3 w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-themeMuted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search caller phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#10b981]/50 text-themeInputText placeholder-themePlaceholder"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-themeInputBg border border-themeInputBorder rounded-xl px-3 py-2 text-xs text-themeTextSecondary focus:outline-none"
              >
                <option value="" className="bg-themeCard text-themeTextPrimary">All Call Types</option>
                <option value="incoming" className="bg-themeCard text-themeTextPrimary">Incoming</option>
                <option value="outgoing" className="bg-themeCard text-themeTextPrimary">Outgoing</option>
                <option value="missed" className="bg-themeCard text-themeTextPrimary">Missed</option>
              </select>
            </div>
            <button
              onClick={() => handleExportCSV('calls')}
              className="flex items-center gap-1.5 bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/25 text-xs font-semibold py-2 px-3 border border-[#10b981]/20 rounded-xl transition-all self-stretch sm:self-auto justify-center"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
          </div>

          {/* Call Logs Table */}
          <div className="glass-card bg-themeCard rounded-2xl border border-themeBorder shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-themeTableHeader text-themeTextSecondary font-bold border-b border-themeBorder uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Session ID</th>
                    <th className="px-5 py-3">Caller details</th>
                    <th className="px-5 py-3">Call Type</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">State/Intent</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-themeBorder/60">
                  {loading && callLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-5 py-12 text-center text-themeMuted">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-[#10b981]" />
                          <span>Loading call logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : callLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-5 py-12 text-center text-themeMuted italic">No calls found in the database.</td>
                    </tr>
                  ) : (
                    callLogs.map(log => {
                      let TypeIcon = PhoneIncoming;
                      let typeColor = 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20';
                      if (log.callType === 'outgoing') {
                        TypeIcon = PhoneOutgoing;
                        typeColor = 'text-blue-500 bg-blue-500/10 border border-blue-500/20';
                      } else if (log.callType === 'missed' || log.callType === 'rejected') {
                        TypeIcon = PhoneMissed;
                        typeColor = 'text-rose-500 bg-rose-500/10 border border-rose-500/20';
                      }
                      return (
                        <tr key={log._id} className="hover:bg-themeTableRowHover odd:bg-themeTableRowAlt/30 transition-all">
                          <td className="px-5 py-3 text-themeTextSecondary font-medium whitespace-nowrap">{formatDate(log.timestamp || log.createdAt)}</td>
                          <td className="px-5 py-3 font-mono text-[10px] text-themeMuted">{log.session_id ? log.session_id.substring(0, 16) + '...' : 'N/A'}</td>
                          <td className="px-5 py-3 font-bold text-themeTextPrimary">
                            <div className="flex flex-col">
                               <span>{log.name || 'IVR Caller'}</span>
                               <span className="text-[10px] font-mono text-themeTextSecondary">+{log.from_number || log.phone}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase ${typeColor}`}>
                              <TypeIcon className="w-3 h-3" />
                              {log.callType}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-semibold text-themeTextSecondary">{log.duration ? formatDuration(log.duration) : '—'}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col max-w-[150px] truncate">
                              <span className="font-semibold text-themeTextPrimary capitalize">{log.status || 'initiated'}</span>
                              <span className="text-[10px] text-themeMuted italic mt-0.5">{log.last_intent || 'No intent parsed'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {/* Click to Call trigger */}
                              <button
                                onClick={() => triggerClickToCall(log.from_number || log.phone)}
                                disabled={dialingPhone === (log.from_number || log.phone)}
                                className="bg-themeCard hover:bg-themeCardHover text-[#10b981] p-1.5 rounded-lg border border-themeBorder transition-all flex items-center justify-center"
                                title="Click to dial outbound callback"
                              >
                                {dialingPhone === (log.from_number || log.phone) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Phone className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {/* Recording player link */}
                              {log.recording_url && (
                                <a
                                  href={log.recording_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-blue-400 hover:underline"
                                  title="Play audio recording"
                                >
                                  Recording
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-themeBorder bg-themeCardHover text-xs">
                <span className="text-themeTextSecondary">Page {page} of {totalPages} ({totalCount} total)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 bg-themeCard border border-themeBorder rounded-lg hover:bg-themeCardHover disabled:opacity-40 text-themeTextPrimary"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 bg-themeCard border border-themeBorder rounded-lg hover:bg-themeCardHover disabled:opacity-40 text-themeTextPrimary"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 3. COMPLAINTS CRM TAB */}
      {/* ============================================================================== */}
      {activeTab === 'complaints' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-themeCardHover p-4 rounded-2xl border border-themeBorder">
            <div className="flex flex-1 gap-3 w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-themeMuted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search complaints name or details..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#10b981]/50 text-themeInputText placeholder-themePlaceholder"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-themeInputBg border border-themeInputBorder rounded-xl px-3 py-2 text-xs text-themeTextSecondary focus:outline-none"
              >
                <option value="" className="bg-themeCard text-themeTextPrimary">All Statuses</option>
                <option value="pending" className="bg-themeCard text-themeTextPrimary">Pending</option>
                <option value="investigating" className="bg-themeCard text-themeTextPrimary">Investigating</option>
                <option value="resolved" className="bg-themeCard text-themeTextPrimary">Resolved</option>
              </select>
            </div>
            <button
              onClick={() => handleExportCSV('complaints')}
              className="flex items-center gap-1.5 bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/25 text-xs font-semibold py-2 px-3 border border-[#10b981]/20 rounded-xl transition-all self-stretch sm:self-auto justify-center"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
          </div>

          <div className="glass-card bg-themeCard rounded-2xl border border-themeBorder shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-themeTableHeader text-themeTextSecondary font-bold border-b border-themeBorder uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Visit Date</th>
                    <th className="px-5 py-3">Complaint description</th>
                    <th className="px-5 py-3">Ticket status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-themeBorder/60">
                  {loading && complaints.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-themeMuted">
                        <Loader2 className="w-5 h-5 animate-spin text-[#10b981] mx-auto mb-2" /> Loading complaints...
                      </td>
                    </tr>
                  ) : complaints.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-themeMuted italic">No complaint tickets logged.</td>
                    </tr>
                  ) : (
                    complaints.map(c => (
                      <tr key={c._id} className="hover:bg-themeTableRowHover odd:bg-themeTableRowAlt/30 transition-all">
                        <td className="px-5 py-3.5 text-themeTextSecondary whitespace-nowrap">{formatDate(c.createdAt)}</td>
                        <td className="px-5 py-3.5 font-bold text-themeTextPrimary">
                          <div className="flex flex-col">
                            <span>{c.name}</span>
                            <span className="text-[10px] font-mono text-themeTextSecondary">+{c.phone_number}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-themeTextSecondary">{formatDate(c.visit_date)}</td>
                        <td className="px-5 py-3.5 max-w-[280px]">
                          <p className="text-themeTextSecondary font-medium break-words leading-relaxed">{c.complaint}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <select
                            value={c.status}
                            disabled={updatingTicketId === c._id}
                            onChange={e => updateTicketStatus('complaints', c._id, e.target.value)}
                            className={`px-3 py-1.5 rounded-lg border font-bold uppercase text-[9px] focus:outline-none ${c.status === 'resolved'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                : c.status === 'investigating'
                                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                              }`}
                          >
                            <option value="pending" className="bg-themeCard text-themeTextPrimary">Pending</option>
                            <option value="investigating" className="bg-themeCard text-themeTextPrimary">Investigating</option>
                            <option value="resolved" className="bg-themeCard text-themeTextPrimary">Resolved</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => triggerClickToCall(c.phone_number)}
                              disabled={dialingPhone === c.phone_number}
                              className="bg-themeCard hover:bg-themeCardHover text-[#10b981] p-1.5 rounded-lg border border-themeBorder transition-all flex items-center justify-center"
                              title="Click to dial outbound callback"
                            >
                              {dialingPhone === c.phone_number ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Phone className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {c.recording_url && (
                              <a
                                href={c.recording_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-themeCard hover:bg-themeCardHover text-blue-400 border border-themeBorder font-bold px-2 py-1 rounded-lg text-[10px]"
                              >
                                Play Audio
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-themeBorder bg-themeCardHover text-xs">
                <span className="text-themeTextSecondary">Page {page} of {totalPages} ({totalCount} total)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 bg-themeCard border border-themeBorder rounded-lg hover:bg-themeCardHover disabled:opacity-40 text-themeTextPrimary"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 bg-themeCard border border-themeBorder rounded-lg hover:bg-themeCardHover disabled:opacity-40 text-themeTextPrimary"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 4. LOST & FOUND TAB */}
      {/* ============================================================================== */}
      {activeTab === 'lost-found' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-themeCardHover p-4 rounded-2xl border border-themeBorder">
            <div className="flex flex-1 gap-3 w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-themeMuted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search lost items..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#10b981]/50 text-themeInputText placeholder-themePlaceholder"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-themeInputBg border border-themeInputBorder rounded-xl px-3 py-2 text-xs text-themeTextSecondary focus:outline-none"
              >
                <option value="" className="bg-themeCard text-themeTextPrimary">All Statuses</option>
                <option value="reported" className="bg-themeCard text-themeTextPrimary">Reported</option>
                <option value="found" className="bg-themeCard text-themeTextPrimary">Found</option>
              </select>
            </div>
            <button
              onClick={() => handleExportCSV('lost-found')}
              className="flex items-center gap-1.5 bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/25 text-xs font-semibold py-2 px-3 border border-[#10b981]/20 rounded-xl transition-all self-stretch sm:self-auto justify-center"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
          </div>

          <div className="glass-card bg-themeCard rounded-2xl border border-themeBorder shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-themeTableHeader text-themeTextSecondary font-bold border-b border-themeBorder uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3">Report Date</th>
                    <th className="px-5 py-3">Reporter</th>
                    <th className="px-5 py-3">Lost Item</th>
                    <th className="px-5 py-3">Estimated date lost</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-themeBorder/60">
                  {loading && lostItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-themeMuted">
                        <Loader2 className="w-5 h-5 animate-spin text-[#10b981] mx-auto mb-2" /> Loading reports...
                      </td>
                    </tr>
                  ) : lostItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-themeMuted italic">No lost item reports found.</td>
                    </tr>
                  ) : (
                    lostItems.map(item => (
                      <tr key={item._id} className="hover:bg-themeTableRowHover odd:bg-themeTableRowAlt/30 transition-all">
                        <td className="px-5 py-3.5 text-themeTextSecondary whitespace-nowrap">{formatDate(item.createdAt)}</td>
                        <td className="px-5 py-3.5 font-bold text-themeTextPrimary">
                          <div className="flex flex-col">
                            <span>{item.name}</span>
                            <span className="text-[10px] font-mono text-themeTextSecondary">+{item.phone_number}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-themeTextSecondary font-medium">{item.lost_item}</td>
                        <td className="px-5 py-3.5 text-themeTextSecondary">{formatDate(item.date_lost)}</td>
                        <td className="px-5 py-3.5">
                          <select
                            value={item.status}
                            disabled={updatingTicketId === item._id}
                            onChange={e => updateTicketStatus('lost-items', item._id, e.target.value)}
                            className={`px-3 py-1.5 rounded-lg border font-bold uppercase text-[9px] focus:outline-none ${item.status === 'found'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                              }`}
                          >
                            <option value="reported" className="bg-themeCard text-themeTextPrimary">Reported</option>
                            <option value="found" className="bg-themeCard text-themeTextPrimary">Found</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => triggerClickToCall(item.phone_number)}
                              disabled={dialingPhone === item.phone_number}
                              className="bg-themeCard hover:bg-themeCardHover text-[#10b981] p-1.5 rounded-lg border border-themeBorder transition-all flex items-center justify-center"
                              title="Click to dial outbound callback"
                            >
                              {dialingPhone === item.phone_number ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Phone className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {item.recording_url && (
                              <a
                                href={item.recording_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-themeCard hover:bg-themeCardHover text-blue-400 border border-themeBorder font-bold px-2 py-1 rounded-lg text-[10px]"
                              >
                                Play Audio
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-themeBorder bg-themeCardHover text-xs">
                <span className="text-themeTextSecondary">Page {page} of {totalPages} ({totalCount} total)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 bg-themeCard border border-themeBorder rounded-lg hover:bg-themeCardHover disabled:opacity-40 text-themeTextPrimary"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 bg-themeCard border border-themeBorder rounded-lg hover:bg-themeCardHover disabled:opacity-40 text-themeTextPrimary"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 5. CALLBACK QUEUE TAB */}
      {/* ============================================================================== */}
      {activeTab === 'callbacks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-themeCardHover p-4 rounded-2xl border border-themeBorder">
            <div className="flex flex-1 gap-3 w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-themeMuted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search callback phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#10b981]/50 text-themeInputText placeholder-themePlaceholder"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-themeInputBg border border-themeInputBorder rounded-xl px-3 py-2 text-xs text-themeTextSecondary focus:outline-none"
              >
                <option value="" className="bg-themeCard text-themeTextPrimary">All Statuses</option>
                <option value="pending" className="bg-themeCard text-themeTextPrimary">Pending</option>
                <option value="completed" className="bg-themeCard text-themeTextPrimary">Completed</option>
              </select>
            </div>
            <button
              onClick={() => handleExportCSV('callbacks')}
              className="flex items-center gap-1.5 bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/25 text-xs font-semibold py-2 px-3 border border-[#10b981]/20 rounded-xl transition-all self-stretch sm:self-auto justify-center"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
          </div>

          <div className="glass-card bg-themeCard rounded-2xl border border-themeBorder shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-themeTableHeader text-themeTextSecondary font-bold border-b border-themeBorder uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3">Date Requested</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Phone number</th>
                    <th className="px-5 py-3">Queue status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-themeBorder/60">
                  {loading && callbacks.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-5 py-12 text-center text-themeMuted">
                        <Loader2 className="w-5 h-5 animate-spin text-[#10b981] mx-auto mb-2" /> Loading queue...
                      </td>
                    </tr>
                  ) : callbacks.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-5 py-12 text-center text-themeMuted italic">No callback requests pending.</td>
                    </tr>
                  ) : (
                    callbacks.map(c => (
                      <tr key={c._id} className="hover:bg-themeTableRowHover odd:bg-themeTableRowAlt/30 transition-all">
                        <td className="px-5 py-3.5 text-themeTextSecondary whitespace-nowrap">{formatDate(c.createdAt)}</td>
                        <td className="px-5 py-3.5 font-bold text-themeTextPrimary">{c.name || 'IVR Caller'}</td>
                        <td className="px-5 py-3.5 font-mono text-themeTextSecondary">+{c.phone_number}</td>
                        <td className="px-5 py-3.5">
                          <select
                            value={c.status}
                            disabled={updatingTicketId === c._id}
                            onChange={e => updateTicketStatus('callbacks', c._id, e.target.value)}
                            className={`px-3 py-1.5 rounded-lg border font-bold uppercase text-[9px] focus:outline-none ${c.status === 'completed'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                              }`}
                          >
                            <option value="pending" className="bg-themeCard text-themeTextPrimary">Pending</option>
                            <option value="completed" className="bg-themeCard text-themeTextPrimary">Completed</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => triggerClickToCall(c.phone_number)}
                            disabled={dialingPhone === c.phone_number}
                            className="bg-[#10b981]/10 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/30 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5"
                          >
                            {dialingPhone === c.phone_number ? (
                              <Loader2 className="w-3 animate-spin" />
                            ) : (
                              <Phone className="w-3 h-3" />
                            )}
                            Call Now (OBD)
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-themeBorder bg-themeCardHover text-xs">
                <span className="text-themeTextSecondary">Page {page} of {totalPages} ({totalCount} total)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 bg-themeCard border border-themeBorder rounded-lg hover:bg-themeCardHover disabled:opacity-40 text-themeTextPrimary"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 bg-themeCard border border-themeBorder rounded-lg hover:bg-themeCardHover disabled:opacity-40 text-themeTextPrimary"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 6. VOICE CONFIGURATOR TAB */}
      {/* ============================================================================== */}
      {activeTab === 'voice-config' && (
        <form onSubmit={handleSaveConfig} className="max-w-4xl space-y-6">
          <div className="glass-card bg-themeCard p-6 rounded-2xl border border-themeBorder shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-themeTextPrimary uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-[#10b981]" /> IVR TTS Configuration settings
            </h3>

            {/* Config Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-themeTextSecondary mb-1.5">Amusement/Park Name</label>
                <input
                  type="text"
                  required
                  value={parkConfig.park_name}
                  onChange={e => setParkConfig({ ...parkConfig, park_name: e.target.value })}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-4 py-2.5 text-xs text-themeInputText focus:outline-none focus:border-[#10b981]/50"
                  placeholder="Amusement Park Name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-themeTextSecondary mb-1.5">ElevenLabs Voice ID</label>
                <input
                  type="text"
                  required
                  value={parkConfig.voice_id}
                  onChange={e => setParkConfig({ ...parkConfig, voice_id: e.target.value })}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-4 py-2.5 text-xs text-themeInputText focus:outline-none focus:border-[#10b981]/50 font-mono"
                  placeholder="Voice ID"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-themeTextSecondary mb-1.5">Timings Information</label>
                <input
                  type="text"
                  value={parkConfig.timings}
                  onChange={e => setParkConfig({ ...parkConfig, timings: e.target.value })}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-4 py-2.5 text-xs text-themeInputText focus:outline-none focus:border-[#10b981]/50"
                  placeholder="e.g. 09:00 AM - 06:00 PM"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-themeTextSecondary mb-1.5">Park Address</label>
                <input
                  type="text"
                  value={parkConfig.address}
                  onChange={e => setParkConfig({ ...parkConfig, address: e.target.value })}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-4 py-2.5 text-xs text-themeInputText focus:outline-none focus:border-[#10b981]/50"
                  placeholder="Amusement Park Address"
                />
              </div>
            </div>

            <div className="border-t border-themeBorder pt-6 space-y-6">
              <h4 className="text-xs font-bold text-themeTextSecondary uppercase tracking-wider">Multilingual Speech Scripts & Preview</h4>

              {/* Languages Script Editors */}
              {[
                { lang: 'en', label: 'English script (en)', color: 'border-blue-800/30' },
                { lang: 'hi', label: 'Hindi script (hi)', color: 'border-orange-800/30' },
                { lang: 'gu', label: 'Gujarati script (gu)', color: 'border-yellow-800/30' }
              ].map(script => (
                <div key={script.lang} className={`bg-themeCardHover p-4 rounded-2xl border border-themeBorder dark:${script.color} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-themeTextPrimary">{script.label}</span>
                    {/* Audio Preview controls */}
                    {parkConfig.audio_urls?.[script.lang] && (
                      <button
                        type="button"
                        onClick={() => togglePlayAudio(script.lang, parkConfig.audio_urls[script.lang])}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${playingAudio === script.lang
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                          }`}
                      >
                        {playingAudio === script.lang ? (
                          <>
                            <Pause className="w-3.5 h-3.5" /> Stop Preview
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" /> Play generated Audio
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={parkConfig.multilingual?.custom_texts?.[script.lang] || ''}
                    onChange={e => {
                      const updatedTexts = { ...parkConfig.multilingual?.custom_texts, [script.lang]: e.target.value };
                      setParkConfig({
                        ...parkConfig,
                        multilingual: { ...parkConfig.multilingual, custom_texts: updatedTexts }
                      });
                    }}
                    className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-4 py-2.5 text-xs text-themeInputText focus:outline-none focus:border-[#10b981]/50"
                    placeholder={`Enter script to read out in ${script.label.split(' ')[0]}...`}
                  />
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="bg-[#10b981] hover:bg-[#0ea271] disabled:opacity-40 text-black text-xs font-bold py-2.5 px-5 rounded-xl shadow-lg transition-all flex items-center gap-2"
              >
                {savingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving & Regenerating TTS...
                  </>
                ) : (
                  <>Save configurator & Build Voice Cache</>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ============================================================================== */}
      {/* 7. STAFF ACCOUNTS MANAGEMENT TAB */}
      {/* ============================================================================== */}
      {activeTab === 'staff' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Staff Form */}
          <div className="glass-card bg-themeCard p-5 rounded-2xl border border-themeBorder shadow-sm h-fit">
            <h3 className="text-sm font-bold text-themeTextPrimary uppercase tracking-wider mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#10b981]" /> Add New Staff account
            </h3>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-themeTextSecondary mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={staffForm.name}
                  onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-3 py-2 text-xs text-themeInputText focus:outline-none focus:border-[#10b981]/50"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-themeTextSecondary mb-1">Email address</label>
                <input
                  type="email"
                  required
                  value={staffForm.email}
                  onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-3 py-2 text-xs text-themeInputText focus:outline-none focus:border-[#10b981]/50"
                  placeholder="johndoe@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-themeTextSecondary mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={staffForm.password}
                  onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-3 py-2 text-xs text-themeInputText focus:outline-none focus:border-[#10b981]/50"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-themeTextSecondary mb-1">Designated Role</label>
                <select
                  value={staffForm.role}
                  onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="w-full bg-themeInputBg border border-themeInputBorder rounded-xl px-3 py-2 text-xs text-themeTextSecondary focus:outline-none"
                >
                  <option value="agent" className="bg-themeCard text-themeTextPrimary">Agent / Telecaller</option>
                  <option value="admin" className="bg-themeCard text-themeTextPrimary">Administrator</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creatingStaff}
                className="w-full bg-[#10b981] hover:bg-[#0ea271] text-black text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                {creatingStaff ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register staff account'}
              </button>
            </form>
          </div>

          {/* Staff Accounts List */}
          <div className="lg:col-span-2 glass-card bg-themeCard p-5 rounded-2xl border border-themeBorder shadow-sm">
            <h3 className="text-sm font-bold text-themeTextPrimary uppercase tracking-wider mb-5 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#10b981]" /> Registered Staff List
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-themeTableHeader text-themeTextSecondary font-bold border-b border-themeBorder uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-themeBorder/60">
                  {loading && staffList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-themeMuted">
                        <Loader2 className="w-5 h-5 animate-spin text-[#10b981] mx-auto" />
                      </td>
                    </tr>
                  ) : (
                    staffList.map(member => (
                      <tr key={member._id} className="hover:bg-themeTableRowHover odd:bg-themeTableRowAlt/30 transition-all">
                        <td className="px-4 py-3 font-bold text-themeTextPrimary">{member.name}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-themeTextSecondary">{member.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${member.role === 'admin' || member.role === 'owner'
                              ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            }`}>
                            {member.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${member.isSuspended
                              ? 'bg-rose-500/10 text-rose-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                            {member.isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {member.role !== 'owner' && (
                            <button
                              onClick={() => handleDeleteStaff(member._id)}
                              className="text-rose-400 hover:text-rose-300 transition-all"
                              title="Delete staff account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
