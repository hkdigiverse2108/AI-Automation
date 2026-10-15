'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History, User, Clock, Shield, Edit3, Play, Pause, CalendarOff,
  Trash2, Plus, Search, Filter, Download, RefreshCw, CheckCircle2,
  AlertCircle, ArrowRight, Eye, Layers, Sparkles
} from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function CampaignActivityLogs({ campaigns = [], onRefreshCampaigns }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  // Fetch audit logs from backend
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/campaigns/logs?limit=100');
      if (data.success) {
        setLogs(data.data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch campaign logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Combine real audit logs with synthetic baseline entries from existing campaigns
  // This guarantees that past campaigns (created before audit log schema was deployed) still show creation and edit entries!
  const combinedLogs = useMemo(() => {
    const list = [...logs];

    // For campaigns that don't have explicit AuditLog entries yet:
    campaigns.forEach(c => {
      const cId = c._id?.toString();
      // If no CREATE_CAMPAIGN log exists for this campaign, synthesize one from campaign document
      const hasCreateLog = logs.some(l => l.resourceId === cId && l.action === 'CREATE_CAMPAIGN');
      if (!hasCreateLog && c.createdAt) {
        list.push({
          _id: `synth-create-${cId}`,
          resourceId: cId,
          resource: 'Campaign',
          action: 'CREATE_CAMPAIGN',
          actorName: c.createdByName || 'Admin',
          role: 'admin',
          timestamp: c.createdAt,
          newValue: {
            name: c.name,
            templateName: c.templateName,
            status: c.status,
            scheduledAt: c.scheduledAt,
            audienceType: c.audience?.type,
          },
          isSynthesized: true,
        });
      }

      // If campaign was updated after creation and has no EDIT_CAMPAIGN log
      const hasEditLog = logs.some(l => l.resourceId === cId && l.action === 'EDIT_CAMPAIGN');
      if (!hasEditLog && c.updatedAt && c.createdAt && new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 5000) {
        list.push({
          _id: `synth-edit-${cId}`,
          resourceId: cId,
          resource: 'Campaign',
          action: 'EDIT_CAMPAIGN',
          actorName: c.lastModifiedByName || 'Admin',
          role: 'admin',
          timestamp: c.updatedAt,
          newValue: {
            name: c.name,
            templateName: c.templateName,
            status: c.status,
            scheduledAt: c.scheduledAt,
          },
          isSynthesized: true,
        });
      }
    });

    // Sort descending by timestamp
    return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [logs, campaigns]);

  // Filter logs based on action and search
  const filteredLogs = useMemo(() => {
    return combinedLogs.filter(log => {
      // Action filter
      if (actionFilter !== 'all') {
        if (log.action !== actionFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const actorMatch = (log.actorName || '').toLowerCase().includes(q);
        const nameMatch = (log.newValue?.name || log.oldValue?.name || '').toLowerCase().includes(q);
        const templateMatch = (log.newValue?.templateName || log.oldValue?.templateName || '').toLowerCase().includes(q);
        const actionMatch = (log.action || '').toLowerCase().includes(q);
        if (!actorMatch && !nameMatch && !templateMatch && !actionMatch) return false;
      }

      return true;
    });
  }, [combinedLogs, actionFilter, searchQuery]);

  // Summary counts
  const summary = useMemo(() => {
    return {
      total: combinedLogs.length,
      created: combinedLogs.filter(l => l.action === 'CREATE_CAMPAIGN').length,
      edited: combinedLogs.filter(l => l.action === 'EDIT_CAMPAIGN').length,
      started: combinedLogs.filter(l => l.action === 'START_CAMPAIGN').length,
      unscheduled: combinedLogs.filter(l => l.action === 'UNSCHEDULE_CAMPAIGN').length,
      deleted: combinedLogs.filter(l => l.action === 'DELETE_CAMPAIGN').length,
    };
  }, [combinedLogs]);

  // Helper for Action Badge
  const getActionBadge = (action) => {
    switch (action) {
      case 'CREATE_CAMPAIGN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
            <Plus className="w-3 h-3" /> Created
          </span>
        );
      case 'EDIT_CAMPAIGN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
            <Edit3 className="w-3 h-3" /> Edited
          </span>
        );
      case 'START_CAMPAIGN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-wa-green/10 text-wa-green border border-wa-green/30">
            <Play className="w-3 h-3 fill-current" /> Started / Blasted
          </span>
        );
      case 'PAUSE_CAMPAIGN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50">
            <Pause className="w-3 h-3 fill-current" /> Paused
          </span>
        );
      case 'RESUME_CAMPAIGN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50">
            <Play className="w-3 h-3 fill-current" /> Resumed
          </span>
        );
      case 'UNSCHEDULE_CAMPAIGN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50">
            <CalendarOff className="w-3 h-3" /> Unscheduled
          </span>
        );
      case 'DELETE_CAMPAIGN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50">
            <Trash2 className="w-3 h-3" /> Deleted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-wa-search text-wa-text-secondary">
            {action}
          </span>
        );
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      return toast.error('No logs available to export.');
    }

    const headers = [
      'Timestamp',
      'Action',
      'Performed By',
      'Role',
      'Campaign Name',
      'Template Name',
      'IP Address',
      'Details / Changes'
    ];

    const rows = filteredLogs.map(l => {
      const cName = l.newValue?.name || l.oldValue?.name || 'N/A';
      const tName = l.newValue?.templateName || l.oldValue?.templateName || 'N/A';
      let details = '';
      if (logActionIs(l.action, 'CREATE_CAMPAIGN')) {
        details = `Created new campaign (Audience: ${l.newValue?.audienceType || 'all'})`;
      } else if (logActionIs(l.action, 'EDIT_CAMPAIGN')) {
        details = `Updated campaign settings`;
      } else if (logActionIs(l.action, 'START_CAMPAIGN')) {
        details = `Launched blast queue`;
      } else if (logActionIs(l.action, 'UNSCHEDULE_CAMPAIGN')) {
        details = `Canceled schedule, moved to draft`;
      } else if (logActionIs(l.action, 'DELETE_CAMPAIGN')) {
        details = `Deleted campaign`;
      }

      return [
        `"${new Date(l.timestamp).toLocaleString()}"`,
        `"${l.action}"`,
        `"${l.actorName || 'Admin'}"`,
        `"${l.role || 'admin'}"`,
        `"${cName.replace(/"/g, '""')}"`,
        `"${tName.replace(/"/g, '""')}"`,
        `"${l.ip || 'N/A'}"`,
        `"${details.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `campaign_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const logActionIs = (action, target) => action === target;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
        <div className="glass-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Total Events</span>
            <History className="w-4 h-4 text-wa-green" />
          </div>
          <div className="text-xl font-bold text-wa-text-primary dark:text-white">
            {summary.total}
          </div>
        </div>

        <div className="glass-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Created</span>
            <Plus className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600">
            {summary.created}
          </div>
        </div>

        <div className="glass-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Edited / Updated</span>
            <Edit3 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-blue-600">
            {summary.edited}
          </div>
        </div>

        <div className="glass-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Blasted / Started</span>
            <Play className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-purple-600">
            {summary.started}
          </div>
        </div>

        <div className="glass-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Unscheduled</span>
            <CalendarOff className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600">
            {summary.unscheduled}
          </div>
        </div>

        <div className="glass-card p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-wa-text-secondary">
            <span>Deleted</span>
            <Trash2 className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-bold text-red-500">
            {summary.deleted}
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-wa-text-secondary" />
            <input
              type="text"
              placeholder="Search user, campaign, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-wa-search dark:bg-wa-dark-search rounded-lg border border-wa-border dark:border-wa-dark-border focus:outline-none focus:ring-1 focus:ring-wa-green text-wa-text-primary dark:text-white"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs py-1.5 px-3 bg-wa-search dark:bg-wa-dark-search rounded-lg border border-wa-border dark:border-wa-dark-border text-wa-text-secondary focus:outline-none cursor-pointer"
          >
            <option value="all">All CRUD Actions</option>
            <option value="CREATE_CAMPAIGN">Created Only</option>
            <option value="EDIT_CAMPAIGN">Edited / Updated Only</option>
            <option value="START_CAMPAIGN">Started / Blasted Only</option>
            <option value="PAUSE_CAMPAIGN">Paused Only</option>
            <option value="RESUME_CAMPAIGN">Resumed Only</option>
            <option value="UNSCHEDULE_CAMPAIGN">Unscheduled Only</option>
            <option value="DELETE_CAMPAIGN">Deleted Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchLogs();
              if (onRefreshCampaigns) onRefreshCampaigns();
            }}
            disabled={loading}
            className="p-2 rounded-lg text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5 hover:shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit Log</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header/50">
          <div>
            <h3 className="font-semibold text-sm text-wa-text-primary dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-wa-green" />
              Campaign CRUD Activity & Audit Log ({filteredLogs.length})
            </h3>
            <p className="text-xs text-wa-text-secondary">
              Chronological audit log showing who generated, edited, scheduled, launched, or deleted campaigns.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-wa-border dark:border-wa-dark-border uppercase text-wa-text-secondary bg-wa-panel-header/30 font-semibold">
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">User / Performed By</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Campaign Name</th>
                <th className="px-6 py-3.5">Template</th>
                <th className="px-6 py-3.5">Details & Changes</th>
                <th className="px-6 py-3.5 text-right">Device / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/50">
              {loading && filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-wa-text-secondary">
                    <div className="flex justify-center items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-wa-green" />
                      <span>Loading activity logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-wa-text-secondary">
                    <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No activity logs found for the selected filter.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const campaignName = log.newValue?.name || log.oldValue?.name || 'Campaign';
                  const templateName = log.newValue?.templateName || log.oldValue?.templateName || '—';
                  const actorInitial = (log.actorName || 'U').charAt(0).toUpperCase();

                  // Build human-friendly details summary
                  let detailText = '';
                  if (log.action === 'CREATE_CAMPAIGN') {
                    detailText = `Created new campaign (Target: ${log.newValue?.audienceType || 'all'})`;
                    if (log.newValue?.scheduledAt) {
                      detailText += ` • Scheduled for ${formatDate(log.newValue.scheduledAt)}`;
                    }
                  } else if (log.action === 'EDIT_CAMPAIGN') {
                    if (log.oldValue && log.newValue) {
                      const changes = [];
                      if (log.oldValue.name && log.newValue.name && log.oldValue.name !== log.newValue.name) {
                        changes.push(`Name: "${log.newValue.name}"`);
                      }
                      if (log.oldValue.templateName && log.newValue.templateName && log.oldValue.templateName !== log.newValue.templateName) {
                        changes.push(`Template: ${log.newValue.templateName}`);
                      }
                      if (log.oldValue.scheduledAt !== log.newValue.scheduledAt) {
                        changes.push(log.newValue.scheduledAt ? `Rescheduled to ${formatDate(log.newValue.scheduledAt)}` : 'Schedule cleared');
                      }
                      detailText = changes.length > 0 ? changes.join(' · ') : 'Updated campaign variables or settings';
                    } else {
                      detailText = 'Updated campaign settings';
                    }
                  } else if (log.action === 'START_CAMPAIGN') {
                    detailText = 'Triggered instant broadcast queue to Meta API';
                  } else if (log.action === 'PAUSE_CAMPAIGN') {
                    detailText = 'Temporarily paused campaign message blasting';
                  } else if (log.action === 'RESUME_CAMPAIGN') {
                    detailText = 'Resumed message queue processing';
                  } else if (log.action === 'UNSCHEDULE_CAMPAIGN') {
                    detailText = 'Canceled scheduled blast and reverted back to draft';
                  } else if (log.action === 'DELETE_CAMPAIGN') {
                    detailText = 'Permanently removed campaign record and halted queue';
                  }

                  return (
                    <tr
                      key={log._id || idx}
                      className="hover:bg-wa-hover/50 dark:hover:bg-wa-dark-hover/50 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-wa-text-primary dark:text-white font-medium">
                          <Clock className="w-3.5 h-3.5 text-wa-text-secondary shrink-0" />
                          <span>{formatDate(log.timestamp)}</span>
                        </div>
                        <div className="text-[10px] text-wa-text-secondary mt-0.5">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-wa-green/10 text-wa-green font-bold text-xs flex items-center justify-center shrink-0 border border-wa-green/20">
                            {actorInitial}
                          </div>
                          <div>
                            <span className="font-semibold text-wa-text-primary dark:text-white block">
                              {log.actorName || 'Admin'}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-wa-text-secondary tracking-wider">
                              {log.role || 'Admin'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Campaign Name */}
                      <td className="px-6 py-4 font-semibold text-wa-text-primary dark:text-white">
                        <span className="max-w-[180px] truncate block" title={campaignName}>
                          {campaignName}
                        </span>
                      </td>

                      {/* Template */}
                      <td className="px-6 py-4 font-mono text-[11px] text-wa-text-secondary">
                        <span className="max-w-[140px] truncate block" title={templateName}>
                          {templateName}
                        </span>
                      </td>

                      {/* Details & Changes */}
                      <td className="px-6 py-4 text-wa-text-secondary">
                        <div className="max-w-xs truncate" title={detailText}>
                          {detailText}
                        </div>
                      </td>

                      {/* IP / Device */}
                      <td className="px-6 py-4 text-right text-wa-text-secondary font-mono text-[11px]">
                        {log.ip ? (
                          <span className="bg-wa-search dark:bg-wa-dark-search px-2 py-0.5 rounded text-[10px]" title={log.userAgent || ''}>
                            {log.ip}
                          </span>
                        ) : (
                          <span className="text-[10px] opacity-40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
