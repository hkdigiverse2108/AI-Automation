'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Search, Loader2, ChevronLeft, ChevronRight, RefreshCw, User, Clock
} from 'lucide-react';
import api from '../../../lib/api';

export default function CallLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [search, setSearch] = useState('');
  const [callType, setCallType] = useState('');

  const fetchCallLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/telephony/call-logs', {
        params: {
          page,
          limit,
          search: search || undefined,
          callType: callType || undefined,
        }
      });
      if (data.success) {
        setLogs(data.data.logs);
        setTotalPages(data.data.pagination.pages || 1);
        setTotalLogs(data.data.pagination.total || 0);
      }
    } catch (err) {
      toast.error('Failed to load call logs database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchCallLogs();
  }, [callType, limit]);

  // Debounce search input
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(1);
      fetchCallLogs();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // Format call duration to readable string
  const formatDuration = (seconds) => {
    if (seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Phone className="w-6 h-6 text-wa-green animate-pulse" /> Telephony & Call Logs
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Monitor incoming, outgoing, and missed call activities synchronized automatically from your agents' mobile apps.
          </p>
        </div>
        <button
          onClick={fetchCallLogs}
          className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 font-semibold self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Database
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-wa-text-secondary">
              <Search className="w-4 h-4" />
            </span>
            <input
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-wa-green/25 focus:border-wa-green transition-all text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary"
              placeholder="Search by contact phone or name..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Call Type Dropdown */}
          <select
            value={callType}
            onChange={(e) => setCallType(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel text-wa-text-primary dark:text-white focus:outline-none"
          >
            <option value="">All Call Types</option>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
            <option value="missed">Missed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Limit Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
                <th className="px-5 py-3">Call Time</th>
                <th className="px-5 py-3">Contact Details</th>
                <th className="px-5 py-3">Call Type</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Synchronized Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-wa-text-secondary">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                      <span>Loading call logs database...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-wa-text-secondary italic">
                    No synchronized call logs found matching filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  let TypeIcon = PhoneIncoming;
                  let typeColor = 'text-green-500 bg-green-50 dark:bg-green-950/20';
                  
                  if (log.callType === 'outgoing') {
                    TypeIcon = PhoneOutgoing;
                    typeColor = 'text-blue-500 bg-blue-50 dark:bg-blue-950/20';
                  } else if (log.callType === 'missed') {
                    TypeIcon = PhoneMissed;
                    typeColor = 'text-red-500 bg-red-50 dark:bg-red-950/20';
                  } else if (log.callType === 'rejected') {
                    TypeIcon = PhoneOff;
                    typeColor = 'text-gray-500 bg-gray-100 dark:bg-gray-800/40';
                  }

                  return (
                    <tr key={log._id} className="hover:bg-wa-bg/10 dark:hover:bg-wa-dark-header/10 transition-colors">
                      {/* Call Time */}
                      <td className="px-5 py-3.5 text-wa-text-secondary whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>

                      {/* Contact Details */}
                      <td className="px-5 py-3.5 font-bold text-wa-text-primary dark:text-white">
                        <div className="flex flex-col">
                          <span>{log.name || 'Unknown Contact'}</span>
                          <span className="text-[10px] text-wa-text-secondary font-mono mt-0.5">+{log.phone}</span>
                        </div>
                      </td>

                      {/* Call Type Pill */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${typeColor}`}>
                          <TypeIcon className="w-3.5 h-3.5" />
                          {log.callType}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="px-5 py-3.5 text-wa-text-secondary font-semibold">
                        {log.callType === 'missed' || log.callType === 'rejected' ? '—' : formatDuration(log.duration)}
                      </td>

                      {/* Synced Agent */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-wa-text-secondary font-semibold">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-wa-green" />
                          <span>{log.userId?.name || 'Agent'}</span>
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
              Showing page <span className="font-bold text-wa-text-primary dark:text-white">{page}</span> of <span className="font-bold">{totalPages}</span> ({totalLogs} total call records)
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
    </div>
  );
}
