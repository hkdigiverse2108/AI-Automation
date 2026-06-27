'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  Search, RefreshCw, Copy, Shield, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Check, X, Users, Loader2
} from 'lucide-react';

const SECTIONS = ['MAIN', 'MARKETING', 'AUTOMATION', 'INSIGHTS', 'SYSTEM'];
const SECTION_COLORS = {
  MAIN: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  MARKETING: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  AUTOMATION: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  INSIGHTS: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  SYSTEM: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

export default function AgentPermissionsTab() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState(SECTIONS);
  const [copyFrom, setCopyFrom] = useState('');
  const [dirty, setDirty] = useState(false);

  // Fetch agents
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/team');
      if (data.success) {
        setAgents(data.data.agents);
      }
    } catch (err) {
      toast.error('Failed to load agents list');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load permissions for selected agent
  const loadPermissions = useCallback(async (agentId) => {
    try {
      const { data } = await api.get(`/team/permissions/${agentId}`);
      if (data.success) {
        setPermissions(data.data.permissions);
        setDirty(false);
      }
    } catch (err) {
      toast.error('Failed to load permissions');
    }
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      loadPermissions(selectedAgent._id);
    }
  }, [selectedAgent, loadPermissions]);

  // Toggle a single permission
  const togglePermission = (featureId) => {
    setPermissions(prev => prev.map(p =>
      p._id === featureId ? { ...p, can_view: !p.can_view } : p
    ));
    setDirty(true);
  };

  // Enable/Disable all
  const setAll = (value) => {
    setPermissions(prev => prev.map(p => ({ ...p, can_view: value })));
    setDirty(true);
  };

  // Save permissions
  const handleSave = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      const payload = permissions.map(p => ({
        feature_id: p._id,
        can_view: p.can_view,
      }));
      const { data } = await api.post(`/team/permissions/${selectedAgent._id}`, { permissions: payload });
      if (data.success) {
        toast.success('Agent permissions saved!');
        setDirty(false);
      }
    } catch (err) {
      toast.error('Failed to save permissions');
    }
    setSaving(false);
  };

  // Copy permissions from another agent
  const handleCopy = async () => {
    if (!copyFrom || !selectedAgent) return;
    setSaving(true);
    try {
      const { data } = await api.post('/team/permissions/copy', {
        sourceAgentId: copyFrom,
        targetAgentId: selectedAgent._id,
      });
      if (data.success) {
        toast.success('Permissions copied successfully!');
        await loadPermissions(selectedAgent._id);
        setCopyFrom('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to copy permissions');
    }
    setSaving(false);
  };

  // Toggle section expand
  const toggleSection = (section) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  // Filter agents by search
  const filteredAgents = agents.filter(a =>
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group permissions by section and filter
  const groupedPermissions = SECTIONS.map(section => ({
    section,
    features: permissions.filter(p =>
      p.section === section &&
      (p.name?.toLowerCase().includes(moduleSearch.toLowerCase()) ||
       p.slug?.toLowerCase().includes(moduleSearch.toLowerCase()))
    ),
  })).filter(g => g.features.length > 0);

  // Stats
  const enabledCount = permissions.filter(p => p.can_view).length;
  const totalCount = permissions.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24">
        <RefreshCw className="w-8 h-8 animate-spin text-wa-green mb-2" />
        <p className="text-sm text-wa-text-secondary font-medium">Loading agents list...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Agent List Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-card overflow-hidden">
            <div className="p-3 border-b border-wa-border dark:border-wa-dark-border bg-wa-hover/10">
              <h3 className="text-xs font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-wa-green" />
                Team Agents ({agents.length})
              </h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-text-secondary" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-wa-panel dark:bg-wa-dark-panel dark:text-white border-wa-border dark:border-wa-dark-border focus:ring-1 focus:ring-wa-green outline-none"
                />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-wa-border/50 dark:divide-wa-dark-border/50">
              {filteredAgents.length === 0 ? (
                <p className="text-xs text-wa-text-secondary p-4 text-center italic">No agents found</p>
              ) : (
                filteredAgents.map(agent => (
                  <button
                    key={agent._id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-wa-hover/20 ${
                      selectedAgent?._id === agent._id
                        ? 'bg-wa-green/10 dark:bg-wa-green/20 border-l-2 border-wa-green'
                        : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-wa-green/10 text-wa-green flex items-center justify-center text-xs font-bold shrink-0">
                      {agent.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-wa-text-primary dark:text-white truncate">{agent.name}</p>
                      <p className="text-[10px] text-wa-text-secondary truncate">{agent.email}</p>
                    </div>
                    {agent.isSuspended && (
                      <span className="shrink-0 text-[8px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold uppercase">Disabled</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Permissions Panel */}
        <div className="lg:col-span-3">
          {!selectedAgent ? (
            <div className="glass-card p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <Shield className="w-12 h-12 text-wa-text-secondary mb-3 opacity-60" />
              <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">No Agent Selected</h3>
              <p className="text-xs text-wa-text-secondary mt-1 max-w-xs">
                Choose a team agent from the left sidebar to manage their platform permissions.
              </p>
            </div>
          ) : (
            <div className="glass-card flex flex-col min-h-[500px]">
              {/* Panel Header */}
              <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wa-hover/5">
                <div>
                  <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
                    Manage Permissions: <span className="text-wa-green">{selectedAgent.name}</span>
                  </h3>
                  <p className="text-[11px] text-wa-text-secondary mt-0.5">
                    Enabled: <span className="font-semibold text-wa-text-primary dark:text-white">{enabledCount} / {totalCount}</span> modules
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAll(true)}
                    className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-50 text-wa-green dark:bg-emerald-950/20 border border-wa-green/20 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-all"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={() => setAll(false)}
                    className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 text-red-650 dark:bg-red-950/20 border border-red-200/20 rounded hover:bg-red-100 dark:hover:bg-red-950/40 transition-all"
                  >
                    Disable All
                  </button>
                </div>
              </div>

              {/* Copy permissions helper */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/30 border-b border-wa-border dark:border-wa-dark-border flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-wa-text-secondary" />
                  <span className="text-[10px] text-wa-text-secondary font-medium">Copy permissions from:</span>
                  <select
                    value={copyFrom}
                    onChange={(e) => setCopyFrom(e.target.value)}
                    className="px-2 py-1 text-xs border rounded bg-white dark:bg-dark-800 dark:text-white border-wa-border dark:border-wa-dark-border outline-none focus:ring-1 focus:ring-wa-green"
                  >
                    <option value="">Select agent...</option>
                    {agents
                      .filter(a => a._id !== selectedAgent._id)
                      .map(a => (
                        <option key={a._id} value={a._id}>{a.name}</option>
                      ))}
                  </select>
                  <button
                    onClick={handleCopy}
                    disabled={!copyFrom || saving}
                    className="px-3 py-1 text-[10px] font-bold bg-wa-green text-white rounded hover:bg-wa-green/90 disabled:opacity-50 transition-all"
                  >
                    Copy
                  </button>
                </div>

                <div className="relative w-full md:w-48 shrink-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-wa-text-secondary" />
                  <input
                    type="text"
                    placeholder="Filter features..."
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 text-[10px] border rounded bg-white dark:bg-dark-850 dark:text-white border-wa-border dark:border-wa-dark-border outline-none focus:ring-1 focus:ring-wa-green"
                  />
                </div>
              </div>

              {/* Permissions Grid */}
              <div className="p-4 flex-1 overflow-y-auto space-y-4 max-h-[400px]">
                {groupedPermissions.length === 0 ? (
                  <p className="text-xs text-wa-text-secondary italic text-center py-12">No matching modules found</p>
                ) : (
                  groupedPermissions.map(({ section, features: sectionFeatures }) => (
                    <div key={section} className="border border-wa-border/50 dark:border-wa-dark-border/50 rounded-xl overflow-hidden shadow-sm">
                      <button
                        onClick={() => toggleSection(section)}
                        className="w-full flex items-center justify-between p-2.5 bg-wa-hover/5 hover:bg-wa-hover/10 text-[10px] font-bold text-wa-text-primary dark:text-white uppercase tracking-wider border-b border-wa-border/50 dark:border-wa-dark-border/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] ${SECTION_COLORS[section]}`}>
                            {section}
                          </span>
                          <span className="text-[10px] font-bold">({sectionFeatures.filter(f => f.can_view).length}/{sectionFeatures.length} Active)</span>
                        </div>
                        {expandedSections.includes(section) ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {expandedSections.includes(section) && (
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-wa-panel dark:bg-wa-dark-panel">
                          {sectionFeatures.map(feature => (
                            <div
                              key={feature._id}
                              onClick={() => togglePermission(feature._id)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between hover:scale-[1.01] ${
                                feature.can_view
                                  ? 'border-wa-green/20 bg-emerald-50/10 dark:bg-emerald-950/5'
                                  : 'border-wa-border bg-slate-50/30 dark:bg-slate-900/5 opacity-75'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  feature.can_view ? 'bg-wa-green/10 text-wa-green' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                }`}>
                                  <Shield className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-wa-text-primary dark:text-white truncate">{feature.name}</p>
                                  <p className="text-[9px] text-wa-text-secondary truncate">{feature.route}</p>
                                </div>
                              </div>

                              <button type="button" className="shrink-0 ml-2 focus:outline-none">
                                {feature.can_view ? (
                                  <ToggleRight className="w-6 h-6 text-wa-green" />
                                ) : (
                                  <ToggleLeft className="w-6 h-6 text-wa-text-light" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Panel Footer */}
              <div className="p-4 border-t border-wa-border dark:border-wa-dark-border bg-wa-hover/5 flex items-center justify-between">
                <div>
                  {dirty && (
                    <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      Unsaved changes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadPermissions(selectedAgent._id)}
                    disabled={!dirty || saving}
                    className="btn-secondary py-1.5 text-xs px-3 disabled:opacity-50"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="btn-primary py-1.5 text-xs px-4 flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
