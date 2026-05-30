'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  ClipboardList, Search, Filter, Calendar, RefreshCw, 
  ArrowUpDown, Download, Eye, Trash2, ArrowUp, ArrowDown, Loader2, Sparkles, FolderDown
} from 'lucide-react';
import api from '../../../lib/api';
import LeadDetailsModal from '../../../components/LeadDetailsModal';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);

  // Inspector Modal
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch || undefined,
        status: selectedStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder
      };
      const { data } = await api.get('/leads', { params });
      if (data.success) {
        setLeads(data.data.leads);
        setTotal(data.data.total);
        setPages(data.data.pages);
      }
    } catch (err) {
      toast.error('Failed to load leads list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchLeads();
  }, [page, selectedStatus, startDate, endDate, sortBy, sortOrder, debouncedSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setDebouncedSearch(search);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleDeleteLead = async (id, name) => {
    if (!confirm(`Are you sure you want to delete lead details for "${name || 'this client'}"?`)) return;
    try {
      const { data } = await api.delete(`/leads/${id}`);
      if (data.success) {
        toast.success('Lead deleted');
        fetchLeads();
      }
    } catch (err) {
      toast.error('Failed to delete lead');
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = {
        search: search || undefined,
        status: selectedStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      };
      const response = await api.get('/leads/export/csv', { params, responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leads.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV downloaded successfully');
    } catch (err) {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    const toastId = toast.loading('Fetching data for PDF catalog...');
    try {
      const params = {
        search: search || undefined,
        status: selectedStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 1000 // fetch all matching leads for PDF catalog
      };
      const { data } = await api.get('/leads', { params });
      if (!data.success) throw new Error();

      const leadsList = data.data.leads || [];
      if (leadsList.length === 0) {
        toast.error('No leads found matching the current criteria', { id: toastId });
        setExporting(false);
        return;
      }

      // Lazy import libraries to reduce bundle size
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      toast.loading('Generating page 1 (Overview table)...', { id: toastId });

      // Page 1: Dashboard Summary Table
      // Header branding bar
      doc.setFillColor(16, 185, 129); // WA Green
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('WA CHATBOX AUTOMATION', 15, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('CRM AUTOMATED BUSINESS LEADS EXPORT REPORT', 15, 25);

      doc.setTextColor(209, 250, 229);
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString()}  |  Records: ${leadsList.length}`, 145, 25);

      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Leads Catalog Overview Table', 15, 42);

      const tableColumn = ["Name", "Contact", "Service Required", "Budget", "Timeline", "Status", "Date"];
      const tableRows = [];

      leadsList.forEach(l => {
        tableRows.push([
          l.name || 'Anonymous',
          l.phone || '-',
          l.serviceRequired || 'Not specified',
          l.budget || 'N/A',
          l.timeline || 'N/A',
          l.status.toUpperCase(),
          l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '-'
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 47,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 26 },
          2: { cellWidth: 42 },
          3: { cellWidth: 22 },
          4: { cellWidth: 24 },
          5: { cellWidth: 22 },
          6: { cellWidth: 22 }
        }
      });

      // Following Pages: Detailed lead breakdown sheets (processed in batches of 15 to prevent event loop blocking)
      const chunkSize = 15;
      for (let i = 0; i < leadsList.length; i += chunkSize) {
        // Yield execution to the browser event loop
        await new Promise(r => setTimeout(r, 0));

        const chunk = leadsList.slice(i, i + chunkSize);
        const currentCount = Math.min(i + chunkSize, leadsList.length);
        toast.loading(`Generating details page ${currentCount} of ${leadsList.length}...`, { id: toastId });

        chunk.forEach((l, chunkIdx) => {
          const index = i + chunkIdx;
          doc.addPage();
          
          // Brand Header Line
          doc.setFillColor(16, 185, 129);
          doc.rect(0, 0, 210, 4, 'F');

          // Main Card Title Box
          doc.setFillColor(243, 244, 246);
          doc.rect(10, 12, 190, 22, 'F');
          doc.setDrawColor(229, 231, 235);
          doc.rect(10, 12, 190, 22, 'S');

          doc.setTextColor(17, 24, 39);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text(`${index + 1}. Lead Details: ${l.name || 'Anonymous Client'}`, 15, 21);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(75, 85, 99);
          doc.text(`Phone: ${l.phone || 'N/A'}  |  Email: ${l.email || 'N/A'}  |  Created: ${l.createdAt ? new Date(l.createdAt).toLocaleString() : 'N/A'}`, 15, 28);

          let y = 44;

          // Block 1: Requirements
          doc.setFillColor(249, 250, 251);
          doc.rect(10, y, 190, 36, 'F');
          doc.rect(10, y, 190, 36, 'S');
          
          doc.setTextColor(16, 185, 129);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('PROJECT METRICS & DETAILS', 15, y + 6);

          doc.setTextColor(55, 65, 81);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(`Service Required:   ${l.serviceRequired || 'Not specified'}`, 15, y + 13);
          doc.text(`Estimated Budget:   ${l.budget || 'Not specified'}`, 15, y + 19);
          doc.text(`Expected Timeline:  ${l.timeline || 'Not specified'}`, 15, y + 25);
          doc.text(`Tech Preference:    ${l.preferredTechnology || 'Not specified'}`, 15, y + 31);

          y += 44;

          // Block 2: AI Description & Special Requests
          doc.setFillColor(249, 250, 251);
          doc.rect(10, y, 190, 42, 'F');
          doc.rect(10, y, 190, 42, 'S');

          doc.setTextColor(16, 185, 129);
          doc.setFont('helvetica', 'bold');
          doc.text('PROJECT SCOPE & SPECIAL REQUESTS', 15, y + 6);

          doc.setTextColor(55, 65, 81);
          doc.setFont('helvetica', 'normal');
          
          doc.text('Description:', 15, y + 13);
          const splitDesc = doc.splitTextToSize(l.projectDescription || 'No description provided.', 140);
          doc.text(splitDesc, 45, y + 13);

          doc.text('Special Needs:', 15, y + 31);
          const splitSpecial = doc.splitTextToSize(l.specialRequirements || 'No special requirements listed.', 140);
          doc.text(splitSpecial, 45, y + 31);

          y += 50;

          // Block 3: AI summary & notes
          if (l.aiSummary) {
            doc.setFillColor(240, 253, 250); // Light teal bg for AI summaries
            doc.setDrawColor(204, 251, 241);
            doc.rect(10, y, 190, 28, 'F');
            doc.rect(10, y, 190, 28, 'S');

            doc.setTextColor(13, 148, 136); // Teal text
            doc.setFont('helvetica', 'bold');
            doc.text('AI CONVERSATION SUMMARY CONTEXT', 15, y + 6);

            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            const splitSummary = doc.splitTextToSize(l.aiSummary, 180);
            doc.text(splitSummary, 15, y + 13);
            y += 36;
          }

          if (l.notes) {
            doc.setFillColor(254, 243, 199); // Yellow notes box
            doc.setDrawColor(252, 211, 77);
            doc.rect(10, y, 190, 24, 'F');
            doc.rect(10, y, 190, 24, 'S');

            doc.setTextColor(180, 83, 9);
            doc.setFont('helvetica', 'bold');
            doc.text('INTERNAL AGENT NOTES', 15, y + 6);

            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            const splitNotes = doc.splitTextToSize(l.notes, 180);
            doc.text(splitNotes, 15, y + 13);
          }

          // Page footer info
          doc.setTextColor(156, 163, 175);
          doc.setFontSize(8);
          doc.text(`Lead Status: ${l.status.toUpperCase()}  |  Report Page ${index + 2} of ${leadsList.length + 1}`, 15, 287);
        });
      }

      doc.save('leads.pdf');
      toast.success('Leads PDF Catalog downloaded successfully', { id: toastId });
    } catch (err) {
      toast.error('Failed to export PDF', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'qualified': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Qualified</span>;
      case 'proposal_sent': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-650 dark:text-blue-400">Proposal Sent</span>;
      case 'closed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-650 dark:text-purple-400">Closed</span>;
      default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">New Lead</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-wa-green" /> Automated Lead Dashboard
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Monitor client details automatically extracted by the AI chatbot from WhatsApp chats.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="btn-secondary text-xs font-bold py-2 px-3.5 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all"
            title="Download CSV report"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="btn-primary text-xs font-bold py-2 px-3.5 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-wa-green/20"
            title="Download PDF report"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderDown className="w-3.5 h-3.5" />}
            Export PDF Catalog
          </button>
        </div>
      </div>

      {/* Control Bar: Filters, Date Selectors */}
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 flex flex-col xl:flex-row gap-4 items-center shadow-sm">
        
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full xl:max-w-xs">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
          <input
            type="text"
            placeholder="Search leads, services, technology..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30"
          />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-start xl:justify-end xl:ml-auto">
          
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-wa-text-secondary shrink-0 font-semibold">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="new">New Lead</option>
              <option value="qualified">Qualified</option>
              <option value="proposal_sent">Proposal Sent</option>
              <option value="closed">Closed / Won</option>
            </select>
          </div>

          {/* Date Picker Range */}
          <div className="flex items-center gap-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl px-3 py-1">
            <Calendar className="w-3.5 h-3.5 text-wa-text-secondary" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="bg-transparent border-none outline-none text-xs text-wa-text-primary dark:text-white focus:ring-0 w-28"
              title="Start Date"
            />
            <span className="text-wa-text-secondary text-xs font-bold px-1">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="bg-transparent border-none outline-none text-xs text-wa-text-primary dark:text-white focus:ring-0 w-28"
              title="End Date"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLeads}
            className="p-2 border border-wa-border dark:border-wa-dark-border rounded-xl hover:bg-wa-bg dark:hover:bg-wa-dark-header transition-colors text-wa-text-secondary"
            title="Refresh Leads"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

        </div>
      </div>

      {/* Leads Table Card */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-wa-panel-header dark:bg-wa-dark-panel-header text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold text-[10px] uppercase tracking-wider border-b border-wa-border dark:border-wa-dark-border select-none">
                <th className="px-6 py-4 cursor-pointer hover:text-wa-text-primary" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">
                    <span>Customer Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-4">Contact Number</th>
                <th className="px-6 py-4">Service Required</th>
                <th className="px-6 py-4 cursor-pointer hover:text-wa-text-primary" onClick={() => handleSort('budget')}>
                  <div className="flex items-center gap-1">
                    <span>Budget</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-6 py-4">Timeline</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/50 text-xs">
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-wa-text-secondary">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                      <span className="font-semibold">Loading business leads...</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-wa-text-secondary">
                    <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-semibold">No lead records found</p>
                    <p className="text-[11px] mt-1 opacity-70">New leads are created automatically when clients chat with the AI bot.</p>
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l._id} className="hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/40 transition-colors">
                    {/* Customer name */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-wa-text-primary dark:text-white">
                        {l.name || 'Anonymous Client'}
                      </div>
                      {l.companyName && (
                        <div className="text-[10px] text-wa-text-secondary mt-0.5 italic">
                          {l.companyName}
                        </div>
                      )}
                    </td>

                    {/* Contact Number */}
                    <td className="px-6 py-4 font-mono font-medium text-wa-text-primary dark:text-wa-dark-text-primary">
                      {l.phone || '-'}
                    </td>

                    {/* Service Required */}
                    <td className="px-6 py-4">
                      {l.serviceRequired ? (
                        <span className="bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border px-2.5 py-0.5 rounded-lg font-bold">
                          {l.serviceRequired}
                        </span>
                      ) : (
                        <span className="text-wa-text-light italic">-</span>
                      )}
                    </td>

                    {/* Budget */}
                    <td className="px-6 py-4 font-bold text-wa-green">
                      {l.budget || '-'}
                    </td>

                    {/* Timeline */}
                    <td className="px-6 py-4 text-wa-text-secondary">
                      {l.timeline || '-'}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {getStatusBadge(l.status)}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-wa-text-secondary font-mono">
                      {l.conversationDateTime ? new Date(l.conversationDateTime).toLocaleDateString() : '-'}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedLeadId(l._id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-wa-green hover:bg-wa-green/10 transition-colors"
                          title="Inspect Lead"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(l._id, l.name)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete Lead"
                        >
                          <Trash2 className="w-4 h-4" />
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
          <div className="flex items-center justify-between px-6 py-4 bg-wa-panel-header dark:bg-wa-dark-panel-header border-t border-wa-border dark:border-wa-dark-border text-xs">
            <span className="text-wa-text-secondary">
              Showing page <span className="font-bold text-wa-text-primary dark:text-white">{page}</span> of <span className="font-bold">{pages}</span> ({total} leads)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-wa-hover disabled:opacity-40 transition-colors border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel"
              >
                &larr;
              </button>
              <span className="px-3 font-semibold dark:text-white">Page {page}</span>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-wa-hover disabled:opacity-40 transition-colors border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel"
              >
                &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LEAD DETAILS INSPECTOR MODAL */}
      {selectedLeadId && (
        <LeadDetailsModal
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdateSuccess={() => { setSelectedLeadId(null); fetchLeads(); }}
        />
      )}
    </div>
  );
}
