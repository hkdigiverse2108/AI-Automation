'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  FolderOpen, Plus, Search, Trash2, Edit2, UserPlus, UserMinus, 
  X, Loader2, ChevronLeft, ChevronRight, Users, Eye
} from 'lucide-react';
import api from '../../../../lib/api';
import { useConfirmStore } from '../../../../lib/store';

export default function GroupsPage() {
  const confirm = useConfirmStore((state) => state.confirm);
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(9);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddContactsModalOpen, setIsAddContactsModalOpen] = useState(false);
  const [isViewContactsModalOpen, setIsViewContactsModalOpen] = useState(false);

  // Active group context
  const [activeGroup, setActiveGroup] = useState(null);

  // Group Form state
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  // Contacts picker state (for Add Contacts)
  const [allContacts, setAllContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [debouncedContactSearch, setDebouncedContactSearch] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Contacts viewer state (for View/Remove Contacts)
  const [groupMembers, setGroupMembers] = useState([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPages, setMemberPages] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // Fetch groups
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch || undefined
      };
      const { data } = await api.get('/groups', { params });
      if (data.success) {
        setGroups(data.data.groups);
        setTotal(data.data.total);
        setPages(data.data.pages);
      }
    } catch (err) {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [page, debouncedSearch]);

  // Debounce main search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Create Group handler
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;

    setSubmitting(true);
    try {
      const { data } = await api.post('/groups', {
        name: groupForm.name.trim(),
        description: groupForm.description.trim()
      });
      if (data.success) {
        toast.success('Group created successfully');
        setIsCreateModalOpen(false);
        setGroupForm({ name: '', description: '' });
        fetchGroups();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Group handler
  const handleEditGroup = async (e) => {
    e.preventDefault();
    if (!activeGroup || !groupForm.name.trim()) return;

    setSubmitting(true);
    try {
      const { data } = await api.put(`/groups/${activeGroup._id}`, {
        name: groupForm.name.trim(),
        description: groupForm.description.trim()
      });
      if (data.success) {
        toast.success('Group updated successfully');
        setIsEditModalOpen(false);
        fetchGroups();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update group');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Group handler
  const handleDeleteGroup = async (group) => {
    const confirmed = await confirm(
      `Are you sure you want to delete the group "${group.name}"? This will remove all contacts from the group but will NOT delete the contacts themselves.`,
      'Delete Group'
    );
    if (!confirmed) return;

    try {
      const { data } = await api.delete(`/groups/${group._id}`);
      if (data.success) {
        toast.success('Group deleted successfully');
        fetchGroups();
      }
    } catch (err) {
      toast.error('Failed to delete group');
    }
  };

  // --- Add Contacts Sub-Flow ---
  const fetchContactsForPicker = async () => {
    setLoadingContacts(true);
    try {
      const params = {
        limit: 50,
        search: debouncedContactSearch || undefined
      };
      const { data } = await api.get('/contacts', { params });
      if (data.success) {
        setAllContacts(data.data.contacts);
      }
    } catch (err) {
      toast.error('Failed to load contacts list');
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (isAddContactsModalOpen) {
      fetchContactsForPicker();
    }
  }, [isAddContactsModalOpen, debouncedContactSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContactSearch(contactSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  const openAddContactsModal = (group) => {
    setActiveGroup(group);
    setSelectedContactIds([]);
    setContactSearch('');
    setIsAddContactsModalOpen(true);
  };

  const handleAddContactsToGroup = async () => {
    if (selectedContactIds.length === 0) {
      toast.error('Please select at least one contact');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post(`/groups/${activeGroup._id}/add-contact`, {
        contactIds: selectedContactIds
      });
      if (data.success) {
        toast.success(`Successfully added contacts to group`);
        setIsAddContactsModalOpen(false);
        fetchGroups();
      }
    } catch (err) {
      toast.error('Failed to add contacts to group');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectContact = (id) => {
    if (selectedContactIds.includes(id)) {
      setSelectedContactIds(selectedContactIds.filter(cid => cid !== id));
    } else {
      setSelectedContactIds([...selectedContactIds, id]);
    }
  };

  // --- View & Remove Members Sub-Flow ---
  const fetchGroupMembers = async () => {
    if (!activeGroup) return;
    setLoadingMembers(true);
    try {
      const params = {
        groupId: activeGroup._id,
        page: memberPage,
        limit: 10
      };
      const { data } = await api.get('/contacts', { params });
      if (data.success) {
        setGroupMembers(data.data.contacts);
        setMemberTotal(data.data.total);
        setMemberPages(data.data.pages);
      }
    } catch (err) {
      toast.error('Failed to load group members');
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (isViewContactsModalOpen) {
      fetchGroupMembers();
    }
  }, [isViewContactsModalOpen, memberPage]);

  const openViewContactsModal = (group) => {
    setActiveGroup(group);
    setMemberPage(1);
    setSelectedMemberIds([]);
    setIsViewContactsModalOpen(true);
  };

  const handleRemoveContactsFromGroup = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('Please select at least one contact to remove');
      return;
    }

    const confirmed = await confirm(
      `Are you sure you want to remove the ${selectedMemberIds.length} selected contacts from this group?`,
      'Remove Contacts'
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const { data } = await api.post(`/groups/${activeGroup._id}/remove-contact`, {
        contactIds: selectedMemberIds
      });
      if (data.success) {
        toast.success('Contacts removed from group');
        setSelectedMemberIds([]);
        fetchGroupMembers();
        fetchGroups();
      }
    } catch (err) {
      toast.error('Failed to remove contacts');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectMember = (id) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(mid => mid !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Contact Groups</h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Organize your customers into target segments for broadcasts, custom triggers, and filters.
          </p>
        </div>
        <button
          onClick={() => {
            setGroupForm({ name: '', description: '' });
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-white bg-wa-green hover:bg-wa-green-hover rounded-xl text-sm font-semibold shadow-md shadow-wa-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 self-start md:self-auto"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>Create Group</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 flex items-center shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3 w-4.5 h-4.5 text-wa-text-secondary" />
          <input
            type="text"
            placeholder="Search groups by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
          />
        </div>
      </div>

      {/* Grid of Groups */}
      {loading ? (
        <div className="py-24 text-center text-wa-text-secondary flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
          <span className="font-semibold text-sm">Loading groups...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="py-24 text-center text-wa-text-secondary border border-dashed border-wa-border dark:border-wa-dark-border rounded-2xl bg-white dark:bg-wa-dark-panel">
          <FolderOpen className="w-12 h-12 mx-auto text-wa-green/45 mb-4" />
          <p className="text-sm font-bold text-wa-text-primary dark:text-white">No groups found</p>
          <p className="text-xs text-wa-text-secondary mt-1">Create groups to segment your contacts for bulk broadcasts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div 
              key={group._id} 
              className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 hover:border-wa-green/40 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-10 h-10 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center shrink-0">
                    <FolderOpen className="w-5.5 h-5.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-wa-green/10 text-wa-green text-xs font-bold rounded-full">
                    <Users className="w-3.5 h-3.5" />
                    <span>{group.contactCount} Contact{group.contactCount !== 1 ? 's' : ''}</span>
                  </span>
                </div>
                
                <div>
                  <h3 className="font-bold text-wa-text-primary dark:text-white text-base leading-snug truncate">
                    {group.name}
                  </h3>
                  <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1.5 line-clamp-2 min-h-[32px] leading-relaxed">
                    {group.description || <span className="italic text-wa-text-light opacity-50">No description provided</span>}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-wa-border/50 dark:border-wa-dark-border/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openViewContactsModal(group)}
                    className="p-2 text-wa-text-secondary hover:text-wa-green hover:bg-wa-hover dark:hover:bg-wa-dark-hover rounded-xl transition-all"
                    title="View Members"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openAddContactsModal(group)}
                    className="p-2 text-wa-green hover:bg-wa-green/10 rounded-xl transition-all"
                    title="Add Contacts"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActiveGroup(group);
                      setGroupForm({ name: group.name, description: group.description || '' });
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                    title="Edit Group"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Delete Group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border border-wa-border dark:border-wa-dark-border rounded-2xl bg-white dark:bg-wa-dark-panel">
          <span className="text-xs text-wa-text-secondary">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} groups
          </span>
          <div className="flex items-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-white dark:bg-wa-dark-panel hover:bg-wa-bg disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4.5 h-4.5 text-wa-text-primary" />
            </button>
            <span className="text-xs font-bold dark:text-white">Page {page} of {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-white dark:bg-wa-dark-panel hover:bg-wa-bg disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4.5 h-4.5 text-wa-text-primary" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE GROUP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
              <h3 className="font-bold text-wa-text-primary dark:text-white text-base">Create Contact Group</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Customers, Leads"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Description</label>
                <textarea
                  placeholder="Details about contacts in this group..."
                  rows="3"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)} 
                  className="btn-secondary py-2 text-xs px-4"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT GROUP */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
              <h3 className="font-bold text-wa-text-primary dark:text-white text-base">Edit Contact Group</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>
            
            <form onSubmit={handleEditGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Customers, Leads"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Description</label>
                <textarea
                  placeholder="Details about contacts in this group..."
                  rows="3"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="btn-secondary py-2 text-xs px-4"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BATCH ADD CONTACTS */}
      {isAddContactsModalOpen && activeGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header shrink-0">
              <h3 className="font-bold text-wa-text-primary dark:text-white text-base">Add Contacts to {activeGroup.name}</h3>
              <button onClick={() => setIsAddContactsModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            {/* Contacts Search */}
            <div className="p-4 border-b border-wa-border dark:border-wa-dark-border shrink-0 bg-slate-50 dark:bg-wa-dark-header/20">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-wa-text-secondary" />
                <input
                  type="text"
                  placeholder="Search contacts by name or phone..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingContacts ? (
                <div className="py-12 text-center text-wa-text-secondary flex justify-center items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-wa-green" />
                  <span className="text-xs">Loading contacts...</span>
                </div>
              ) : allContacts.length === 0 ? (
                <p className="text-xs text-wa-text-secondary italic py-12 text-center">No contacts found</p>
              ) : (
                <div className="border border-wa-border dark:border-wa-dark-border rounded-xl divide-y divide-wa-border dark:divide-wa-dark-border overflow-hidden">
                  {allContacts.map((contact) => {
                    const isSelected = selectedContactIds.includes(contact._id);
                    return (
                      <div 
                        key={contact._id}
                        onClick={() => toggleSelectContact(contact._id)}
                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/10 transition-colors ${
                          isSelected ? 'bg-wa-green/5 dark:bg-wa-green/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}} // toggled by parent div click
                            className="rounded border-wa-border text-wa-green focus:ring-wa-green/30 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <span className="font-semibold text-xs text-wa-text-primary dark:text-white block">{contact.name}</span>
                            <span className="font-mono text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary">{contact.phone}</span>
                          </div>
                        </div>
                        {contact.tags && contact.tags.length > 0 && (
                          <span className="text-[9px] font-semibold bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border px-2 py-0.5 rounded-full text-wa-text-secondary dark:text-wa-dark-text-secondary">
                            {contact.tags[0]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-wa-border dark:border-wa-dark-border shrink-0 flex items-center justify-between bg-wa-bg dark:bg-wa-dark-header">
              <span className="text-xs text-wa-text-secondary font-semibold">
                {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddContactsModalOpen(false)} 
                  className="btn-secondary py-1.5 text-xs px-3.5"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleAddContactsToGroup}
                  disabled={submitting || selectedContactIds.length === 0} 
                  className="btn-primary py-1.5 text-xs px-4 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Add Selected</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW & REMOVE CONTACT MEMBERS */}
      {isViewContactsModalOpen && activeGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header shrink-0">
              <div>
                <h3 className="font-bold text-wa-text-primary dark:text-white text-base">Members of {activeGroup.name}</h3>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-semibold">Total: {memberTotal} members</p>
              </div>
              <button onClick={() => setIsViewContactsModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors shrink-0">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingMembers ? (
                <div className="py-12 text-center text-wa-text-secondary flex justify-center items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-wa-green" />
                  <span className="text-xs">Loading members...</span>
                </div>
              ) : groupMembers.length === 0 ? (
                <p className="text-xs text-wa-text-secondary italic py-12 text-center">No contacts in this group</p>
              ) : (
                <div className="border border-wa-border dark:border-wa-dark-border rounded-xl divide-y divide-wa-border dark:divide-wa-dark-border overflow-hidden bg-white dark:bg-wa-dark-panel">
                  {groupMembers.map((contact) => {
                    const isSelected = selectedMemberIds.includes(contact._id);
                    return (
                      <div 
                        key={contact._id}
                        onClick={() => toggleSelectMember(contact._id)}
                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/10 transition-colors ${
                          isSelected ? 'bg-red-50/20 dark:bg-red-950/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}} // toggled by parent div click
                            className="rounded border-wa-border text-red-500 focus:ring-red-500/30 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <span className="font-semibold text-xs text-wa-text-primary dark:text-white block">{contact.name}</span>
                            <span className="font-mono text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary">{contact.phone}</span>
                          </div>
                        </div>
                        {contact.email && (
                          <span className="text-[10px] text-wa-text-light">{contact.email}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with pagination and bulk remove */}
            <div className="p-4 border-t border-wa-border dark:border-wa-dark-border shrink-0 flex flex-col gap-3 bg-wa-bg dark:bg-wa-dark-header">
              {memberPages > 1 && (
                <div className="flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border pb-3">
                  <span className="text-[10px] text-wa-text-secondary">
                    Page {memberPage} of {memberPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={memberPage <= 1}
                      onClick={() => setMemberPage(memberPage - 1)}
                      className="p-1 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel hover:bg-wa-bg disabled:opacity-50 transition-colors text-[10px] px-2"
                    >
                      Prev
                    </button>
                    <button
                      disabled={memberPage >= memberPages}
                      onClick={() => setMemberPage(memberPage + 1)}
                      className="p-1 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel hover:bg-wa-bg disabled:opacity-50 transition-colors text-[10px] px-2"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-wa-text-secondary font-semibold">
                  {selectedMemberIds.length} contact{selectedMemberIds.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsViewContactsModalOpen(false)} 
                    className="btn-secondary py-1.5 text-xs px-3.5"
                    disabled={submitting}
                  >
                    Close
                  </button>
                  <button 
                    type="button" 
                    onClick={handleRemoveContactsFromGroup}
                    disabled={submitting || selectedMemberIds.length === 0} 
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-md disabled:opacity-50"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Remove Selected</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
