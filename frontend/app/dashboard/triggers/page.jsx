'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Zap, Plus, Trash2, Edit3, X, Sparkles, Loader2, Search,
  ToggleLeft, ToggleRight, AlertCircle, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '../../../lib/api';

export default function TriggersPage() {
  const [triggers, setTriggers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search & Pagination states
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTriggers, setTotalTriggers] = useState(0);

  // Modal / Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTriggerId, setEditingTriggerId] = useState(null);
  const [triggerForm, setTriggerForm] = useState({
    triggerText: '',
    templateIds: [],
    replyText: '',
    isFallback: false,
    isActive: true
  });

  const fetchTemplates = async () => {
    try {
      const { data } = await api.get('/templates');
      if (data.success) {
        setTemplates(data.data.templates);
      }
    } catch (err) {
      toast.error('Failed to load WhatsApp templates');
    }
  };

  const fetchTriggers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/triggers', {
        params: {
          search,
          page,
          limit
        }
      });
      if (data.success) {
        setTriggers(data.data.triggers);
        setTotalPages(data.data.pages || 1);
        setTotalTriggers(data.data.total || 0);
      }
    } catch (err) {
      toast.error('Failed to load reply triggers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    fetchTriggers();
  }, [page, limit, search]);

  const handleOpenCreateModal = () => {
    setEditingTriggerId(null);
    setTriggerForm({
      triggerText: '',
      templateIds: [],
      replyText: '',
      isFallback: false,
      isActive: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (trigger) => {
    setEditingTriggerId(trigger._id);
    setTriggerForm({
      triggerText: trigger.triggerText || '',
      templateIds: trigger.templateIds ? trigger.templateIds.map(t => t._id || t) : [],
      replyText: trigger.replyText || '',
      isFallback: trigger.isFallback || false,
      isActive: trigger.isActive !== undefined ? trigger.isActive : true
    });
    setIsModalOpen(true);
  };

  const handleToggleTemplate = (templateId) => {
    setTriggerForm(prev => {
      const ids = [...prev.templateIds];
      const idx = ids.indexOf(templateId);
      if (idx > -1) {
        ids.splice(idx, 1);
      } else {
        ids.push(templateId);
      }
      return { ...prev, templateIds: ids };
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!triggerForm.isFallback && !triggerForm.triggerText) {
      toast.error('Keyword is required for standard triggers');
      return;
    }

    if (triggerForm.templateIds.length === 0 && !triggerForm.replyText) {
      toast.error('Please assign at least one template or text reply');
      return;
    }

    setSubmitting(true);
    try {
      let res;
      if (editingTriggerId) {
        res = await api.put(`/triggers/${editingTriggerId}`, triggerForm);
      } else {
        res = await api.post('/triggers', triggerForm);
      }

      if (res.data.success) {
        toast.success(editingTriggerId ? 'Trigger updated' : 'Trigger responder created');
        setIsModalOpen(false);
        fetchTriggers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save trigger responder');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTrigger = async (id) => {
    if (!confirm('Are you sure you want to delete this reply trigger?')) return;
    try {
      const { data } = await api.delete(`/triggers/${id}`);
      if (data.success) {
        toast.success('Reply trigger deleted');
        fetchTriggers();
      }
    } catch (err) {
      toast.error('Failed to delete reply trigger');
    }
  };

  const handleToggleActive = async (trigger) => {
    try {
      const { data } = await api.put(`/triggers/${trigger._id}`, {
        isActive: !trigger.isActive
      });
      if (data.success) {
        toast.success(trigger.isActive ? 'Trigger deactivated' : 'Trigger activated');
        fetchTriggers();
      }
    } catch (err) {
      toast.error('Failed to update trigger status');
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Zap className="w-6 h-6 text-wa-green animate-pulse" /> Reply Trigger Messages
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Configure automated responses based on message keywords or manage the default fallback responder.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="btn-primary py-2 text-xs flex items-center gap-1.5 font-semibold self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Reply Message
        </button>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-wa-dark-panel p-4 rounded-2xl border border-wa-border dark:border-wa-dark-border shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search keywords..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-wa-text-secondary" />
        </div>

        {/* Entries Per Page */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-wa-text-secondary">
          <span>Show:</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border bg-wa-bg dark:bg-wa-dark-header text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30"
          >
            <option value={10}>10 entries</option>
            <option value={25}>25 entries</option>
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
          </select>
        </div>
      </div>

      {/* Reply Trigger Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-wa-panel-header dark:bg-wa-dark-panel-header text-wa-text-secondary dark:text-wa-dark-text-secondary font-semibold text-[11px] uppercase tracking-wider border-b border-wa-border dark:border-wa-dark-border">
                <th className="px-5 py-3">Serial No</th>
                <th className="px-5 py-3">Trigger Text / Type</th>
                <th className="px-5 py-3">Attachments / Auto-Replies</th>
                <th className="px-5 py-3">Created Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-wa-text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                      <span>Loading reply triggers...</span>
                    </div>
                  </td>
                </tr>
              ) : triggers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-wa-text-secondary italic">
                    No keyword triggers found. Create one to begin automating replies.
                  </td>
                </tr>
              ) : (
                triggers.map((trigger, index) => {
                  const serialNo = (page - 1) * limit + index + 1;
                  return (
                    <tr key={trigger._id} className="hover:bg-wa-bg/10 dark:hover:bg-wa-dark-header/10 transition-colors">
                      {/* Serial No */}
                      <td className="px-5 py-4 font-mono font-semibold text-wa-text-secondary">{serialNo}</td>

                      {/* Trigger Text / Type */}
                      <td className="px-5 py-4">
                        {trigger.isFallback ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 font-bold rounded-full border border-amber-200/50 dark:border-amber-900/30">
                            <AlertCircle className="w-3.5 h-3.5" /> Fallback Responder
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="font-bold text-wa-text-primary dark:text-white bg-wa-green/10 text-wa-green px-2 py-0.5 rounded border border-wa-green/20">
                              {trigger.triggerText}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Attachments / Auto-Replies */}
                      <td className="px-5 py-4 max-w-md">
                        <div className="flex flex-wrap gap-1.5">
                          {trigger.templateIds && trigger.templateIds.map(t => (
                            <span key={t._id} className="flex items-center gap-1 bg-wa-panel dark:bg-wa-dark-panel px-2.5 py-1 rounded-lg border border-wa-border dark:border-wa-dark-border text-[10px] text-wa-text-secondary shadow-sm">
                              <FileText className="w-3 h-3 text-wa-green" />
                              <span className="font-semibold truncate max-w-[120px]">{t.name}</span>
                            </span>
                          ))}
                          {trigger.replyText && (
                            <span className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg text-[10px] font-semibold italic max-w-[200px] truncate">
                              "{trigger.replyText}"
                            </span>
                          )}
                          {!trigger.replyText && (!trigger.templateIds || trigger.templateIds.length === 0) && (
                            <span className="text-wa-text-light italic">No reply configured</span>
                          )}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="px-5 py-4 text-wa-text-secondary font-mono">
                        {new Date(trigger.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Toggle Active Status */}
                          <button
                            onClick={() => handleToggleActive(trigger)}
                            className="text-wa-text-secondary"
                            title={trigger.isActive ? "Deactivate" : "Activate"}
                          >
                            {trigger.isActive ? (
                              <ToggleRight className="w-5 h-5 text-wa-green" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-wa-text-light" />
                            )}
                          </button>

                          {/* Edit Trigger */}
                          <button
                            onClick={() => handleOpenEditModal(trigger)}
                            className="p-1.5 hover:bg-wa-bg rounded-lg text-wa-text-secondary"
                            title="Edit Responder"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete Trigger */}
                          <button
                            onClick={() => handleDeleteTrigger(trigger._id)}
                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                            title="Delete Responder"
                          >
                            <Trash2 className="w-4 h-4" />
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 bg-wa-panel-header dark:bg-wa-dark-panel-header border-t border-wa-border dark:border-wa-dark-border text-xs">
            <span className="text-wa-text-secondary">
              Showing page <span className="font-bold text-wa-text-primary dark:text-white">{page}</span> of <span className="font-bold">{totalPages}</span> ({totalTriggers} total triggers)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-bg disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-bg disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT RESPONDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh] shadow-wa-lg">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-wa-green animate-pulse" />
                {editingTriggerId ? 'Edit Auto-Responder' : 'Add Auto-Responder'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* Type Switcher */}
              <div className="flex gap-4 p-1 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl">
                <button
                  type="button"
                  onClick={() => setTriggerForm(prev => ({ ...prev, isFallback: false }))}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    !triggerForm.isFallback
                      ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm border border-wa-border dark:border-wa-dark-border'
                      : 'text-wa-text-secondary hover:text-wa-text-primary'
                  }`}
                >
                  Keyword Trigger
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerForm(prev => ({ ...prev, isFallback: true, triggerText: '' }))}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    triggerForm.isFallback
                      ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm border border-wa-border dark:border-wa-dark-border'
                      : 'text-wa-text-secondary hover:text-wa-text-primary'
                  }`}
                >
                  Fallback Responder
                </button>
              </div>

              {/* Keyword text box */}
              {!triggerForm.isFallback && (
                <div>
                  <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Keyword Trigger *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. price, menu, support, hours"
                    value={triggerForm.triggerText}
                    onChange={(e) => setTriggerForm({ ...triggerForm, triggerText: e.target.value })}
                    className="input-field py-2 text-xs font-semibold"
                  />
                  <p className="text-[10px] text-wa-text-light mt-1">Incoming messages matching this exact keyword (case-insensitive) will trigger this response.</p>
                </div>
              )}

              {triggerForm.isFallback && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 rounded-xl text-xs flex gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>
                    <strong>Note:</strong> Enabling this fallback responder will automatically deactivate any other existing active fallback responders. It fires when no keywords match.
                  </span>
                </div>
              )}

              {/* Simple Text Auto-Reply option */}
              <div>
                <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Direct Text Reply (Optional)</label>
                <textarea
                  placeholder="Type a simple plain text auto-reply..."
                  value={triggerForm.replyText}
                  onChange={(e) => setTriggerForm({ ...triggerForm, replyText: e.target.value })}
                  rows="3"
                  className="input-field py-2 text-xs"
                />
              </div>

              {/* WABA Template Multi-Select */}
              <div>
                <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Linked WhatsApp Templates</label>
                {templates.length === 0 ? (
                  <p className="text-xs text-wa-text-secondary italic">No approved WhatsApp templates sync'd to use for auto replies.</p>
                ) : (
                  <div className="border border-wa-border dark:border-wa-dark-border rounded-xl max-h-[180px] overflow-y-auto divide-y divide-wa-border/50 dark:divide-wa-dark-border/50 p-2 space-y-1 bg-wa-bg/15 dark:bg-slate-900/10 scrollbar-thin">
                    {templates.map(tmpl => {
                      const isSelected = triggerForm.templateIds.includes(tmpl._id);
                      return (
                        <div
                          key={tmpl._id}
                          onClick={() => handleToggleTemplate(tmpl._id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs ${
                            isSelected ? 'bg-wa-green/10 text-wa-green font-bold' : 'hover:bg-wa-hover text-wa-text-primary dark:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-wa-green" />
                            <div>
                              <p className="font-bold">{tmpl.name}</p>
                              <p className="text-[9px] text-wa-text-light uppercase tracking-wider">{tmpl.category} · {tmpl.language || 'en'}</p>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'border-wa-green bg-wa-green text-white' : 'border-wa-border'}`}>
                            {isSelected && <span className="text-[10px]">✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-wa-text-light mt-1">If templates are selected, they will be sent automatically. Multiple templates will be sent in order.</p>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary py-2 text-xs px-4" disabled={submitting}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Responder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
