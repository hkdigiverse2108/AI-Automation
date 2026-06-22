'use client';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  X, Phone, Mail, Globe, Calendar, Clock, Tag, Plus, Save, 
  Trash2, Edit2, Pin, Sparkles, Loader2, User, Check
} from 'lucide-react';
import api from '../lib/api';
import { ScoreBadge } from './ContactScoreCard';

export default function ContactDetailsModal({ contactId, onClose, onUpdateSuccess }) {
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [contact, setContact] = useState(null);
  
  // Notes states
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [pinningNoteId, setPinningNoteId] = useState(null);
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  // Tags states
  const [availableTags, setAvailableTags] = useState([]);
  const [tagSearch, setTagSearch] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagActionLoading, setTagActionLoading] = useState(false);
  const tagDropdownRef = useRef(null);

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      try {
        // Fetch contact
        const contactRes = await api.get(`/contacts/${contactId}`);
        if (contactRes.data.success) {
          setContact(contactRes.data.data.contact);
        }

        // Fetch notes
        const notesRes = await api.get(`/contacts/${contactId}/notes`);
        if (notesRes.data.success) {
          setNotes(notesRes.data.data.notes);
        }

        // Fetch tags library
        const tagsRes = await api.get('/tags');
        if (tagsRes.data.success) {
          setAvailableTags(tagsRes.data.data.tags);
        }
      } catch (err) {
        toast.error('Failed to load contact details');
        onClose();
      } finally {
        setLoading(false);
      }
    }

    if (contactId) {
      loadDetails();
    }
  }, [contactId]);

  // Click outside tag dropdown to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target)) {
        setShowTagDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to re-sort notes locally: pinned first, then by date descending
  const sortNotesArray = (noteArray) => {
    return [...noteArray].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return b.isPinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  // Notes operations
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setSavingNote(true);
    try {
      const { data } = await api.post(`/contacts/${contactId}/notes`, { note: newNoteText.trim() });
      if (data.success) {
        toast.success('Note added successfully');
        setNewNoteText('');
        // Refresh notes list
        const notesRes = await api.get(`/contacts/${contactId}/notes`);
        if (notesRes.data.success) {
          setNotes(notesRes.data.data.notes);
        }
      }
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleTogglePin = async (noteId) => {
    setPinningNoteId(noteId);
    try {
      const { data } = await api.post(`/notes/${noteId}/pin`);
      if (data.success) {
        toast.success(data.data.note.isPinned ? 'Note pinned' : 'Note unpinned');
        setNotes(prevNotes => {
          const updated = prevNotes.map(n => n._id === noteId ? data.data.note : n);
          return sortNotesArray(updated);
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update note status');
    } finally {
      setPinningNoteId(null);
    }
  };

  const handleStartEditNote = (note) => {
    setEditingNoteId(note._id);
    setEditingNoteText(note.note);
  };

  const handleSaveEditNote = async (noteId) => {
    if (!editingNoteText.trim()) return;
    try {
      const { data } = await api.put(`/notes/${noteId}`, { note: editingNoteText.trim() });
      if (data.success) {
        toast.success('Note updated successfully');
        setNotes(prevNotes => {
          const updated = prevNotes.map(n => n._id === noteId ? data.data.note : n);
          return sortNotesArray(updated);
        });
        setEditingNoteId(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    setDeletingNoteId(noteId);
    try {
      const { data } = await api.delete(`/notes/${noteId}`);
      if (data.success) {
        toast.success('Note deleted');
        setNotes(notes.filter(n => n._id !== noteId));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete note');
    } finally {
      setDeletingNoteId(null);
    }
  };

  // Tags operations
  const handleAttachTag = async (tag) => {
    if (contact.tags.includes(tag.name)) {
      toast.error('Tag already assigned');
      return;
    }
    setTagActionLoading(true);
    try {
      const { data } = await api.post(`/contacts/${contactId}/add-tag`, { tagId: tag._id });
      if (data.success) {
        toast.success('Tag assigned');
        setContact({ ...contact, tags: data.data.tags });
        if (onUpdateSuccess) onUpdateSuccess();
      }
    } catch (err) {
      toast.error('Failed to assign tag');
    } finally {
      setTagActionLoading(false);
    }
  };

  const handleDetachTag = async (tagName) => {
    setTagActionLoading(true);
    try {
      const { data } = await api.post(`/contacts/${contactId}/remove-tag`, { tagName });
      if (data.success) {
        toast.success('Tag removed');
        setContact({ ...contact, tags: data.data.tags });
        if (onUpdateSuccess) onUpdateSuccess();
      }
    } catch (err) {
      toast.error('Failed to remove tag');
    } finally {
      setTagActionLoading(false);
    }
  };

  const handleCreateAndAttachTag = async () => {
    if (!tagSearch.trim()) return;
    setTagActionLoading(true);
    try {
      const { data } = await api.post('/tags', { name: tagSearch.trim() });
      if (data.success) {
        toast.success('New tag created');
        // Add to available tags list
        setAvailableTags([...availableTags, data.data.tag]);
        // Attach it
        await handleAttachTag(data.data.tag);
        setTagSearch('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create tag');
    } finally {
      setTagActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-8 flex flex-col items-center justify-center shadow-wa-lg w-full max-w-md">
          <Loader2 className="w-8 h-8 animate-spin text-wa-green mb-3" />
          <span className="text-sm font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary">Loading details...</span>
        </div>
      </div>
    );
  }

  if (!contact) return null;

  const initials = contact.name ? contact.name.substring(0, 2).toUpperCase() : 'CN';

  // Filter available tags that are not currently attached
  const unattachedTags = availableTags.filter(
    t => !contact.tags.includes(t.name) && 
    t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-5xl overflow-hidden shadow-wa-lg animate-fade-in flex flex-col h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header dark:bg-wa-dark-panel-header shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center font-bold shadow-inner">
              {initials}
            </div>
            <div>
              <h3 className="font-extrabold text-wa-text-primary dark:text-white text-base leading-tight">
                {contact.name || 'Anonymous Contact'}
              </h3>
              <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono mt-0.5">
                Contact ID: {contact._id}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Column: Profile details & Tags */}
          <div className="w-full md:w-[360px] border-r border-wa-border dark:border-wa-dark-border overflow-y-auto p-6 space-y-5 bg-wa-bg/30 dark:bg-wa-dark-header/10">
            
            {/* Contact details */}
            <div className="glass-card p-5 space-y-4">
              <h4 className="text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider pb-2 border-b border-wa-border dark:border-wa-dark-border">
                Contact Details
              </h4>
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div>
                    <span className="block text-[10px] text-wa-text-light uppercase font-semibold">Phone</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white font-mono">{contact.phone || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-[10px] text-wa-text-light uppercase font-semibold">Email</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white truncate block">{contact.email || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div>
                    <span className="block text-[10px] text-wa-text-light uppercase font-semibold">Source</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white capitalize bg-wa-bg dark:bg-wa-dark-header px-1.5 py-0.5 rounded border border-wa-border dark:border-wa-dark-border mt-0.5 inline-block">
                      {contact.source || 'manual'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div>
                    <span className="block text-[10px] text-wa-text-light uppercase font-semibold">Added On</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-wa-text-light shrink-0" />
                  <div>
                    <span className="block text-[10px] text-wa-text-light uppercase font-semibold">Last Engagement</span>
                    <span className="font-semibold text-wa-text-primary dark:text-white">
                      {contact.lastMessageAt ? new Date(contact.lastMessageAt).toLocaleString() : 'No activity logged'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Engagement Score */}
            <div className="glass-card p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider pb-2 border-b border-wa-border dark:border-wa-dark-border">
                Engagement Status
              </h4>
              <div className="flex items-center justify-between">
                <span className="text-xs text-wa-text-primary dark:text-wa-dark-text-secondary font-medium">Score & Segment</span>
                <ScoreBadge score={contact.engagementScore} segment={contact.segment} size="sm" />
              </div>
            </div>

            {/* Contact Tags Section */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-wa-border dark:border-wa-dark-border">
                <h4 className="text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider">
                  Audience Tags
                </h4>
                
                {/* Add Tag Dropdown Wrapper */}
                <div className="relative" ref={tagDropdownRef}>
                  <button 
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className="p-1 rounded bg-wa-green hover:bg-wa-green-hover text-white transition-colors"
                    title="Add Tag"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  
                  {showTagDropdown && (
                    <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-lg z-50 p-3 space-y-2">
                      <input 
                        type="text"
                        placeholder="Search or type tag..."
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-1 focus:ring-wa-green"
                      />
                      
                      <div className="max-h-40 overflow-y-auto divide-y divide-wa-border/50 dark:divide-wa-dark-border/30 scrollbar-thin">
                        {unattachedTags.length === 0 ? (
                          tagSearch.trim() ? (
                            <button
                              onClick={handleCreateAndAttachTag}
                              className="w-full text-left py-2 px-2 text-[11px] font-bold text-wa-green hover:bg-wa-green/5 dark:hover:bg-wa-green/10 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Create & Assign "{tagSearch}"
                            </button>
                          ) : (
                            <div className="py-2 text-center text-wa-text-light text-[10px] italic">No matching tags</div>
                          )
                        ) : (
                          unattachedTags.map(tag => (
                            <button
                              key={tag._id}
                              onClick={() => handleAttachTag(tag)}
                              disabled={tagActionLoading}
                              className="w-full text-left py-2 px-2 text-xs text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover flex items-center justify-between disabled:opacity-50"
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                <span className="capitalize">{tag.name}</span>
                              </span>
                              <Plus className="w-3.5 h-3.5 text-wa-text-secondary" />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Attached Tags list */}
              <div className="flex flex-wrap gap-1.5">
                {contact.tags && contact.tags.length > 0 ? (
                  contact.tags.map(tagName => {
                    // Try to resolve color from tags library
                    const libTag = availableTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                    const tagColor = libTag?.color || '#cbd5e1';
                    
                    return (
                      <span 
                        key={tagName} 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-header text-wa-text-primary dark:text-wa-dark-text-primary shadow-sm hover:scale-[1.02] transition-transform"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tagColor }} />
                        <span className="capitalize">{tagName}</span>
                        <button 
                          onClick={() => handleDetachTag(tagName)}
                          disabled={tagActionLoading}
                          className="hover:text-red-500 font-bold shrink-0 ml-1 transition-colors disabled:opacity-50"
                          title="Remove Tag"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary italic">No tags associated.</span>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Timeline & Notes */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-wa-bg/10 dark:bg-wa-dark-panel/30">
            
            {/* Notes Section Title */}
            <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-header flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-wa-text-primary dark:text-white">
                <Sparkles className="w-4.5 h-4.5 text-wa-green" />
                <span>Customer Notes & Activity Log Timeline</span>
              </div>
            </div>

            {/* Note Entry Area */}
            <div className="p-6 bg-white dark:bg-wa-dark-header border-b border-wa-border dark:border-wa-dark-border shrink-0">
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  rows="3"
                  placeholder="Type new customer note, follow-up comments, or client updates..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green resize-none transition-all"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNote || !newNoteText.trim()}
                    className="px-5 py-2 bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-wa-green/20"
                  >
                    {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Add Note</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Notes History list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {notesLoading ? (
                <div className="py-12 text-center text-wa-text-secondary flex items-center justify-center gap-2 text-xs">
                  <Loader2 className="w-4.5 h-4.5 animate-spin text-wa-green" /> Loading timeline...
                </div>
              ) : notes.length === 0 ? (
                <div className="py-16 text-center text-wa-text-secondary italic text-xs max-w-sm mx-auto space-y-2">
                  <Pin className="w-8 h-8 text-wa-text-light mx-auto opacity-30 rotate-45" />
                  <h4 className="font-semibold text-sm text-wa-text-primary dark:text-white">Timeline is empty</h4>
                  <p className="text-wa-text-secondary">No internal notes have been logged for this customer yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => {
                    const author = note.createdBy || {};
                    const authorInitials = author.name ? author.name.substring(0, 2).toUpperCase() : 'US';
                    const isEditing = editingNoteId === note._id;
                    
                    return (
                      <div 
                        key={note._id} 
                        className={`group border relative transition-all duration-200 rounded-2xl p-4 shadow-sm bg-white dark:bg-wa-dark-header ${
                          note.isPinned 
                            ? 'border-wa-green/35 dark:border-wa-green/30 bg-wa-green/[0.02]' 
                            : 'border-wa-border dark:border-wa-dark-border/60 hover:border-wa-border-hover'
                        }`}
                      >
                        {/* Note Header */}
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6.5 h-6.5 rounded-full bg-wa-bg dark:bg-wa-dark-panel flex items-center justify-center font-bold text-[10px] text-wa-text-secondary border border-wa-border shrink-0">
                              {authorInitials}
                            </div>
                            <div>
                              <span className="font-bold text-wa-text-primary dark:text-white text-xs block leading-none">
                                {author.name || 'SaaS Platform User'}
                              </span>
                              <span className="text-[9px] text-wa-text-secondary uppercase font-semibold tracking-wider font-mono">
                                {author.role || 'Agent'} • {new Date(note.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Note actions toolbar */}
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleTogglePin(note._id)}
                              disabled={pinningNoteId === note._id}
                              className={`p-1.5 rounded-lg hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors ${
                                note.isPinned ? 'text-wa-green' : 'text-wa-text-light'
                              } disabled:opacity-50`}
                              title={note.isPinned ? 'Unpin note' : 'Pin note'}
                            >
                              <Pin className={`w-3.5 h-3.5 ${note.isPinned ? '' : 'rotate-45'}`} />
                            </button>
                            {!isEditing && (
                              <button
                                onClick={() => handleStartEditNote(note)}
                                disabled={deletingNoteId === note._id || pinningNoteId === note._id}
                                className="p-1.5 rounded-lg hover:bg-wa-hover dark:hover:bg-wa-dark-hover text-blue-500 transition-colors disabled:opacity-50"
                                title="Edit note"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteNote(note._id)}
                              disabled={deletingNoteId === note._id}
                              className="p-1.5 rounded-lg hover:bg-wa-hover dark:hover:bg-wa-dark-hover text-red-500 transition-colors disabled:opacity-50"
                              title="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Note Body */}
                        <div className="text-xs text-wa-text-primary dark:text-wa-dark-text-primary leading-relaxed font-medium pl-8">
                          {isEditing ? (
                            <div className="space-y-2 mt-1">
                              <textarea
                                rows="3"
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="w-full px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-1 focus:ring-wa-green resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-3 py-1.5 bg-wa-bg dark:bg-wa-dark-panel hover:bg-wa-hover border border-wa-border dark:border-wa-dark-border text-[10px] font-bold text-wa-text-secondary rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditNote(note._id)}
                                  className="px-3.5 py-1.5 bg-wa-green hover:bg-wa-green-hover text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <Save className="w-3 h-3" /> Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{note.note}</p>
                          )}
                        </div>

                        {/* Pinned Ribbon */}
                        {note.isPinned && (
                          <div className="absolute top-0 right-14 flex items-center bg-wa-green/10 text-wa-green text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-b-lg border-b border-x border-wa-green/20 tracking-wider">
                            Pinned
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
