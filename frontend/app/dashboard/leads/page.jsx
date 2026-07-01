'use client';
import { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { toast } from 'react-hot-toast';
import { 
  Search, Users, RefreshCw, MessageSquare, Eye, Sparkles, Filter, 
  MapPin, DollarSign, Calendar, Briefcase, ChevronLeft, ChevronRight, 
  Bookmark, ArrowRight, Edit2, Trash2, X, Loader2, Save
} from 'lucide-react';
import LeadDetailsModal from '../../../components/LeadDetailsModal';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useConfirmStore } from '../../../lib/store';

export default function LeadsPage() {
  const confirm = useConfirmStore((state) => state.confirm);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
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
    serviceRequired: '',
    budget: '',
    timeline: '',
    city: '',
    specialRequirements: '',
    notes: ''
  });

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch || undefined
      };
      const { data } = await api.get('/leads', { params });
      if (data.success) {
        setLeads(data.data.leads || []);
        setTotal(data.data.total || 0);
        setPages(data.data.pages || 1);
      }
    } catch (err) {
      toast.error('Failed to load leads data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchLeads();
  }, [page, debouncedSearch]);

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
      const { data } = await api.put(`/leads/${editingLead._id}`, editForm);
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

  const getStatusColor = (s) => {
    switch (s) {
      case 'qualified': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
      case 'proposal_sent': return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20';
      case 'closed': return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20';
      default: return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20';
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

  // Calculate metrics
  const totalCount = total;
  const hotCount = leads.filter(l => l.segment === 'hot').length;
  const warmCount = leads.filter(l => l.segment === 'warm').length;
  const closedCount = leads.filter(l => l.status === 'closed').length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-wa-green animate-pulse" /> Customer Inquiries & Leads
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Real-time inquiries captured from active Bot flows, custom fields, and qualifications.
          </p>
        </div>
        <button 
          onClick={fetchLeads}
          className="flex items-center gap-1.5 px-4 py-2 bg-wa-panel-header dark:bg-wa-dark-panel-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs font-semibold text-wa-text-primary dark:text-white hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all duration-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

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
          <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
            <Sparkles className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">Hot Leads</span>
            <span className="text-2xl font-black text-red-500">{hotCount}</span>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 text-red-500 pointer-events-none">
            <Sparkles className="w-32 h-32 -mr-8 -mb-8" />
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl">
            <Bookmark className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">Warm Leads</span>
            <span className="text-2xl font-black text-orange-500">{warmCount}</span>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 text-orange-500 pointer-events-none">
            <Bookmark className="w-32 h-32 -mr-8 -mb-8" />
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">Closed Deals</span>
            <span className="text-2xl font-black text-purple-500">{closedCount}</span>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 text-purple-500 pointer-events-none">
            <MessageSquare className="w-32 h-32 -mr-8 -mb-8" />
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="glass-card overflow-hidden flex flex-col">
        {/* Table Filters */}
        <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-wa-panel-header dark:bg-wa-dark-panel-header/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-text-secondary" />
            <input
              type="text"
              placeholder="Search by name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 pr-4 py-2 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-wa-text-secondary">
            <Filter className="w-3.5 h-3.5" />
            <span>Showing {leads.length} of {total} leads</span>
          </div>
        </div>

        {/* Leads Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-wa-border dark:border-wa-dark-border bg-wa-panel-header dark:bg-wa-dark-panel-header/35 text-[10px] uppercase tracking-wider font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary">
                <th className="px-6 py-4">Lead / Customer</th>
                <th className="px-6 py-4">Inquiry Summary</th>
                <th className="px-6 py-4">Budget & Timeline</th>
                <th className="px-6 py-4">Interest / Status</th>
                <th className="px-6 py-4">Last Activity</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/40 text-xs">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-wa-text-secondary">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-wa-green" />
                        <span>Loading leads...</span>
                      </div>
                    ) : (
                      <span>No bot flow leads found. Ensure bot flows are active and customers are interacting.</span>
                    )}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-wa-green/10 text-wa-green font-bold flex items-center justify-center shadow-inner">
                          {lead.name ? lead.name.substring(0, 2).toUpperCase() : 'LD'}
                        </div>
                        <div>
                          <span className="font-bold text-wa-text-primary dark:text-white block hover:underline cursor-pointer" onClick={() => handleOpenLead(lead._id)}>
                            {lead.name || 'Anonymous User'}
                          </span>
                          <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono block mt-0.5">
                            {lead.phone}
                          </span>
                        </div>
                      </div>
                    </td>
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
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 w-fit">
                        {lead.segment && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-center uppercase tracking-wider ${getSegmentColor(lead.segment)}`}>
                            {lead.segment}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-center uppercase tracking-wider ${getStatusColor(lead.status)}`}>
                          {lead.status === 'qualified' ? 'Qualified' : lead.status === 'proposal_sent' ? 'Proposal Sent' : lead.status === 'closed' ? 'Closed' : 'New'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-wa-text-secondary text-[11px] font-medium">
                      {getRelativeTime(lead.lastMessageAt || lead.updatedAt)}
                    </td>
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
                ))
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
                className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border hover:bg-wa-hover dark:hover:bg-wa-dark-hover disabled:opacity-40 disabled:hover:bg-transparent text-wa-text-primary dark:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === pages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border hover:bg-wa-hover dark:hover:bg-wa-dark-hover disabled:opacity-40 disabled:hover:bg-transparent text-wa-text-primary dark:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details modal overlay */}
      {isDetailsOpen && selectedLeadId && (
        <LeadDetailsModal
          leadId={selectedLeadId}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
              <div className="pt-4 border-t border-wa-border dark:border-wa-dark-border flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl text-xs font-semibold text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="px-4 py-2 bg-wa-green hover:bg-wa-green-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-wa-green/15"
                >
                  {savingLead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Lead Data
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
