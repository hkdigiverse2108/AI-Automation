'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Users2, Plus, Trash2, Edit3, Shield, Mail, Key,
  Sparkles, Loader2, Play, ToggleLeft, ToggleRight, X, UserCheck,
  Clock, Activity, Inbox, MessageSquare
} from 'lucide-react';
import api from '../../../lib/api';

export default function TeamPage() {
  const [agents, setAgents] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Tab & Telemetry Monitoring States
  const [activeTab, setActiveTab] = useState('members'); // 'members' or 'monitoring'
  const [monitoringData, setMonitoringData] = useState(null);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);

  // Modal states
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState(null);
  const [agentForm, setAgentForm] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    mobileNumber: '',
    username: '',
    department: '',
    designation: '',
    shiftTiming: '',
    status: 'active'
  });

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    ruleName: '',
    triggerType: 'all',
    triggerValue: '',
    agentId: ''
  });

  const fetchMonitoringStats = async () => {
    setLoadingMonitoring(true);
    try {
      const { data } = await api.get('/team/monitoring-stats');
      if (data.success) {
        setMonitoringData(data.data);
      }
    } catch (err) {
      // Fail silently to prevent spamming during poll
    } finally {
      setLoadingMonitoring(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monitoring') {
      fetchMonitoringStats();
      const interval = setInterval(fetchMonitoringStats, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleToggleSuspend = async (agent) => {
    try {
      const nextStatus = !agent.isSuspended;
      const { data } = await api.put(`/team/agents/${agent._id}`, { isSuspended: nextStatus });
      if (data.success) {
        toast.success(nextStatus ? 'Agent login disabled' : 'Agent login enabled');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle status');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/team');
      if (data.success) {
        setAgents(data.data.agents);
        setRules(data.data.rules);
      }
    } catch (err) {
      toast.error('Failed to load team details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAgentSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password } = agentForm;
    if (!name || !email || (!editingAgentId && !password)) {
      toast.error('Please fill in all agent fields');
      return;
    }

    setSubmitting(true);
    try {
      let res;
      if (editingAgentId) {
        res = await api.put(`/team/agents/${editingAgentId}`, {
          name,
          email,
          ...(password ? { password } : {}),
          employeeId: agentForm.employeeId,
          mobileNumber: agentForm.mobileNumber,
          username: agentForm.username,
          department: agentForm.department,
          designation: agentForm.designation,
          shiftTiming: agentForm.shiftTiming,
          status: agentForm.status
        });
      } else {
        res = await api.post('/team/agents', agentForm);
      }

      if (res.data.success) {
        toast.success(editingAgentId ? 'Agent updated' : 'Agent created');
        setIsAgentModalOpen(false);
        setEditingAgentId(null);
        setAgentForm({
          name: '',
          email: '',
          password: '',
          employeeId: '',
          mobileNumber: '',
          username: '',
          department: '',
          designation: '',
          shiftTiming: '',
          status: 'active'
        });
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit agent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAgent = (agent) => {
    setEditingAgentId(agent._id);
    setAgentForm({
      name: agent.name,
      email: agent.email,
      password: '',
      employeeId: agent.employeeId || '',
      mobileNumber: agent.mobileNumber || '',
      username: agent.username || '',
      department: agent.department || '',
      designation: agent.designation || '',
      shiftTiming: agent.shiftTiming || '',
      status: agent.status || 'active'
    });
    setIsAgentModalOpen(true);
  };

  const handleDeleteAgent = async (id) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      const { data } = await api.delete(`/team/agents/${id}`);
      if (data.success) {
        toast.success('Agent deleted');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to delete agent');
    }
  };

  const handleRuleSubmit = async (e) => {
    e.preventDefault();
    const { ruleName, triggerType, triggerValue, agentId } = ruleForm;
    if (!ruleName || !agentId) {
      toast.error('Please fill in all rule fields');
      return;
    }

    setSubmitting(true);
    try {
      let res;
      if (editingRuleId) {
        res = await api.put(`/team/rules/${editingRuleId}`, ruleForm);
      } else {
        res = await api.post('/team/rules', ruleForm);
      }

      if (res.data.success) {
        toast.success(editingRuleId ? 'Routing rule updated' : 'Routing rule created');
        setIsRuleModalOpen(false);
        setEditingRuleId(null);
        setRuleForm({ ruleName: '', triggerType: 'all', triggerValue: '', agentId: '' });
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRule = (rule) => {
    setEditingRuleId(rule._id);
    setRuleForm({
      ruleName: rule.ruleName,
      triggerType: rule.triggerType,
      triggerValue: rule.triggerValue || '',
      agentId: rule.agentId?._id || rule.agentId
    });
    setIsRuleModalOpen(true);
  };

  const handleToggleRule = async (rule) => {
    try {
      const { data } = await api.put(`/team/rules/${rule._id}`, { isActive: !rule.isActive });
      if (data.success) {
        toast.success('Rule status updated');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const { data } = await api.delete(`/team/rules/${id}`);
      if (data.success) {
        toast.success('Rule deleted');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to delete rule');
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Users2 className="w-6 h-6 text-wa-green" /> Team Management
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Add team members, assign agent access levels, and build routing rules to auto-assign inbox conversations.
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-wa-border dark:border-wa-dark-border gap-2">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'members'
              ? 'border-wa-green text-wa-green'
              : 'border-transparent text-wa-text-secondary hover:text-wa-text-primary'
          }`}
        >
          Members & Routing
        </button>
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'monitoring'
              ? 'border-wa-green text-wa-green'
              : 'border-transparent text-wa-text-secondary hover:text-wa-text-primary'
          }`}
        >
          Monitoring & Performance
        </button>
      </div>

      {activeTab === 'members' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* TEAM MEMBERS PANEL */}
          <div className="glass-card p-6 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">Team Members / Agents</h3>
              <button
                onClick={() => {
                  setEditingAgentId(null);
                  setAgentForm({
                    name: '',
                    email: '',
                    password: '',
                    employeeId: '',
                    mobileNumber: '',
                    username: '',
                    department: '',
                    designation: '',
                    shiftTiming: '',
                    status: 'active'
                  });
                  setIsAgentModalOpen(true);
                }}
                className="btn-primary py-2 text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Member
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-wa-text-secondary flex items-center justify-center gap-1.5 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-wa-green" /> Loading team members...
              </div>
            ) : agents.length === 0 ? (
              <p className="text-xs text-wa-text-secondary italic py-12 text-center">No agents registered. Create agent accounts to collaborate.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-wa-border dark:border-wa-dark-border text-wa-text-secondary uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Agent</th>
                      <th className="py-3 px-3">Emp ID & Role</th>
                      <th className="py-3 px-3">Contact</th>
                      <th className="py-3 px-3">Shift & Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map(agent => (
                      <tr key={agent._id} className="border-b border-wa-border/50 dark:border-wa-dark-border/50 hover:bg-wa-hover/30 dark:hover:bg-wa-dark-hover/10 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-wa-green/10 text-wa-green flex items-center justify-center font-bold text-xs shrink-0">
                              {agent.name[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-wa-text-primary dark:text-white block truncate">{agent.name}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">@{agent.username || agent.email.split('@')[0]}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="min-w-0">
                            <span className="font-semibold text-wa-text-primary dark:text-slate-200 block text-[11px]">{agent.employeeId || 'N/A'}</span>
                            <span className="text-[10px] text-wa-text-secondary block mt-0.5 truncate">
                              {agent.designation || 'Agent'}{agent.department ? ` • ${agent.department}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="min-w-0">
                            <span className="text-wa-text-primary dark:text-slate-200 block text-[11px]">{agent.email}</span>
                            {agent.mobileNumber && (
                              <span className="text-[10px] text-wa-text-secondary block mt-0.5">{agent.mobileNumber}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-wa-text-secondary">
                              <Clock className="w-3 h-3 text-wa-green shrink-0" />
                              <span>{agent.shiftTiming || 'General'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {agent.isSuspended ? (
                                <span className="inline-block bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border border-red-200/25">Suspended</span>
                              ) : agent.status === 'inactive' ? (
                                <span className="inline-block bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border border-amber-200/25">Inactive</span>
                              ) : (
                                <span className="inline-block bg-emerald-50 text-wa-green dark:bg-emerald-950/20 dark:text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border border-wa-green/20">Active</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => handleToggleSuspend(agent)} 
                              className={`p-1.5 rounded-lg transition-colors ${agent.isSuspended ? 'text-slate-400 hover:text-wa-green animate-pulse' : 'text-wa-green hover:bg-wa-green/5'}`}
                              title={agent.isSuspended ? "Enable Agent Account" : "Disable Agent Account"}
                            >
                              {agent.isSuspended ? <ToggleLeft className="w-5 h-5 text-slate-400" /> : <ToggleRight className="w-5 h-5 text-wa-green" />}
                            </button>
                            <button onClick={() => handleEditAgent(agent)} className="p-1.5 hover:bg-wa-bg rounded-lg text-wa-text-secondary">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteAgent(agent._id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AUTO ROUTING RULES PANEL */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">Auto routing rules</h3>
              <button
                onClick={() => { setEditingRuleId(null); setRuleForm({ ruleName: '', triggerType: 'all', triggerValue: '', agentId: '' }); setIsRuleModalOpen(true); }}
                className="btn-secondary py-2 text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Rule
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-wa-text-secondary flex items-center justify-center gap-1.5 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-wa-green" /> Loading rules...
              </div>
            ) : rules.length === 0 ? (
              <p className="text-xs text-wa-text-secondary italic py-8 text-center">No routing rules configured. Default is bot handling.</p>
            ) : (
              <div className="space-y-3">
                {rules.map(rule => (
                  <div key={rule._id} className="p-3.5 rounded-xl border border-wa-border dark:border-wa-dark-border bg-wa-panel shadow-sm space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-wa-text-primary dark:text-white">{rule.ruleName}</p>
                        <p className="text-[10px] text-wa-text-secondary mt-0.5">
                          Trigger: <span className="font-semibold capitalize">{rule.triggerType}</span>
                          {rule.triggerValue && ` (${rule.triggerValue})`}
                        </p>
                      </div>
                      <button onClick={() => handleToggleRule(rule)} className="text-wa-text-secondary">
                        {rule.isActive ? <ToggleRight className="w-5 h-5 text-wa-green" /> : <ToggleLeft className="w-5 h-5 text-wa-text-light" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between border-t border-wa-border/50 dark:border-wa-dark-border/50 pt-2 text-[10px]">
                      <span className="text-wa-text-secondary flex items-center gap-1 font-semibold">
                        <UserCheck className="w-3.5 h-3.5 text-wa-green" /> {rule.agentId?.name || 'Unassigned'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleEditRule(rule)} className="text-wa-text-secondary hover:text-wa-text-primary">Edit</button>
                        <span className="text-slate-300">·</span>
                        <button onClick={() => handleDeleteRule(rule._id)} className="text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MONITORING & PERFORMANCE DASHBOARD */
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold uppercase tracking-widest">Unassigned Chats</p>
                <p className="text-3xl font-extrabold text-purple-600 mt-1">{monitoringData?.totalUnassigned ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/20 rounded-xl flex items-center justify-center text-purple-500">
                <Inbox className="w-6 h-6" />
              </div>
            </div>
            <div className="glass-card p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold uppercase tracking-widest">Active Telecallers</p>
                <p className="text-3xl font-extrabold text-wa-green mt-1">{monitoringData?.activeTelecallers ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl flex items-center justify-center text-wa-green">
                <Users2 className="w-6 h-6" />
              </div>
            </div>
            <div className="glass-card p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold uppercase tracking-widest">Assigned Conversations</p>
                <p className="text-3xl font-extrabold text-blue-500 mt-1">{monitoringData?.totalAssignedActive ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/20 rounded-xl flex items-center justify-center text-blue-500">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AGENT PERFORMANCE TABLE */}
            <div className="glass-card p-6 lg:col-span-2 space-y-4">
              <h3 className="text-xs font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2 uppercase tracking-widest">
                <Activity className="w-4 h-4 text-wa-green" /> Telecaller Performance
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-wa-border dark:border-wa-dark-border text-wa-text-secondary uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-2">Name</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-center">Active Chats</th>
                      <th className="py-3 px-2 text-center">Resolved Chats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingMonitoring && !monitoringData ? (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-slate-400">Loading performance data...</td>
                      </tr>
                    ) : !monitoringData?.performance?.length ? (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-slate-400 italic">No agents registered.</td>
                      </tr>
                    ) : (
                      monitoringData.performance.map(p => (
                        <tr key={p._id} className="border-b border-wa-border/50 dark:border-wa-dark-border/50 hover:bg-wa-hover/30 dark:hover:bg-wa-dark-hover/10">
                          <td className="py-3 px-2">
                            <span className="font-semibold text-wa-text-primary dark:text-white block">{p.name}</span>
                            <span className="text-[10px] text-wa-text-secondary block mt-0.5">{p.email}</span>
                          </td>
                          <td className="py-3 px-2">
                            {p.isSuspended ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400 border border-red-150/30 uppercase">Disabled</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-wa-green dark:bg-emerald-950/20 dark:text-emerald-400 border border-wa-green/20 uppercase">Active</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-blue-500">{p.activeChats}</td>
                          <td className="py-3 px-2 text-center font-bold text-wa-green">{p.resolvedChats}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TAKEOVER HISTORY AUDIT STREAM */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-xs font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2 uppercase tracking-widest">
                <Clock className="w-4 h-4 text-purple-500" /> Recent Takeover Log
              </h3>
              
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                {loadingMonitoring && !monitoringData ? (
                  <p className="text-xs text-center text-slate-400 py-8">Loading history...</p>
                ) : !monitoringData?.takeoverHistory?.length ? (
                  <p className="text-xs text-center text-slate-400 italic py-8">No assignment history logged.</p>
                ) : (
                  monitoringData.takeoverHistory.map((log, idx) => {
                    let badgeColor = 'bg-slate-100 text-slate-700';
                    let logText = log.action;
                    
                    if (log.action === 'ASSIGN_CONVERSATION') {
                      badgeColor = 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
                      logText = 'Take Over';
                    } else if (log.action === 'REASSIGN_CONVERSATION') {
                      badgeColor = 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30';
                      logText = 'Reassigned';
                    } else if (log.action === 'RELEASE_CONVERSATION') {
                      badgeColor = 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
                      logText = 'Returned to Bot';
                    } else if (log.action === 'AI_RESUME') {
                      badgeColor = 'bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30';
                      logText = 'AI Resumed';
                    } else if (log.action === 'RESOLVE_CONVERSATION') {
                      badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
                      logText = 'Resolved';
                    } else if (log.action === 'AGENT_MESSAGE_SENT') {
                      badgeColor = 'bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30';
                      logText = 'Msg Sent';
                    }

                    return (
                      <div key={log._id || idx} className="p-3 rounded-xl bg-wa-bg/30 dark:bg-wa-dark-header/20 border border-wa-border dark:border-wa-dark-border space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-wa-text-primary dark:text-white truncate">{log.actorName || 'System'}</span>
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeColor}`}>{logText}</span>
                        </div>
                        <p className="text-[9px] text-wa-text-secondary truncate">Ref Chat ID: {log.resourceId || 'N/A'}</p>
                        <span className="text-[8px] text-wa-text-light block text-right font-mono mt-0.5">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER CREATE/EDIT MODAL */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col shadow-wa-lg">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-wa-green" /> {editingAgentId ? 'Edit Team Agent' : 'Create Agent Account'}
              </h3>
              <button onClick={() => setIsAgentModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleAgentSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Parth Prince"
                    value={agentForm.name}
                    onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. parth_prince"
                    value={agentForm.username}
                    onChange={(e) => setAgentForm({ ...agentForm, username: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. parth@company.com"
                    value={agentForm.email}
                    onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +919876543210"
                    value={agentForm.mobileNumber}
                    onChange={(e) => setAgentForm({ ...agentForm, mobileNumber: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP102"
                    value={agentForm.employeeId}
                    onChange={(e) => setAgentForm({ ...agentForm, employeeId: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">
                    {editingAgentId ? 'New Password (Optional)' : 'Default Password *'}
                  </label>
                  <input
                    type="password"
                    required={!editingAgentId}
                    placeholder={editingAgentId ? 'Leave blank to keep same' : 'Minimum 8 characters'}
                    value={agentForm.password}
                    onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Customer Support"
                    value={agentForm.department}
                    onChange={(e) => setAgentForm({ ...agentForm, department: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Executive"
                    value={agentForm.designation}
                    onChange={(e) => setAgentForm({ ...agentForm, designation: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Shift Timing</label>
                  <input
                    type="text"
                    placeholder="e.g. 09:00 AM - 06:00 PM"
                    value={agentForm.shiftTiming}
                    onChange={(e) => setAgentForm({ ...agentForm, shiftTiming: e.target.value })}
                    className="input-field py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Status *</label>
                  <select
                    value={agentForm.status}
                    onChange={(e) => setAgentForm({ ...agentForm, status: e.target.value })}
                    className="input-field py-2 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button type="button" onClick={() => setIsAgentModalOpen(false)} className="btn-secondary py-2 text-xs px-4" disabled={submitting}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingAgentId ? 'Save Agent' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RULE CREATE/EDIT MODAL */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden animate-slide-up flex flex-col shadow-wa-lg">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-wa-green" /> {editingRuleId ? 'Edit Routing Rule' : 'Create Routing Rule'}
              </h3>
              <button onClick={() => setIsRuleModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleRuleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Rule Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Route website requests to Parth"
                  value={ruleForm.ruleName}
                  onChange={(e) => setRuleForm({ ...ruleForm, ruleName: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Trigger Condition *</label>
                <select
                  value={ruleForm.triggerType}
                  onChange={(e) => setRuleForm({ ...ruleForm, triggerType: e.target.value, triggerValue: '' })}
                  className="input-field py-2 text-xs"
                >
                  <option value="all">Match all incoming conversations</option>
                  <option value="keyword">Keyword in text message</option>
                  <option value="source">Specific customer signup source</option>
                </select>
              </div>

              {ruleForm.triggerType !== 'all' && (
                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Trigger Value Match *</label>
                  {ruleForm.triggerType === 'source' ? (
                    <select
                      value={ruleForm.triggerValue}
                      onChange={(e) => setRuleForm({ ...ruleForm, triggerValue: e.target.value })}
                      required
                      className="input-field py-2 text-xs"
                    >
                      <option value="">Select source...</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="website">Website</option>
                      <option value="direct">Direct WABA</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="e.g. price, booking, support"
                      value={ruleForm.triggerValue}
                      onChange={(e) => setRuleForm({ ...ruleForm, triggerValue: e.target.value })}
                      className="input-field py-2 text-xs"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5 uppercase">Assign Conversation To *</label>
                <select
                  value={ruleForm.agentId}
                  onChange={(e) => setRuleForm({ ...ruleForm, agentId: e.target.value })}
                  required
                  className="input-field py-2 text-xs"
                >
                  <option value="">Select agent...</option>
                  {agents.map(a => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button type="button" onClick={() => setIsRuleModalOpen(false)} className="btn-secondary py-2 text-xs px-4" disabled={submitting}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5">
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingRuleId ? 'Save Rule' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
