'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Clock, Plus, Trash2, Edit3, X, Sparkles, Loader2, Play, Users, FileText, CheckCircle2, History, AlertCircle
} from 'lucide-react';
import api from '../../../lib/api';
import { useConfirmStore } from '../../../lib/store';

export default function SequencesPage() {
  const confirm = useConfirmStore((state) => state.confirm);
  const [sequences, setSequences] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New/Edit Sequence form state
  const [isSeqModalOpen, setIsSeqModalOpen] = useState(false);
  const [editingSeqId, setEditingSeqId] = useState(null);
  const [seqForm, setSeqForm] = useState({
    name: '',
    triggerTag: '',
    messages: [
      { delayValue: 1, delayUnit: 'days', templateId: '', templateName: '' }
    ]
  });

  // Assign sequence manual state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSeqId, setSelectedSeqId] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: seqData } = await api.get('/sequences');
      if (seqData.success) {
        setSequences(seqData.data.sequences);
        setExecutions(seqData.data.executions);
      }

      // Fetch WABA templates
      const { data: tmplData } = await api.get('/templates');
      if (tmplData.success) {
        // filter approved templates
        setTemplates(tmplData.data.templates.filter(t => t.status === 'APPROVED'));
      }

      // Fetch contacts
      const { data: contactData } = await api.get('/contacts');
      if (contactData.success) {
        setContacts(contactData.data.contacts);
      }

      // Fetch tags list
      const { data: tagData } = await api.get('/tags');
      if (tagData.success) {
        setTags(tagData.data.tags);
      }

    } catch (err) {
      toast.error('Failed to load sequences dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddStep = () => {
    setSeqForm(prev => ({
      ...prev,
      messages: [...prev.messages, { delayValue: 1, delayUnit: 'days', templateId: '', templateName: '' }]
    }));
  };

  const handleRemoveStep = (idx) => {
    if (seqForm.messages.length <= 1) return;
    const stepsCopy = [...seqForm.messages];
    stepsCopy.splice(idx, 1);
    setSeqForm(prev => ({ ...prev, messages: stepsCopy }));
  };

  const handleStepFieldChange = (idx, field, val) => {
    const stepsCopy = [...seqForm.messages];
    if (field === 'templateId') {
      const selectedTmpl = templates.find(t => t._id === val);
      stepsCopy[idx].templateId = val;
      stepsCopy[idx].templateName = selectedTmpl ? selectedTmpl.name : '';
    } else {
      stepsCopy[idx][field] = val;
    }
    setSeqForm(prev => ({ ...prev, messages: stepsCopy }));
  };

  const handleSeqSubmit = async (e) => {
    e.preventDefault();
    const { name, messages } = seqForm;
    if (!name || !messages.length) {
      toast.error('Please fill in all sequence details');
      return;
    }

    const missingTmpl = messages.some(m => !m.templateName);
    if (missingTmpl) {
      toast.error('Please select an approved WhatsApp template for each step');
      return;
    }

    setSubmitting(true);
    try {
      let res;
      if (editingSeqId) {
        res = await api.put(`/sequences/${editingSeqId}`, seqForm);
      } else {
        res = await api.post('/sequences', seqForm);
      }

      if (res.data.success) {
        toast.success(editingSeqId ? 'Sequence updated' : 'Sequence created successfully');
        setIsSeqModalOpen(false);
        setEditingSeqId(null);
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to save sequence');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSequence = (seq) => {
    setEditingSeqId(seq._id);
    setSeqForm({
      name: seq.name,
      triggerTag: seq.triggerTag || '',
      messages: seq.messages.map(m => ({
        delayValue: m.delayValue,
        delayUnit: m.delayUnit,
        templateId: m.templateId || '',
        templateName: m.templateName
      }))
    });
    setIsSeqModalOpen(true);
  };

  const handleDeleteSequence = async (id) => {
    const confirmed = await confirm('Are you sure you want to delete this sequence? This will cancel all running executions.', 'Delete Drip Sequence');
    if (!confirmed) return;
    try {
      const { data } = await api.delete(`/sequences/${id}`);
      if (data.success) {
        toast.success('Sequence deleted successfully');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to delete sequence');
    }
  };

  const handleManualAssign = async (e) => {
    e.preventDefault();
    if (!selectedSeqId || !selectedContactIds.length) {
      toast.error('Please select a sequence and at least one contact');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/sequences/assign', {
        sequenceId: selectedSeqId,
        contactIds: selectedContactIds
      });

      if (data.success) {
        toast.success('Sequence successfully assigned to selected contacts');
        setIsAssignModalOpen(false);
        setSelectedContactIds([]);
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to assign sequence');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectContactToggle = (id) => {
    if (selectedContactIds.includes(id)) {
      setSelectedContactIds(prev => prev.filter(cid => cid !== id));
    } else {
      setSelectedContactIds(prev => [...prev, id]);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Clock className="w-6 h-6 text-wa-green" /> Drip sequences & campaigns
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Design drip message schedules, assign trigger tags, or manually schedule sequences for target customer groups.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedSeqId(''); setSelectedContactIds([]); setIsAssignModalOpen(true); }}
            className="btn-secondary py-2 text-xs flex items-center gap-1.5 font-semibold"
          >
            <Users className="w-3.5 h-3.5" />
            Assign Contacts
          </button>
          <button
            onClick={() => { setEditingSeqId(null); setSeqForm({ name: '', triggerTag: '', messages: [{ delayValue: 1, delayUnit: 'days', templateId: '', templateName: '' }] }); setIsSeqModalOpen(true); }}
            className="btn-primary py-2 text-xs flex items-center gap-1.5 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            New Sequence
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SEQUENCES LISTING */}
        <div className="glass-card p-6 lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">Configured Sequences</h3>
          {loading ? (
            <div className="py-12 text-center text-wa-text-secondary flex items-center justify-center gap-1.5 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-wa-green" /> Loading sequences...
            </div>
          ) : sequences.length === 0 ? (
            <p className="text-xs text-wa-text-secondary italic py-12 text-center">No sequences configured. Click "New Sequence" to build a drip schedule.</p>
          ) : (
            <div className="space-y-4">
              {sequences.map(seq => (
                <div key={seq._id} className="p-4 rounded-xl border border-wa-border dark:border-wa-dark-border bg-wa-bg/25 dark:bg-wa-dark-header/20 flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-wa-text-primary dark:text-white uppercase tracking-wider">{seq.name}</span>
                      {seq.triggerTag && (
                        <span className="bg-wa-green/10 text-wa-green text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border border-wa-green/20">
                          Tag: {seq.triggerTag}
                        </span>
                      )}
                    </div>
                    {/* Drip steps trail */}
                    <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-wa-text-secondary">
                      {seq.messages.map((msg, mIdx) => (
                        <div key={mIdx} className="flex items-center gap-1 bg-wa-panel dark:bg-wa-dark-panel px-2.5 py-1 rounded-lg border border-wa-border dark:border-wa-dark-border shadow-sm">
                          <Clock className="w-3 h-3 text-wa-green" />
                          <span>{msg.delayValue} {msg.delayUnit}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-semibold">{msg.templateName}</span>
                          {mIdx < seq.messages.length - 1 && <span className="text-wa-green ml-2 font-bold font-sans">→</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button onClick={() => handleEditSequence(seq)} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDeleteSequence(seq._id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SEQUENCES EXECUTION LOG */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <History className="w-4 h-4 text-wa-green" /> Execution logs history
          </h3>
          {loading ? (
            <div className="py-8 text-center text-wa-text-secondary flex items-center justify-center gap-1.5 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-wa-green" /> Loading execution logs...
            </div>
          ) : executions.length === 0 ? (
            <p className="text-xs text-wa-text-secondary italic py-8 text-center">No active or completed drip sequences log.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {executions.map(exec => (
                <div key={exec._id} className="p-3 rounded-xl bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-wa-text-primary dark:text-white capitalize">{exec.sequenceId?.name || 'Deleted Sequence'}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      exec.status === 'completed' ? 'bg-green-50 text-green-600 dark:bg-green-950/20' :
                      exec.status === 'running' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 animate-pulse' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {exec.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-wa-text-secondary dark:text-wa-dark-text-secondary">
                      Contact: <span className="font-semibold text-wa-text-primary dark:text-white">{exec.contactId?.name || 'Unknown'} ({exec.contactId?.phone})</span>
                    </p>
                    {exec.status === 'running' && (
                      <p className="text-[10px] text-wa-text-light flex items-center gap-1.5 mt-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        Next step due: {new Date(exec.scheduledAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NEW/EDIT SEQUENCE MODAL */}
      {isSeqModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh] shadow-wa-lg">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-wa-green" /> {editingSeqId ? 'Edit Drip Sequence' : 'Create Drip Sequence'}
              </h3>
              <button onClick={() => setIsSeqModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleSeqSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Sequence Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 7-Day Customer Onboarding"
                    value={seqForm.name}
                    onChange={(e) => setSeqForm({ ...seqForm, name: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Trigger Tag (Optional)</label>
                  <select
                    value={seqForm.triggerTag}
                    onChange={(e) => setSeqForm({ ...seqForm, triggerTag: e.target.value })}
                    className="input-field py-2 text-xs"
                  >
                    <option value="">No tag trigger linked</option>
                    {tags.map(t => (
                      <option key={t._id} value={t.name}>{t.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Drip steps builder */}
              <div className="space-y-4 pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-wa-text-secondary uppercase">Drip Message Steps ({seqForm.messages.length})</span>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="text-xs text-wa-green hover:underline flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Step
                  </button>
                </div>

                <div className="space-y-3">
                  {seqForm.messages.map((step, idx) => (
                    <div key={idx} className="bg-wa-bg/35 dark:bg-wa-dark-header/40 p-4 rounded-xl border border-wa-border dark:border-wa-dark-border relative space-y-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="absolute right-3 top-3 text-wa-text-light hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <span className="block text-xs font-bold text-wa-text-primary dark:text-white">Step #{idx + 1}</span>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-wa-text-secondary mb-1 uppercase">Delay Duration *</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={step.delayValue}
                            onChange={(e) => handleStepFieldChange(idx, 'delayValue', parseInt(e.target.value) || 1)}
                            className="input-field py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-wa-text-secondary mb-1 uppercase">Delay Unit *</label>
                          <select
                            value={step.delayUnit}
                            onChange={(e) => handleStepFieldChange(idx, 'delayUnit', e.target.value)}
                            className="input-field py-1 text-xs"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-wa-text-secondary mb-1 uppercase">Select Template *</label>
                          <select
                            value={step.templateId}
                            onChange={(e) => handleStepFieldChange(idx, 'templateId', e.target.value)}
                            required
                            className="input-field py-1 text-xs"
                          >
                            <option value="">Choose template...</option>
                            {templates.map(t => (
                              <option key={t._id} value={t._id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button type="button" onClick={() => setIsSeqModalOpen(false)} className="btn-secondary py-2 text-xs px-4" disabled={submitting}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Sequence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL ASSIGN MODAL */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col max-h-[85vh] shadow-wa-lg">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <Users className="w-5 h-5 text-wa-green" /> Assign Drip Sequence
              </h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleManualAssign} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Select Sequence *</label>
                <select
                  value={selectedSeqId}
                  onChange={(e) => setSelectedSeqId(e.target.value)}
                  required
                  className="input-field py-2 text-xs"
                >
                  <option value="">Choose sequence...</option>
                  {sequences.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Select Contacts *</label>
                {contacts.length === 0 ? (
                  <p className="text-xs text-wa-text-secondary italic">No contacts found in database.</p>
                ) : (
                  <div className="border border-wa-border dark:border-wa-dark-border rounded-xl max-h-[250px] overflow-y-auto divide-y divide-wa-border/50 dark:divide-wa-dark-border/50 p-2 space-y-1 bg-wa-bg/20 dark:bg-slate-900/10 scrollbar-thin">
                    {contacts.map(c => {
                      const isSelected = selectedContactIds.includes(c._id);
                      return (
                        <div
                          key={c._id}
                          onClick={() => handleSelectContactToggle(c._id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs ${
                            isSelected ? 'bg-wa-green/10 text-wa-green font-semibold' : 'hover:bg-wa-hover text-wa-text-primary dark:text-white'
                          }`}
                        >
                          <div>
                            <p className="font-bold">{c.name || 'Unknown'}</p>
                            <p className="text-[10px] text-wa-text-light font-mono mt-0.5">{c.phone}</p>
                          </div>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'border-wa-green bg-wa-green text-white' : 'border-wa-border'}`}>
                            {isSelected && <span className="text-[10px]">✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="btn-secondary py-2 text-xs px-4" disabled={submitting}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Assign Sequence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
