'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../../lib/api';
import { toast } from 'react-hot-toast';
import { 
  Search, Users, RefreshCw, MessageSquare, Eye, Sparkles, Filter, 
  MapPin, DollarSign, Calendar, Briefcase, ChevronLeft, ChevronRight, 
  Bookmark, ArrowRight, Edit2, Trash2, X, Loader2, Save,
  ChevronDown, Award, FileText, CreditCard, XCircle, CheckCircle2, UserCheck, Check,
  List, LayoutGrid, GripVertical, Receipt, BarChart3
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import LeadAnalyticsView from '../../../components/LeadAnalyticsView';
import LeadLostReasonModal from '../../../components/LeadLostReasonModal';
import LeadWonReasonModal from '../../../components/LeadWonReasonModal';

const LeadDetailsModal = dynamic(() => import('../../../components/LeadDetailsModal'), {
  ssr: false,
});
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useConfirmStore } from '../../../lib/store';
import { getFastCache, setFastCache } from '../../../lib/usePageData';
import Portal from '../../../components/Portal';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New Lead', emoji: '🟡' },
  { value: 'qualified', label: 'Qualified', emoji: '🟢' },
  { value: 'proposal_sent', label: 'Proposal Sent', emoji: '🔵' },
  { value: 'invoice_generated', label: 'Invoice Generated', emoji: '🔷' },
  { value: 'payment_due', label: 'Payment Due', emoji: '🟠' },
  { value: 'won', label: 'Lead Won', emoji: '🏆' },
  { value: 'lost', label: 'Lead Lost', emoji: '❌' },
  { value: 'closed', label: 'Closed / Won', emoji: '🟣' },
];

const KANBAN_COLUMNS = [
  {
    key: 'new',
    label: 'New Lead',
    emoji: '🟡',
    color: 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10',
    headerBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    desc: 'Newly captured inquiries'
  },
  {
    key: 'qualified',
    label: 'Qualified',
    emoji: '🟢',
    color: 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10',
    headerBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    desc: 'Requirements & budget fit'
  },
  {
    key: 'proposal_sent',
    label: 'Proposal Sent',
    emoji: '🔵',
    color: 'border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10',
    headerBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    desc: 'Quotation sent, reviewing'
  },
  {
    key: 'invoice_generated',
    label: 'Invoice Generated',
    emoji: '🔷',
    color: 'border-cyan-500/30 bg-cyan-500/5 dark:bg-cyan-500/10',
    headerBg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
    desc: 'Bill raised, awaiting pay'
  },
  {
    key: 'payment_due',
    label: 'Payment Due',
    emoji: '🟠',
    color: 'border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10',
    headerBg: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
    desc: 'Follow-up for payment'
  },
  {
    key: 'won',
    label: 'Lead Won',
    emoji: '🏆',
    color: 'border-emerald-600/30 bg-emerald-600/5 dark:bg-emerald-600/10',
    headerBg: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30',
    badge: 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-bold',
    desc: 'Deal closed & converted'
  },
  {
    key: 'lost',
    label: 'Lead Lost',
    emoji: '❌',
    color: 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10',
    headerBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
    desc: 'Not interested / dropped'
  },
];

export default function LeadsPage() {
  const confirm = useConfirmStore((state) => state.confirm);

  const cachedLeads = getFastCache('leads_all_cache', null);
  const [allLeads, setAllLeads] = useState(cachedLeads?.leads || []);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(!cachedLeads?.leads?.length);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  // View mode: 'list' (Table) vs 'kanban' (Drag and Drop Board)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('leads_view_mode') || 'list';
    }
    return 'list';
  });

  // Drag and drop states for Kanban
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Active inline popover dropdown: { id: string, type: 'status' | 'assign' } | null
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Lost Reason Modal State: { leadId: string, leadName: string } | null
  const [lostReasonTarget, setLostReasonTarget] = useState(null);
  // Won Reason Modal State: { leadId: string, leadName: string, targetStatus: string } | null
  const [wonReasonTarget, setWonReasonTarget] = useState(null);

  // Modal states
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [savingLead, setSavingLead] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'new',
    lossReason: 'Price / Budget Issue',
    customLossReason: '',
    winReason: 'Competitive Pricing & Value',
    customWinReason: '',
    assignedAgent: 'unassigned',
    serviceRequired: '',
    budget: '',
    timeline: '',
    city: '',
    specialRequirements: '',
    notes: ''
  });

  const handleToggleView = (mode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('leads_view_mode', mode);
    }
  };

  // Listen for clicks outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-dropdown-container]')) {
        setActiveDropdown(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveDropdown(null);
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const { data } = await api.get('/leads/agents');
      if (data.success) {
        setAgents(data.data.agents || []);
      }
    } catch (_) {}
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads', { params: { all: 'true', limit: 1000 } });
      if (data.success) {
        const fetchedLeads = data.data.leads || [];
        setAllLeads(fetchedLeads);
        setFastCache('leads_all_cache', {
          leads: fetchedLeads,
          total: fetchedLeads.length
        });
      }
    } catch (err) {
      toast.error('Failed to load leads data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchAgents();
  }, [fetchLeads, fetchAgents]);

  // Inline Quick Assign Handler
  const handleAssignAgent = async (leadId, agentId) => {
    const selectedAgent = agents.find((a) => a._id === agentId);
    const previousLeads = [...allLeads];

    // Optimistic UI Update
    setAllLeads((prev) =>
      prev.map((lead) => {
        if (lead._id === leadId) {
          return {
            ...lead,
            assignedAgent: agentId && agentId !== 'unassigned' ? selectedAgent || { _id: agentId, name: 'Assigned Agent' } : null
          };
        }
        return lead;
      })
    );

    try {
      const { data } = await api.put(`/leads/${leadId}`, {
        assignedAgent: agentId === 'unassigned' ? '' : agentId
      });
      if (data.success) {
        const agentName = selectedAgent?.name || (agentId === 'unassigned' ? 'Unassigned' : 'Assigned Member');
        toast.success(`Assigned to ${agentName}`);
        setFastCache('leads_all_cache', {
          leads: allLeads.map((l) => (l._id === leadId ? data.data.lead : l)),
          total: allLeads.length
        });
      } else {
        setAllLeads(previousLeads);
        toast.error('Failed to update assignment');
      }
    } catch (err) {
      setAllLeads(previousLeads);
      toast.error(err.response?.data?.error || 'Failed to update lead assignment');
    }
  };

  // Inline Quick Status Handler (Intercepts 'lost' & 'won' to ask for reason)
  const handleUpdateStatus = async (leadId, newStatus) => {
    if (newStatus === 'lost') {
      const lead = allLeads.find((l) => l._id === leadId);
      setLostReasonTarget({ leadId, leadName: lead?.name || 'Inquiry' });
      return;
    }
    if (newStatus === 'won' || newStatus === 'closed') {
      const lead = allLeads.find((l) => l._id === leadId);
      setWonReasonTarget({ leadId, leadName: lead?.name || 'Inquiry', targetStatus: newStatus });
      return;
    }
    await executeStatusUpdate(leadId, newStatus);
  };

  const executeStatusUpdate = async (leadId, newStatus, lossReason = '', additionalNotes = '', winReason = '') => {
    const previousLeads = [...allLeads];
    const currentLead = allLeads.find((l) => l._id === leadId);

    // Optimistic UI Update
    setAllLeads((prev) =>
      prev.map((lead) => {
        if (lead._id === leadId) {
          return {
            ...lead,
            status: newStatus,
            lossReason: lossReason || lead.lossReason,
            winReason: winReason || lead.winReason,
            customFields: {
              ...(lead.customFields || {}),
              status: newStatus,
              ...(lossReason ? { lossReason, dropReason: lossReason } : {}),
              ...(winReason ? { winReason, wonReason: winReason } : {})
            },
            notes: additionalNotes ? (lead.notes ? `${lead.notes} | ${additionalNotes}` : additionalNotes) : lead.notes
          };
        }
        return lead;
      })
    );

    try {
      const payload = { status: newStatus };
      if (lossReason) payload.lossReason = lossReason;
      if (winReason) payload.winReason = winReason;
      if (additionalNotes) {
        payload.notes = currentLead?.notes ? `${currentLead.notes} | ${additionalNotes}` : additionalNotes;
      }

      const { data } = await api.put(`/leads/${leadId}`, payload);
      if (data.success) {
        toast.success(`Moved to ${getStatusLabel(newStatus)}`);
        setFastCache('leads_all_cache', {
          leads: allLeads.map((l) => (l._id === leadId ? data.data.lead : l)),
          total: allLeads.length
        });
      } else {
        setAllLeads(previousLeads);
        toast.error('Failed to update status');
      }
    } catch (err) {
      setAllLeads(previousLeads);
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  // Kanban Drag & Drop Drop Handler
  const handleDropLead = async (targetStatus) => {
    if (!draggedLeadId) return;
    const lead = allLeads.find((l) => l._id === draggedLeadId);
    if (!lead) return;
    
    const currentStatus = lead.status || 'new';
    if (currentStatus === targetStatus || (targetStatus === 'won' && currentStatus === 'closed')) {
      setDraggedLeadId(null);
      setDragOverCol(null);
      return;
    }

    if (targetStatus === 'lost') {
      const lId = draggedLeadId;
      setDraggedLeadId(null);
      setDragOverCol(null);
      setLostReasonTarget({ leadId: lId, leadName: lead.name || 'Inquiry' });
      return;
    }

    if (targetStatus === 'won' || targetStatus === 'closed') {
      const lId = draggedLeadId;
      setDraggedLeadId(null);
      setDragOverCol(null);
      setWonReasonTarget({ leadId: lId, leadName: lead.name || 'Inquiry', targetStatus });
      return;
    }

    await executeStatusUpdate(draggedLeadId, targetStatus);
    setDraggedLeadId(null);
    setDragOverCol(null);
  };

  // Status Counts for Pill Filters
  const counts = useMemo(() => {
    return {
      all: allLeads.length,
      new: allLeads.filter((l) => !l.status || l.status === 'new').length,
      qualified: allLeads.filter((l) => l.status === 'qualified').length,
      proposal_sent: allLeads.filter((l) => l.status === 'proposal_sent').length,
      invoice_generated: allLeads.filter((l) => l.status === 'invoice_generated').length,
      payment_due: allLeads.filter((l) => l.status === 'payment_due').length,
      won: allLeads.filter((l) => l.status === 'won' || l.status === 'closed').length,
      lost: allLeads.filter((l) => l.status === 'lost').length,
    };
  }, [allLeads]);

  // Instant Live Filtering on EVERY Keystroke across ALL fields + Status Pill Filter
  const filteredLeads = useMemo(() => {
    let result = allLeads;

    // 1. Status Filter (active in table view or if user filters)
    if (statusFilter !== 'ALL') {
      result = result.filter((l) => {
        if (statusFilter === 'won') {
          return l.status === 'won' || l.status === 'closed';
        }
        return (l.status || 'new') === statusFilter;
      });
    }

    // 2. Search Text
    if (!search || !search.trim()) return result;
    const cleanSearch = search.trim().toLowerCase();
    const tokens = cleanSearch.split(/\s+/).filter(Boolean);
    const digitsOnly = cleanSearch.replace(/\D/g, '');

    return result.filter((lead) => {
      const nameStr = (lead.name || '').toLowerCase();
      const phoneStr = (lead.phone || '').toString();
      const phoneClean = phoneStr.replace(/\D/g, '');
      const emailStr = (lead.email || '').toLowerCase();
      const serviceStr = (lead.serviceRequired || '').toLowerCase();
      const descStr = (lead.projectDescription || '').toLowerCase();
      const budgetStr = (lead.budget || '').toString().toLowerCase();
      const timelineStr = (lead.timeline || '').toString().toLowerCase();
      const statusStr = (lead.status || '').toLowerCase();
      const segmentStr = (lead.segment || '').toLowerCase();
      const cityStr = (lead.customFields?.city || '').toLowerCase();
      const notesStr = (lead.notes || '').toLowerCase();
      const agentName = (lead.assignedAgent?.name || lead.assignedAgent?.email || '').toLowerCase();
      const idStr = (lead._id || '').toString().toLowerCase();

      // 1. Partial ID match
      if (idStr.includes(cleanSearch)) return true;

      // 2. Partial phone match if user enters numbers
      if (digitsOnly && digitsOnly.length >= 2 && phoneClean.includes(digitsOnly)) {
        return true;
      }

      // 3. Partial substring search across all fields (tokens match)
      const fullBlob = `${nameStr} ${phoneStr} ${emailStr} ${serviceStr} ${descStr} ${budgetStr} ${timelineStr} ${statusStr} ${segmentStr} ${cityStr} ${notesStr} ${agentName}`;
      if (tokens.every((tok) => fullBlob.includes(tok))) {
        return true;
      }

      // 4. Custom fields partial match
      if (lead.customFields && typeof lead.customFields === 'object') {
        const fieldsObj = lead.customFields instanceof Map ? Object.fromEntries(lead.customFields) : lead.customFields;
        for (const val of Object.values(fieldsObj)) {
          if (val && typeof val === 'string' && val.toLowerCase().includes(cleanSearch)) {
            return true;
          }
        }
      }

      return false;
    });
  }, [allLeads, search, statusFilter]);

  const total = filteredLeads.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const paginatedLeads = filteredLeads.slice((page - 1) * limit, page * limit);

  const handleOpenLead = (leadId) => {
    setSelectedLeadId(leadId);
    setIsDetailsOpen(true);
  };

  const handleOpenEdit = (lead) => {
    setEditingLead(lead);
    setEditForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      status: lead.status || 'new',
      lossReason: lead.lossReason || lead.customFields?.lossReason || 'Price / Budget Issue',
      customLossReason: '',
      winReason: lead.winReason || lead.customFields?.winReason || lead.customFields?.wonReason || 'Competitive Pricing & Value',
      customWinReason: '',
      assignedAgent: lead.assignedAgent?._id || (typeof lead.assignedAgent === 'string' ? lead.assignedAgent : 'unassigned'),
      serviceRequired: lead.serviceRequired || '',
      budget: lead.budget || '',
      timeline: lead.timeline || '',
      city: lead.customFields?.city || '',
      specialRequirements: lead.specialRequirements || '',
      notes: lead.notes || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingLead(true);
    try {
      const finalLossReason = editForm.status === 'lost' 
        ? (editForm.lossReason === 'Custom Reason' ? (editForm.customLossReason || 'Other / Unspecified') : (editForm.customLossReason || editForm.lossReason))
        : '';
      const finalWinReason = (editForm.status === 'won' || editForm.status === 'closed')
        ? (editForm.winReason === 'Custom Reason' ? (editForm.customWinReason || 'General Deal Win') : (editForm.customWinReason || editForm.winReason))
        : '';

      const payload = {
        ...editForm,
        assignedAgent: editForm.assignedAgent === 'unassigned' ? '' : editForm.assignedAgent,
        ...(editForm.status === 'lost' ? { lossReason: finalLossReason } : {}),
        ...((editForm.status === 'won' || editForm.status === 'closed') ? { winReason: finalWinReason } : {})
      };
      const { data } = await api.put(`/leads/${editingLead._id}`, payload);
      if (data.success) {
        toast.success('Lead updated successfully in the database.');
        setEditingLead(null);
        fetchLeads();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update lead');
    } finally {
      setSavingLead(false);
    }
  };

  const handleDeleteLead = async (leadId, leadName) => {
    const confirmed = await confirm(
      `Are you sure you want to permanently delete lead "${leadName || 'Anonymous User'}"? This will permanently delete the customer record, active conversations, and all chat message history from the database.`,
      'Delete Lead'
    );
    if (!confirmed) return;

    try {
      const { data } = await api.delete(`/leads/${leadId}`);
      if (data.success) {
        toast.success('Lead and chat history permanently deleted.');
        fetchLeads();
      }
    } catch (err) {
      toast.error('Failed to delete lead from database');
    }
  };

  const getStatusLabel = (s) => {
    switch (s) {
      case 'qualified': return 'Qualified';
      case 'proposal_sent': return 'Proposal Sent';
      case 'invoice_generated': return 'Invoice Generated';
      case 'payment_due': return 'Payment Due';
      case 'won': return 'Lead Won';
      case 'lost': return 'Lead Lost';
      case 'closed': return 'Closed / Won';
      default: return 'New Lead';
    }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'qualified': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25';
      case 'proposal_sent': return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/25';
      case 'invoice_generated': return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25';
      case 'payment_due': return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25';
      case 'won': case 'closed': return 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30 font-bold';
      case 'lost': return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/25';
      default: return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25';
    }
  };

  const getSegmentColor = (seg) => {
    switch (seg) {
      case 'hot': return 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20 font-bold';
      case 'warm': return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20';
      default: return 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/20';
    }
  };

  const getRelativeTime = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
    } catch (_) {
      return 'Recent';
    }
  };

  // Metrics Counters
  const totalCount = allLeads.length;
  const wonCount = counts.won;
  const financeCount = counts.invoice_generated + counts.payment_due;
  const activeLeadsCount = counts.qualified + counts.proposal_sent;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header section with View Toggle (Table vs Kanban) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-wa-green animate-pulse" /> Customer Inquiries & Lead Pipeline
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Real-time inquiries captured from active Bot flows, qualifications, drag & drop pipeline, and billing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Table vs Kanban vs Lead Analytics View Mode Toggle */}
          <div className="flex items-center p-1 bg-wa-panel-header dark:bg-wa-dark-panel-header border border-wa-border dark:border-wa-dark-border rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => handleToggleView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-xs'
                  : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-xs'
                  : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
              }`}
              title="Kanban Drag & Drop Board"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleView('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                viewMode === 'analytics'
                  ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-xs'
                  : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
              }`}
              title="Lead Analytics & Agent Performance"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Lead Analytics</span>
            </button>
          </div>

          <button 
            onClick={() => {
              fetchLeads();
              fetchAgents();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-wa-panel-header dark:bg-wa-dark-panel-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs font-semibold text-wa-text-primary dark:text-white hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all duration-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* VIEW 3: INLINE LEAD ANALYTICS VIEW */}
      {viewMode === 'analytics' ? (
        <LeadAnalyticsView 
          allLeads={allLeads} 
          agents={agents} 
          onBackToLeads={() => handleToggleView('list')} 
        />
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-wa-green/10 text-wa-green rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">Total Leads</span>
            <span className="text-2xl font-black text-wa-text-primary dark:text-white">{totalCount}</span>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 text-wa-green pointer-events-none">
            <Users className="w-32 h-32 -mr-8 -mb-8" />
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Award className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">Leads Won / Closed</span>
            <span className="text-2xl font-black text-emerald-600">{wonCount}</span>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 text-emerald-500 pointer-events-none">
            <Award className="w-32 h-32 -mr-8 -mb-8" />
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-cyan-500/10 text-cyan-600 rounded-xl">
            <CreditCard className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">Invoice / Payment Due</span>
            <span className="text-2xl font-black text-cyan-600">{financeCount}</span>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 text-cyan-500 pointer-events-none">
            <CreditCard className="w-32 h-32 -mr-8 -mb-8" />
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <MessageSquare className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">In Negotiation</span>
            <span className="text-2xl font-black text-blue-500">{activeLeadsCount}</span>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 text-blue-500 pointer-events-none">
            <MessageSquare className="w-32 h-32 -mr-8 -mb-8" />
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="glass-card overflow-hidden flex flex-col">
        {/* Table Filters & Search */}
        <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex flex-col gap-3.5 bg-wa-panel-header dark:bg-wa-dark-panel-header/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-text-secondary" />
              <input
                type="text"
                placeholder="Live search by name, phone, agent, city, status..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input-field pl-10 pr-9 py-2 text-xs"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white p-0.5 rounded transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-wa-text-secondary">
              <Filter className="w-3.5 h-3.5" />
              <span>
                {search.trim() || statusFilter !== 'ALL'
                  ? `Showing ${total} of ${allLeads.length} leads`
                  : `Showing ${viewMode === 'list' ? paginatedLeads.length : allLeads.length} of ${allLeads.length} leads`}
              </span>
            </div>
          </div>

          {/* Status Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            <span className="text-[10px] font-bold uppercase text-wa-text-secondary mr-1 shrink-0">Status:</span>
            {[
              { id: 'ALL', label: 'All', count: counts.all },
              { id: 'new', label: 'New', count: counts.new },
              { id: 'qualified', label: 'Qualified', count: counts.qualified },
              { id: 'proposal_sent', label: 'Proposal Sent', count: counts.proposal_sent },
              { id: 'invoice_generated', label: 'Invoice Generated', count: counts.invoice_generated },
              { id: 'payment_due', label: 'Payment Due', count: counts.payment_due },
              { id: 'won', label: 'Lead Won', count: counts.won },
              { id: 'lost', label: 'Lead Lost', count: counts.lost },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
                    active
                      ? 'bg-wa-green text-white border-wa-green shadow-sm shadow-wa-green/20'
                      : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:border-wa-green/40'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-wa-bg dark:bg-wa-dark-header text-wa-text-secondary'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* VIEW 1: TABLE VIEW */}
        {viewMode === 'list' && (
          <>
            <div className="overflow-x-auto min-h-[380px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-wa-border dark:border-wa-dark-border bg-wa-panel-header dark:bg-wa-dark-panel-header/35 text-[10px] uppercase tracking-wider font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary">
                    <th className="px-6 py-4">Lead / Customer</th>
                    <th className="px-6 py-4">Inquiry Summary</th>
                    <th className="px-6 py-4">Budget & Timeline</th>
                    <th className="px-6 py-4">Assigned To</th>
                    <th className="px-6 py-4">Lead Status</th>
                    <th className="px-6 py-4">Last Activity</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/40 text-xs">
                  {paginatedLeads.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-wa-text-secondary">
                        {loading ? (
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-wa-green" />
                            <span>Loading leads...</span>
                          </div>
                        ) : search.trim() || statusFilter !== 'ALL' ? (
                          <div className="space-y-2 py-4 max-w-sm mx-auto">
                            <p className="text-sm font-semibold text-wa-text-primary dark:text-white">
                              No leads matching current filters
                            </p>
                            <p className="text-xs text-wa-text-secondary">
                              Try adjusting your search terms or status filter.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setSearch('');
                                setStatusFilter('ALL');
                                setPage(1);
                              }}
                              className="mt-2 px-3 py-1.5 bg-wa-green/10 text-wa-green hover:bg-wa-green hover:text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                              Clear Filters
                            </button>
                          </div>
                        ) : (
                          <span>No bot flow leads found. Ensure bot flows are active and customers are interacting.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedLeads.map((lead, index) => {
                      const assignedAgentObj = lead.assignedAgent && typeof lead.assignedAgent === 'object' ? lead.assignedAgent : null;
                      const isNearBottom = index >= paginatedLeads.length - 2 && paginatedLeads.length > 3;

                      return (
                        <tr key={lead._id} className="hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/10 transition-colors">
                          {/* Customer / Name */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-wa-green/10 text-wa-green font-bold flex items-center justify-center shadow-inner">
                                {lead.name ? lead.name.substring(0, 2).toUpperCase() : 'LD'}
                              </div>
                              <div>
                                <span 
                                  className="font-bold text-wa-text-primary dark:text-white block hover:underline cursor-pointer" 
                                  onClick={() => handleOpenLead(lead._id)}
                                >
                                  {lead.name || 'Anonymous User'}
                                </span>
                                <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono block mt-0.5">
                                  {lead.phone}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Inquiry Summary */}
                          <td className="px-6 py-4">
                            <div className="space-y-1.5 max-w-xs">
                              {lead.serviceRequired && (
                                <div className="flex items-center gap-1">
                                  <Briefcase className="w-3.5 h-3.5 text-wa-text-light shrink-0" />
                                  <span className="font-semibold truncate text-[11px] text-wa-text-primary dark:text-wa-dark-text-primary">
                                    {lead.serviceRequired}
                                  </span>
                                </div>
                              )}
                              {lead.projectDescription && (
                                <span className="text-[10px] text-wa-text-secondary line-clamp-1">
                                  {lead.projectDescription}
                                </span>
                              )}
                              {lead.customFields?.city && (
                                <div className="flex items-center gap-1 text-[10px] text-wa-text-secondary">
                                  <MapPin className="w-3 h-3 text-red-400" />
                                  <span>{lead.customFields.city}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Budget & Timeline */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {lead.budget && (
                                <div className="flex items-center text-wa-green font-bold text-[11px]">
                                  <DollarSign className="w-3 h-3" />
                                  <span>{lead.budget}</span>
                                </div>
                              )}
                              {lead.timeline && (
                                <div className="flex items-center gap-1 text-[10px] text-wa-text-secondary">
                                  <Calendar className="w-3 h-3" />
                                  <span>{lead.timeline}</span>
                                </div>
                              )}
                              {!lead.budget && !lead.timeline && (
                                <span className="text-wa-text-secondary italic text-[10px]">No info collected</span>
                              )}
                            </div>
                          </td>

                          {/* Lead Assigned (Default: clean agent name/avatar badge, Click: interactive dropdown) */}
                          <td className="px-6 py-4">
                            <div className="relative inline-block" data-dropdown-container>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveDropdown(
                                    activeDropdown?.id === lead._id && activeDropdown?.type === 'assign'
                                      ? null
                                      : { id: lead._id, type: 'assign' }
                                  )
                                }
                                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-wa-hover/60 dark:hover:bg-wa-dark-hover/40 border border-transparent hover:border-wa-border dark:hover:border-wa-dark-border transition-all duration-150 group cursor-pointer text-left"
                                title="Click to reassign agent"
                              >
                                {assignedAgentObj ? (
                                  <>
                                    <div className="w-6 h-6 rounded-full bg-wa-green/15 text-wa-green font-bold text-[10px] flex items-center justify-center shrink-0 border border-wa-green/20 shadow-xs">
                                      {assignedAgentObj.name ? assignedAgentObj.name.substring(0, 2).toUpperCase() : 'AG'}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs font-semibold text-wa-text-primary dark:text-white truncate max-w-[130px] group-hover:text-wa-green transition-colors">
                                        {assignedAgentObj.name || assignedAgentObj.email}
                                      </span>
                                      <span className="text-[9px] text-wa-text-secondary capitalize">
                                        {assignedAgentObj.role || 'Agent'}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-wa-text-secondary group-hover:text-wa-text-primary dark:group-hover:text-white text-xs">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-wa-text-secondary flex items-center justify-center text-[10px]">
                                      👤
                                    </div>
                                    <span className="italic text-xs font-normal">Unassigned</span>
                                  </div>
                                )}
                                <ChevronDown
                                  className={`w-3 h-3 text-wa-text-secondary group-hover:text-wa-text-primary dark:group-hover:text-white transition-transform duration-150 ${
                                    activeDropdown?.id === lead._id && activeDropdown?.type === 'assign' ? 'rotate-180' : 'opacity-50'
                                  }`}
                                />
                              </button>

                              {/* Assign Dropdown Menu */}
                              {activeDropdown?.id === lead._id && activeDropdown?.type === 'assign' && (
                                <div
                                  className={`absolute z-50 left-0 w-56 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-2xl py-1.5 animate-scale-in text-xs font-medium ${
                                    isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                  }`}
                                >
                                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider border-b border-wa-border/50 dark:border-wa-dark-border/40 flex items-center justify-between">
                                    <span>Assign Agent</span>
                                    <Users className="w-3 h-3 opacity-60" />
                                  </div>
                                  <div className="max-h-60 overflow-y-auto scrollbar-thin py-1">
                                    {/* Option: Unassigned */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleAssignAgent(lead._id, 'unassigned');
                                        setActiveDropdown(null);
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                        !assignedAgentObj
                                          ? 'bg-wa-green/10 text-wa-green font-bold'
                                          : 'text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px]">
                                          👤
                                        </span>
                                        <span className="italic text-wa-text-secondary">Unassigned (None)</span>
                                      </div>
                                      {!assignedAgentObj && <Check className="w-3.5 h-3.5 text-wa-green shrink-0" />}
                                    </button>

                                    {agents.length > 0 && <div className="h-px bg-wa-border/40 dark:bg-wa-dark-border/30 my-1" />}

                                    {/* Agent Options */}
                                    {agents.map((ag) => {
                                      const isSelected = assignedAgentObj && (assignedAgentObj._id === ag._id || assignedAgentObj === ag._id);
                                      return (
                                        <button
                                          key={ag._id}
                                          type="button"
                                          onClick={() => {
                                            handleAssignAgent(lead._id, ag._id);
                                            setActiveDropdown(null);
                                          }}
                                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                            isSelected
                                              ? 'bg-wa-green/10 text-wa-green font-bold'
                                              : 'text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-full bg-wa-green/15 text-wa-green font-bold text-[10px] flex items-center justify-center shrink-0 border border-wa-green/20">
                                              {ag.name ? ag.name.substring(0, 2).toUpperCase() : 'AG'}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                              <span className="truncate font-semibold text-xs leading-tight">
                                                {ag.name || ag.email}
                                              </span>
                                              <span className="text-[9px] text-wa-text-secondary capitalize">
                                                {ag.role || 'Agent'}
                                              </span>
                                            </div>
                                          </div>
                                          {isSelected && <Check className="w-3.5 h-3.5 text-wa-green shrink-0 ml-1.5" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Lead Status (Default: clean status badge pill, Click: interactive dropdown) */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              {lead.segment && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-center uppercase tracking-wider w-fit ${getSegmentColor(lead.segment)}`}>
                                  {lead.segment}
                                </span>
                              )}
                              <div className="relative inline-block" data-dropdown-container>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveDropdown(
                                      activeDropdown?.id === lead._id && activeDropdown?.type === 'status'
                                        ? null
                                        : { id: lead._id, type: 'status' }
                                    )
                                  }
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] ${getStatusColor(lead.status)}`}
                                  title="Click to update status"
                                >
                                  <span>{STATUS_OPTIONS.find((o) => o.value === (lead.status || 'new'))?.emoji || '🟡'}</span>
                                  <span>{getStatusLabel(lead.status)}</span>
                                  <ChevronDown
                                    className={`w-3 h-3 transition-transform duration-150 ${
                                      activeDropdown?.id === lead._id && activeDropdown?.type === 'status' ? 'rotate-180' : 'opacity-60'
                                    }`}
                                  />
                                </button>

                                {/* Status Dropdown Menu */}
                                {activeDropdown?.id === lead._id && activeDropdown?.type === 'status' && (
                                  <div
                                    className={`absolute z-50 left-0 w-52 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-2xl py-1.5 animate-scale-in text-xs font-medium ${
                                      isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                    }`}
                                  >
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider border-b border-wa-border/50 dark:border-wa-dark-border/40">
                                      Select Lead Status
                                    </div>
                                    <div className="max-h-60 overflow-y-auto scrollbar-thin py-1">
                                      {STATUS_OPTIONS.map((opt) => {
                                        const isSelected = (lead.status || 'new') === opt.value;
                                        return (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                              handleUpdateStatus(lead._id, opt.value);
                                              setActiveDropdown(null);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                                              isSelected
                                                ? 'bg-wa-green/10 text-wa-green font-bold'
                                                : 'text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm">{opt.emoji}</span>
                                              <span>{opt.label}</span>
                                            </div>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-wa-green shrink-0" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Win/Loss Reason Badges */}
                              {lead.status === 'lost' && (lead.lossReason || lead.customFields?.lossReason) && (
                                <span className="text-[9px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={lead.lossReason || lead.customFields?.lossReason}>
                                  ❌ {lead.lossReason || lead.customFields?.lossReason}
                                </span>
                              )}
                              {(lead.status === 'won' || lead.status === 'closed') && (lead.winReason || lead.customFields?.winReason) && (
                                <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={lead.winReason || lead.customFields?.winReason}>
                                  🏆 {lead.winReason || lead.customFields?.winReason}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Last Activity */}
                          <td className="px-6 py-4 text-wa-text-secondary text-[11px] font-medium">
                            {getRelativeTime(lead.lastMessageAt || lead.updatedAt)}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenLead(lead._id)}
                                className="p-1.5 bg-wa-green/10 hover:bg-wa-green text-wa-green hover:text-white rounded-lg transition-all duration-200"
                                title="View Details & Chat"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(lead)}
                                className="p-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white rounded-lg transition-all duration-200"
                                title="Edit Lead Database"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <Link
                                href={`/dashboard/invoice-settings?tab=generate&customerId=${lead._id}`}
                                className="p-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white rounded-lg transition-all duration-200"
                                title="Generate Invoice for Lead"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                onClick={() => handleDeleteLead(lead._id, lead.name)}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all duration-200"
                                title="Delete Lead Database"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {pages > 1 && (
              <div className="p-4 border-t border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-wa-panel-header dark:bg-wa-dark-panel-header/20">
                <span className="text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase">
                  Page {page} of {pages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border hover:bg-wa-hover dark:hover:bg-wa-dark-hover disabled:opacity-40 disabled:hover:bg-transparent text-wa-text-primary dark:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page === pages}
                    onClick={() => setPage(page + 1)}
                    className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border hover:bg-wa-hover dark:hover:bg-wa-dark-hover disabled:opacity-40 disabled:hover:bg-transparent text-wa-text-primary dark:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* VIEW 2: KANBAN DRAG & DROP BOARD */}
        {viewMode === 'kanban' && (
          <div className="p-4 overflow-x-auto min-h-[620px] scrollbar-thin">
            <div className="flex gap-4 items-start pb-4 min-w-[1750px]">
              {KANBAN_COLUMNS.map((col) => {
                const colLeads = filteredLeads.filter((l) => {
                  const s = l.status || 'new';
                  if (col.key === 'won') {
                    return s === 'won' || s === 'closed';
                  }
                  return s === col.key;
                });

                const isDragOver = dragOverCol === col.key;

                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverCol !== col.key) setDragOverCol(col.key);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget)) return;
                      setDragOverCol(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropLead(col.key);
                    }}
                    className={`w-72 shrink-0 rounded-2xl border transition-all duration-200 flex flex-col bg-slate-50/80 dark:bg-wa-dark-header/30 shadow-xs ${
                      isDragOver
                        ? 'ring-2 ring-wa-green border-wa-green bg-wa-green/10 scale-[1.01]'
                        : 'border-wa-border dark:border-wa-dark-border'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="p-3.5 border-b border-wa-border/70 dark:border-wa-dark-border/60 bg-white/90 dark:bg-wa-dark-panel/90 rounded-t-2xl flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">{col.emoji}</span>
                        <div>
                          <h3 className="text-xs font-bold text-wa-text-primary dark:text-white uppercase tracking-wider">
                            {col.label}
                          </h3>
                          <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary leading-tight mt-0.5">
                            {col.desc}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${col.headerBg}`}>
                        {colLeads.length}
                      </span>
                    </div>

                    {/* Column Drop Zone / Cards List */}
                    <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-[420px] max-h-[calc(100vh-320px)] scrollbar-thin">
                      {colLeads.length === 0 ? (
                        <div className="h-44 border-2 border-dashed border-wa-border/70 dark:border-wa-dark-border/60 rounded-xl flex flex-col items-center justify-center text-center p-4 text-wa-text-secondary dark:text-wa-dark-text-secondary bg-white/30 dark:bg-wa-dark-panel/20 select-none">
                          <span className="text-2xl mb-1 opacity-50">{col.emoji}</span>
                          <span className="text-xs font-semibold">No leads in this stage</span>
                          <span className="text-[10px] opacity-75 mt-0.5">Drag & drop cards here</span>
                        </div>
                      ) : (
                        colLeads.map((lead) => {
                          const isBeingDragged = draggedLeadId === lead._id;
                          const assignedAgentObj = lead.assignedAgent && typeof lead.assignedAgent === 'object' ? lead.assignedAgent : null;

                          return (
                            <div
                              key={lead._id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedLeadId(lead._id);
                                e.dataTransfer.setData('text/plain', lead._id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragEnd={() => {
                                setDraggedLeadId(null);
                                setDragOverCol(null);
                              }}
                              className={`group bg-white dark:bg-wa-dark-panel border rounded-xl p-3.5 shadow-xs hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
                                isBeingDragged
                                  ? 'opacity-40 border-dashed border-wa-green scale-95 shadow-inner'
                                  : 'border-wa-border dark:border-wa-dark-border hover:border-wa-green/60'
                              }`}
                            >
                              {/* Card Top: Customer Avatar, Name, Segment & Grip */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-8 h-8 rounded-xl bg-wa-green/10 text-wa-green font-bold text-xs flex items-center justify-center shrink-0 shadow-inner">
                                    {lead.name ? lead.name.substring(0, 2).toUpperCase() : 'LD'}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4
                                      onClick={() => handleOpenLead(lead._id)}
                                      className="text-xs font-bold text-wa-text-primary dark:text-white truncate hover:text-wa-green cursor-pointer"
                                      title={lead.name || 'Anonymous User'}
                                    >
                                      {lead.name || 'Anonymous User'}
                                    </h4>
                                    <span className="text-[10px] font-mono text-wa-text-secondary dark:text-wa-dark-text-secondary block mt-0.2">
                                      {lead.phone}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {lead.segment && (
                                    <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold uppercase tracking-wider ${getSegmentColor(lead.segment)}`}>
                                      {lead.segment}
                                    </span>
                                  )}
                                  <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 shrink-0" />
                                </div>
                              </div>

                              {/* Inquiry info */}
                              {(lead.serviceRequired || lead.projectDescription) && (
                                <div className="space-y-1 mb-2.5 py-1.5 px-2 bg-wa-bg/50 dark:bg-wa-dark-header/40 rounded-lg border border-wa-border/40 dark:border-wa-dark-border/30 text-[11px]">
                                  {lead.serviceRequired && (
                                    <div className="flex items-center gap-1 text-wa-text-primary dark:text-wa-dark-text-primary font-semibold truncate">
                                      <Briefcase className="w-3 h-3 text-wa-text-light shrink-0" />
                                      <span className="truncate">{lead.serviceRequired}</span>
                                    </div>
                                  )}
                                  {lead.projectDescription && (
                                    <p className="text-[10px] text-wa-text-secondary line-clamp-2">
                                      {lead.projectDescription}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Budget & Timeline & City Chips */}
                              <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[10px]">
                                {lead.budget && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold flex items-center gap-0.5 border border-emerald-500/20">
                                    <DollarSign className="w-2.5 h-2.5" />
                                    <span>{lead.budget}</span>
                                  </span>
                                )}
                                {lead.timeline && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium flex items-center gap-0.5 border border-blue-500/20">
                                    <Calendar className="w-2.5 h-2.5" />
                                    <span>{lead.timeline}</span>
                                  </span>
                                )}
                                {lead.customFields?.city && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium flex items-center gap-0.5 border border-red-500/20">
                                    <MapPin className="w-2.5 h-2.5" />
                                    <span>{lead.customFields.city}</span>
                                  </span>
                                )}
                              </div>

                              {/* Win or Loss Reason on Kanban Card */}
                              {lead.status === 'lost' && (lead.lossReason || lead.customFields?.lossReason) && (
                                <div className="mb-2 px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40 text-[10px] font-semibold flex items-center gap-1 truncate" title={lead.lossReason || lead.customFields?.lossReason}>
                                  <span>❌</span>
                                  <span className="truncate">{lead.lossReason || lead.customFields?.lossReason}</span>
                                </div>
                              )}
                              {(lead.status === 'won' || lead.status === 'closed') && (lead.winReason || lead.customFields?.winReason) && (
                                <div className="mb-2 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40 text-[10px] font-semibold flex items-center gap-1 truncate" title={lead.winReason || lead.customFields?.winReason}>
                                  <span>🏆</span>
                                  <span className="truncate">{lead.winReason || lead.customFields?.winReason}</span>
                                </div>
                              )}

                              {/* Card Bottom: Assigned Agent, Time & Actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-wa-border/50 dark:border-wa-dark-border/40 text-[10px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {assignedAgentObj ? (
                                    <div className="flex items-center gap-1 text-wa-text-primary dark:text-white font-medium truncate" title={assignedAgentObj.name}>
                                      <div className="w-4.5 h-4.5 rounded-full bg-wa-green/15 text-wa-green text-[8px] font-bold flex items-center justify-center shrink-0 border border-wa-green/20">
                                        {assignedAgentObj.name ? assignedAgentObj.name.substring(0, 2).toUpperCase() : 'AG'}
                                      </div>
                                      <span className="truncate max-w-[90px]">{assignedAgentObj.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-wa-text-secondary italic flex items-center gap-1 text-[10px]">
                                      <UserCheck className="w-3 h-3 opacity-60" /> Unassigned
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleOpenLead(lead._id)}
                                    className="p-1 rounded-md text-wa-text-secondary hover:text-wa-green hover:bg-wa-green/10 transition-colors"
                                    title="View Chat & Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEdit(lead)}
                                    className="p-1 rounded-md text-wa-text-secondary hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                                    title="Edit Lead"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <Link
                                    href={`/dashboard/invoice-settings?tab=generate&customerId=${lead._id}`}
                                    className="p-1 rounded-md text-wa-text-secondary hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                                    title="Generate Invoice"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteLead(lead._id, lead.name)}
                                    className="p-1 rounded-md text-wa-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    title="Delete Lead"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Details modal overlay */}
      {isDetailsOpen && selectedLeadId && (
        <LeadDetailsModal
          leadId={selectedLeadId}
          agents={agents}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedLeadId(null);
          }}
          onUpdateSuccess={() => {
            fetchLeads();
            setIsDetailsOpen(false);
            setSelectedLeadId(null);
          }}
        />
      )}

      {/* Edit Lead Modal Overlay */}
      {editingLead && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-lg overflow-hidden shadow-wa-lg animate-fade-in flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header dark:bg-wa-dark-panel-header shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-wa-text-primary dark:text-white text-sm leading-tight">
                      Edit Lead Database Records
                    </h3>
                    <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                      Modifying CRM fields and inquiry attributes for: {editingLead.name || editingLead.phone}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingLead(null)} 
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Modal Form Content */}
              <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Client Name</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="Enter name"
                    />
                  </div>
                  
                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      required
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <div>
                  {/* Email */}
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="input-field py-2 text-xs"
                    placeholder="Enter email"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Lead Pipeline Status */}
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Lead Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="input-field py-2 text-xs font-semibold"
                    >
                      <option value="new">🟡 New Lead</option>
                      <option value="qualified">🟢 Qualified</option>
                      <option value="proposal_sent">🔵 Proposal Sent</option>
                      <option value="invoice_generated">🔷 Invoice Generated</option>
                      <option value="payment_due">🟠 Payment Due</option>
                      <option value="won">🏆 Lead Won</option>
                      <option value="lost">❌ Lead Lost</option>
                      <option value="closed">🟣 Closed / Won</option>
                    </select>
                  </div>

                  {/* Assigned Agent */}
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Assigned Agent</label>
                    <select
                      value={editForm.assignedAgent}
                      onChange={(e) => setEditForm({ ...editForm, assignedAgent: e.target.value })}
                      className="input-field py-2 text-xs font-semibold"
                    >
                      <option value="unassigned">👤 Unassigned</option>
                      {agents.map((ag) => (
                        <option key={ag._id} value={ag._id}>
                          {ag.name || ag.email} ({ag.role || 'Agent'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Drop Reason Selector when Status is Lost */}
                {editForm.status === 'lost' && (
                  <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 space-y-2.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                      Select Lead Drop / Loss Reason:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        'Price / Budget Issue',
                        'Chose Competitor',
                        'No Response / Ghosted',
                        'Service Area Mismatch',
                        'Postponed / Timing Issue',
                        'Not Interested / Invalid',
                        'Custom Reason'
                      ].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, lossReason: r })}
                          className={`px-2 py-1.5 rounded-lg border text-left text-[11px] font-semibold transition-all ${
                            editForm.lossReason === r
                              ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                              : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:border-rose-400'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    {/* Custom reason or feedback note */}
                    <input
                      type="text"
                      value={editForm.customLossReason}
                      onChange={(e) => setEditForm({ ...editForm, customLossReason: e.target.value })}
                      placeholder="Write custom reason or client feedback..."
                      className="input-field py-1.5 text-xs bg-white dark:bg-wa-dark-panel"
                    />
                  </div>
                )}

                {/* Win Reason Selector when Status is Won or Closed */}
                {(editForm.status === 'won' || editForm.status === 'closed') && (
                  <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2.5 animate-fade-in">
                    <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Select Deal Win / Conversion Reason:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        'Competitive Pricing & Value',
                        'Fast Response & Follow-up',
                        'Trust, Demo & Portfolio',
                        'Custom Requirements Matched',
                        'Client Referral / Word of Mouth',
                        'Special Discount / Deal Offer',
                        'Custom Reason'
                      ].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, winReason: r })}
                          className={`px-2 py-1.5 rounded-lg border text-left text-[11px] font-semibold transition-all ${
                            editForm.winReason === r
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:border-emerald-400'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    {/* Custom reason or feedback note */}
                    <input
                      type="text"
                      value={editForm.customWinReason}
                      onChange={(e) => setEditForm({ ...editForm, customWinReason: e.target.value })}
                      placeholder="Write custom reason or conversion factor..."
                      className="input-field py-1.5 text-xs bg-white dark:bg-wa-dark-panel"
                    />
                  </div>
                )}

                <div className="h-px bg-wa-border dark:bg-wa-dark-border opacity-50 my-2" />
                
                <div className="flex items-center gap-1.5 text-wa-green font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Bot Inquiry Variables</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Service Required */}
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Inquired Service</label>
                    <input
                      type="text"
                      value={editForm.serviceRequired}
                      onChange={(e) => setEditForm({ ...editForm, serviceRequired: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="e.g. Renovation, Water park"
                    />
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Budget</label>
                    <input
                      type="text"
                      value={editForm.budget}
                      onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="e.g. 50k-2L"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Timeline */}
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Timeline</label>
                    <input
                      type="text"
                      value={editForm.timeline}
                      onChange={(e) => setEditForm({ ...editForm, timeline: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="e.g. Immediately"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="e.g. Surat"
                    />
                  </div>
                </div>

                <div>
                  {/* Special Requirements */}
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Company Size / Special Requirements</label>
                  <input
                    type="text"
                    value={editForm.specialRequirements}
                    onChange={(e) => setEditForm({ ...editForm, specialRequirements: e.target.value })}
                    className="input-field py-2 text-xs"
                    placeholder="e.g. 10-50 employees"
                  />
                </div>

                <div>
                  {/* Notes */}
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Internal Client Notes</label>
                  <textarea
                    rows="3"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="input-field py-2 text-xs"
                    placeholder="Enter manual annotations..."
                  />
                </div>

                {/* Actions Footer */}
                <div className="pt-4 border-t border-wa-border dark:border-wa-dark-border flex items-center justify-between gap-2.5 shrink-0">
                  <Link
                    href={`/dashboard/invoice-settings?tab=generate&customerId=${editingLead?._id}`}
                    onClick={() => setEditingLead(null)}
                    className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-amber-500/20"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Create Invoice
                  </Link>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingLead(null)}
                      className="px-4 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl text-xs font-semibold text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingLead}
                      className="px-4 py-2 bg-wa-green hover:bg-wa-green-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-wa-green/15 cursor-pointer"
                    >
                      {savingLead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Lead Data
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Lead Lost Reason Quick Popup Modal */}
      <LeadLostReasonModal
        isOpen={!!lostReasonTarget}
        leadName={lostReasonTarget?.leadName}
        onClose={() => setLostReasonTarget(null)}
        onConfirm={async ({ lossReason, notes }) => {
          if (lostReasonTarget?.leadId) {
            await executeStatusUpdate(lostReasonTarget.leadId, 'lost', lossReason, notes);
          }
        }}
      />

      {/* Lead Won Reason Quick Popup Modal */}
      <LeadWonReasonModal
        isOpen={!!wonReasonTarget}
        leadName={wonReasonTarget?.leadName}
        onClose={() => setWonReasonTarget(null)}
        onConfirm={async ({ winReason, notes }) => {
          if (wonReasonTarget?.leadId) {
            await executeStatusUpdate(
              wonReasonTarget.leadId,
              wonReasonTarget.targetStatus || 'won',
              '',
              notes,
              winReason
            );
          }
        }}
      />
    </div>
  );
}
