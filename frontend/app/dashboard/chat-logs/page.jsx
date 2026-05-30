'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Terminal, MessageSquare, MousePointer, Activity, Search,
  Loader2, ChevronLeft, ChevronRight, Eye, X, ExternalLink, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/api';

export default function ChatLogsPage() {
  const [activeTab, setActiveTab] = useState('text'); // 'text', 'button', 'api'
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Inspector states for details modal
  const [selectedPayload, setSelectedPayload] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/chat-logs', {
        params: {
          logType: activeTab,
          page,
          limit
        }
      });
      if (data.success) {
        setLogs(data.data.logs);
        setTotalPages(data.data.pages || 1);
        setTotalLogs(data.data.total || 0);
      }
    } catch (err) {
      toast.error('Failed to load logs database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchLogs();
  }, [activeTab, limit]);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const handleOpenInspector = (log) => {
    setSelectedPayload({
      title: activeTab === 'api' ? `${log.method?.toUpperCase()} - ${log.url}` : 'Button Event Payload',
      request: log.requestBody,
      response: log.responseBody,
      details: log
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Terminal className="w-6 h-6 text-wa-green animate-pulse" /> Platform Logs & Debugger
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Audit conversational histories, trace interactive button responses, and debug API webhook events in real-time.
          </p>
        </div>
        <Link
          href="/dashboard/inbox"
          className="btn-primary py-2 text-xs flex items-center gap-1.5 font-semibold self-start md:self-auto"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Live Chat Inbox
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex border-b border-wa-border dark:border-wa-dark-border w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
              activeTab === 'text'
                ? 'border-wa-green text-wa-green font-bold'
                : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Text History Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('button')}
            className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
              activeTab === 'button'
                ? 'border-wa-green text-wa-green font-bold'
                : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <MousePointer className="w-4 h-4" />
            <span>Button Clicks</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
              activeTab === 'api'
                ? 'border-wa-green text-wa-green font-bold'
                : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>API & Webhooks</span>
          </button>
        </div>

        {/* Refresh & Limit Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={fetchLogs}
            className="p-2 border border-wa-border dark:border-wa-dark-border rounded-xl hover:bg-wa-bg dark:hover:bg-wa-dark-hover transition-colors text-wa-text-secondary"
            title="Refresh Logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel text-wa-text-primary dark:text-white focus:outline-none"
          >
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>
      </div>

      {/* Logs Table Area */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-wa-panel-header dark:bg-wa-dark-panel-header text-wa-text-secondary dark:text-wa-dark-text-secondary font-semibold text-[10px] uppercase tracking-wider border-b border-wa-border dark:border-wa-dark-border">
                {activeTab === 'text' && (
                  <>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Direction</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Message Content</th>
                    <th className="px-5 py-3">Status</th>
                  </>
                )}
                {activeTab === 'button' && (
                  <>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Details / Context</th>
                    <th className="px-5 py-3">Webhook Route</th>
                    <th className="px-5 py-3">Response Code</th>
                    <th className="px-5 py-3 text-right">Inspect Payload</th>
                  </>
                )}
                {activeTab === 'api' && (
                  <>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Method</th>
                    <th className="px-5 py-3">Endpoint URL</th>
                    <th className="px-5 py-3">Status Code</th>
                    <th className="px-5 py-3">Remote IP</th>
                    <th className="px-5 py-3 text-right">Inspect Payload</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-wa-text-secondary">
                    <div className="flex items-center justify-center gap-2 font-sans">
                      <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                      <span>Fetching logs database...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-wa-text-secondary italic font-sans">
                    No logs found for this category.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-wa-bg/10 dark:hover:bg-wa-dark-header/10 transition-colors">
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 text-wa-text-secondary whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    {/* TEXT TAB SPECIFIC */}
                    {activeTab === 'text' && (
                      <>
                        <td className="px-5 py-3.5 font-bold font-sans">
                          <Link href={`/dashboard/inbox?phone=${log.contactPhone}`} className="text-wa-green hover:underline">
                            {log.contactName} ({log.contactPhone})
                          </Link>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                            log.direction === 'incoming'
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20'
                              : 'bg-wa-green/10 text-wa-green'
                          }`}>
                            {log.direction}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-wa-text-secondary uppercase text-[10px] font-sans">
                          {log.type}
                        </td>
                        <td className="px-5 py-3.5 max-w-xs truncate font-sans text-wa-text-primary dark:text-white">
                          {log.content}
                        </td>
                        <td className="px-5 py-3.5 font-sans">
                          <span className={`capitalize font-semibold ${
                            log.status === 'read' ? 'text-wa-green' :
                            log.status === 'delivered' ? 'text-blue-500' :
                            log.status === 'sent' ? 'text-slate-500' : 'text-red-500'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </>
                    )}

                    {/* BUTTON TAB SPECIFIC */}
                    {activeTab === 'button' && (
                      <>
                        <td className="px-5 py-3.5 font-sans text-wa-text-primary dark:text-white font-semibold">
                          {log.details}
                        </td>
                        <td className="px-5 py-3.5 text-wa-text-secondary text-[11px]">
                          {log.url}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                            log.statusCode >= 200 && log.statusCode < 300
                              ? 'bg-green-50 text-green-600 dark:bg-green-950/20'
                              : 'bg-red-50 text-red-600 dark:bg-red-950/20'
                          }`}>
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          <button
                            onClick={() => handleOpenInspector(log)}
                            className="btn-secondary py-1 px-2.5 text-[10px] flex items-center gap-1 font-semibold ml-auto"
                          >
                            <Eye className="w-3 h-3" /> Inspect JSON
                          </button>
                        </td>
                      </>
                    )}

                    {/* API TAB SPECIFIC */}
                    {activeTab === 'api' && (
                      <>
                        <td className="px-5 py-3.5 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.type === 'webhook_incoming'
                              ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/20'
                              : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20'
                          }`}>
                            {log.type === 'webhook_incoming' ? 'webhook' : 'api key'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold">
                          <span className={`${
                            log.method === 'POST' ? 'text-blue-500' :
                            log.method === 'GET' ? 'text-green-500' :
                            log.method === 'DELETE' ? 'text-red-500' : 'text-amber-500'
                          }`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-wa-text-secondary text-[11px] truncate max-w-[200px]">
                          {log.url}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                            log.statusCode >= 200 && log.statusCode < 300
                              ? 'bg-green-50 text-green-600 dark:bg-green-950/20'
                              : 'bg-red-50 text-red-600 dark:bg-red-950/20'
                          }`}>
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-wa-text-secondary font-mono">
                          {log.ip || '127.0.0.1'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          <button
                            onClick={() => handleOpenInspector(log)}
                            className="btn-secondary py-1 px-2.5 text-[10px] flex items-center gap-1 font-semibold ml-auto"
                          >
                            <Eye className="w-3 h-3" /> Inspect JSON
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 bg-wa-panel-header dark:bg-wa-dark-panel-header border-t border-wa-border dark:border-wa-dark-border text-xs">
            <span className="text-wa-text-secondary">
              Showing page <span className="font-bold text-wa-text-primary dark:text-white">{page}</span> of <span className="font-bold">{totalPages}</span> ({totalLogs} total entries)
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

      {/* JSON PAYLOAD INSPECTOR MODAL */}
      {selectedPayload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-3xl overflow-hidden animate-slide-up flex flex-col max-h-[85vh] shadow-wa-lg">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary truncate max-w-lg">
                {selectedPayload.title}
              </h3>
              <button onClick={() => setSelectedPayload(null)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Request Payload */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-wa-text-secondary uppercase">Request Body / Payload</span>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-auto max-h-[40vh] font-mono border border-slate-800 scrollbar-thin">
                    {selectedPayload.request
                      ? JSON.stringify(selectedPayload.request, null, 2)
                      : '// No request body payload logged'}
                  </pre>
                </div>

                {/* Response Payload */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-wa-text-secondary uppercase">Response Body / Payload</span>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-auto max-h-[40vh] font-mono border border-slate-800 scrollbar-thin">
                    {selectedPayload.response
                      ? JSON.stringify(selectedPayload.response, null, 2)
                      : '// No response body payload logged'}
                  </pre>
                </div>
              </div>

              {/* Extra Metadata */}
              <div className="p-3 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-secondary">
                <p>Status: <span className="font-bold font-mono text-wa-green">{selectedPayload.details.statusCode}</span></p>
                <p className="mt-1">Timestamp: <span className="font-mono">{new Date(selectedPayload.details.timestamp).toLocaleString()}</span></p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-wa-border dark:border-wa-dark-border flex justify-end bg-wa-panel-header dark:bg-wa-dark-panel-header">
              <button
                type="button"
                onClick={() => setSelectedPayload(null)}
                className="btn-primary py-2 px-5 text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
