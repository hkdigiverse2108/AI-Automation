'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  X, Phone, Mail, Globe, Calendar, Briefcase, DollarSign, Clock, 
  Settings, Save, Sparkles, Loader2, MessageSquare, AlertCircle, Bookmark
} from 'lucide-react';
import api from '../lib/api';
import { formatDateOnly, formatTime } from '../lib/utils';

export default function LeadDetailsModal({ leadId, onClose, onUpdateSuccess }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // Editable fields
  const [status, setStatus] = useState('new');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function loadLeadDetails() {
      setLoading(true);
      try {
        const { data } = await api.get(`/leads/${leadId}`);
        if (data.success) {
          setLead(data.data.lead);
          setMessages(data.data.messages || []);
          setStatus(data.data.lead.status || 'new');
          setNotes(data.data.lead.notes || '');
        }
      } catch (err) {
        toast.error('Failed to load lead details');
        onClose();
      } finally {
        setLoading(false);
      }
    }
    if (leadId) {
      loadLeadDetails();
    }
  }, [leadId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/leads/${leadId}`, { status, notes });
      if (data.success) {
        toast.success('Lead updated successfully');
        onUpdateSuccess();
      }
    } catch (err) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getStatusLabel = (s) => {
    switch (s) {
      case 'qualified': return 'Qualified';
      case 'proposal_sent': return 'Proposal Sent';
      case 'closed': return 'Closed / Won';
      default: return 'New Lead';
    }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'qualified': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-900/30';
      case 'proposal_sent': return 'bg-blue-500/10 text-blue-600 dark:text-blue-450 border border-blue-200 dark:border-blue-900/30';
      case 'closed': return 'bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-200 dark:border-purple-900/30';
      default: return 'bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-200 dark:border-amber-900/30';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-8 flex flex-col items-center justify-center shadow-wa-lg w-full max-w-md">
          <Loader2 className="w-8 h-8 animate-spin text-wa-green mb-3" />
          <span className="text-sm font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary">Loading details...</span>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-5xl overflow-hidden shadow-wa-lg animate-fade-in flex flex-col h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header dark:bg-wa-dark-panel-header shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center font-bold shadow-inner">
              {lead.name ? lead.name.substring(0, 2).toUpperCase() : 'LD'}
            </div>
            <div>
              <h3 className="font-extrabold text-wa-text-primary dark:text-white text-base leading-tight flex items-center gap-2">
                {lead.name || 'Anonymous Client'}
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(lead.status)}`}>
                  {getStatusLabel(lead.status)}
                </span>
              </h3>
              <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono mt-0.5">
                Lead ID: {lead._id}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Left Sidebar & Right Chat Split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Column: Requirements & Status Form */}
          <div className="w-full md:w-[500px] border-r border-wa-border dark:border-wa-dark-border overflow-y-auto p-6 space-y-6 scrollbar-thin">
            
            {/* AI Summary Card */}
            {lead.aiSummary && (
              <div className="p-4 bg-gradient-to-br from-wa-green/5 to-emerald-500/5 dark:from-wa-green/5 dark:to-wa-green/10 border border-wa-green/20 dark:border-wa-green/10 rounded-2xl space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-wa-green/5 rounded-full blur-xl pointer-events-none" />
                <h4 className="text-xs font-bold uppercase text-wa-green tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 animate-pulse" /> AI Extraction Summary
                </h4>
                <p className="text-xs text-wa-text-primary dark:text-wa-dark-text-primary leading-relaxed font-medium">
                  {lead.aiSummary}
                </p>
              </div>
            )}

            {/* Customer Details Card */}
            <div className="glass-card p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider pb-2 border-b border-wa-border dark:border-wa-dark-border">
                Client Contact Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div>
                    <span className="block text-[10px] text-wa-text-light">Phone</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white font-mono">{lead.phone || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] text-wa-text-light">Email Address</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white truncate block">{lead.email || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div>
                    <span className="block text-[10px] text-wa-text-light">Company Name</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white capitalize">{lead.companyName || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div>
                    <span className="block text-[10px] text-wa-text-light">Extraction Date</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white">
                      {lead.createdAt ? formatDateOnly(lead.createdAt) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Requirements Card */}
            <div className="glass-card p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider pb-2 border-b border-wa-border dark:border-wa-dark-border">
                Project Requirements
              </h4>
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="block text-[10px] font-bold text-wa-text-secondary uppercase">Service Required</span>
                  <span className="font-semibold text-wa-text-primary dark:text-white block mt-0.5 bg-wa-bg dark:bg-wa-dark-header px-2.5 py-1 rounded-lg border border-wa-border dark:border-wa-dark-border w-fit font-sans text-xs">
                    {lead.serviceRequired || 'Not specified'}
                  </span>
                </div>
                {lead.projectDescription && (
                  <div>
                    <span className="block text-[10px] font-bold text-wa-text-secondary uppercase">Project Scope / Details</span>
                    <p className="text-wa-text-primary dark:text-wa-dark-text-primary mt-1 leading-relaxed bg-wa-bg/30 dark:bg-slate-900/10 p-2.5 rounded-xl border border-wa-border/50 dark:border-wa-dark-border/20 text-xs font-medium">
                      {lead.projectDescription}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold text-wa-text-secondary uppercase">Budget Details</span>
                    <span className="font-bold text-wa-green text-sm flex items-center gap-0.5 mt-0.5">
                      <DollarSign className="w-4 h-4" /> {lead.budget || 'Not provided'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-wa-text-secondary uppercase">Timeline</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-wa-text-light" /> {lead.timeline || 'Not specified'}
                    </span>
                  </div>
                </div>
                {(lead.preferredTechnology || lead.specialRequirements) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-wa-border/40 dark:border-wa-dark-border/40">
                    {lead.preferredTechnology && (
                      <div>
                        <span className="block text-[10px] font-bold text-wa-text-light uppercase">Preferred Tech</span>
                        <span className="font-semibold text-wa-text-primary dark:text-white block mt-0.5">{lead.preferredTechnology}</span>
                      </div>
                    )}
                    {lead.specialRequirements && (
                      <div>
                        <span className="block text-[10px] font-bold text-wa-text-light uppercase">Special Requests</span>
                        <span className="font-semibold text-wa-text-primary dark:text-white block mt-0.5">{lead.specialRequirements}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Editable Status & Notes Form */}
            <form onSubmit={handleSave} className="glass-card p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider pb-2 border-b border-wa-border dark:border-wa-dark-border">
                Manage Lead Status & Notes
              </h4>
              
              <div>
                <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Lead Pipeline Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input-field py-2 text-xs"
                >
                  <option value="new">New Lead</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="closed">Closed / Won</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1.5">Manual Internal Notes</label>
                <textarea
                  rows="4"
                  placeholder="Type updates, follow-ups, or custom instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field py-2 text-xs"
                />
              </div>

              <button 
                type="submit" 
                disabled={saving} 
                className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5 font-bold shadow-md shadow-wa-green/20"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Notes & Pipeline Status
              </button>
            </form>

          </div>

          {/* Right Column: Full WhatsApp Chat History */}
          <div className="flex-1 bg-wa-chat-bg dark:bg-wa-dark-bg relative flex flex-col min-h-0">
            {/* Wallpaper Overlay */}
            <div className="absolute inset-0 wa-chat-bg opacity-[0.06] dark:opacity-[0.02] pointer-events-none" />

            <div className="relative z-10 px-6 py-3 bg-wa-header dark:bg-wa-dark-header border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-wa-text-primary dark:text-white">
                <MessageSquare className="w-4.5 h-4.5 text-wa-green" />
                <span>Transcript Logs History ({messages.length} messages)</span>
              </div>
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin flex flex-col">
              {messages.length === 0 ? (
                <div className="my-auto text-center space-y-2 max-w-sm mx-auto">
                  <AlertCircle className="w-10 h-10 text-wa-text-light mx-auto opacity-30" />
                  <h4 className="font-semibold text-sm text-wa-text-primary dark:text-white">No conversation logged</h4>
                  <p className="text-xs text-wa-text-secondary leading-relaxed">
                    No transcript could be pulled for this lead record.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {messages.map((msg) => {
                    const isInbound = msg.direction === 'inbound';
                    const timeStr = msg.timestamp ? formatTime(msg.timestamp) : '';
                    
                    return (
                      <div key={msg._id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                        <div 
                          className={`relative max-w-[80%] rounded-2xl px-4 py-2 text-xs shadow-sm border flex flex-col ${
                            isInbound 
                              ? 'bg-white dark:bg-wa-dark-header border-wa-border/30 dark:border-wa-dark-border/10 rounded-tl-none text-wa-text-primary dark:text-white' 
                              : 'bg-wa-bubble-out-bg dark:bg-wa-dark-bubble-out-bg border-wa-green/10 rounded-tr-none text-wa-text-primary dark:text-white'
                          }`}
                        >
                          {/* WhatsApp Tail */}
                          <div className={`absolute top-0 w-2 h-2.5 overflow-hidden ${isInbound ? '-left-[7px]' : '-right-[7px]'}`}>
                            <div className={`w-3.5 h-3.5 rotate-45 transform ${
                              isInbound 
                                ? 'bg-white dark:bg-wa-dark-header border-t border-r border-wa-border/20 dark:border-wa-dark-border/10 origin-top-right' 
                                : 'bg-wa-bubble-out-bg dark:bg-wa-dark-bubble-out-bg origin-top-left'
                            }`} />
                          </div>

                          {/* Message Content */}
                          <span className="leading-relaxed whitespace-pre-wrap pr-6">
                            {msg.content?.text || '[Media Attachment]'}
                          </span>

                          {/* Timestamp and SentBy badge */}
                          <span className="text-[8px] text-wa-text-secondary dark:text-wa-dark-text-secondary self-end mt-1 flex items-center gap-1 leading-none">
                            {!isInbound && msg.sentBy && (
                              <span className="font-bold text-[7px] uppercase bg-wa-bg dark:bg-wa-dark-header px-1.5 py-0.5 rounded border border-wa-border dark:border-wa-dark-border">
                                {msg.sentBy}
                              </span>
                            )}
                            {timeStr}
                            {!isInbound && <span className="text-blue-500 font-bold ml-0.5">✓✓</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
