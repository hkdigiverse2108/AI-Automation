'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { 
  Search, Plus, Upload, Trash2, Filter, ChevronLeft, ChevronRight, 
  X, Mail, Phone, User, Tag, HelpCircle, Loader2, MessageSquare, Edit2, CheckSquare, Square
} from 'lucide-react';
import api from '../lib/api';
import { ScoreBadge } from './ContactScoreCard';

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
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);

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
  
  // Add Contact Form State
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'manual',
    tags: ''
  });

  // Edit Contact Form State
  const [editingContact, setEditingContact] = useState({
    _id: '',
    name: '',
    email: '',
    tags: ''
  });
  
  // CSV Import State
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);

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

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch || undefined,
        tags: selectedTag || undefined,
        source: source || undefined,
        optedOut: optedOut === '' ? undefined : optedOut,
        segment: segment || undefined
      };
      
      const { data } = await api.get('/contacts', { params });
      if (data.success) {
        setContacts(data.data.contacts);
        setTotal(data.data.total);
        setPages(data.data.pages);
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
  }, [page, selectedTag, source, optedOut, segment, debouncedSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setDebouncedSearch(search);
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContact.phone || !newContact.name) {
      toast.error('Name and Phone number are required');
      return;
    }
    
    try {
      const payload = {
        ...newContact,
        tags: newContact.tags ? newContact.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };
      const { data } = await api.post('/contacts', payload);
      if (data.success) {
        toast.success('Contact added successfully');
        setIsAddModalOpen(false);
        setNewContact({ name: '', phone: '', email: '', source: 'manual', tags: '' });
        fetchContacts();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add contact');
    }
  };

  const handleEditContact = async (e) => {
    e.preventDefault();
    if (!editingContact.name) {
      toast.error('Name is required');
      return;
    }

    try {
      const payload = {
        name: editingContact.name,
        email: editingContact.email,
        tags: editingContact.tags ? editingContact.tags.split(',').map(t => t.trim()).filter(Boolean) : []
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
    setEditingContact({
      _id: contact._id,
      name: contact.name || '',
      email: contact.email || '',
      tags: contact.tags ? contact.tags.join(', ') : ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteContact = async (id) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
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
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected contacts?`)) return;
    
    setLoading(true);
    try {
      // Call individual soft deletes in parallel
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
      toast.error('Please select a CSV file');
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

  const sources = ['manual', 'import', 'api', 'webhook', 'campaign'];

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Contacts & Audience ({total})</h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">Manage your subscribers, view tag analytics, and bulk import customers.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-wa-dark-text-primary bg-white dark:bg-wa-dark-panel hover:bg-wa-bg dark:hover:bg-wa-dark-header rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-wa-green hover:bg-wa-green-hover rounded-xl text-sm font-semibold shadow-md shadow-wa-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

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
            className="px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-wa-dark-text-primary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
          >
            <option value="">All Sources</option>
            {sources.map(src => (
              <option key={src} value={src}>{src}</option>
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
        </div>
      </div>

      {/* Table view */}
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
                  <td colSpan="8" className="px-6 py-12 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                      <span className="font-medium">Loading contacts...</span>
                    </div>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
                    No contacts found matching your criteria.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => {
                  const isChecked = selectedIds.includes(contact._id);
                  const avatarClass = getAvatarBg(contact.name);
                  const initials = contact.name ? contact.name.substring(0, 2).toUpperCase() : 'C';
                  
                  return (
                    <tr 
                      key={contact._id} 
                      className={`hover:bg-wa-bg/50 dark:hover:bg-wa-dark-header/20 transition-colors ${isChecked ? 'bg-wa-green/5 dark:bg-wa-green/5' : ''}`}
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
                            <span className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary block hover:underline cursor-pointer" onClick={() => openEditModal(contact)}>
                              {contact.name}
                            </span>
                            <span className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider bg-wa-bg dark:bg-wa-dark-header px-1.5 py-0.5 rounded border border-wa-border dark:border-wa-dark-border font-mono">
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
                        {contact.optedOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-950">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Opted Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-wa-green/10 text-wa-green border border-wa-green/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-wa-green animate-pulse" />
                            Active
                          </span>
                        )}
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
                            onClick={() => openEditModal(contact)}
                            className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all duration-200"
                            title="Edit Contact"
                          >
                            <Edit2 className="w-4 h-4" />
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
                          <span className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary block hover:underline cursor-pointer" onClick={() => openEditModal(contact)}>
                            {contact.name}
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
                          onClick={() => openEditModal(contact)}
                          className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all duration-200"
                          title="Edit Contact"
                        >
                          <Edit2 className="w-4 h-4" />
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

      {/* MODAL: ADD CONTACT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
              <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Create New Contact</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleAddContact} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={newContact.name}
                    onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                  <input
                    type="tel"
                    required
                    placeholder="+1234567890"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all font-mono"
                  />
                </div>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Must include country code without symbols (e.g. +14155552671)</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={newContact.email}
                    onChange={(e) => setNewContact({...newContact, email: e.target.value})}
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
                    value={newContact.tags}
                    onChange={(e) => setNewContact({...newContact, tags: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                  />
                </div>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">Comma-separated tags list</p>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
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
      )}

      {/* MODAL: EDIT CONTACT */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
              <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Edit Contact Details</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleEditContact} className="p-6 space-y-4">
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
      )}

      {/* MODAL: IMPORT CSV */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
              <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Import Audience CSV</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
              </button>
            </div>

            <form onSubmit={handleImportCSV} className="p-6 space-y-4">
              <div className="p-4 bg-wa-green/10 border border-wa-green/30 dark:border-wa-green/20 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-wa-green dark:text-wa-green-light uppercase flex items-center gap-1">
                  <HelpCircle className="w-4 h-4" /> CSV File Format Guidelines
                </h4>
                <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed">
                  Your CSV must have a header row. The <span className="font-bold">phone</span> column is required (include country code). Optional: <span className="font-bold">name</span>, <span className="font-bold">email</span>, <span className="font-bold">tags</span> (semi-colon separated).
                </p>
                <div className="bg-wa-bg dark:bg-wa-dark-header p-2.5 rounded-lg border border-wa-border dark:border-wa-dark-border font-mono text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary overflow-x-auto leading-relaxed">
                  phone,name,email,tags<br />
                  +14155552671,John Doe,john@test.com,vip;leads<br />
                  +14155559876,Jane Smith,,promo
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  required
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full text-xs text-wa-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-wa-border dark:file:border-wa-dark-border file:text-xs file:font-semibold file:bg-wa-bg dark:file:bg-wa-dark-header file:text-wa-text-primary dark:file:text-wa-dark-text-primary hover:file:bg-wa-border dark:hover:file:bg-wa-dark-border cursor-pointer transition-colors"
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
                      <span>Importing...</span>
                    </>
                  ) : (
                    <span>Start Import</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT BULK MESSAGE */}
      {isBulkMessageModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
      )}
    </div>
  );
}
