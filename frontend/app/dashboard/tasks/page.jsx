'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  ClipboardList, Plus, Search, Calendar, Clock, Filter, List, Grid,
  ChevronLeft, ChevronRight, RefreshCw, Loader2, ArrowUpDown, Shield, AlertCircle
} from 'lucide-react';
import api from '../../../lib/api';
import TaskDetailModal from '../../../components/TaskDetailModal';
import { useAuthStore } from '../../../lib/store';

export default function TasksPage() {
  const { user: currentUser } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Tab & Filters State
  const [activeTab, setActiveTab] = useState('my-tasks'); // 'my-tasks', 'assigned-by-me', 'today', 'overdue', 'completed', 'pending', 'all'
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');

  // Stats / Counters
  const [counts, setCounts] = useState({
    'my-tasks': 0,
    'today': 0,
    'overdue': 0,
    'completed': 0,
    'pending': 0
  });

  // View Mode: 'list' or 'calendar'
  const [viewMode, setViewMode] = useState('list');
  const [calendarMode, setCalendarMode] = useState('month'); // 'month', 'week', 'day'
  const [currentDate, setCurrentDate] = useState(new Date());

  // Assignable Users Cache
  const [users, setUsers] = useState([]);

  // Modals state
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Create Form State
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    dueDate: '',
    dueTime: ''
  });

  // Role details
  const isSuperOrAdmin = ['superadmin', 'owner', 'admin'].includes(currentUser?.role);
  const isManager = currentUser?.role === 'agent' && (
    (currentUser?.designation && /manager/i.test(currentUser.designation)) ||
    (currentUser?.department && /manager/i.test(currentUser.department))
  );

  // Fetch list of tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: viewMode === 'calendar' ? 100 : limit, // Load more for calendar grids
        tab: activeTab === 'all' ? undefined : activeTab,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        assignedTo: assignedFilter || undefined,
        search: search || undefined,
        sort
      };

      const { data } = await api.get('/tasks', { params });
      if (data.success) {
        setTasks(data.data.tasks);
        if (viewMode === 'list') {
          setTotal(data.data.total);
          setPages(data.data.pages);
        }
      }
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  // Fetch count badges
  const fetchCounts = async () => {
    try {
      const tabs = ['my-tasks', 'today', 'overdue', 'completed', 'pending'];
      const results = await Promise.all(
        tabs.map(tab => api.get('/tasks', { params: { tab, limit: 1 } }))
      );
      
      const newCounts = {};
      tabs.forEach((tab, index) => {
        newCounts[tab] = results[index].data.data.total;
      });
      setCounts(newCounts);
    } catch (err) {
      console.error('Failed to fetch task metrics:', err.message);
    }
  };

  // Fetch team members for assignments
  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/tasks/users');
      if (data.success) {
        setUsers(data.data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch assignable users:', err.message);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeTab, statusFilter, priorityFilter, assignedFilter, sort, page, viewMode]);

  useEffect(() => {
    fetchCounts();
    fetchUsers();
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.assignedTo || !createForm.dueDate) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/tasks', createForm);
      if (data.success) {
        toast.success(data.message || 'Task assigned successfully!');
        setIsCreateModalOpen(false);
        setCreateForm({
          title: '',
          description: '',
          assignedTo: '',
          priority: 'medium',
          dueDate: '',
          dueTime: ''
        });
        fetchTasks();
        fetchCounts();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800';
      case 'high': return 'text-orange-600 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800';
      case 'urgent': return 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800';
      default: return 'text-sky-600 bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'in-progress': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'overdue': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'cancelled': return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      default: return 'text-sky-500 bg-sky-500/10 border-sky-500/20';
    }
  };

  // Calendar Date Mathematics
  const handleNavigateCalendar = (direction) => {
    const nextDate = new Date(currentDate);
    if (calendarMode === 'month') {
      nextDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (calendarMode === 'week') {
      nextDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (calendarMode === 'day') {
      nextDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(nextDate);
  };

  const setCalendarToToday = () => {
    setCurrentDate(new Date());
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    const firstDayOfWeek = firstDay.getDay(); // 0 is Sunday, 6 is Saturday

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Next month filler days to complete 6 weeks grid (42 cells)
    const totalCells = 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  };

  const getDaysInWeek = (date) => {
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek); // Set to Sunday

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const getTasksForDate = (date) => {
    return tasks.filter(task => {
      const taskDate = new Date(task.dueDate);
      return (
        taskDate.getFullYear() === date.getFullYear() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getDate() === date.getDate()
      );
    });
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-slate-50 dark:bg-wa-dark-bg p-6 overflow-y-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-wa-text-primary dark:text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-wa-green" /> Tasks & Reminders
          </h1>
          <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary font-medium">
            Manage collaborative checklists, set priority boundaries, and follow deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-1 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                viewMode === 'list'
                  ? 'bg-wa-green/10 text-wa-green dark:bg-wa-green/15'
                  : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                viewMode === 'calendar'
                  ? 'bg-wa-green/10 text-wa-green dark:bg-wa-green/15'
                  : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" /> Calendar
            </button>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary bg-wa-green hover:bg-wa-green-dark text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-lg shadow-wa-green/20"
          >
            <Plus className="w-4 h-4" /> Assign Task
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setActiveTab('my-tasks')}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
            activeTab === 'my-tasks'
              ? 'bg-white dark:bg-wa-dark-panel border-wa-green shadow-sm'
              : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border hover:border-wa-green/45'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
            My Tasks
          </p>
          <h3 className="text-xl font-black text-wa-text-primary dark:text-white mt-1">
            {counts['my-tasks']}
          </h3>
        </button>

        <button
          onClick={() => setActiveTab('today')}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
            activeTab === 'today'
              ? 'bg-white dark:bg-wa-dark-panel border-sky-500 shadow-sm'
              : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border hover:border-sky-500/45'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
            Due Today
          </p>
          <h3 className="text-xl font-black text-sky-500 mt-1">
            {counts['today']}
          </h3>
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
            activeTab === 'overdue'
              ? 'bg-white dark:bg-wa-dark-panel border-rose-500 shadow-sm'
              : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border hover:border-rose-500/45'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary flex items-center gap-1.5">
            Overdue <AlertCircle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          </p>
          <h3 className="text-xl font-black text-rose-500 mt-1">
            {counts['overdue']}
          </h3>
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
            activeTab === 'pending'
              ? 'bg-white dark:bg-wa-dark-panel border-amber-500 shadow-sm'
              : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border hover:border-amber-500/45'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
            Pending Tasks
          </p>
          <h3 className="text-xl font-black text-amber-500 mt-1">
            {counts['pending']}
          </h3>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
            activeTab === 'completed'
              ? 'bg-white dark:bg-wa-dark-panel border-emerald-500 shadow-sm'
              : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border hover:border-emerald-500/45'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
            Completed
          </p>
          <h3 className="text-xl font-black text-emerald-500 mt-1">
            {counts['completed']}
          </h3>
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl flex flex-col shadow-sm overflow-hidden">
        {/* Filters Header (Only in List View) */}
        {viewMode === 'list' ? (
          <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-wa-hover dark:bg-wa-dark-panel-header">
            {/* Left side: Search & Advanced Filters */}
            <div className="flex flex-wrap items-center gap-2 flex-grow">
              <div className="relative min-w-[200px] flex-grow max-w-sm">
                <Search className="w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search task title/description..."
                  className="w-full bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-wa-green text-wa-text-primary dark:text-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl px-3 py-2 text-xs text-wa-text-primary dark:text-white focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl px-3 py-2 text-xs text-wa-text-primary dark:text-white focus:outline-none"
              >
                <option value="">All Priorities</option>
                <option value="low">Green - Low</option>
                <option value="medium">Blue - Medium</option>
                <option value="high">Orange - High</option>
                <option value="urgent">Red - Urgent</option>
              </select>

              {isSuperOrAdmin && (
                <select
                  value={assignedFilter}
                  onChange={(e) => setAssignedFilter(e.target.value)}
                  className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl px-3 py-2 text-xs text-wa-text-primary dark:text-white focus:outline-none max-w-[150px]"
                >
                  <option value="">All Users</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Right side: Sort & Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort:</span>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl px-3 py-2 text-xs text-wa-text-primary dark:text-white focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="priority">Priority</option>
                <option value="due-date">Due Date</option>
              </select>
              
              <button
                onClick={() => { fetchTasks(); fetchCounts(); }}
                className="p-2 border border-wa-border dark:border-wa-dark-border rounded-xl hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white bg-white dark:bg-wa-dark-panel"
                title="Refresh list"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Calendar Navigation Header */
          <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-wa-hover dark:bg-wa-dark-panel-header shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleNavigateCalendar('prev')}
                className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-bold text-wa-text-primary dark:text-white min-w-[120px] text-center">
                {currentDate.toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                  ...(calendarMode === 'day' ? { day: 'numeric' } : {})
                })}
              </h2>
              <button
                onClick={() => handleNavigateCalendar('next')}
                className="p-1.5 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={setCalendarToToday}
                className="btn btn-secondary py-1 px-2.5 text-[10px] font-semibold border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-1 rounded-xl flex items-center">
                {['month', 'week', 'day'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setCalendarMode(mode)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      calendarMode === mode
                        ? 'bg-wa-green/10 text-wa-green dark:bg-wa-green/15'
                        : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner overlay */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-wa-text-secondary">
            <Loader2 className="w-7 h-7 animate-spin text-wa-green" />
            <p className="text-xs font-semibold">Updating task boards...</p>
          </div>
        ) : viewMode === 'list' ? (
          /* TASK LIST VIEW */
          <div className="flex-1 overflow-x-auto">
            {tasks.length === 0 ? (
              <div className="p-12 text-center text-wa-text-secondary">
                <ClipboardList className="w-12 h-12 stroke-[1] mx-auto mb-3 opacity-40 text-wa-text-secondary" />
                <p className="text-sm font-bold">No tasks found</p>
                <p className="text-xs text-wa-text-secondary/75 mt-0.5">
                  Try adjusting your filters, searching, or select a different tab.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-wa-dark-border/10 text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold border-b border-wa-border dark:border-wa-dark-border">
                    <th className="p-4 w-1/3">Task Details</th>
                    <th className="p-4">Assigned To</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Due Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-wa-dark-border/40">
                  {tasks.map((task) => (
                    <tr
                      key={task._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-wa-dark-hover/40 transition-colors"
                    >
                      <td className="p-4">
                        <button
                          onClick={() => setSelectedTaskId(task._id)}
                          className="font-bold text-wa-text-primary dark:text-white hover:text-wa-green dark:hover:text-wa-green text-left hover:underline break-words"
                        >
                          {task.title}
                        </button>
                        <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary line-clamp-1 mt-0.5">
                          {task.description || 'No description.'}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-wa-green/10 text-wa-green font-bold text-[10px] flex items-center justify-center shrink-0">
                            {task.assignedTo?.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-wa-text-primary dark:text-white truncate">
                              {task.assignedTo?.name}
                            </p>
                            <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary truncate capitalize">
                              {task.assignedTo?.role}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col text-[11px] text-wa-text-primary dark:text-white font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-wa-text-secondary" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                          {task.dueTime && (
                            <span className="text-wa-text-secondary text-[10px] mt-0.5 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {task.dueTime}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedTaskId(task._id)}
                          className="btn btn-secondary py-1 px-3 text-[10px] font-bold"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination Controls */}
            {pages > 1 && (
              <div className="p-4 border-t border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-wa-hover dark:bg-wa-dark-panel-header text-xs text-wa-text-secondary">
                <span>Showing page {page} of {pages} ({total} total tasks)</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1 px-2 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel hover:text-wa-text-primary dark:hover:text-white disabled:opacity-50 text-[11px] font-bold"
                  >
                    Prev
                  </button>
                  <button
                    disabled={page === pages}
                    onClick={() => setPage(page + 1)}
                    className="p-1 px-2 border border-wa-border dark:border-wa-dark-border rounded-lg bg-white dark:bg-wa-dark-panel hover:text-wa-text-primary dark:hover:text-white disabled:opacity-50 text-[11px] font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CALENDAR DISPLAY VIEWS */
          <div className="flex-grow min-h-[500px]">
            {calendarMode === 'month' && (
              <div className="grid grid-cols-7 border-b border-wa-border dark:border-wa-dark-border text-center text-[10px] font-bold text-wa-text-secondary uppercase bg-wa-hover dark:bg-wa-dark-panel-header py-2 shrink-0">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>
            )}

            {calendarMode === 'month' && (
              <div className="grid grid-cols-7 grid-rows-6 auto-rows-fr flex-grow bg-slate-100 dark:bg-wa-dark-border/20 gap-px">
                {getDaysInMonth(currentDate).map(({ date, isCurrentMonth }, i) => {
                  const dayTasks = getTasksForDate(date);
                  const isToday = new Date().toDateString() === date.toDateString();

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        // Pre-fill date for the clicked calendar day
                        setCreateForm({
                          ...createForm,
                          dueDate: date.toISOString().substring(0, 10)
                        });
                        setIsCreateModalOpen(true);
                      }}
                      className={`min-h-[85px] bg-white dark:bg-wa-dark-panel p-2 flex flex-col gap-1 cursor-pointer transition-colors hover:bg-wa-hover dark:hover:bg-wa-dark-hover/40 group ${
                        isCurrentMonth ? '' : 'opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                          isToday
                            ? 'bg-wa-green text-white font-extrabold'
                            : 'text-wa-text-primary dark:text-white'
                        }`}>
                          {date.getDate()}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 text-[9px] text-wa-green font-bold">
                          + Add
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-none">
                        {dayTasks.slice(0, 3).map(task => (
                          <div
                            key={task._id}
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent opening Create Modal
                              setSelectedTaskId(task._id);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border truncate ${getPriorityColor(task.priority)}`}
                            title={`${task.title} - due at ${task.dueTime || 'EOD'}`}
                          >
                            {task.title}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-[8px] text-wa-text-secondary text-center font-bold">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {calendarMode === 'week' && (
              <div className="grid grid-cols-7 flex-grow divide-x divide-wa-border dark:divide-wa-dark-border h-full min-h-[500px]">
                {getDaysInWeek(currentDate).map((date, i) => {
                  const dayTasks = getTasksForDate(date);
                  const isToday = new Date().toDateString() === date.toDateString();

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setCreateForm({
                          ...createForm,
                          dueDate: date.toISOString().substring(0, 10)
                        });
                        setIsCreateModalOpen(true);
                      }}
                      className="bg-white dark:bg-wa-dark-panel p-3 flex flex-col gap-3 min-h-[450px] cursor-pointer hover:bg-wa-hover/30 dark:hover:bg-wa-dark-hover/10"
                    >
                      <div className="border-b border-wa-border dark:border-wa-dark-border pb-2 text-center">
                        <p className="text-[10px] font-bold text-wa-text-secondary uppercase">
                          {date.toLocaleDateString(undefined, { weekday: 'short' })}
                        </p>
                        <span className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-xs font-bold mt-1 ${
                          isToday ? 'bg-wa-green text-white' : 'text-wa-text-primary dark:text-white'
                        }`}>
                          {date.getDate()}
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2">
                        {dayTasks.map(task => (
                          <div
                            key={task._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(task._id);
                            }}
                            className={`p-2 rounded-xl border flex flex-col gap-1 cursor-pointer transition-transform hover:-translate-y-0.5 ${getPriorityColor(task.priority)}`}
                          >
                            <p className="text-[11px] font-extrabold truncate">{task.title}</p>
                            {task.dueTime && (
                              <span className="text-[9px] flex items-center gap-1 font-medium opacity-85">
                                <Clock className="w-3 h-3" /> {task.dueTime}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {calendarMode === 'day' && (
              <div className="p-6 bg-white dark:bg-wa-dark-panel flex-grow h-full space-y-4">
                <div className="flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">
                      Tasks Schedule for Today
                    </h3>
                    <p className="text-[11px] text-wa-text-secondary">
                      {currentDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCreateForm({
                        ...createForm,
                        dueDate: currentDate.toISOString().substring(0, 10)
                      });
                      setIsCreateModalOpen(true);
                    }}
                    className="btn btn-secondary text-xs py-1.5 px-3 rounded-lg"
                  >
                    + Add Task
                  </button>
                </div>

                {getTasksForDate(currentDate).length === 0 ? (
                  <div className="p-12 text-center text-wa-text-secondary">
                    <Clock className="w-10 h-10 mx-auto stroke-[1.5] mb-2 opacity-50" />
                    <p className="text-xs font-semibold">No tasks scheduled for this day</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-xl">
                    {getTasksForDate(currentDate).map(task => (
                      <div
                        key={task._id}
                        onClick={() => setSelectedTaskId(task._id)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:translate-x-1 ${getPriorityColor(task.priority)}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/40 dark:bg-wa-dark-panel/40 flex items-center justify-center font-bold text-xs shrink-0 border border-white/20">
                            {task.dueTime || 'EOD'}
                          </div>
                          <div>
                            <p className="text-xs font-extrabold">{task.title}</p>
                            <p className="text-[10px] opacity-75 line-clamp-1 mt-0.5">{task.description || 'No description.'}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full uppercase ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border w-full max-w-lg rounded-2xl flex flex-col shadow-wa-lg overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-wa-border dark:border-wa-dark-border shrink-0 bg-wa-hover dark:bg-wa-dark-panel-header">
              <h2 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
                <ClipboardList className="w-5 h-5 text-wa-green" /> Create & Assign Task
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green"
                  placeholder="e.g. Follow up on proposal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green resize-none"
                  placeholder="Details, objectives, links..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                    Assign To *
                  </label>
                  <select
                    required
                    value={createForm.assignedTo}
                    onChange={e => setCreateForm({ ...createForm, assignedTo: e.target.value })}
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
                    value={createForm.priority}
                    onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}
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
                    value={createForm.dueDate}
                    onChange={e => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-wa-text-secondary dark:text-wa-dark-text-secondary">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={createForm.dueTime}
                    onChange={e => setCreateForm({ ...createForm, dueTime: e.target.value })}
                    className="w-full bg-wa-hover dark:bg-wa-dark-hover border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white focus:outline-none focus:border-wa-green"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary py-2 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary bg-wa-green hover:bg-wa-green-dark text-white text-xs py-2 px-4 font-bold rounded-xl flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAIL MODAL */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdateSuccess={() => {
            fetchTasks();
            fetchCounts();
          }}
        />
      )}
    </div>
  );
}
