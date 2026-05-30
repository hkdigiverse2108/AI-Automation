'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../../../lib/store';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import {
  Shield, Activity, Database, Cpu, Layers, UserX, UserCheck,
  RefreshCw, Play, Pause, Trash2, Search, Users, CheckCircle2,
  XCircle, AlertCircle, HardDrive, Clock, Plus, Edit2, Lock,
  Globe, Building, Mail, Phone, Calendar, Upload, ImageIcon, X, Loader2
} from 'lucide-react';

export default function AdminPanel() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('organizations'); // health, queues, organizations
  const [healthData, setHealthData] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Logo upload states
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const [message, setMessage] = useState('');

  // Org modal states
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState(null);
  const [orgForm, setOrgForm] = useState({
    name: '',
    logo: '',
    businessType: '',
    industry: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: '',
    gstNumber: '',
    contactPerson: '',
    contactEmail: '',
    contactNumber: '',
    plan: 'free',
    maxTelecallers: 5,
    maxLeads: 1000,
    maxMonthlyConversations: 1000,
    adminName: '',
    adminEmail: '',
    adminUsername: '',
    adminPassword: '',
  });

  // Password reset modal states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Fetch health stats
  const fetchHealth = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/health');
      if (data.success) {
        setHealthData(data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch system health status.');
    }
  }, []);

  // Fetch all organizations
  const fetchOrganizations = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/organizations');
      if (data.success) {
        setOrganizations(data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch organizations.');
    }
  }, []);

  // Initial load
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    if (user?.role === 'superadmin') {
      await Promise.all([fetchHealth(), fetchOrganizations()]);
    }
    setLoading(false);
  }, [user, fetchHealth, fetchOrganizations]);

  useEffect(() => {
    loadData();
  }, [user, loadData]);

  // Queue actions
  const handleQueueControl = async (queueName, action, type = '') => {
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/admin/queues/control', { queueName, action, type });
      if (data.success) {
        toast.success(data.message);
        await fetchHealth();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to execute queue command.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle logo file selection
  const handleLogoFileSelect = (file) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only image files (JPG, PNG, GIF, WEBP, SVG) are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file must be under 5MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Upload logo to server and return URL
  const uploadLogo = async () => {
    if (!logoFile) return orgForm.logo;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const { data } = await api.post('/admin/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        return data.data.url;
      }
      throw new Error('Upload failed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload logo');
      return orgForm.logo;
    } finally {
      setUploadingLogo(false);
    }
  };

  // Create or Update Organization
  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      // Upload logo file first if a new file was selected
      let logoUrl = orgForm.logo;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }
      const submitData = { ...orgForm, logo: logoUrl };

      let res;
      if (editingOrgId) {
        res = await api.put(`/admin/organizations/${editingOrgId}`, submitData);
      } else {
        res = await api.post('/admin/organizations', submitData);
      }

      if (res.data.success) {
        toast.success(editingOrgId ? 'Organization updated successfully' : 'Organization and Admin created successfully');
        setIsOrgModalOpen(false);
        setOrgForm({
          name: '', logo: '', businessType: '', industry: '', website: '',
          address: '', city: '', state: '', country: '', gstNumber: '',
          contactPerson: '', contactEmail: '', contactNumber: '', plan: 'free',
          maxTelecallers: 5, maxLeads: 1000, maxMonthlyConversations: 1000,
          adminName: '', adminEmail: '', adminUsername: '', adminPassword: '',
        });
        setEditingOrgId(null);
        setLogoFile(null);
        setLogoPreview('');
        await fetchOrganizations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit organization details');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditOrg = (org) => {
    setEditingOrgId(org._id);
    setOrgForm({
      name: org.name || '',
      logo: org.logo || '',
      businessType: org.businessType || '',
      industry: org.industry || '',
      website: org.website || '',
      address: org.address || '',
      city: org.city || '',
      state: org.state || '',
      country: org.country || '',
      gstNumber: org.gstNumber || '',
      contactPerson: org.contactPerson || '',
      contactEmail: org.contactEmail || '',
      contactNumber: org.contactNumber || '',
      plan: org.plan || 'free',
      maxTelecallers: org.maxTelecallers ?? 5,
      maxLeads: org.maxLeads ?? 1000,
      maxMonthlyConversations: org.maxMonthlyConversations ?? 1000,
      adminName: org.adminName || '',
      adminEmail: org.adminEmail || '',
      adminUsername: '',
      adminPassword: '',
      status: org.status || 'active'
    });
    setIsOrgModalOpen(true);
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleToggleOrgSuspension = async (orgId, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus === 'active' ? 'suspend' : 'activate'} this organization?`)) return;
    setActionLoading(true);
    try {
      const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const { data } = await api.put(`/admin/organizations/${orgId}`, { status: nextStatus });
      if (data.success) {
        toast.success(`Organization has been ${nextStatus === 'suspended' ? 'suspended' : 'activated'}`);
        await fetchOrganizations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle suspension');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrg = async (orgId) => {
    if (!confirm('Are you sure you want to permanently delete this organization? All related user accounts will be suspended.')) return;
    setActionLoading(true);
    try {
      const { data } = await api.delete(`/admin/organizations/${orgId}`);
      if (data.success) {
        toast.success('Organization deleted successfully');
        await fetchOrganizations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete organization');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Admin Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    setActionLoading(true);
    try {
      const { data } = await api.post(`/admin/users/${resetUserId}/reset-password`, { newPassword });
      if (data.success) {
        toast.success('Admin password reset successfully');
        setIsPasswordModalOpen(false);
        setNewPassword('');
        setResetUserId(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  const openResetPasswordModal = (org) => {
    // Find the Admin user _id for resetting
    api.get('/admin/users').then(({ data }) => {
      const users = data.data || [];
      const admin = users.find(u => u.email === org.adminEmail);
      if (admin) {
        setResetUserId(admin._id);
        setResetEmail(org.adminEmail);
        setIsPasswordModalOpen(true);
      } else {
        toast.error('Admin user account not found for password reset');
      }
    }).catch(() => {
      toast.error('Failed to load user accounts for validation');
    });
  };

  // Format bytes helper
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format uptime helper
  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || parts.length === 0) parts.push(`${m}m`);
    return parts.join(' ');
  };

  // Filtered organizations
  const filteredOrgs = organizations.filter((o) =>
    o.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.adminName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Access check
  if (user?.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-red-550/10 rounded-2xl border border-red-500/20 text-red-500 max-w-xl mx-auto mt-20">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h3 className="text-xl font-bold mb-2">Access Denied</h3>
        <p className="text-sm text-center">You do not have administrative permissions to view this panel.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dark-200 dark:border-dark-700 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Admin & Operations Control</h2>
            <p className="text-sm text-dark-500 dark:text-dark-400 font-medium">SaaS Multi-tenant organizations management, limits, health monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingOrgId(null);
              setOrgForm({
                name: '', logo: '', businessType: '', industry: '', website: '',
                address: '', city: '', state: '', country: '', gstNumber: '',
                contactPerson: '', contactEmail: '', contactNumber: '', plan: 'free',
                maxTelecallers: 5, maxLeads: 1000, maxMonthlyConversations: 1000,
                adminName: '', adminEmail: '', adminUsername: '', adminPassword: '',
              });
              setIsOrgModalOpen(true);
            }}
            className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" /> Create Organization
          </button>
          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            className="btn-secondary flex items-center gap-2 py-2.5 px-4 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || actionLoading) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-dark-200 dark:border-dark-700">
        <button
          onClick={() => setActiveTab('organizations')}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'organizations'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Organizations ({organizations.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'health'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Health</span>
        </button>
        <button
          onClick={() => setActiveTab('queues')}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'queues'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Queues & Tasks</span>
        </button>
      </div>

      {/* Tabs Content */}
      <div className="pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-24">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mb-2" />
            <p className="text-sm text-dark-500 dark:text-dark-400 font-medium">Fetching platform metrics...</p>
          </div>
        ) : (
          <>
            {/* 1. ORGANIZATIONS TAB */}
            {activeTab === 'organizations' && (
              <div className="card overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-dark-200 dark:border-dark-800 bg-dark-50/50 dark:bg-dark-900 flex items-center gap-3">
                  <Search className="w-5 h-5 text-dark-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search organizations by name, admin email, or contact..."
                    className="bg-transparent border-0 ring-0 focus:ring-0 outline-none w-full text-sm dark:text-white placeholder-dark-400"
                  />
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-dark-200 dark:divide-dark-800 text-xs">
                    <thead className="bg-dark-50 dark:bg-dark-800/60 font-bold uppercase text-[10px] tracking-wider text-dark-500 dark:text-dark-400">
                      <tr>
                        <th className="px-5 py-3 text-left">Company Details</th>
                        <th className="px-5 py-3 text-left">Admin Info</th>
                        <th className="px-5 py-3 text-center">Subscription Plan</th>
                        <th className="px-5 py-3 text-center">Telecallers</th>
                        <th className="px-5 py-3 text-center">Leads</th>
                        <th className="px-5 py-3 text-center">Conversations (Monthly)</th>
                        <th className="px-5 py-3 className='text-center'">Created Date</th>
                        <th className="px-5 py-3 text-center">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-dark-900 divide-y divide-dark-200 dark:divide-dark-800">
                      {filteredOrgs.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-5 py-12 text-center text-sm text-dark-500 dark:text-dark-400">
                            No matching organizations found.
                          </td>
                        </tr>
                      ) : (
                        filteredOrgs.map((org) => (
                          <tr key={org._id} className="hover:bg-dark-50/50 dark:hover:bg-dark-800/10">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                {org.logo ? (
                                  <img 
                                    src={org.logo?.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${org.logo}` : org.logo} 
                                    alt="logo" 
                                    className="w-9 h-9 rounded-xl object-cover border border-dark-200" 
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                    {org.name?.[0]?.toUpperCase() || 'O'}
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-bold dark:text-white leading-tight">{org.name}</p>
                                  <p className="text-[10px] text-dark-400 mt-0.5">{org.industry || 'General'} · {org.businessType || 'SaaS'}</p>
                                  {org.website && <span className="text-[10px] text-brand-500 font-semibold truncate hover:underline block">{org.website}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="font-semibold dark:text-white leading-tight">{org.adminName}</p>
                              <p className="text-[10px] text-dark-400 mt-0.5">{org.adminEmail}</p>
                              {org.adminPhone && <p className="text-[10px] text-dark-400 font-mono mt-0.5">{org.adminPhone}</p>}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase ${
                                org.plan === 'enterprise' ? 'bg-purple-500/10 text-purple-500 border-purple-500/25' :
                                org.plan === 'pro' ? 'bg-pink-500/10 text-pink-500 border-pink-500/25' :
                                org.plan === 'starter' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25' :
                                'bg-dark-500/10 text-dark-500 dark:text-dark-350 border-dark-500/25'
                              }`}>
                                {org.plan}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="font-bold dark:text-white text-sm">{org.activeTelecallers}</span>
                              <span className="text-dark-400 text-[10px] block">Limit: {org.maxTelecallers}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="font-bold dark:text-white text-sm">{org.totalLeads}</span>
                              <span className="text-dark-400 text-[10px] block">Limit: {org.maxLeads}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="font-bold dark:text-white text-sm">{org.monthlyUsage}</span>
                              <span className="text-dark-400 text-[10px] block">Limit: {org.maxMonthlyConversations}</span>
                            </td>
                            <td className="px-5 py-4 text-center text-dark-400 font-mono">
                              {new Date(org.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                org.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                org.status === 'suspended' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${org.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span>{org.status}</span>
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <button onClick={() => handleEditOrg(org)} className="p-1.5 text-dark-500 hover:text-brand-500 dark:hover:text-white hover:bg-dark-100 dark:hover:bg-dark-800 rounded-lg transition-colors" title="Edit Plan Limits">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => openResetPasswordModal(org)} className="p-1.5 text-dark-500 hover:text-amber-500 dark:hover:text-white hover:bg-dark-100 dark:hover:bg-dark-800 rounded-lg transition-colors" title="Reset Admin Password">
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleToggleOrgSuspension(org._id, org.status)} className={`p-1.5 rounded-lg transition-colors ${org.status === 'active' ? 'text-red-500 hover:bg-red-550/10' : 'text-emerald-500 hover:bg-emerald-550/10'}`} title={org.status === 'active' ? 'Suspend Organization' : 'Activate Organization'}>
                                  {org.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => handleDeleteOrg(org._id)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Organization">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. HEALTH TAB */}
            {activeTab === 'health' && healthData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Services Connection Status */}
                <div className="card p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-4">
                      <Database className="w-5 h-5 text-brand-500" />
                      <span>Connections</span>
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-dark-100 dark:border-dark-800 pb-2">
                        <span className="text-sm font-semibold dark:text-dark-300">MongoDB Atlas</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${healthData.database.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-xs font-bold uppercase dark:text-white">{healthData.database.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold dark:text-dark-300">Redis Broker</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${healthData.redis.status === 'ready' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-xs font-bold uppercase dark:text-white">{healthData.redis.status === 'ready' ? 'connected' : 'disconnected'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 text-xs text-dark-500 dark:text-dark-400 border-t border-dark-100 dark:border-dark-800 pt-3">
                    Redis Ping: <span className="font-semibold text-brand-500">{healthData.redis.ping || 'N/A'}</span>
                  </div>
                </div>

                {/* System Hardware Stats */}
                <div className="card p-6">
                  <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-4">
                    <Cpu className="w-5 h-5 text-brand-500" />
                    <span>CPU / Processes</span>
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-dark-100 dark:border-dark-800 pb-2">
                      <span className="text-sm text-dark-500 dark:text-dark-300">CPU Cores</span>
                      <span className="text-sm font-bold dark:text-white">{healthData.cpu.cores} Core(s)</span>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-dark-500 dark:text-dark-400">Load Average (1m / 5m / 15m)</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-800 text-xs font-bold dark:text-white">{healthData.cpu.load1m}</span>
                        <span className="px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-800 text-xs font-bold dark:text-white">{healthData.cpu.load5m}</span>
                        <span className="px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-800 text-xs font-bold dark:text-white">{healthData.cpu.load15m}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Memory Hardware Stats */}
                <div className="card p-6">
                  <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-4">
                    <HardDrive className="w-5 h-5 text-brand-500" />
                    <span>Memory Usage</span>
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500 dark:text-dark-300">Used Memory</span>
                      <span className="font-bold dark:text-white">{formatBytes(healthData.memory.used)}</span>
                    </div>
                    <div className="w-full bg-dark-100 dark:bg-dark-800 rounded-full h-2">
                      <div
                        className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${healthData.memory.percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-dark-500 dark:text-dark-400">
                      <span>Total: {formatBytes(healthData.memory.total)}</span>
                      <span>{healthData.memory.percentage}% Used</span>
                    </div>
                  </div>
                </div>

                {/* Uptime and Processes */}
                <div className="card p-6 md:col-span-2 lg:col-span-3">
                  <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-brand-500" />
                    <span>Server Uptime</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-center gap-4 bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl border border-dark-100 dark:border-dark-800">
                      <div className="p-3 bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 rounded-xl">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">API Service Uptime</p>
                        <p className="text-lg font-bold dark:text-white mt-0.5">{formatUptime(healthData.uptime.process)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl border border-dark-100 dark:border-dark-800">
                      <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 rounded-xl">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-dark-550 dark:text-dark-400 font-semibold uppercase">System OS Uptime</p>
                        <p className="text-lg font-bold dark:text-white mt-0.5">{formatUptime(healthData.uptime.system)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. QUEUES TAB */}
            {activeTab === 'queues' && healthData && (
              <div className="space-y-6">
                {/* Campaign Messages Queue */}
                <div className="card p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dark-200 dark:border-dark-800 pb-4 mb-4">
                    <div>
                      <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand-500" />
                        <span>Campaign Messages Queue (`campaign-messages`)</span>
                      </h3>
                      <p className="text-xs text-dark-500 dark:text-dark-400">Processes bulk campaign dispatches. Rates are capped at 10 msgs/sec.</p>
                    </div>
                    <div className="flex gap-2">
                      {healthData.queues.campaign.paused ? (
                        <button
                          onClick={() => handleQueueControl('campaign-messages', 'resume')}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume Queue</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQueueControl('campaign-messages', 'pause')}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Queue</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleQueueControl('campaign-messages', 'clean', 'failed')}
                        disabled={actionLoading || healthData.queues.campaign.failed === 0}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Failed</span>
                      </button>
                      <button
                        onClick={() => handleQueueControl('campaign-messages', 'clean', 'completed')}
                        disabled={actionLoading || healthData.queues.campaign.completed === 0}
                        className="px-3 py-1.5 text-xs font-semibold bg-dark-500/10 hover:bg-dark-500/20 dark:hover:bg-dark-800 text-dark-600 dark:text-dark-300 border border-dark-500/20 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Completed</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Active</span>
                      <p className="text-2xl font-bold dark:text-white mt-1">{healthData.queues.campaign.active}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Waiting</span>
                      <p className="text-2xl font-bold text-brand-500 mt-1">{healthData.queues.campaign.waiting}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Delayed</span>
                      <p className="text-2xl font-bold dark:text-white mt-1">{healthData.queues.campaign.delayed}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Completed</span>
                      <p className="text-2xl font-bold text-emerald-500 mt-1">{healthData.queues.campaign.completed}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Failed</span>
                      <p className="text-2xl font-bold text-red-500 mt-1">{healthData.queues.campaign.failed}</p>
                    </div>
                  </div>
                </div>

                {/* Scheduled Campaigns Queue */}
                <div className="card p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dark-200 dark:border-dark-800 pb-4 mb-4">
                    <div>
                      <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand-500" />
                        <span>Scheduled Campaigns Clock Queue (`scheduled-campaigns`)</span>
                      </h3>
                      <p className="text-xs text-dark-500 dark:text-dark-400">Triggers pending scheduled blasts. Evaluates database schedules once per minute.</p>
                    </div>
                    <div className="flex gap-2">
                      {healthData.queues.schedule.paused ? (
                        <button
                          onClick={() => handleQueueControl('scheduled-campaigns', 'resume')}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume Queue</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQueueControl('scheduled-campaigns', 'pause')}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Queue</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleQueueControl('scheduled-campaigns', 'clean', 'failed')}
                        disabled={actionLoading || healthData.queues.schedule.failed === 0}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Failed</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Active</span>
                      <p className="text-2xl font-bold dark:text-white mt-1">{healthData.queues.schedule.active}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Waiting</span>
                      <p className="text-2xl font-bold text-brand-500 mt-1">{healthData.queues.schedule.waiting}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Delayed</span>
                      <p className="text-2xl font-bold dark:text-white mt-1">{healthData.queues.schedule.delayed}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Completed</span>
                      <p className="text-2xl font-bold text-emerald-500 mt-1">{healthData.queues.schedule.completed}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Failed</span>
                      <p className="text-2xl font-bold text-red-500 mt-1">{healthData.queues.schedule.failed}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATE/EDIT ORG MODAL */}
      {isOrgModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 rounded-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col shadow-2xl max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-dark-200 dark:border-dark-800 px-6 py-4">
              <h3 className="font-bold text-base text-dark-800 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-brand-500" />
                <span>{editingOrgId ? 'Configure Organization Plan & Profile' : 'Register Organization & Tenant Admin'}</span>
              </h3>
              <button onClick={() => setIsOrgModalOpen(false)} className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOrgSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin text-xs">
              
              {/* SECTION: COMPANY PROFILE */}
              <div className="space-y-3">
                <h4 className="font-bold text-[10px] text-brand-500 uppercase tracking-widest border-b pb-1">Company Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Company Name *</label>
                    <input
                      type="text" required
                      value={orgForm.name}
                      onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Company Logo</label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={(e) => handleLogoFileSelect(e.target.files?.[0])}
                      className="hidden"
                    />
                    {logoPreview || orgForm.logo ? (
                      <div className="relative group w-full h-[100px] rounded-xl border-2 border-dashed border-brand-300 dark:border-brand-700 overflow-hidden bg-gray-50 dark:bg-dark-800 flex items-center justify-center">
                        <img
                          src={logoPreview || (orgForm.logo?.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${orgForm.logo}` : orgForm.logo)}
                          alt="Logo preview"
                          className="max-h-[90px] max-w-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="p-2 bg-white/90 rounded-lg text-dark-700 hover:bg-white transition-colors"
                            title="Change logo"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setLogoFile(null); setLogoPreview(''); setOrgForm({ ...orgForm, logo: '' }); if (logoInputRef.current) logoInputRef.current.value = ''; }}
                            className="p-2 bg-white/90 rounded-lg text-red-600 hover:bg-white transition-colors"
                            title="Remove logo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {uploadingLogo && (
                          <div className="absolute inset-0 bg-white/70 dark:bg-dark-900/70 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleLogoFileSelect(e.dataTransfer.files?.[0]); }}
                        className="w-full h-[100px] rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-600 hover:border-brand-400 dark:hover:border-brand-600 bg-gray-50 dark:bg-dark-800 flex flex-col items-center justify-center cursor-pointer transition-colors group"
                      >
                        <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-brand-500 mb-1 transition-colors" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-brand-500 transition-colors">Click or drag to upload</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, GIF, WEBP, SVG (max 5MB)</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Website URL</label>
                    <input
                      type="url"
                      value={orgForm.website}
                      onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">GST Number (Optional)</label>
                    <input
                      type="text"
                      value={orgForm.gstNumber}
                      onChange={(e) => setOrgForm({ ...orgForm, gstNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="e.g. 22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Business Type</label>
                    <input
                      type="text"
                      value={orgForm.businessType}
                      onChange={(e) => setOrgForm({ ...orgForm, businessType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="e.g. B2B, B2C"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Industry</label>
                    <input
                      type="text"
                      value={orgForm.industry}
                      onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="e.g. Technology, Retail"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block font-bold text-dark-500 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={orgForm.address}
                      onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">City</label>
                    <input
                      type="text"
                      value={orgForm.city}
                      onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="Surat"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Country</label>
                    <input
                      type="text"
                      value={orgForm.country}
                      onChange={(e) => setOrgForm({ ...orgForm, country: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="India"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: PLAN LIMITS */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-[10px] text-brand-500 uppercase tracking-widest border-b pb-1">Subscription plan limits</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">SaaS Plan *</label>
                    <select
                      value={orgForm.plan}
                      onChange={(e) => setOrgForm({ ...orgForm, plan: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700 bg-white dark:bg-dark-900"
                    >
                      <option value="free">Free Plan</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro Plan</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Max Telecallers *</label>
                    <input
                      type="number" required min="1"
                      value={orgForm.maxTelecallers}
                      onChange={(e) => setOrgForm({ ...orgForm, maxTelecallers: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Max Leads Allowed *</label>
                    <input
                      type="number" required min="1"
                      value={orgForm.maxLeads}
                      onChange={(e) => setOrgForm({ ...orgForm, maxLeads: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Max Monthly Chats *</label>
                    <input
                      type="number" required min="1"
                      value={orgForm.maxMonthlyConversations}
                      onChange={(e) => setOrgForm({ ...orgForm, maxMonthlyConversations: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: ADMIN CONFIG (Only when creating) */}
              {!editingOrgId && (
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-[10px] text-brand-500 uppercase tracking-widest border-b pb-1">Primary Organization Admin Credential</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-dark-500 mb-1">Admin Full Name *</label>
                      <input
                        type="text" required
                        value={orgForm.adminName}
                        onChange={(e) => setOrgForm({ ...orgForm, adminName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                        placeholder="Parth Devani"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-dark-500 mb-1">Admin Email Address *</label>
                      <input
                        type="email" required
                        value={orgForm.adminEmail}
                        onChange={(e) => setOrgForm({ ...orgForm, adminEmail: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                        placeholder="admin@company.com"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-dark-500 mb-1">Admin Phone Number</label>
                      <input
                        type="text"
                        value={orgForm.contactNumber}
                        onChange={(e) => setOrgForm({ ...orgForm, contactNumber: e.target.value, contactPerson: orgForm.adminName })}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                        placeholder="+91 99999 88888"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-dark-500 mb-1">Admin Default Password *</label>
                      <input
                        type="password" required
                        value={orgForm.adminPassword}
                        onChange={(e) => setOrgForm({ ...orgForm, adminPassword: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                        placeholder="Minimum 8 characters"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-dark-200 dark:border-dark-800">
                <button type="button" onClick={() => setIsOrgModalOpen(false)} className="btn-secondary py-2 px-4" disabled={actionLoading}>Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn-primary py-2 px-5 flex items-center gap-1.5">
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingOrgId ? 'Save Configuration' : 'Register SaaS Tenant'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET ADMIN PASSWORD MODAL */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 rounded-2xl w-full max-w-sm overflow-hidden animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-200 dark:border-dark-800 px-5 py-4">
              <h3 className="font-bold text-sm text-dark-800 dark:text-white flex items-center gap-1.5">
                <Lock className="w-4.5 h-4.5 text-amber-500" />
                <span>Reset Admin Password</span>
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-dark-500 leading-normal">
                You are resetting the password for organization admin: <strong className="dark:text-white font-semibold">{resetEmail}</strong>.
              </p>
              <div>
                <label className="block font-bold text-dark-500 mb-1">New Password *</label>
                <input
                  type="password" required
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-dark-200 dark:border-dark-800">
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="btn-secondary py-2 px-4" disabled={actionLoading}>Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn-primary py-2 px-4 flex items-center gap-1.5">
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
