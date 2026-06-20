'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, Clock, Plus, Search, Trash2, Edit2, CheckCircle2,
  X, Loader2, ChevronLeft, ChevronRight, Filter, Eye, Phone, MessageSquare, Mail, ClipboardList, RefreshCw
} from 'lucide-react';
import api from '../../../lib/api';
import { useConfirmStore } from '../../../lib/store';

const TYPE_CONFIG = {
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' },
  call: { label: 'Phone Call', icon: Phone, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' },
  email: { label: 'Email', icon: Mail, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' },
  manual: { label: 'Manual Task', icon: ClipboardList, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800' },
};

export default function FollowUpsPage() {
  const confirm = useConfirmStore((state) => state.confirm);
  const [followUps, setFollowUps] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Stats / Metrics
  const [metrics, setMetrics] = useState({
    pending: 0,
    today: 0,
    overdue: 0,
    completed: 0
  });

  // Filters state
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'completed', 'all'
  const [typeFilter, setTypeFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' (calendar-grouped), 'list'

  // Modals state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeFollowUp, setActiveFollowUp] = useState(null);

  // Teams & Contacts cache for dropdowns
  const [teamMembers, setTeamMembers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [debouncedContactSearch, setDebouncedContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Schedule Form state
  const [form, setForm] = useState({
    contactId: '',
    assignedTo: '',
    title: '',
    description: '',
    followUpType: 'call',
    scheduledAt: ''
  });

  // Fetch follow-ups list
  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
        followUpType: typeFilter || undefined,
        assignedTo: assignedFilter || undefined,
        search: debouncedSearch || undefined,
        sort: statusFilter === 'completed' ? '-completedAt' : 'scheduledAt'
      };
      const { data } = await api.get('/follow-ups', { params });
      if (data.success) {
        setFollowUps(data.data.followUps);
        setTotal(data.data.total);
        setPages(data.data.pages);
      }
    } catch (err) {
      toast.error('Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  };

  // Fetch metrics/counters
  const fetchMetrics = async () => {
    try {
      // We can run queries by fetching metadata or filtering lists
      const [pendingRes, completedRes] = await Promise.all([
        api.get('/follow-ups', { params: { status: 'pending', limit: 1 } }),
        api.get('/follow-ups', { params: { status: 'completed', limit: 1 } })
      ]);

      const now = new Date();
      const todayStart = new Date(now.setHours(0,0,0,0)).toISOString();
      const todayEnd = new Date(now.setHours(23,59,59,999)).toISOString();

      const [todayRes, overdueRes] = await Promise.all([
        api.get('/follow-ups', { params: { status: 'pending', dateStart: todayStart, dateEnd: todayEnd, limit: 1 } }),
        api.get('/follow-ups', { params: { status: 'pending', dateEnd: new Date().toISOString(), limit: 1 } })
      ]);

      setMetrics({
        pending: pendingRes.data.data.total || 0,
        completed: completedRes.data.data.total || 0,
        today: todayRes.data.data.total || 0,
        overdue: overdueRes.data.data.total || 0
      });
    } catch (err) {
      console.error('Failed to fetch follow-up counts');
    }
  };

  // Fetch agents list
  const fetchTeam = async () => {
    try {
      const { data } = await api.get('/team');
      if (data.success) {
        setTeamMembers(data.data.team || []);
      }
    } catch (err) {
      console.error('Failed to load team members');
    }
  };

  // Fetch contacts for autocomplete picker
  const fetchContactsForForm = async () => {
    setLoadingContacts(true);
    try {
      const params = {
        limit: 20,
        search: debouncedContactSearch || undefined
      };
      const { data } = await api.get('/contacts', { params });
      if (data.success) {
        setContacts(data.data.contacts);
      }
    } catch (err) {
      console.error('Failed to fetch contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
    fetchMetrics();
  }, [page, statusFilter, typeFilter, assignedFilter, debouncedSearch]);

  useEffect(() => {
    fetchTeam();
  }, []);

  useEffect(() => {
    if (isScheduleModalOpen || isEditModalOpen) {
      fetchContactsForForm();
    }
  }, [isScheduleModalOpen, isEditModalOpen, debouncedContactSearch]);

  // Debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContactSearch(contactSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  // Create Follow-up
  const handleScheduleFollowUp = async (e) => {
    e.preventDefault();
    const { contactId, assignedTo, title, description, followUpType, scheduledAt } = form;
    if (!contactId || !assignedTo || !title || !followUpType || !scheduledAt) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/follow-ups', form);
      if (data.success) {
        toast.success('Follow-up scheduled successfully');
        setIsScheduleModalOpen(false);
        setForm({ contactId: '', assignedTo: '', title: '', description: '', followUpType: 'call', scheduledAt: '' });
        setContactSearch('');
        fetchFollowUps();
        fetchMetrics();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to schedule follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Follow-up
  const handleEditFollowUp = async (e) => {
    e.preventDefault();
    if (!activeFollowUp) return;

    setSubmitting(true);
    try {
      const { data } = await api.put(`/follow-ups/${activeFollowUp._id}`, {
        title: form.title,
        description: form.description,
        followUpType: form.followUpType,
        scheduledAt: form.scheduledAt,
        assignedTo: form.assignedTo
      });
      if (data.success) {
        toast.success('Follow-up updated successfully');
        setIsEditModalOpen(false);
        fetchFollowUps();
        fetchMetrics();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // Mark Completed
  const handleCompleteFollowUp = async (id) => {
    try {
      const { data } = await api.post(`/follow-ups/${id}/complete`);
      if (data.success) {
        toast.success('Follow-up completed');
        fetchFollowUps();
        fetchMetrics();
      }
    } catch (err) {
      toast.error('Failed to mark follow-up completed');
    }
  };

  // Cancel/Delete Follow-up
  const handleDeleteFollowUp = async (id) => {
    const confirmed = await confirm('Are you sure you want to delete/cancel this follow-up?', 'Delete Follow-up');
    if (!confirmed) return;

    try {
      const { data } = await api.delete(`/follow-ups/${id}`);
      if (data.success) {
        toast.success('Follow-up cancelled');
        fetchFollowUps();
        fetchMetrics();
      }
    } catch (err) {
      toast.error('Failed to cancel follow-up');
    }
  };

  // Helper: Grouping follow-ups for calendar grouped view
  const getGroupedFollowUps = () => {
    const todayStr = new Date().toDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toDateString();

    const groups = {
      overdue: [],
      today: [],
      tomorrow: [],
      upcoming: []
    };

    followUps.forEach(f => {
      if (f.status !== 'pending') {
        groups.upcoming.push(f);
        return;
      }
      const schedDate = new Date(f.scheduledAt);
      const schedDateStr = schedDate.toDateString();

      if (schedDate < new Date() && schedDateStr !== todayStr) {
        groups.overdue.push(f);
      } else if (schedDateStr === todayStr) {
        groups.today.push(f);
      } else if (schedDateStr === tomorrowStr) {
        groups.tomorrow.push(f);
      } else {
        groups.upcoming.push(f);
      }
    });

    return groups;
  };

  const grouped = getGroupedFollowUps();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Follow-Up Automations</h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Schedule reminders, automated WhatsApp follow-ups, email notifications, and tasks.
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ contactId: '', assignedTo: '', title: '', description: '', followUpType: 'call', scheduledAt: '' });
            setContactSearch('');
            setIsScheduleModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-white bg-wa-green hover:bg-wa-green-hover rounded-xl text-sm font-semibold shadow-md shadow-wa-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 self-start md:self-auto"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>Schedule Task</span>
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform">
          <div>
            <span className="text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60 tracking-wider">Pending Reminders</span>
            <h3 className="text-2xl font-black text-wa-text-primary dark:text-white mt-1 leading-none">{metrics.pending}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Clock className="w-5.5 h-5.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform">
          <div>
            <span className="text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60 tracking-wider">Scheduled Today</span>
            <h3 className="text-2xl font-black text-wa-green mt-1 leading-none">{metrics.today}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-wa-green/10 text-wa-green flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5.5 h-5.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform">
          <div>
            <span className="text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60 tracking-wider">Overdue Reminders</span>
            <h3 className={`text-2xl font-black mt-1 leading-none ${metrics.overdue > 0 ? 'text-red-500' : 'text-wa-text-primary dark:text-white'}`}>{metrics.overdue}</h3>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${metrics.overdue > 0 ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-slate-500/10 text-slate-500'}`}>
            <Clock className="w-5.5 h-5.5" />
          </div>
        </div>

        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:scale-[1.01] transition-transform">
          <div>
            <span className="text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60 tracking-wider">Completed Tasks</span>
            <h3 className="text-2xl font-black text-emerald-500 mt-1 leading-none">{metrics.completed}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5.5 h-5.5" />
          </div>
        </div>
      </div>

      {/* Tabs and Filters Bar */}
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex items-center gap-1 bg-wa-panel-header dark:bg-wa-dark-panel-header p-1 rounded-xl w-full lg:w-auto overflow-x-auto shrink-0">
          <button
            onClick={() => { setStatusFilter('pending'); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => { setStatusFilter('completed'); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => { setStatusFilter('all'); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover'
            }`}
          >
            All Tasks
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 lg:w-48">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-wa-text-secondary" />
            <input
              type="text"
              placeholder="Search title/desc..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="call">Call Reminders</option>
            <option value="email">Email Reminders</option>
            <option value="manual">Manual Tasks</option>
          </select>

          {/* Assigned Filter */}
          <select
            value={assignedFilter}
            onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary focus:outline-none"
          >
            <option value="">All Agents</option>
            {teamMembers.map(t => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-wa-bg dark:bg-wa-dark-header rounded-xl p-0.5 border border-wa-border dark:border-wa-dark-border">
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1 px-2.5 rounded-lg text-[10px] font-bold ${viewMode === 'grouped' ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow' : 'text-wa-text-secondary hover:text-wa-text-primary'}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 px-2.5 rounded-lg text-[10px] font-bold ${viewMode === 'list' ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow' : 'text-wa-text-secondary hover:text-wa-text-primary'}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Render */}
      {loading ? (
        <div className="py-24 text-center text-wa-text-secondary flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
          <span className="font-semibold text-sm">Loading follow-ups...</span>
        </div>
      ) : followUps.length === 0 ? (
        <div className="py-24 text-center text-wa-text-secondary border border-dashed border-wa-border dark:border-wa-dark-border rounded-2xl bg-white dark:bg-wa-dark-panel">
          <CalendarIcon className="w-12 h-12 mx-auto text-wa-green/45 mb-4" />
          <p className="text-sm font-bold text-wa-text-primary dark:text-white">No tasks found</p>
          <p className="text-xs text-wa-text-secondary mt-1">Schedule phone calls or WhatsApp auto-reminders for your leads.</p>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-wa-border dark:border-wa-dark-border text-wa-text-secondary uppercase tracking-wider bg-wa-bg dark:bg-wa-dark-header/40 font-bold">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Scheduled Time</th>
                  <th className="px-6 py-4">Task Type</th>
                  <th className="px-6 py-4">Assigned Telecaller</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border text-sm">
                {followUps.map(f => {
                  const typeStyles = TYPE_CONFIG[f.followUpType] || TYPE_CONFIG.manual;
                  const TypeIcon = typeStyles.icon;
                  const formattedTime = new Date(f.scheduledAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  
                  // Decrypt name if needed
                  const clientName = f.contactId?.name || 'Unnamed Contact';
                  const clientPhone = f.contactId?.phone || '';

                  return (
                    <tr key={f._id} className="hover:bg-wa-hover/30 dark:hover:bg-wa-dark-hover/10 transition-colors">
                      <td className="px-6 py-4">
                        {f.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg font-semibold text-xs border border-emerald-100 dark:border-emerald-900">
                            Completed
                          </span>
                        ) : f.status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/20 text-red-500 px-2 py-0.5 rounded-lg font-semibold text-xs border border-red-100 dark:border-red-950">
                            Cancelled
                          </span>
                        ) : new Date(f.scheduledAt) < new Date() ? (
                          <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded-lg font-semibold text-xs border border-red-200 dark:border-red-900 animate-pulse">
                            Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/20 text-blue-500 px-2 py-0.5 rounded-lg font-semibold text-xs border border-blue-100 dark:border-blue-900">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-bold text-wa-text-primary dark:text-white block">{f.title}</span>
                          <span className="text-[10px] text-wa-text-secondary block truncate max-w-xs">{f.description || 'No description'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <span className="font-semibold text-wa-text-primary dark:text-white block">{clientName}</span>
                          <span className="font-mono text-[10px] text-wa-text-secondary">{clientPhone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-wa-text-primary">
                        {formattedTime}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-xs font-semibold ${typeStyles.color}`}>
                          <TypeIcon className="w-3.5 h-3.5" />
                          <span>{typeStyles.label}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-wa-green/10 text-wa-green flex items-center justify-center font-bold text-[10px]">
                            {f.assignedTo?.name?.[0]?.toUpperCase() || 'A'}
                          </div>
                          <span className="text-xs font-medium text-wa-text-primary dark:text-white">{f.assignedTo?.name || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {f.status === 'pending' && (
                            <button
                              onClick={() => handleCompleteFollowUp(f._id)}
                              className="p-2 text-wa-green hover:bg-wa-green/10 rounded-xl transition-all"
                              title="Mark Completed"
                            >
                              <CheckCircle2 className="w-4.5 h-4.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActiveFollowUp(f);
                              setForm({
                                contactId: f.contactId?._id || '',
                                assignedTo: f.assignedTo?._id || '',
                                title: f.title,
                                description: f.description || '',
                                followUpType: f.followUpType,
                                scheduledAt: new Date(f.scheduledAt).toISOString().slice(0, 16)
                              });
                              setIsEditModalOpen(true);
                            }}
                            className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFollowUp(f._id)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CALENDAR GROUPED VIEW */
        <div className="space-y-8">
          {Object.entries(grouped).map(([key, list]) => {
            if (list.length === 0) return null;
            const headerTitles = {
              overdue: 'Overdue Reminders ⚠️',
              today: "Today's Schedule 📅",
              tomorrow: 'Scheduled Tomorrow ⏰',
              upcoming: 'Upcoming & Completed Tasks ⚡'
            };
            const cardBgs = {
              overdue: 'border-red-200 dark:border-red-950/40 bg-red-50/10 dark:bg-red-950/5',
              today: 'border-emerald-200 dark:border-emerald-950/40 bg-emerald-50/10 dark:bg-emerald-950/5',
              tomorrow: 'border-blue-200 dark:border-blue-950/40 bg-blue-50/10',
              upcoming: 'border-wa-border dark:border-wa-dark-border'
            };

            return (
              <div key={key} className="space-y-4">
                <h3 className="text-sm font-bold text-wa-text-primary dark:text-white uppercase tracking-wider px-2">
                  {headerTitles[key]} ({list.length})
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {list.map(f => {
                    const typeStyles = TYPE_CONFIG[f.followUpType] || TYPE_CONFIG.manual;
                    const TypeIcon = typeStyles.icon;
                    const formattedTime = new Date(f.scheduledAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    
                    const clientName = f.contactId?.name || 'Unnamed';
                    const clientPhone = f.contactId?.phone || '';

                    return (
                      <div 
                        key={f._id} 
                        className={`border rounded-2xl p-5 hover:shadow-md transition-all flex flex-col justify-between ${cardBgs[key] || 'bg-white dark:bg-wa-dark-panel'}`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${typeStyles.color}`}>
                              <TypeIcon className="w-3.5 h-3.5" />
                              <span>{typeStyles.label}</span>
                            </span>
                            <span className="text-[10px] font-mono text-wa-text-secondary flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formattedTime}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-bold text-sm text-wa-text-primary dark:text-white leading-snug">{f.title}</h4>
                            <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1 line-clamp-2 leading-relaxed">
                              {f.description || <span className="italic opacity-55">No details provided</span>}
                            </p>
                          </div>

                          <div className="p-2.5 bg-wa-bg dark:bg-wa-dark-header/40 rounded-xl border border-wa-border/50 dark:border-wa-dark-border/20 text-xs">
                            <span className="text-[9px] uppercase font-bold text-wa-text-secondary block">Client context</span>
                            <span className="font-semibold text-wa-text-primary dark:text-white mt-0.5 block">{clientName}</span>
                            <span className="font-mono text-[10px] text-wa-text-secondary block mt-0.5">{clientPhone}</span>
                          </div>
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-wa-border/50 dark:border-wa-dark-border/40 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5 text-xs text-wa-text-secondary">
                            <div className="w-5 h-5 rounded-full bg-wa-green/10 text-wa-green flex items-center justify-center font-bold text-[9px]">
                              {f.assignedTo?.name?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <span className="truncate max-w-[80px] font-medium">{f.assignedTo?.name || 'Agent'}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {f.status === 'pending' && (
                              <button
                                onClick={() => handleCompleteFollowUp(f._id)}
                                className="p-1.5 text-wa-green hover:bg-wa-green/10 rounded-lg transition-all"
                                title="Complete"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setActiveFollowUp(f);
                                setForm({
                                  contactId: f.contactId?._id || '',
                                  assignedTo: f.assignedTo?._id || '',
                                  title: f.title,
                                  description: f.description || '',
                                  followUpType: f.followUpType,
                                  scheduledAt: new Date(f.scheduledAt).toISOString().slice(0, 16)
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFollowUp(f._id)}
                              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination (List view only) */}
      {viewMode === 'list' && pages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border border-wa-border dark:border-wa-dark-border rounded-2xl bg-white dark:bg-wa-dark-panel">
          <span className="text-xs text-wa-text-secondary">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} tasks
          </span>
          <div className="flex items-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-white dark:bg-wa-dark-panel hover:bg-wa-bg disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4.5 h-4.5 text-wa-text-primary" />
            </button>
            <span className="text-xs font-bold dark:text-white">Page {page} of {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-white dark:bg-wa-dark-panel hover:bg-wa-bg disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4.5 h-4.5 text-wa-text-primary" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: SCHEDULE FOLLOW-UP */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header shrink-0">
              <h3 className="font-bold text-wa-text-primary dark:text-white text-base">Schedule Follow-Up Task</h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleScheduleFollowUp} className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Select Customer */}
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Select Client *</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Search client by name or phone..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="input-field py-1.5 text-xs flex-1"
                  />
                </div>
                
                <select
                  required
                  value={form.contactId}
                  onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                  className="input-field py-2 text-xs"
                >
                  <option value="">-- Choose matching client --</option>
                  {contacts.map(c => (
                    <option key={c._id} value={c._id}>{c.name || 'Unnamed'} ({c.phone})</option>
                  ))}
                  {contacts.length === 0 && (
                    <option value="" disabled>No matches found. Search above.</option>
                  )}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call to discuss pricing proposal"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Description / Notes</label>
                <textarea
                  placeholder="Enter details or message copy for WABA automations..."
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              {/* Type & Date Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Task Type *</label>
                  <select
                    value={form.followUpType}
                    onChange={(e) => setForm({ ...form, followUpType: e.target.value })}
                    className="input-field py-2 text-xs"
                  >
                    <option value="call">Phone Call</option>
                    <option value="whatsapp">Auto-WhatsApp</option>
                    <option value="email">Auto-Email</option>
                    <option value="manual">Manual Task</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Scheduled Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    className="input-field py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Assign agent */}
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Assign Telecaller/Agent *</label>
                <select
                  required
                  value={form.assignedTo}
                  onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                  className="input-field py-2 text-xs"
                >
                  <option value="">-- Choose agent --</option>
                  {teamMembers.map(t => (
                    <option key={t._id} value={t._id}>{t.name} ({t.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button 
                  type="button" 
                  onClick={() => setIsScheduleModalOpen(false)} 
                  className="btn-secondary py-2 text-xs px-4"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Schedule Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT FOLLOW-UP */}
      {isEditModalOpen && activeFollowUp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header shrink-0">
              <h3 className="font-bold text-wa-text-primary dark:text-white text-base">Edit Follow-Up Task</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleEditFollowUp} className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Customer view-only */}
              <div className="p-3 bg-wa-bg dark:bg-wa-dark-header/40 rounded-xl border border-wa-border/50 text-xs">
                <span className="text-[10px] uppercase font-bold text-wa-text-secondary">Client context</span>
                <p className="font-bold text-wa-text-primary dark:text-white mt-1">
                  {activeFollowUp.contactId?.name || 'Unnamed'} ({activeFollowUp.contactId?.phone})
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call to discuss pricing proposal"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Description / Notes</label>
                <textarea
                  placeholder="Enter details or message copy for WABA automations..."
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              {/* Type & Date Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Task Type *</label>
                  <select
                    value={form.followUpType}
                    onChange={(e) => setForm({ ...form, followUpType: e.target.value })}
                    className="input-field py-2 text-xs"
                  >
                    <option value="call">Phone Call</option>
                    <option value="whatsapp">Auto-WhatsApp</option>
                    <option value="email">Auto-Email</option>
                    <option value="manual">Manual Task</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Scheduled Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    className="input-field py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Assign agent */}
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Assign Telecaller/Agent *</label>
                <select
                  required
                  value={form.assignedTo}
                  onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                  className="input-field py-2 text-xs"
                >
                  <option value="">-- Choose agent --</option>
                  {teamMembers.map(t => (
                    <option key={t._id} value={t._id}>{t.name} ({t.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="btn-secondary py-2 text-xs px-4"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
