'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { 
  Search, Plus, Upload, Trash2, Filter, ChevronLeft, ChevronRight, 
  X, Mail, Phone, User, Tag, HelpCircle, Loader2, MessageSquare, Edit2, CheckSquare, Square,
  Calendar, Eye, Copy, FileSpreadsheet, AlertCircle, Check, Sparkles, FileDown, ChevronDown,
  Kanban, LayoutGrid, List, GripVertical
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../lib/api';
import { ScoreBadge } from './ContactScoreCard';
import { LOGO_BASE64 } from '../lib/logoBase64';
import { useConfirmStore } from '../lib/store';
import { getFastCache, setFastCache } from '../lib/usePageData';
import { getSocket } from '../lib/socket';
import dynamic from 'next/dynamic';
import Portal from './Portal';

const ContactDetailsModal = dynamic(() => import('./ContactDetailsModal'), {
  ssr: false,
});

// Helper to generate a soft color class based on user initials
const getAvatarBg = (name) => {
  if (!name) return 'bg-wa-green/10 text-wa-green';
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
    'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
    'bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400',
  ];
  return colors[charCodeSum % colors.length];
};

// Helper for colored dots on tags
const getTagColorClass = (tag) => {
  const charCodeSum = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dotColors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-indigo-500', 'bg-pink-500'
  ];
  const textColors = [
    'text-emerald-700 bg-emerald-50 dark:text-emerald-350 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30',
    'text-blue-700 bg-blue-50 dark:text-blue-350 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30',
    'text-purple-700 bg-purple-50 dark:text-purple-350 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30',
    'text-amber-700 bg-amber-50 dark:text-amber-350 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30',
    'text-indigo-700 bg-indigo-50 dark:text-indigo-350 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30',
    'text-pink-700 bg-pink-50 dark:text-pink-350 dark:bg-pink-950/20 border-pink-100 dark:border-pink-900/30'
  ];
  const index = charCodeSum % dotColors.length;
  return { dot: dotColors[index], badge: textColors[index] };
};

export default function ContactTable() {
  const router = useRouter();
  const confirm = useConfirmStore(state => state.confirm);

  const cachedContacts = getFastCache('contacts_page_1', null);
  const [contacts, setContacts] = useState(cachedContacts?.contacts || []);
  const [total, setTotal] = useState(cachedContacts?.total || 0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(cachedContacts?.pages || 1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(!cachedContacts?.contacts?.length);

  // View Mode: 'list' (table) vs 'kanban'
  const [viewMode, setViewMode] = useState('list');
  // Kanban Grouping: 'source' (default), 'segment', 'status'
  const [kanbanGroupBy, setKanbanGroupBy] = useState('source');
  const [draggedContactId, setDraggedContactId] = useState(null);

  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [agents, setAgents] = useState(() => getFastCache('team_agents', []));
  const [assignedAgent, setAssignedAgent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastActivityStart, setLastActivityStart] = useState('');
  const [lastActivityEnd, setLastActivityEnd] = useState('');

  // Contact Details Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsContactId, setDetailsContactId] = useState(null);

  // Row selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [source, setSource] = useState('');
  const [optedOut, setOptedOut] = useState('');
  const [segment, setSegment] = useState('');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  
  // Add Contact Form State
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'manual',
    tags: ''
  });
  const [addCustomFields, setAddCustomFields] = useState([]);
  const [addFormErrors, setAddFormErrors] = useState({});

  // Edit Contact Form State
  const [editingContact, setEditingContact] = useState({
    _id: '',
    name: '',
    email: '',
    tags: ''
  });
  const [editCustomFields, setEditCustomFields] = useState([]);

  // Duplicate Scanner State
  const [duplicateScanning, setDuplicateScanning] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [selectedPrimaryMap, setSelectedPrimaryMap] = useState({});
  const [mergingGroupIndex, setMergingGroupIndex] = useState(null);
  
  // Import (CSV / Excel) & Export (PDF) State
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Bulk Message State
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useState(false);
  const [bulkMessageText, setBulkMessageText] = useState('');
  const [bulkMessageImageUrl, setBulkMessageImageUrl] = useState('');
  const [bulkMediaType, setBulkMediaType] = useState('text');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSendResults, setBulkSendResults] = useState(null);

  const handleSendBulkMessage = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    if (bulkMediaType === 'text' && !bulkMessageText.trim()) {
      toast.error('Please enter message text');
      return;
    }
    if (bulkMediaType === 'image' && !bulkMessageImageUrl.trim()) {
      toast.error('Please enter an image URL');
      return;
    }

    setBulkSending(true);
    setBulkSendResults(null);
    try {
      const payload = {
        contactIds: selectedIds,
        text: bulkMessageText || undefined,
        type: bulkMediaType,
        mediaUrl: bulkMediaType === 'image' ? bulkMessageImageUrl : undefined,
        caption: bulkMediaType === 'image' && bulkMessageText ? bulkMessageText : undefined,
      };

      const { data } = await api.post('/messages/bulk', payload);
      if (data.success) {
        toast.success('Bulk sending completed!');
        setBulkSendResults(data.data);
        setBulkMessageText('');
        setBulkMessageImageUrl('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send bulk messages');
    } finally {
      setBulkSending(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const { data } = await api.get('/team-chat/users');
      if (data.success) {
        const users = data.data.users || [];
        setAgents(users);
        setFastCache('team_agents', users);
      }
    } catch (err) {
      console.error('Failed to load agents list', err);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchContacts = async () => {
    // Only show loading spinner if we don't already have contacts rendered
    if (contacts.length === 0) {
      setLoading(true);
    }
    try {
      const currentLimit = viewMode === 'kanban' ? 200 : limit;
      const params = {
        page: viewMode === 'kanban' ? 1 : page,
        limit: currentLimit,
        search: debouncedSearch || undefined,
        tags: selectedTag || undefined,
        source: source || undefined,
        optedOut: optedOut === '' ? undefined : optedOut,
        segment: segment || undefined,
        assignedAgent: assignedAgent || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        lastActivityStart: lastActivityStart || undefined,
        lastActivityEnd: lastActivityEnd || undefined,
      };
      
      const { data } = await api.get('/contacts', { params });
      if (data.success) {
        setContacts(data.data.contacts);
        setTotal(data.data.total);
        setPages(data.data.pages);
        // Cache default page 1 for instant return
        if (page === 1 && viewMode === 'list' && !debouncedSearch && !selectedTag && !source && optedOut === '' && !segment && !assignedAgent) {
          setFastCache('contacts_page_1', {
            contacts: data.data.contacts,
            total: data.data.total,
            pages: data.data.pages,
          });
        }
        // Clear selection when contacts change or reload
        setSelectedIds([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch contacts');
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
    fetchContacts();
  }, [
    page, limit, viewMode, selectedTag, source, optedOut, segment, debouncedSearch,
    assignedAgent, startDate, endDate, lastActivityStart, lastActivityEnd
  ]);

  // Live Real-Time Socket Listener: Update contact status dynamically on Meta events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRealtimeMessage = (data) => {
      if (data?.contact) {
        setContacts((prevContacts) =>
          prevContacts.map((c) =>
            c._id === data.contact._id ? { ...c, ...data.contact } : c
          )
        );
      }
    };

    socket.on('new_message', handleRealtimeMessage);

    return () => {
      socket.off('new_message', handleRealtimeMessage);
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setDebouncedSearch(search);
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    const errors = {};
    const trimmedName = (newContact.name || '').trim();
    const trimmedPhone = (newContact.phone || '').trim();
    const trimmedEmail = (newContact.email || '').trim();

    if (!trimmedName) {
      errors.name = 'Full name is required';
    }
    if (!trimmedPhone) {
      errors.phone = 'Phone number is required';
    }
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    if (Object.keys(errors).length > 0) {
      setAddFormErrors(errors);
      return;
    }
    setAddFormErrors({});
    
    try {
      const customFieldsObj = {};
      addCustomFields.forEach((f) => {
        if (f.key && f.key.trim()) customFieldsObj[f.key.trim()] = f.value;
      });

      const payload = {
        name: trimmedName,
        phone: trimmedPhone,
        source: newContact.source || 'manual',
        tags: newContact.tags ? newContact.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        customFields: customFieldsObj
      };

      if (trimmedEmail) {
        payload.email = trimmedEmail;
      }

      const { data } = await api.post('/contacts', payload);
      if (data.success) {
        toast.success('Contact added successfully');
        setIsAddModalOpen(false);
        setNewContact({ name: '', phone: '', email: '', source: 'manual', tags: '' });
        setAddCustomFields([]);
        setAddFormErrors({});
        fetchContacts();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.details?.[0]?.message || err.response?.data?.error || 'Failed to add contact';
      toast.error(errorMsg);
    }
  };

  const handleEditContact = async (e) => {
    e.preventDefault();
    if (!editingContact.name) {
      toast.error('Name is required');
      return;
    }

    try {
      const customFieldsObj = {};
      editCustomFields.forEach((f) => {
        if (f.key && f.key.trim()) customFieldsObj[f.key.trim()] = f.value;
      });

      const payload = {
        name: editingContact.name,
        email: editingContact.email,
        tags: editingContact.tags ? editingContact.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        customFields: customFieldsObj
      };
      const { data } = await api.put(`/contacts/${editingContact._id}`, payload);
      if (data.success) {
        toast.success('Contact updated successfully');
        setIsEditModalOpen(false);
        fetchContacts();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update contact');
    }
  };

  const openEditModal = (contact) => {
    const cf = contact.customFields;
    const entries = cf ? Object.entries(cf).map(([k, v]) => ({ key: k, value: String(v) })) : [];
    setEditCustomFields(entries);
    setEditingContact({
      _id: contact._id,
      name: contact.name || '',
      email: contact.email || '',
      tags: contact.tags ? contact.tags.join(', ') : ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteContact = async (id) => {
    if (!await confirm('Are you sure you want to delete this contact?')) return;
    try {
      const { data } = await api.delete(`/contacts/${id}`);
      if (data.success) {
        toast.success('Contact deleted');
        fetchContacts();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete contact');
    }
  };

  // Bulk Delete implementation
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!await confirm(`Are you sure you want to delete the ${selectedIds.length} selected contacts?`)) return;
    
    setLoading(true);
    try {
      const deletePromises = selectedIds.map(id => api.delete(`/contacts/${id}`));
      await Promise.all(deletePromises);
      toast.success(`${selectedIds.length} contacts deleted successfully`);
      setSelectedIds([]);
      fetchContacts();
    } catch (err) {
      toast.error('Failed to delete some selected contacts');
      fetchContacts();
    } finally {
      setLoading(false);
    }
  };

  const handleMessageContact = async (contactId) => {
    try {
      const { data } = await api.post('/messages/conversations', { contactId });
      if (data.success) {
        toast.success('Starting chat...');
        router.push('/dashboard/inbox');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start chat');
    }
  };

  const handleImportCSV = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error('Please select a CSV or Excel file');
      return;
    }

    const formData = new FormData();
    formData.append('file', csvFile);

    setImporting(true);
    try {
      const { data } = await api.post('/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        toast.success(`Import complete! Imported: ${data.data.imported}, Skipped: ${data.data.skipped}, Errors: ${data.data.errors}`);
        setIsImportModalOpen(false);
        setCsvFile(null);
        fetchContacts();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // Export Contacts to PDF Handler
  const handleExportPDF = async () => {
    setIsActionsDropdownOpen(false);
    setExportingPdf(true);
    const toastId = toast.loading('Preparing contacts PDF export...');

    try {
      let exportList = [];

      // If user selected rows, export only selected
      if (selectedIds.length > 0) {
        exportList = contacts.filter(c => selectedIds.includes(c._id));
      } else {
        // Fetch contacts matching current active filters (up to 1000)
        const params = {
          page: 1,
          limit: 1000,
          search: debouncedSearch || undefined,
          tags: selectedTag || undefined,
          source: source || undefined,
          optedOut: optedOut === '' ? undefined : optedOut,
          segment: segment || undefined,
          assignedAgent: assignedAgent || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          lastActivityStart: lastActivityStart || undefined,
          lastActivityEnd: lastActivityEnd || undefined,
        };

        const { data } = await api.get('/contacts', { params });
        if (data.success && data.data?.contacts?.length) {
          exportList = data.data.contacts;
        } else {
          exportList = contacts;
        }
      }

      if (!exportList || exportList.length === 0) {
        toast.error('No contacts available to export', { id: toastId });
        setExportingPdf(false);
        return;
      }

      // Generate PDF with jsPDF and autoTable
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const primaryColor = [18, 140, 126]; // #128c7e WhatsApp green
      const darkColor = [30, 41, 59];
      const generatedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      // Prepare Table Data
      const tableHeaders = ['No.', 'Name', 'Phone', 'Email', 'Source', 'Tags', 'Status'];
      const tableRows = exportList.map((c, index) => [
        index + 1,
        c.name || 'Anonymous',
        c.phone || '-',
        c.email || '-',
        c.source || 'manual',
        Array.isArray(c.tags) && c.tags.length > 0 ? c.tags.join(', ') : '-',
        c.optedOut ? 'Opted Out' : 'Active'
      ]);

      // Render autoTable
      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: 68,
        theme: 'striped',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left',
          cellPadding: 6,
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: darkColor,
          cellPadding: 5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 125, fontStyle: 'bold' },
          2: { cellWidth: 105, fontStyle: 'bold' },
          3: { cellWidth: 145 },
          4: { cellWidth: 65, halign: 'center' },
          5: { cellWidth: 155 },
          6: { cellWidth: 70, halign: 'center' },
        },
        margin: { top: 68, left: 30, right: 30, bottom: 35 },
        didDrawPage: (data) => {
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();

          // 1. Top green brand accent stripe
          doc.setFillColor(18, 140, 126);
          doc.rect(0, 0, pageWidth, 4, 'F');

          // 2. Company Brand Logo (HariKrushn DigiVerse LLP)
          try {
            if (LOGO_BASE64) {
              // 342x97 ratio 3.525 -> w: 134pt, h: 38pt
              doc.addImage(LOGO_BASE64, 'PNG', 30, 12, 134, 38);
            }
          } catch (imgErr) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(18, 140, 126);
            doc.text('HariKrushn DigiVerse LLP', 30, 36);
          }

          // 3. Right Header Info
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42); // slate-900
          doc.text('Contacts Directory Report', pageWidth - 30, 26, { align: 'right' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139); // slate-500
          doc.text(`Generated: ${generatedDate} IST`, pageWidth - 30, 39, { align: 'right' });

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(18, 140, 126); // emerald green
          doc.text(`Total Records: ${exportList.length} Contacts`, pageWidth - 30, 50, { align: 'right' });

          // 4. Subtle separator line below header
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.75);
          doc.line(30, 58, pageWidth - 30, 58);

          // 5. Footer
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184); // slate-400
          doc.text(
            'HariKrushn DigiVerse LLP • WhatsApp Marketing Platform | Confidential',
            30,
            pageHeight - 14
          );
          doc.text(
            `Page ${data.pageNumber}`,
            pageWidth - 30,
            pageHeight - 14,
            { align: 'right' }
          );
        },
      });

      // Save PDF file
      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`HK_Contacts_Export_${dateStr}.pdf`);

      toast.success(`Exported ${exportList.length} contacts to PDF!`, { id: toastId });
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to export contacts PDF', { id: toastId });
    } finally {
      setExportingPdf(false);
    }
  };

  // Duplicate Scanner Handlers
  const handleOpenDuplicateScanner = async () => {
    setIsDuplicateModalOpen(true);
    setDuplicateScanning(true);
    try {
      const { data } = await api.get('/contacts/duplicates');
      if (data.success) {
        const groups = data.data.groups || [];
        setDuplicateGroups(groups);
        const initialMap = {};
        groups.forEach((grp, idx) => {
          initialMap[idx] = grp.suggestedPrimaryId || grp.contacts[0]?._id;
        });
        setSelectedPrimaryMap(initialMap);
      }
    } catch (err) {
      toast.error('Failed to scan for duplicate contacts');
    } finally {
      setDuplicateScanning(false);
    }
  };

  const handleMergeGroup = async (groupIndex) => {
    const group = duplicateGroups[groupIndex];
    if (!group) return;
    const primaryId = selectedPrimaryMap[groupIndex] || group.contacts[0]?._id;
    const duplicateIds = group.contacts.map(c => c._id).filter(id => id.toString() !== primaryId.toString());

    if (duplicateIds.length === 0) {
      toast.error('Please select a valid primary contact different from duplicates');
      return;
    }

    if (!await confirm(`Merge ${duplicateIds.length} duplicate contacts into the selected primary contact? Messages, tags, notes, and custom fields will be consolidated.`)) {
      return;
    }

    setMergingGroupIndex(groupIndex);
    try {
      const { data } = await api.post('/contacts/merge', {
        primaryContactId: primaryId,
        duplicateContactIds: duplicateIds
      });
      if (data.success) {
        toast.success(data.message || 'Contacts merged successfully!');
        setDuplicateGroups(prev => prev.filter((_, idx) => idx !== groupIndex));
        fetchContacts();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to merge contacts');
    } finally {
      setMergingGroupIndex(null);
    }
  };

  // Quick Toggle Opt-Out / Active Status Handler
  const handleToggleOptOut = async (contact) => {
    const newStatus = !contact.optedOut;
    const actionText = newStatus ? 'Opt-Out' : 'Reactivate (Opt-In)';
    const confirmPrompt = newStatus
      ? `Are you sure you want to opt-out "${contact.name || contact.phone}"? They will be excluded from all automated campaigns.`
      : `Reactivate "${contact.name || contact.phone}" as an Active Subscriber? They will be eligible to receive campaigns again.`;

    if (!(await confirm(confirmPrompt, `${actionText} Contact`))) {
      return;
    }

    try {
      const { data } = await api.put(`/contacts/${contact._id}`, { optedOut: newStatus });
      if (data.success) {
        toast.success(`Contact marked as ${newStatus ? 'Opted Out' : 'Active'}`);
        setContacts((prev) =>
          prev.map((c) => (c._id === contact._id ? { ...c, optedOut: newStatus, optedOutAt: newStatus ? new Date() : undefined } : c))
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update contact status');
    }
  };

  // Kanban Drag and Drop Handler
  const handleDropContact = async (targetColumnKey) => {
    if (!draggedContactId) return;
    const contactToMove = contacts.find((c) => c._id === draggedContactId);
    if (!contactToMove) {
      setDraggedContactId(null);
      return;
    }

    let payload = {};
    let hasChanged = false;

    if (kanbanGroupBy === 'source') {
      if (contactToMove.source !== targetColumnKey) {
        payload.source = targetColumnKey;
        hasChanged = true;
      }
    } else if (kanbanGroupBy === 'segment') {
      const currentSegment = contactToMove.segment || 'new';
      if (currentSegment !== targetColumnKey) {
        payload.segment = targetColumnKey;
        hasChanged = true;
      }
    } else if (kanbanGroupBy === 'status') {
      const targetOptedOut = targetColumnKey === 'optedOut';
      if (contactToMove.optedOut !== targetOptedOut) {
        payload.optedOut = targetOptedOut;
        hasChanged = true;
      }
    }

    setDraggedContactId(null);
    if (!hasChanged) return;

    // Optimistic UI Update
    setContacts((prev) =>
      prev.map((c) => (c._id === contactToMove._id ? { ...c, ...payload } : c))
    );

    try {
      const { data } = await api.put(`/contacts/${contactToMove._id}`, payload);
      if (data.success) {
        toast.success(`Contact moved to "${targetColumnKey.toUpperCase()}"!`);
      }
    } catch (err) {
      toast.error('Failed to update contact');
      fetchContacts();
    }
  };

  // Row selection helpers
  const handleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map(c => c._id));
    }
  };

  // Standard known sources plus any dynamic sources present in contacts
  const defaultSources = ['direct', 'manual', 'import', 'website', 'instagram', 'facebook', 'api', 'webhook', 'campaign'];
  const sources = Array.from(
    new Set([...defaultSources, ...contacts.map(c => c.source).filter(Boolean)])
  );

  // Kanban Columns configuration based on selected kanbanGroupBy
  const getKanbanColumns = () => {
    if (kanbanGroupBy === 'source') {
      const baseSources = [
        { key: 'direct', label: 'Direct', emoji: '💬', subtitle: 'Direct WhatsApp Chat', bgBadge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
        { key: 'manual', label: 'Manual', emoji: '✍️', subtitle: 'Manually Added', bgBadge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
        { key: 'import', label: 'Import', emoji: '📁', subtitle: 'Spreadsheet Upload', bgBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
        { key: 'website', label: 'Website', emoji: '🌐', subtitle: 'Web Lead Capture', bgBadge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
        { key: 'instagram', label: 'Instagram', emoji: '📸', subtitle: 'Instagram DM / Ad', bgBadge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' },
        { key: 'facebook', label: 'Facebook', emoji: '👥', subtitle: 'Facebook Ad / Page', bgBadge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
        { key: 'api', label: 'API / Other', emoji: '⚡', subtitle: 'Webhook & Integrations', bgBadge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
      ];
      const existingKeys = new Set(baseSources.map(s => s.key));
      contacts.forEach(c => {
        if (c.source && !existingKeys.has(c.source.toLowerCase())) {
          const srcKey = c.source.toLowerCase();
          existingKeys.add(srcKey);
          baseSources.push({
            key: srcKey,
            label: c.source.charAt(0).toUpperCase() + c.source.slice(1),
            emoji: '🏷️',
            subtitle: 'Custom Source',
            bgBadge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
          });
        }
      });
      return baseSources;
    }

    if (kanbanGroupBy === 'segment') {
      return [
        { key: 'hot', label: 'Hot 🔥', subtitle: 'High Engagement & Active', emoji: '🔥', bgBadge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
        { key: 'warm', label: 'Warm 🌡️', subtitle: 'Moderate Activity', emoji: '🌡️', bgBadge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
        { key: 'cold', label: 'Cold ❄️', subtitle: 'Low / Inactive Leads', emoji: '❄️', bgBadge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
        { key: 'new', label: 'New ✨', subtitle: 'Recently Added Customers', emoji: '✨', bgBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
      ];
    }

    if (kanbanGroupBy === 'status') {
      return [
        { key: 'active', label: 'Active Subscribers 🟢', subtitle: 'Eligible for Campaigns & Chats', emoji: '🟢', bgBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
        { key: 'optedOut', label: 'Opted Out 🔴', subtitle: 'Unsubscribed / Excluded', emoji: '🔴', bgBadge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
      ];
    }

    return [];
  };

  const getContactsForColumn = (colKey) => {
    return contacts.filter((c) => {
      if (kanbanGroupBy === 'source') {
        const src = (c.source || 'manual').toLowerCase();
        if (colKey === 'api') {
          return src === 'api' || src === 'webhook';
        }
        return src === colKey;
      }
      if (kanbanGroupBy === 'segment') {
        const seg = (c.segment || 'new').toLowerCase();
        return seg === colKey;
      }
      if (kanbanGroupBy === 'status') {
        if (colKey === 'optedOut') return c.optedOut === true;
        return !c.optedOut;
      }
      return false;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Contacts({total})</h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">Manage your subscribers, view tag analytics, and bulk import customers.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleOpenDuplicateScanner}
            className="flex items-center gap-2 px-3.5 py-2 border border-amber-500/30 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl text-sm font-semibold transition-all duration-200"
            title="Scan and merge duplicate contacts"
          >
            <Copy className="w-4 h-4 text-amber-500" />
            <span>Duplicate Scanner</span>
          </button>
          {/* Import / Export Dropdown */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setIsActionsDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 px-3.5 py-2 border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-wa-dark-text-primary bg-white dark:bg-wa-dark-panel hover:bg-wa-bg dark:hover:bg-wa-dark-header rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm"
              aria-expanded={isActionsDropdownOpen}
            >
              <Upload className="w-4 h-4 text-wa-green" />
              <span>Import / Export</span>
              <ChevronDown className={`w-3.5 h-3.5 text-wa-text-secondary transition-transform duration-200 ${isActionsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isActionsDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsActionsDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionsDropdownOpen(false);
                      setIsImportModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-bg dark:hover:bg-wa-dark-header transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-wa-green/10 text-wa-green flex items-center justify-center shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="block font-bold">Import CSV / Excel</span>
                      <span className="block text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-normal">Bulk upload contacts from file</span>
                    </div>
                  </button>

                  <div className="my-1 border-t border-wa-border/50 dark:border-wa-dark-border/50" />

                  <button
                    type="button"
                    disabled={exportingPdf}
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-bg dark:hover:bg-wa-dark-header transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      {exportingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <span className="block font-bold">Export to PDF</span>
                      <span className="block text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-normal">
                        {selectedIds.length > 0 ? `Export ${selectedIds.length} selected contacts` : 'Download contacts list PDF'}
                      </span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          {/* View Mode Switcher: List vs Kanban */}
          <div className="flex items-center p-1 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm'
                  : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary'
              }`}
              title="Standard List View"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm'
                  : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary'
              }`}
              title="Kanban Board View (Drag & Drop)"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>

          <button 
            onClick={() => {
              setAddFormErrors({});
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-white bg-wa-green hover:bg-wa-green-hover rounded-xl text-sm font-semibold shadow-md shadow-wa-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Kanban Group-By Selector Bar (Sources [Default], Segment, Status) */}
      {viewMode === 'kanban' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-sm animate-fade-in">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider mr-1">
              <LayoutGrid className="w-4 h-4 text-wa-green" />
              <span>Group Kanban By:</span>
            </div>
            <div className="inline-flex p-1 bg-wa-bg dark:bg-wa-dark-header rounded-xl border border-wa-border dark:border-wa-dark-border shadow-inner">
              <button
                type="button"
                onClick={() => setKanbanGroupBy('source')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  kanbanGroupBy === 'source'
                    ? 'bg-wa-green text-white shadow-md shadow-wa-green/25'
                    : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary'
                }`}
              >
                <span>Sources</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${kanbanGroupBy === 'source' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>Default</span>
              </button>
              <button
                type="button"
                onClick={() => setKanbanGroupBy('segment')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  kanbanGroupBy === 'segment'
                    ? 'bg-wa-green text-white shadow-md shadow-wa-green/25'
                    : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary'
                }`}
              >
                <span>Segment</span>
                <span className="text-[10px]">🔥 ❄️</span>
              </button>
              <button
                type="button"
                onClick={() => setKanbanGroupBy('status')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  kanbanGroupBy === 'status'
                    ? 'bg-wa-green text-white shadow-md shadow-wa-green/25'
                    : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary'
                }`}
              >
                <span>Status</span>
                <span className="text-[10px]">🟢 🔴</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
            <span className="inline-block w-2 h-2 rounded-full bg-wa-green animate-pulse" />
            <span>Drag card to any column to instantly update contact</span>
          </div>
        </div>
      )}

      {/* Bulk Actions Panel */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 bg-wa-green/10 border border-wa-green/30 dark:border-wa-green/20 rounded-2xl animate-slide-in">
          <div className="flex items-center gap-3 text-wa-green dark:text-wa-green-light text-sm font-semibold">
            <CheckSquare className="w-5 h-5" />
            <span>{selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3.5 py-1.5 text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary font-semibold hover:text-wa-text-primary dark:hover:text-wa-dark-text-primary"
            >
              Cancel Selection
            </button>
            <button
              onClick={() => setIsBulkMessageModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl transition-all duration-200 shadow-md shadow-wa-green/25"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Send Bulk Message</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-md shadow-red-500/25"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
          <input 
            type="text" 
            placeholder="Search by name, phone, or email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
          />
          <button type="submit" className="hidden">Search</button>
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Tag Filter */}
          <div className="flex items-center gap-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl px-3 py-1.5">
            <Filter className="w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
            <input
              type="text"
              placeholder="Filter by tag..."
              value={selectedTag}
              onChange={(e) => { setSelectedTag(e.target.value); setPage(1); }}
              className="bg-transparent border-none outline-none text-xs text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary w-28 focus:ring-0"
            />
          </div>

          {/* Source Filter */}
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30 capitalize"
          >
            <option value="">All Sources</option>
            {sources.map(src => (
              <option key={src} value={src}>
                {src.charAt(0).toUpperCase() + src.slice(1)}
              </option>
            ))}
          </select>

          {/* Segment Filter */}
          <select
            value={segment}
            onChange={(e) => { setSegment(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
          >
            <option value="">All Segments</option>
            <option value="hot">Hot 🔥</option>
            <option value="warm">Warm 🌡️</option>
            <option value="cold">Cold ❄️</option>
            <option value="new">New ✨</option>
          </select>

          {/* Status Filter */}
          <select
            value={optedOut}
            onChange={(e) => { setOptedOut(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
          >
            <option value="">All Statuses</option>
            <option value="false">Active Subscribers</option>
            <option value="true">Opted Out</option>
          </select>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-all duration-200 ${
              showAdvancedFilters 
                ? 'bg-wa-green/10 text-wa-green border-wa-green/30' 
                : 'border-wa-border dark:border-wa-dark-border text-wa-text-secondary dark:text-wa-dark-text-secondary bg-white dark:bg-wa-dark-panel hover:bg-wa-bg'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Advanced Filters</span>
          </button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 shadow-sm animate-fade-in">
          {/* Assigned Agent */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-wa-text-secondary uppercase">Assigned User</label>
            <select
              value={assignedAgent}
              onChange={(e) => { setAssignedAgent(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
            >
              <option value="">All Agents</option>
              <option value="unassigned">Unassigned</option>
              {agents.map(agent => (
                <option key={agent._id} value={agent._id}>{agent.name}</option>
              ))}
            </select>
          </div>

          {/* Date Created Start */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-wa-text-secondary uppercase">Created From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-1 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
            />
          </div>

          {/* Date Created End */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-wa-text-secondary uppercase">Created To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-1 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
            />
          </div>

          {/* Last Activity Start */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-wa-text-secondary uppercase">Activity From</label>
            <input
              type="date"
              value={lastActivityStart}
              onChange={(e) => { setLastActivityStart(e.target.value); setPage(1); }}
              className="w-full px-3 py-1 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
            />
          </div>

          {/* Last Activity End */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-wa-text-secondary uppercase">Activity To</label>
            <input
              type="date"
              value={lastActivityEnd}
              onChange={(e) => { setLastActivityEnd(e.target.value); setPage(1); }}
              className="w-full px-3 py-1 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
            />
          </div>
        </div>
      )}

      {/* View Content: Kanban Board vs Table View */}
      {viewMode === 'kanban' ? (
        <div className="space-y-4">
          {loading && contacts.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-wa-green mx-auto mb-3" />
              <span className="text-sm font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary">Loading contacts into Kanban board...</span>
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-sm text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
              No contacts found matching your current filter criteria.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-6 pt-1 px-1 scrollbar-thin items-start min-h-[580px]">
              {getKanbanColumns().map((col) => {
                const colContacts = getContactsForColumn(col.key);

                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropContact(col.key);
                    }}
                    className="w-80 shrink-0 bg-slate-50/90 dark:bg-wa-dark-header/40 border border-slate-200/90 dark:border-wa-dark-border rounded-2xl flex flex-col max-h-[calc(100vh-220px)] shadow-sm hover:border-wa-green/40 transition-colors"
                  >
                    {/* Column Header */}
                    <div className="p-3.5 border-b border-slate-200 dark:border-wa-dark-border bg-white/80 dark:bg-wa-dark-panel/80 rounded-t-2xl flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg select-none">{col.emoji}</span>
                        <div>
                          <h3 className="text-xs font-bold text-wa-text-primary dark:text-wa-dark-text-primary uppercase tracking-wider">
                            {col.label}
                          </h3>
                          {col.subtitle && (
                            <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary leading-tight mt-0.5">
                              {col.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${col.bgBadge || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {colContacts.length}
                      </span>
                    </div>

                    {/* Column Body / Drop Zone */}
                    <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-thin min-h-[220px]">
                      {colContacts.length === 0 ? (
                        <div className="h-44 border-2 border-dashed border-slate-200 dark:border-wa-dark-border/60 rounded-xl flex flex-col items-center justify-center text-center p-4 text-wa-text-secondary dark:text-wa-dark-text-secondary bg-white/40 dark:bg-wa-dark-panel/20">
                          <span className="text-2xl mb-1 opacity-50">{col.emoji}</span>
                          <span className="text-xs font-semibold">No contacts here</span>
                          <span className="text-[10px] opacity-75 mt-0.5">Drag & drop any card here</span>
                        </div>
                      ) : (
                        colContacts.map((contact) => {
                          const avatarClass = getAvatarBg(contact.name);
                          const initials = contact.name ? contact.name.substring(0, 2).toUpperCase() : 'C';
                          const isBeingDragged = draggedContactId === contact._id;

                          return (
                            <div
                              key={contact._id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedContactId(contact._id);
                                e.dataTransfer.setData('text/plain', contact._id);
                              }}
                              onDragEnd={() => setDraggedContactId(null)}
                              className={`group bg-white dark:bg-wa-dark-panel border rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                                isBeingDragged
                                  ? 'opacity-30 border-dashed border-wa-green scale-95'
                                  : 'border-slate-200 dark:border-wa-dark-border hover:border-wa-green/60'
                              }`}
                            >
                              {/* Top Bar: Drag Grip, Avatar, Name, Status Dot */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className={`w-8 h-8 rounded-full ${avatarClass} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}>
                                    {initials}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4 
                                      onClick={() => { setDetailsContactId(contact._id); setIsDetailsModalOpen(true); }}
                                      className="text-xs font-bold text-wa-text-primary dark:text-wa-dark-text-primary truncate hover:text-wa-green cursor-pointer flex items-center gap-1 group/name"
                                      title={contact.name}
                                    >
                                      <span className="truncate">{contact.name || 'Anonymous'}</span>
                                      <Eye className="w-3 h-3 opacity-0 group-hover/name:opacity-100 transition-opacity text-wa-green shrink-0" />
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] font-mono text-wa-text-secondary dark:text-wa-dark-text-secondary">
                                        {contact.phone}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  {contact.optedOut ? (
                                    <span className="w-2 h-2 rounded-full bg-red-500" title="Opted Out" />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-wa-green animate-pulse" title="Active" />
                                  )}
                                  <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400" />
                                </div>
                              </div>

                              {/* Mid Info: Engagement & Source */}
                              <div className="flex items-center justify-between text-[11px] py-1 border-t border-slate-100 dark:border-wa-dark-border/40 my-2">
                                <ScoreBadge score={contact.engagementScore} segment={contact.segment} size="xs" />
                                <span className="px-1.5 py-0.5 rounded bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border text-[10px] font-medium capitalize text-wa-text-secondary dark:text-wa-dark-text-secondary">
                                  {contact.source || 'manual'}
                                </span>
                              </div>

                              {/* Tags */}
                              {contact.tags && contact.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2.5">
                                  {contact.tags.slice(0, 3).map((t) => {
                                    const tagStyles = getTagColorClass(t);
                                    return (
                                      <span
                                        key={t}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${tagStyles.badge}`}
                                      >
                                        <span className={`w-1 h-1 rounded-full ${tagStyles.dot}`} />
                                        <span className="truncate max-w-[85px]">{t}</span>
                                      </span>
                                    );
                                  })}
                                  {contact.tags.length > 3 && (
                                    <span className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary self-center">
                                      +{contact.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Card Footer: Quick Actions */}
                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-wa-dark-border/40">
                                <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                                  ID: {contact._id.substring(contact._id.length - 6)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMessageContact(contact._id);
                                    }}
                                    className="p-1 text-wa-green hover:bg-wa-green/10 rounded-lg transition-colors"
                                    title="Start WhatsApp Chat"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDetailsContactId(contact._id);
                                      setIsDetailsModalOpen(true);
                                    }}
                                    className="p-1 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                    title="View & Edit Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteContact(contact._id);
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Delete Contact"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Table view */
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="hidden sm:table w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-wa-border dark:border-wa-dark-border text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary bg-wa-bg dark:bg-wa-dark-header/40">
                <th className="px-6 py-4 w-10">
                  <button 
                    onClick={handleSelectAll} 
                    className="text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-green transition-colors"
                  >
                    {selectedIds.length === contacts.length && contacts.length > 0 ? (
                      <CheckSquare className="w-4.5 h-4.5 text-wa-green" />
                    ) : (
                      <Square className="w-4.5 h-4.5" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">WhatsApp Phone</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Engagement</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Tags</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                      <span className="font-medium">Loading contacts...</span>
                    </div>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
                    No contacts found matching your criteria.
                  </td>
                </tr>
              ) : (
                contacts.map((contact, idx) => {
                  const isChecked = selectedIds.includes(contact._id);
                  const avatarClass = getAvatarBg(contact.name);
                  const initials = contact.name ? contact.name.substring(0, 2).toUpperCase() : 'C';

                  return (
                    <tr 
                      key={contact._id} 
                      style={{ animationDelay: `${Math.min(idx, 15) * 25}ms` }}
                      className={`animate-row-in hover:bg-wa-bg/60 dark:hover:bg-wa-dark-header/30 transition-all duration-150 ${isChecked ? 'bg-wa-green/5 dark:bg-wa-green/5' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleSelectRow(contact._id)}
                          className="text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-green transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4.5 h-4.5 text-wa-green" />
                          ) : (
                            <Square className="w-4.5 h-4.5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${avatarClass} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}>
                            {initials}
                          </div>
                          <div>
                            <span className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary block hover:underline cursor-pointer flex items-center gap-1 group/name" onClick={() => { setDetailsContactId(contact._id); setIsDetailsModalOpen(true); }}>
                              <span>{contact.name}</span>
                              <Eye className="w-3.5 h-3.5 opacity-0 group-hover/name:opacity-100 transition-opacity text-wa-green" />
                            </span>
                            <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider bg-wa-bg dark:bg-wa-dark-header px-1.5 py-0.5 rounded border border-wa-border dark:border-wa-dark-border font-mono mt-0.5 inline-block">
                              ID: {contact._id.substring(contact._id.length - 6)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-wa-text-primary dark:text-wa-dark-text-primary font-mono text-xs font-medium">
                        {contact.phone}
                      </td>
                      <td className="px-6 py-4 text-wa-text-secondary dark:text-wa-dark-text-secondary text-xs">
                        {contact.email || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <ScoreBadge score={contact.engagementScore} segment={contact.segment} size="xs" />
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-lg bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium capitalize">
                          {contact.source}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.map(t => {
                              const tagStyles = getTagColorClass(t);
                              return (
                                <span 
                                  key={t} 
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${tagStyles.badge}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${tagStyles.dot}`} />
                                  <span>{t}</span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary italic">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleOptOut(contact)}
                          title={`Click to mark as ${contact.optedOut ? 'Active' : 'Opted Out'}`}
                          className="group cursor-pointer focus:outline-none transition-transform active:scale-95"
                        >
                          {contact.optedOut ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-950 group-hover:bg-red-100 transition-colors">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              Opted Out
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-wa-green/10 text-wa-green border border-wa-green/20 group-hover:bg-wa-green/20 transition-colors">
                              <span className="w-1.5 h-1.5 rounded-full bg-wa-green animate-pulse" />
                              Active
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleMessageContact(contact._id)}
                            className="p-2 text-wa-green hover:bg-wa-green/10 rounded-xl transition-all duration-200"
                            title="Message Contact"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { setDetailsContactId(contact._id); setIsDetailsModalOpen(true); }}
                            className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all duration-200"
                            title="View / Edit Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteContact(contact._id)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                            title="Delete Contact"
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

          {/* Card view on mobile */}
          <div className="sm:hidden block divide-y divide-wa-border dark:divide-wa-dark-border">
            {loading ? (
              <div className="px-6 py-12 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
                <div className="flex justify-center items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                  <span className="font-medium">Loading contacts...</span>
                </div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="px-6 py-12 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
                No contacts found matching your criteria.
              </div>
            ) : (
              contacts.map((contact) => {
                const isChecked = selectedIds.includes(contact._id);
                const avatarClass = getAvatarBg(contact.name);
                const initials = contact.name ? contact.name.substring(0, 2).toUpperCase() : 'C';

                return (
                  <div 
                    key={contact._id} 
                    className={`p-4 space-y-3 transition-colors ${isChecked ? 'bg-wa-green/5 dark:bg-wa-green/5' : ''}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full ${avatarClass} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}>
                          {initials}
                        </div>
                        <div>
                          <span className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary block hover:underline cursor-pointer flex items-center gap-1 group/name" onClick={() => { setDetailsContactId(contact._id); setIsDetailsModalOpen(true); }}>
                            <span>{contact.name}</span>
                            <Eye className="w-3.5 h-3.5 opacity-0 group-hover/name:opacity-100 transition-opacity text-wa-green" />
                          </span>
                          <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider font-mono">
                            ID: {contact._id.substring(contact._id.length - 6)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleSelectRow(contact._id)}
                          className="text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-green transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-wa-green" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Contact Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60">Phone</span>
                        <span className="font-mono text-wa-text-primary dark:text-wa-dark-text-primary font-medium">{contact.phone}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60">Engagement</span>
                        <div className="mt-0.5">
                          <ScoreBadge score={contact.engagementScore} segment={contact.segment} size="xs" />
                        </div>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60">Email</span>
                        <span className="text-wa-text-secondary dark:text-wa-dark-text-secondary truncate block">{contact.email || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60">Source</span>
                        <span className="capitalize text-wa-text-secondary dark:text-wa-dark-text-secondary">{contact.source}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary/60">Status</span>
                        {contact.optedOut ? (
                          <span className="text-red-500 font-semibold block">Opted Out</span>
                        ) : (
                          <span className="text-wa-green font-semibold block">Active</span>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {contact.tags.map(t => {
                          const tagStyles = getTagColorClass(t);
                          return (
                            <span 
                              key={t} 
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tagStyles.badge}`}
                            >
                              <span className={`w-1 h-1 rounded-full ${tagStyles.dot}`} />
                              <span>{t}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-wa-border/40 dark:border-wa-dark-border/20">
                      <span className="text-[10px] text-wa-text-light">Actions</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleMessageContact(contact._id)}
                          className="p-2 text-wa-green hover:bg-wa-green/10 rounded-xl transition-all duration-200"
                          title="Message Contact"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setDetailsContactId(contact._id); setIsDetailsModalOpen(true); }}
                          className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all duration-200"
                          title="View / Edit Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteContact(contact._id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                          title="Delete Contact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pagination controls */}
        {pages > 1 && (
          <div className="px-6 py-4 border-t border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-wa-bg/30 dark:bg-wa-dark-header/10">
            <span className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} contacts
            </span>
            <div className="flex items-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-white dark:bg-wa-dark-panel hover:bg-wa-bg dark:hover:bg-wa-dark-header disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4.5 h-4.5 text-wa-text-primary dark:text-wa-dark-text-primary" />
              </button>
              <span className="text-xs dark:text-white font-bold">Page {page} of {pages}</span>
              <button
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-white dark:bg-wa-dark-panel hover:bg-wa-bg dark:hover:bg-wa-dark-header disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4.5 h-4.5 text-wa-text-primary dark:text-wa-dark-text-primary" />
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* MODAL: ADD CONTACT */}
      {isAddModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header shrink-0">
              <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Create New Contact</h3>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setAddFormErrors({});
                }} 
                className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors"
              >
                <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleAddContact} noValidate className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className={`absolute left-3.5 top-3 w-4 h-4 ${addFormErrors.name ? 'text-red-500' : 'text-wa-text-secondary dark:text-wa-dark-text-secondary'}`} />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={newContact.name}
                    onChange={(e) => {
                      setNewContact({...newContact, name: e.target.value});
                      if (addFormErrors.name) setAddFormErrors(prev => ({ ...prev, name: '' }));
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none transition-all ${
                      addFormErrors.name
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-wa-border dark:border-wa-dark-border focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green'
                    }`}
                  />
                </div>
                {addFormErrors.name && (
                  <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                    <span>{addFormErrors.name}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className={`absolute left-3.5 top-3 w-4 h-4 ${addFormErrors.phone ? 'text-red-500' : 'text-wa-text-secondary dark:text-wa-dark-text-secondary'}`} />
                  <input
                    type="tel"
                    placeholder="+1234567890"
                    value={newContact.phone}
                    onChange={(e) => {
                      setNewContact({...newContact, phone: e.target.value});
                      if (addFormErrors.phone) setAddFormErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none transition-all font-mono ${
                      addFormErrors.phone
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-wa-border dark:border-wa-dark-border focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green'
                    }`}
                  />
                </div>
                {addFormErrors.phone ? (
                  <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                    <span>{addFormErrors.phone}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Must include country code without symbols (e.g. +14155552671)</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">
                  Email Address <span className="text-[10px] lowercase font-normal text-wa-text-secondary dark:text-wa-dark-text-secondary">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3.5 top-3 w-4 h-4 ${addFormErrors.email ? 'text-red-500' : 'text-wa-text-secondary dark:text-wa-dark-text-secondary'}`} />
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={newContact.email}
                    onChange={(e) => {
                      setNewContact({...newContact, email: e.target.value});
                      if (addFormErrors.email) setAddFormErrors(prev => ({ ...prev, email: '' }));
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none transition-all ${
                      addFormErrors.email
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-wa-border dark:border-wa-dark-border focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green'
                    }`}
                  />
                </div>
                {addFormErrors.email && (
                  <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                    <span>{addFormErrors.email}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Source</label>
                <select
                  value={newContact.source}
                  onChange={(e) => setNewContact({...newContact, source: e.target.value})}
                  className="w-full px-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30 capitalize"
                >
                  <option value="manual">Manual</option>
                  <option value="direct">Direct</option>
                  <option value="website">Website</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="import">Import</option>
                  <option value="api">API</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Tags</label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                  <input
                    type="text"
                    placeholder="leads, vip, customer"
                    value={newContact.tags}
                    onChange={(e) => setNewContact({...newContact, tags: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                  />
                </div>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Comma-separated tags list</p>
              </div>

              {/* Dynamic Custom Fields in Add Contact */}
              <div className="pt-3 border-t border-wa-border dark:border-wa-dark-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary">Custom Fields (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setAddCustomFields([...addCustomFields, { key: '', value: '' }])}
                    className="text-xs font-semibold text-wa-green hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Field
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {['Company', 'City', 'Designation'].map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => {
                        if (!addCustomFields.some(f => f.key.toLowerCase() === field.toLowerCase())) {
                          setAddCustomFields([...addCustomFields, { key: field, value: '' }]);
                        }
                      }}
                      className="px-2 py-0.5 text-[10px] rounded-md bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:text-wa-green hover:border-wa-green/40 transition-colors"
                    >
                      + {field}
                    </button>
                  ))}
                </div>

                {addCustomFields.length > 0 && (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {addCustomFields.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Field name (e.g. City)"
                          value={f.key}
                          onChange={(e) => {
                            const updated = [...addCustomFields];
                            updated[idx].key = e.target.value;
                            setAddCustomFields(updated);
                          }}
                          className="w-1/2 px-3 py-1.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-1 focus:ring-wa-green"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={f.value}
                          onChange={(e) => {
                            const updated = [...addCustomFields];
                            updated[idx].value = e.target.value;
                            setAddCustomFields(updated);
                          }}
                          className="w-1/2 px-3 py-1.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-1 focus:ring-wa-green"
                        />
                        <button
                          type="button"
                          onClick={() => setAddCustomFields(addCustomFields.filter((_, i) => i !== idx))}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddFormErrors({});
                  }}
                  className="px-4 py-2 text-sm font-semibold border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-bg rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary transition-all duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-sm font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md transition-all duration-200"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* MODAL: EDIT CONTACT */}
      {isEditModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header shrink-0">
              <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Edit Contact Details</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleEditContact} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={editingContact.name}
                    onChange={(e) => setEditingContact({...editingContact, name: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={editingContact.email}
                    onChange={(e) => setEditingContact({...editingContact, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Tags</label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                  <input
                    type="text"
                    placeholder="leads, vip, customer"
                    value={editingContact.tags}
                    onChange={(e) => setEditingContact({...editingContact, tags: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                  />
                </div>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Comma-separated tags list</p>
              </div>

              {/* Dynamic Custom Fields in Edit Contact */}
              <div className="pt-3 border-t border-wa-border dark:border-wa-dark-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary">Custom Fields</label>
                  <button
                    type="button"
                    onClick={() => setEditCustomFields([...editCustomFields, { key: '', value: '' }])}
                    className="text-xs font-semibold text-wa-green hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Field
                  </button>
                </div>

                {editCustomFields.length > 0 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {editCustomFields.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Field name"
                          value={f.key}
                          onChange={(e) => {
                            const updated = [...editCustomFields];
                            updated[idx].key = e.target.value;
                            setEditCustomFields(updated);
                          }}
                          className="w-1/2 px-3 py-1.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-1 focus:ring-wa-green"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={f.value}
                          onChange={(e) => {
                            const updated = [...editCustomFields];
                            updated[idx].value = e.target.value;
                            setEditCustomFields(updated);
                          }}
                          className="w-1/2 px-3 py-1.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-1 focus:ring-wa-green"
                        />
                        <button
                          type="button"
                          onClick={() => setEditCustomFields(editCustomFields.filter((_, i) => i !== idx))}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary italic">No custom fields assigned to this contact.</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-bg rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary transition-all duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-sm font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md transition-all duration-200"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* MODAL: IMPORT CSV / EXCEL */}
      {isImportModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-wa-green" />
                <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Import Contacts (CSV & Excel)</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleImportCSV} className="p-6 space-y-4">
              <div className="p-4 bg-wa-green/10 border border-wa-green/30 dark:border-wa-green/20 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-wa-green dark:text-wa-green-light uppercase flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" /> Spreadsheet Format Guidelines (.csv, .xlsx, .xls)
                </h4>
                <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed">
                  Your spreadsheet must have a header row with a <span className="font-bold text-wa-text-primary dark:text-white">phone</span> column (with country code). Optional: <span className="font-bold text-wa-text-primary dark:text-white">name</span>, <span className="font-bold text-wa-text-primary dark:text-white">email</span>, <span className="font-bold text-wa-text-primary dark:text-white">tags</span>.
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  💡 <strong>Custom Fields Auto-Import:</strong> Any extra columns (like Company, City, Address) will automatically be saved into Custom Fields!
                </p>
                <div className="bg-wa-bg dark:bg-wa-dark-header p-2.5 rounded-lg border border-wa-border dark:border-wa-dark-border font-mono text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary overflow-x-auto leading-relaxed">
                  phone,name,email,tags,company,city<br />
                  +14155552671,John Doe,john@test.com,vip;leads,HK Digiverse,Ahmedabad<br />
                  +919876543210,Jane Smith,,promo,Acme Corp,Surat
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Select CSV or Excel File</label>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  required
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full text-xs text-wa-text-secondary file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border file:border-wa-border dark:file:border-wa-dark-border file:text-xs file:font-semibold file:bg-wa-bg dark:file:bg-wa-dark-header file:text-wa-text-primary dark:file:text-wa-dark-text-primary hover:file:bg-wa-border dark:hover:file:bg-wa-dark-border cursor-pointer transition-colors"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button 
                  type="button" 
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-bg rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary transition-all duration-200"
                  disabled={importing}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={importing}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md transition-all duration-200"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing Spreadsheet...</span>
                    </>
                  ) : (
                    <span>Start Import</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* MODAL: DUPLICATE DETECTION & MERGE */}
      {isDuplicateModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary text-base">Duplicate Contact Scanner</h3>
                  <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">Detect contacts sharing the same phone number or email and merge them cleanly.</p>
                </div>
              </div>
              <button onClick={() => setIsDuplicateModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {duplicateScanning ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <p className="text-sm font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary">Scanning contacts for duplicates...</p>
                </div>
              ) : duplicateGroups.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary text-base">Zero Duplicates Found!</h4>
                  <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary max-w-sm mx-auto">
                    Your contact database has no duplicate records sharing the same phone number or email address.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                    <span>Found <strong>{duplicateGroups.length}</strong> duplicate cluster(s) across your database.</span>
                    <span className="text-[11px] opacity-80">Select which contact to keep as Primary (Master).</span>
                  </div>

                  {duplicateGroups.map((group, gIdx) => {
                    const currentPrimaryId = selectedPrimaryMap[gIdx] || group.contacts[0]?._id;
                    const isMergingThis = mergingGroupIndex === gIdx;

                    return (
                      <div key={gIdx} className="border border-wa-border dark:border-wa-dark-border rounded-xl p-4 bg-wa-bg/30 dark:bg-wa-dark-header/20 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                              Matching {group.type}: {group.matchKey}
                            </span>
                            <span className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">({group.contacts.length} copies)</span>
                          </div>
                          <button
                            type="button"
                            disabled={isMergingThis}
                            onClick={() => handleMergeGroup(gIdx)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-wa-green hover:bg-wa-green-hover rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isMergingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            <span>Merge Group</span>
                          </button>
                        </div>

                        {/* Contacts Comparison Table / List */}
                        <div className="space-y-2">
                          {group.contacts.map((c) => {
                            const isPrimary = c._id.toString() === currentPrimaryId?.toString();
                            return (
                              <label
                                key={c._id}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                  isPrimary 
                                    ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/10 dark:border-emerald-500/30' 
                                    : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border hover:border-wa-green/30'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`primary_${gIdx}`}
                                  checked={isPrimary}
                                  onChange={() => setSelectedPrimaryMap({ ...selectedPrimaryMap, [gIdx]: c._id })}
                                  className="mt-1 text-wa-green focus:ring-wa-green"
                                />
                                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary block truncate">
                                      {c.name || 'Anonymous'}
                                      {isPrimary && <span className="ml-1.5 text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded">PRIMARY</span>}
                                    </span>
                                    <span className="text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono text-[11px]">{c.phone}</span>
                                  </div>
                                  <div>
                                    <span className="text-wa-text-secondary dark:text-wa-dark-text-secondary block truncate">{c.email || 'No email'}</span>
                                    <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary capitalize">Source: {c.source || 'manual'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary block">
                                      Messages: {c.totalMessages || 0}
                                    </span>
                                    <div className="flex gap-1 flex-wrap mt-0.5">
                                      {(c.tags || []).slice(0, 3).map((t, ti) => (
                                        <span key={ti} className="text-[9px] px-1 py-0.2 rounded bg-wa-bg dark:bg-wa-dark-header border border-wa-border/50">{t}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-wa-border dark:border-wa-dark-border bg-wa-bg dark:bg-wa-dark-header flex justify-between items-center shrink-0">
              <span className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary">
                Merging consolidates all chat histories, notes, and tags into the selected Primary contact.
              </span>
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel rounded-lg hover:bg-wa-bg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* MODAL: DIRECT BULK MESSAGE */}
      {isBulkMessageModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
              <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Send Direct Bulk Message</h3>
              <button 
                onClick={() => {
                  if (!bulkSending) {
                    setIsBulkMessageModalOpen(false);
                    setBulkSendResults(null);
                  }
                }} 
                disabled={bulkSending}
                className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
              </button>
            </div>

            <div className="p-6">
              {bulkSendResults ? (
                /* Results View */
                <div className="space-y-4">
                  <div className="p-4 bg-wa-bg dark:bg-wa-dark-header rounded-xl border border-wa-border dark:border-wa-dark-border text-center">
                    <h4 className="text-sm font-bold text-wa-text-primary dark:text-white">Bulk Dispatch Summary</h4>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="bg-wa-panel-header dark:bg-wa-dark-panel-header p-2.5 rounded-lg">
                        <span className="block text-[10px] uppercase font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary">Total</span>
                        <span className="text-lg font-extrabold text-wa-text-primary dark:text-white">{bulkSendResults.total}</span>
                      </div>
                      <div className="bg-wa-green/10 dark:bg-wa-green/20 p-2.5 rounded-lg border border-wa-green/20">
                        <span className="block text-[10px] uppercase font-bold text-wa-green dark:text-wa-green-light">Succeeded</span>
                        <span className="text-lg font-extrabold text-wa-green dark:text-wa-green-light">{bulkSendResults.sent}</span>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-100 dark:border-red-900/30">
                        <span className="block text-[10px] uppercase font-bold text-red-500">Failed</span>
                        <span className="text-lg font-extrabold text-red-500">{bulkSendResults.failed}</span>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-wa-border dark:border-wa-dark-border rounded-xl p-3 bg-wa-bg/30 dark:bg-wa-dark-header/10">
                    <span className="text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider block mb-2">Detailed Logs</span>
                    {bulkSendResults.details.map((detail, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs border-b border-wa-border dark:border-wa-dark-border/40 pb-2 last:border-0 last:pb-0">
                        <div>
                          <span className="font-semibold text-wa-text-primary dark:text-white block">{detail.name || 'Unknown'}</span>
                          <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono">{detail.phone}</span>
                        </div>
                        <div className="text-right shrink-0">
                          {detail.status === 'sent' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-wa-green/10 text-wa-green">Sent</span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-500">Failed</span>
                              <span className="block text-[9px] text-red-400 mt-1 max-w-[200px] break-words">{detail.error || 'Unknown Error'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBulkMessageModalOpen(false);
                        setBulkSendResults(null);
                        setSelectedIds([]);
                        fetchContacts();
                      }}
                      className="px-5 py-2 text-sm font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md transition-all duration-200"
                    >
                      Close and Clear Selection
                    </button>
                  </div>
                </div>
              ) : (
                /* Sending Form View */
                <form onSubmit={handleSendBulkMessage} className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                      ⚠️ 24-Hour Policy Notice
                    </h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      Direct (non-template) messages will <strong>only</strong> be delivered to contacts who messaged your business in the last 24 hours. Messages to other contacts will fail.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary">Message Type</label>
                    <div className="flex gap-2 p-1 bg-wa-bg dark:bg-wa-dark-header rounded-xl border border-wa-border dark:border-wa-dark-border">
                      <button
                        type="button"
                        onClick={() => setBulkMediaType('text')}
                        disabled={bulkSending}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${bulkMediaType === 'text' ? 'bg-wa-green text-white shadow-sm' : 'text-wa-text-secondary hover:text-wa-text-primary'}`}
                      >
                        Text Message
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkMediaType('image')}
                        disabled={bulkSending}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${bulkMediaType === 'image' ? 'bg-wa-green text-white shadow-sm' : 'text-wa-text-secondary hover:text-wa-text-primary'}`}
                      >
                        Image Message
                      </button>
                    </div>
                  </div>

                  {bulkMediaType === 'image' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary">Image URL *</label>
                      <input
                        type="url"
                        required
                        disabled={bulkSending}
                        placeholder="https://example.com/image.jpg"
                        value={bulkMessageImageUrl}
                        onChange={(e) => setBulkMessageImageUrl(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary">
                      {bulkMediaType === 'image' ? 'Caption' : 'Message Text *'}
                    </label>
                    <textarea
                      rows="4"
                      required={bulkMediaType === 'text'}
                      disabled={bulkSending}
                      placeholder={bulkMediaType === 'image' ? 'Optional caption...' : 'Type your message here...'}
                      value={bulkMessageText}
                      onChange={(e) => setBulkMessageText(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all resize-none"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                    <button 
                      type="button" 
                      onClick={() => setIsBulkMessageModalOpen(false)}
                      disabled={bulkSending}
                      className="px-4 py-2 text-sm font-semibold border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-bg rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary transition-all duration-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={bulkSending}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md transition-all duration-200 disabled:opacity-50"
                    >
                      {bulkSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending ({selectedIds.length})...</span>
                        </>
                      ) : (
                        <span>Send to {selectedIds.length} Contacts</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}

      {isDetailsModalOpen && (
        <ContactDetailsModal
          contactId={detailsContactId}
          onClose={() => setIsDetailsModalOpen(false)}
          onUpdateSuccess={() => fetchContacts()}
        />
      )}
    </div>
  );
}
