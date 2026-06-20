'use client';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  X, Calendar, Clock, User, Shield, Info, Edit2, Check,
  AlertTriangle, Play, CheckCircle2, Ban, Plus, Trash2,
  FileText, Image as ImageIcon, Video, Paperclip, MessageSquare,
  CornerDownRight, Send, Loader2, Download
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../lib/store';

export default function TaskDetailModal({ taskId, onClose, onUpdateSuccess }) {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [commenting, setCommenting] = useState(false);

  // Core task details
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  
  // Edit mode details
  const [editMode, setEditMode] = useState(false);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    dueDate: '',
    dueTime: ''
  });

  // Collaboration details
  const [newComment, setNewComment] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const commentInputRef = useRef(null);

  // Privilege calculations
  const isSuperOrAdmin = ['superadmin', 'owner', 'admin'].includes(currentUser?.role);
  const isManager = currentUser?.role === 'agent' && (
    (currentUser?.designation && /manager/i.test(currentUser.designation)) ||
    (currentUser?.department && /manager/i.test(currentUser.department))
  );
  const isAgent = !isSuperOrAdmin && !isManager;

  const canEditTask = isSuperOrAdmin || (isManager && (
    task?.assignedTo?._id === currentUser?._id ||
    task?.assignedBy?._id === currentUser?._id ||
    task?.assignedTo?.department === currentUser?.department
  ));

  const loadTaskDetails = async () => {
    try {
      const { data } = await api.get(`/tasks/${taskId}`);
      if (data.success) {
        const t = data.data.task;
        setTask(t);
        setComments(data.data.comments || []);
        setAttachments(data.data.attachments || []);
        
        // Setup editing form fields
        setForm({
          title: t.title || '',
          description: t.description || '',
          assignedTo: t.assignedTo?._id || '',
          priority: t.priority || 'medium',
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString().substring(0, 10) : '',
          dueTime: t.dueTime || ''
        });
      }
    } catch (err) {
      toast.error('Failed to load task details');
      onClose();
    }
  };

  const loadAssignableUsers = async () => {
    try {
      const { data } = await api.get('/tasks/users');
      if (data.success) {
        setUsers(data.data.users || []);
      }
    } catch (err) {
      console.error('Failed to load assignable users:', err.message);
    }
  };

  useEffect(() => {
    if (taskId) {
      setLoading(true);
      Promise.all([loadTaskDetails(), loadAssignableUsers()]).finally(() => setLoading(false));
    }
  }, [taskId]);

  // Status transition buttons
  const handleTransitionStatus = async (statusEndpoint) => {
    setSaving(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/${statusEndpoint}`);
      if (data.success) {
        toast.success(data.message || 'Task status updated');
        await loadTaskDetails();
        if (onUpdateSuccess) onUpdateSuccess();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  // Submit edit form
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.assignedTo || !form.dueDate) {
      toast.error('Title, Assigned To, and Due Date are required');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put(`/tasks/${taskId}`, form);
      if (data.success) {
        toast.success('Task details updated');
        setEditMode(false);
        await loadTaskDetails();
        if (onUpdateSuccess) onUpdateSuccess();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    setSaving(true);
    try {
      const { data } = await api.delete(`/tasks/${taskId}`);
      if (data.success) {
        toast.success('Task deleted successfully');
        onClose();
        if (onUpdateSuccess) onUpdateSuccess();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete task');
    } finally {
      setSaving(false);
    }
  };

  // Comment Creation
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setCommenting(true);
    try {
      const payload = {
        comment: newComment.trim(),
        parentCommentId: replyToCommentId
      };
      const { data } = await api.post(`/tasks/${taskId}/comments`, payload);
      if (data.success) {
        setNewComment('');
        setReplyToCommentId(null);
        await loadTaskDetails();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to post comment');
    } finally {
      setCommenting(false);
    }
  };

  // File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (15MB)
    const limitBytes = 15 * 1024 * 1024;
    if (file.size > limitBytes) {
      toast.error('File size exceeds the 15MB limit.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(`/tasks/${taskId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        toast.success('File uploaded successfully');
        await loadTaskDetails();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'urgent': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      default: return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'in-progress': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'overdue': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'cancelled': return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
      default: return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
    }
  };

  // Mentions typing hook
  const handleCommentChange = (e) => {
    const value = e.target.value;
    setNewComment(value);

    const words = value.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setMentionSearch(lastWord.slice(1));
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (name) => {
    const words = newComment.split(/\s/);
    words[words.length - 1] = `@${name} `;
    setNewComment(words.join(' '));
    setShowMentionDropdown(false);
    commentInputRef.current?.focus();
  };

  // Recursive comment reply node component
  const CommentNode = ({ comment, allComments, isReply = false }) => {
    const replies = allComments.filter(c => c.parentCommentId === comment._id);

    return (
      <div className={`flex flex-col gap-2 ${isReply ? 'ml-6 pl-4 border-l border-wa-border dark:border-wa-dark-border mt-2' : 'border-b border-slate-100 dark:border-wa-dark-border/40 pb-4 mt-3'}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="wa-avatar wa-avatar-xs shrink-0 bg-wa-green/20 text-wa-green font-bold">
              {comment.userId?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-xs font-semibold text-wa-text-primary dark:text-white leading-tight">
                {comment.userId?.name || 'Unknown User'}
              </p>
              <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary">
                {new Date(comment.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          {!isReply && (
            <button
              onClick={() => {
                setReplyToCommentId(comment._id);
                commentInputRef.current?.focus();
              }}
              className="text-[10px] text-wa-green hover:underline flex items-center gap-1 font-medium"
            >
              <CornerDownRight className="w-3 h-3" /> Reply
            </button>
          )}
        </div>
        <p className="text-xs text-wa-text-primary dark:text-slate-300 ml-7 leading-relaxed break-words whitespace-pre-line">
          {comment.comment}
        </p>

        {replies.map(rep => (
          <CommentNode key={rep._id} comment={rep} allComments={allComments} isReply={true} />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-wa-lg overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-wa-border dark:border-wa-dark-border shrink-0 bg-wa-hover dark:bg-wa-dark-panel-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-wa-green/10 flex items-center justify-center text-wa-green shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-wa-text-primary dark:text-white truncate">
                {task?.title || 'Loading Task...'}
              </h2>
              <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary flex items-center gap-1.5 mt-0.5">
                <span>Created by {task?.assignedBy?.name}</span>
                <span>•</span>
                <span>{task ? new Date(task.createdAt).toLocaleDateString() : ''}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {canEditTask && !editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="btn btn-secondary py-1.5 px-3 flex items-center gap-1.5 text-xs font-semibold"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-wa-text-secondary">
            <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
            <p className="text-xs font-medium">Fetching details & files...</p>
          </div>
        ) : editMode ? (
          /* EDIT TASK FORM */
          <form onSubmit={handleSaveTask} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green"
                placeholder="e.g. Call Client, Draft Proposal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                Task Description
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green resize-none"
                placeholder="Enter description, objectives, and links..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  Assign To *
                </label>
                <select
                  required
                  value={form.assignedTo}
                  onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                  className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green"
                >
                  <option value="">Select Assignee</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role}{u.department ? ` - ${u.department}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green"
                >
                  <option value="low">Green - Low</option>
                  <option value="medium">Blue - Medium</option>
                  <option value="high">Orange - High</option>
                  <option value="urgent">Red - Urgent</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  Due Time
                </label>
                <input
                  type="time"
                  value={form.dueTime}
                  onChange={e => setForm({ ...form, dueTime: e.target.value })}
                  className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-wa-border dark:border-wa-dark-border">
              {isSuperOrAdmin && (
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={saving}
                  className="btn bg-rose-500 hover:bg-rose-600 text-white text-xs py-2 px-4 flex items-center gap-1.5 font-bold rounded-xl"
                >
                  <Trash2 className="w-4 h-4" /> Delete Task
                </button>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="btn btn-secondary py-2 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary bg-wa-green hover:bg-wa-green-dark text-white text-xs py-2 px-4 font-bold rounded-xl flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* REGULAR VIEW: DETAILS + TIMELINE & COLLABORATION */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column: Details & Status Transitions & Attachments */}
            <div className="w-full md:w-[45%] border-r border-wa-border dark:border-wa-dark-border overflow-y-auto p-6 space-y-6">
              {/* Task Description */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">
                  Description
                </h4>
                <p className="text-xs text-wa-text-primary dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {task?.description || <span className="italic text-wa-text-secondary">No description provided.</span>}
                </p>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1">
                    Assigned To
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="wa-avatar wa-avatar-xs bg-wa-green/10 text-wa-green shrink-0">
                      {task?.assignedTo?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-xs font-semibold text-wa-text-primary dark:text-white truncate">
                      {task?.assignedTo?.name}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1">
                    Priority
                  </h4>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPriorityColor(task?.priority)}`}>
                    {task?.priority}
                  </span>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1">
                    Status
                  </h4>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(task?.status)}`}>
                    {task?.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1">
                    Deadline
                  </h4>
                  <div className="text-xs font-medium text-wa-text-primary dark:text-white flex flex-col">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-wa-text-secondary" />
                      {task ? new Date(task.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                    </span>
                    {task?.dueTime && (
                      <span className="flex items-center gap-1.5 mt-0.5 text-wa-text-secondary text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        {task.dueTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Actions */}
              <div className="pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary mb-2">
                  Update Task Status
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task?.status !== 'in-progress' && task?.status !== 'completed' && task?.status !== 'cancelled' && (
                    <button
                      onClick={() => handleTransitionStatus('in-progress')}
                      disabled={saving}
                      className="btn bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5" /> Start Work
                    </button>
                  )}
                  {task?.status !== 'completed' && task?.status !== 'cancelled' && (
                    <button
                      onClick={() => handleTransitionStatus('complete')}
                      disabled={saving}
                      className="btn bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complete Task
                    </button>
                  )}
                  {task?.status !== 'cancelled' && task?.status !== 'completed' && (
                    <button
                      onClick={() => handleTransitionStatus('cancel')}
                      disabled={saving}
                      className="btn bg-slate-500 hover:bg-slate-600 text-white font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1"
                    >
                      <Ban className="w-3.5 h-3.5" /> Cancel Task
                    </button>
                  )}
                  {(task?.status === 'completed' || task?.status === 'cancelled') && (
                    <button
                      onClick={() => handleTransitionStatus('in-progress')}
                      disabled={saving}
                      className="btn btn-primary py-1.5 px-3 text-xs font-semibold rounded-lg"
                    >
                      Reopen Task
                    </button>
                  )}
                </div>
              </div>

              {/* Attachments Section */}
              <div className="pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                    Attachments
                  </h4>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-[10px] text-wa-green hover:underline flex items-center gap-1 font-bold"
                  >
                    {uploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Upload
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/*"
                  />
                </div>

                {attachments.length === 0 ? (
                  <p className="text-[11px] italic text-wa-text-secondary mt-1">
                    No files attached yet. (Max 15MB)
                  </p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {attachments.map(att => (
                      <div key={att._id} className="flex items-center justify-between p-2 rounded-xl bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border">
                        <div className="flex items-center gap-2 min-w-0">
                          {att.fileType.startsWith('image/') ? (
                            <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : att.fileType.startsWith('video/') ? (
                            <Video className="w-4 h-4 text-orange-500 shrink-0" />
                          ) : (
                            <Paperclip className="w-4 h-4 text-sky-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-wa-text-primary dark:text-white truncate">
                              {att.fileName || 'Attachment'}
                            </p>
                            <p className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary capitalize">
                              {att.fileType.split('/')[1] || 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <a
                          href={att.fileUrl.startsWith('http') ? att.fileUrl : `${api.defaults.baseURL.replace(/\/api$/, '')}${att.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-lg hover:bg-wa-border dark:hover:bg-wa-dark-border/40 flex items-center justify-center text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white shrink-0"
                          title="Download / View file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Comments & Collaboration */}
            <div className="w-full md:w-[55%] flex flex-col overflow-hidden p-6">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary mb-3 shrink-0">
                Collaboration & Comments
              </h4>

              {/* Threaded Comments List */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-4 scrollbar-thin">
                {comments.filter(c => !c.parentCommentId).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-wa-text-secondary">
                    <MessageSquare className="w-8 h-8 stroke-[1.5] mb-2 opacity-50" />
                    <p className="text-xs font-medium">No comments posted yet</p>
                    <p className="text-[10px] text-wa-text-secondary/75 mt-0.5">Start the conversation below! Use @Name to mention.</p>
                  </div>
                ) : (
                  comments.filter(c => !c.parentCommentId).map(c => (
                    <CommentNode key={c._id} comment={c} allComments={comments} />
                  ))
                )}
              </div>

              {/* Reply Indicator */}
              {replyToCommentId && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-wa-hover dark:bg-wa-dark-hover rounded-t-xl border-t border-x border-wa-border dark:border-wa-dark-border text-[10px] text-wa-text-secondary shrink-0">
                  <span>
                    Replying to: <strong className="text-wa-text-primary dark:text-white">{comments.find(c => c._id === replyToCommentId)?.userId?.name}</strong>
                  </span>
                  <button
                    onClick={() => setReplyToCommentId(null)}
                    className="text-rose-500 font-bold hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Create Comment Form */}
              <form onSubmit={handleAddComment} className="relative shrink-0 flex items-end gap-2 border border-wa-border dark:border-wa-dark-border rounded-2xl bg-wa-hover dark:bg-wa-dark-panel p-2">
                <textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={handleCommentChange}
                  rows={2}
                  className="flex-grow bg-transparent border-0 resize-none text-xs text-wa-text-primary dark:text-white focus:ring-0 focus:outline-none p-1 scrollbar-none"
                  placeholder="Write a message... Use @Name to mention."
                />
                
                {/* Mention autocomplete dropdown */}
                {showMentionDropdown && (
                  <div className="absolute left-0 bottom-full mb-2 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-wa-lg max-h-36 overflow-y-auto w-48 z-[60]">
                    {users
                      .filter(u => u.name.toLowerCase().includes(mentionSearch.toLowerCase()))
                      .map(u => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => insertMention(u.name)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-wa-hover dark:hover:bg-wa-dark-hover text-wa-text-primary dark:text-white truncate flex items-center gap-1.5"
                        >
                          <div className="w-5 h-5 rounded-full bg-wa-green/10 text-wa-green flex items-center justify-center font-bold text-[9px]">
                            {u.name[0].toUpperCase()}
                          </div>
                          <span>{u.name}</span>
                        </button>
                      ))}
                    {users.filter(u => u.name.toLowerCase().includes(mentionSearch.toLowerCase())).length === 0 && (
                      <div className="p-2 text-[10px] text-wa-text-secondary text-center">No matching user</div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={commenting || !newComment.trim()}
                  className="btn bg-wa-green hover:bg-wa-green-dark disabled:opacity-50 text-white rounded-xl w-8 h-8 flex items-center justify-center shrink-0 shadow-lg shadow-wa-green/20"
                >
                  {commenting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
