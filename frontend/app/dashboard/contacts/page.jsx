'use client';
import { useState, useEffect } from 'react';
import ContactTable from '../../../components/ContactTable';
import api from '../../../lib/api';
import { toast } from 'react-hot-toast';
import { Tag as TagIcon, Users, Play, Plus, Trash2, X, Sparkles, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState('contacts'); // 'contacts', 'tags', 'rules'
  
  // Tags and Rules states
  const [tags, setTags] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Tag Form state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  // New Rule Form state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    ruleName: '',
    triggerType: 'keyword',
    triggerValue: '',
    tagToAssign: '',
  });

  const fetchTagsAndRules = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tags');
      if (data.success) {
        setTags(data.data.tags);
        setRules(data.data.rules);
      }
    } catch (err) {
      toast.error('Failed to load tags and rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'contacts') {
      fetchTagsAndRules();
    }
  }, [activeTab]);

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    
    setSubmitting(true);
    try {
      const { data } = await api.post('/tags', {
        name: newTagName.trim(),
        color: newTagColor
      });
      if (data.success) {
        toast.success('Tag created successfully');
        setNewTagName('');
        fetchTagsAndRules();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create tag');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTag = async (name) => {
    if (!confirm(`Are you sure you want to delete tag "${name}"? This will remove it from all contacts.`)) return;

    try {
      const { data } = await api.delete(`/tags/${name}`);
      if (data.success) {
        toast.success('Tag deleted successfully');
        fetchTagsAndRules();
      }
    } catch (err) {
      toast.error('Failed to delete tag');
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    const { ruleName, triggerType, triggerValue, tagToAssign } = newRule;
    if (!ruleName || !triggerValue || !tagToAssign) {
      toast.error('Please fill in all rule fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/tags/rules', newRule);
      if (data.success) {
        toast.success('Auto-tag rule created successfully');
        setNewRule({ ruleName: '', triggerType: 'keyword', triggerValue: '', tagToAssign: '' });
        setIsRuleModalOpen(false);
        fetchTagsAndRules();
      }
    } catch (err) {
      toast.error('Failed to create auto-tag rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRule = async (id, isActive) => {
    try {
      const { data } = await api.put(`/tags/rules/${id}`, { isActive: !isActive });
      if (data.success) {
        toast.success('Rule status updated');
        fetchTagsAndRules();
      }
    } catch (err) {
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { data } = await api.delete(`/tags/rules/${id}`);
      if (data.success) {
        toast.success('Rule deleted successfully');
        fetchTagsAndRules();
      }
    } catch (err) {
      toast.error('Failed to delete rule');
    }
  };

  const colorsPreset = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header and Pill Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Contacts & Audience</h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Manage your customer database, labels/tags, and configure tag automation rules.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-wa-panel-header dark:bg-wa-dark-panel-header p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'contacts'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary hover:bg-wa-hover'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Contacts List
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'tags'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary hover:bg-wa-hover'
            }`}
          >
            <TagIcon className="w-3.5 h-3.5" />
            Manage Tags
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'bg-wa-green text-white shadow-sm'
                : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary hover:bg-wa-hover'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Auto-Tag Rules
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeTab === 'contacts' && (
        <ContactTable />
      )}

      {activeTab === 'tags' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create tag */}
          <div className="glass-card p-6 h-fit space-y-4">
            <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">Create New Tag</h3>
            <form onSubmit={handleAddTag} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Tag Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Customer"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="input-field py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Color Hex</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-10 h-10 p-0 border border-wa-border dark:border-wa-dark-border rounded-xl cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    required
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="input-field py-2 text-xs flex-1"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {colorsPreset.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      className="w-6 h-6 rounded-full border border-white dark:border-slate-800"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add Tag to Library
              </button>
            </form>
          </div>

          {/* List tags */}
          <div className="glass-card p-6 lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">Central Tags Library</h3>
            {loading ? (
              <div className="py-12 text-center text-wa-text-secondary flex items-center justify-center gap-1.5 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-wa-green" /> Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <p className="text-xs text-wa-text-secondary italic py-12 text-center">No tags in the library. Create one to classify contacts.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {tags.map(tag => (
                  <span
                    key={tag._id}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-wa-border dark:border-wa-dark-border bg-wa-panel shadow-sm hover:scale-[1.02] transition-all"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="capitalize text-wa-text-primary dark:text-white">{tag.name}</span>
                    <button
                      onClick={() => handleDeleteTag(tag.name)}
                      className="hover:text-red-500 font-bold ml-1 transition-colors text-sm text-wa-text-secondary shrink-0"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">Auto-Tag Rules</h3>
            <button onClick={() => setIsRuleModalOpen(true)} className="btn-primary py-2 text-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Create Rule
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-wa-text-secondary flex items-center justify-center gap-1.5 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-wa-green" /> Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <p className="text-xs text-wa-text-secondary italic py-12 text-center">No tag rules defined. Add a rule to auto-tag contacts dynamically.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-wa-border dark:border-wa-dark-border text-wa-text-secondary uppercase text-[10px] tracking-wider bg-wa-panel-header/50 dark:bg-wa-dark-panel-header/20">
                    <th className="py-3 px-4 font-bold">Rule Name</th>
                    <th className="py-3 px-4 font-bold">Trigger</th>
                    <th className="py-3 px-4 font-bold">Value Match</th>
                    <th className="py-3 px-4 font-bold">Assign Tag</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border">
                  {rules.map(rule => (
                    <tr key={rule._id} className="hover:bg-wa-hover/30 dark:hover:bg-wa-dark-hover/10 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-wa-text-primary dark:text-white">{rule.ruleName}</td>
                      <td className="py-3.5 px-4 text-wa-text-secondary dark:text-wa-dark-text-secondary capitalize font-semibold">
                        {rule.triggerType === 'keyword' ? 'Message Keyword' : 'Contact Source'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-wa-green bg-wa-green/5 dark:bg-wa-green/10 px-2 py-0.5 rounded inline-block mt-2">
                        {rule.triggerValue}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-wa-border dark:border-wa-dark-border bg-wa-bg/30 dark:bg-wa-dark-header/40 rounded-full font-bold capitalize">
                          <span className="w-1.5 h-1.5 rounded-full bg-wa-green" />
                          {rule.tagToAssign}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button onClick={() => handleToggleRule(rule._id, rule.isActive)} className="text-wa-text-secondary hover:text-wa-text-primary">
                          {rule.isActive ? (
                            <ToggleRight className="w-6 h-6 text-wa-green" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-wa-text-light" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule._id)}
                          className="w-7 h-7 inline-flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE RULE MODAL */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden animate-slide-up flex flex-col max-h-[85vh] shadow-wa-lg">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-wa-green" /> Configure Auto-Tag Rule
              </h3>
              <button onClick={() => setIsRuleModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Label Trigger"
                  value={newRule.ruleName}
                  onChange={(e) => setNewRule({ ...newRule, ruleName: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Trigger Condition *</label>
                <select
                  value={newRule.triggerType}
                  onChange={(e) => setNewRule({ ...newRule, triggerType: e.target.value, triggerValue: '' })}
                  className="input-field py-2 text-xs"
                >
                  <option value="keyword">Message Keyword Contains</option>
                  <option value="source">Contact Signup Source Equals</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Trigger Value Match *</label>
                {newRule.triggerType === 'source' ? (
                  <select
                    value={newRule.triggerValue}
                    onChange={(e) => setNewRule({ ...newRule, triggerValue: e.target.value })}
                    required
                    className="input-field py-2 text-xs"
                  >
                    <option value="">Select signup source...</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="website">Website</option>
                    <option value="direct">Direct WABA inbound</option>
                    <option value="manual">Manual Input</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="e.g. buy, price, help, details"
                    value={newRule.triggerValue}
                    onChange={(e) => setNewRule({ ...newRule, triggerValue: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Assign Tag Label *</label>
                <select
                  value={newRule.tagToAssign}
                  onChange={(e) => setNewRule({ ...newRule, tagToAssign: e.target.value })}
                  required
                  className="input-field py-2 text-xs"
                >
                  <option value="">Select tag to assign...</option>
                  {tags.map(t => (
                    <option key={t._id} value={t.name}>{t.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button type="button" onClick={() => setIsRuleModalOpen(false)} className="btn-secondary py-2 text-xs px-4" disabled={submitting}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Auto-Tag Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
