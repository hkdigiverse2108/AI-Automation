'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  Search, RefreshCw, Copy, Shield, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Check, X, Users, Loader2
} from 'lucide-react';

const SECTIONS = ['MAIN', 'MARKETING', 'AUTOMATION', 'INSIGHTS', 'SYSTEM'];
const SECTION_COLORS = {
  MAIN: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  MARKETING: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  AUTOMATION: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  INSIGHTS: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  SYSTEM: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

export default function FeaturePermissionsTab() {
  const [admins, setAdmins] = useState([]);
  const [features, setFeatures] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState(SECTIONS);
  const [copyFrom, setCopyFrom] = useState('');
  const [dirty, setDirty] = useState(false);

  // Fetch admins and features
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, featuresRes] = await Promise.all([
        api.get('/admin/admins'),
        api.get('/admin/features'),
      ]);
      if (adminsRes.data.success) setAdmins(adminsRes.data.data.admins);
      if (featuresRes.data.success) setFeatures(featuresRes.data.data.features);
    } catch (err) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load permissions for selected admin
  const loadPermissions = useCallback(async (adminId) => {
    try {
      const { data } = await api.get(`/admin/permissions/${adminId}`);
      if (data.success) {
        setPermissions(data.data.permissions);
        setDirty(false);
      }
    } catch (err) {
      toast.error('Failed to load permissions');
    }
  }, []);

  useEffect(() => {
    if (selectedAdmin) loadPermissions(selectedAdmin._id);
  }, [selectedAdmin, loadPermissions]);

  // Toggle a single permission
  const togglePermission = (featureId) => {
    setPermissions(prev => prev.map(p =>
      p._id === featureId ? { ...p, can_view: !p.can_view } : p
    ));
    setDirty(true);
  };

  // Enable/Disable all
  const setAll = (value) => {
    setPermissions(prev => prev.map(p => ({ ...p, can_view: value })));
    setDirty(true);
  };

  // Save permissions
  const handleSave = async () => {
    if (!selectedAdmin) return;
    setSaving(true);
    try {
      const payload = permissions.map(p => ({
        feature_id: p._id,
        can_view: p.can_view,
      }));
      const { data } = await api.post(`/admin/permissions/${selectedAdmin._id}`, { permissions: payload });
      if (data.success) {
        toast.success('Permissions saved!');
        setDirty(false);
      }
    } catch (err) {
      toast.error('Failed to save permissions');
    }
    setSaving(false);
  };

  // Copy permissions from another admin
  const handleCopy = async () => {
    if (!copyFrom || !selectedAdmin) return;
    setSaving(true);
    try {
      const { data } = await api.post('/admin/permissions/copy', {
        sourceAdminId: copyFrom,
        targetAdminId: selectedAdmin._id,
      });
      if (data.success) {
        toast.success('Permissions copied!');
        await loadPermissions(selectedAdmin._id);
        setCopyFrom('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to copy permissions');
    }
    setSaving(false);
  };

  // Toggle section expand
  const toggleSection = (section) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  // Filter admins by search
  const filteredAdmins = admins.filter(a =>
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group permissions by section and filter
  const groupedPermissions = SECTIONS.map(section => ({
    section,
    features: permissions.filter(p =>
      p.section === section &&
      (p.name?.toLowerCase().includes(moduleSearch.toLowerCase()) ||
       p.slug?.toLowerCase().includes(moduleSearch.toLowerCase()))
    ),
  })).filter(g => g.features.length > 0);

  // Stats
  const enabledCount = permissions.filter(p => p.can_view).length;
  const totalCount = permissions.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mb-2" />
        <p className="text-sm text-dark-500 dark:text-dark-400 font-medium">Loading feature permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Admin List Sidebar */}
        <div className="lg:col-span-1">
          <div className="card overflow-hidden">
            <div className="p-3 border-b border-dark-200 dark:border-dark-700 bg-dark-50/50 dark:bg-dark-900">
              <h3 className="text-xs font-bold text-dark-700 dark:text-dark-200 flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                Organization Admins ({admins.length})
              </h3>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search admins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-dark-800 dark:text-white dark:border-dark-700 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-dark-100 dark:divide-dark-800">
              {filteredAdmins.length === 0 ? (
                <p className="text-xs text-dark-400 p-4 text-center">No admins found</p>
              ) : (
                filteredAdmins.map(admin => (
                  <button
                    key={admin._id}
                    onClick={() => setSelectedAdmin(admin)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-dark-50 dark:hover:bg-dark-800 ${
                      selectedAdmin?._id === admin._id
                        ? 'bg-brand-50 dark:bg-brand-900/20 border-l-2 border-brand-500'
                        : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {admin.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-dark-800 dark:text-white truncate">{admin.name}</p>
                      <p className="text-[10px] text-dark-400 dark:text-dark-500 truncate">{admin.email}</p>
                    </div>
                    {admin.isSuspended && (
                      <span className="text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">Suspended</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Permissions Panel */}
        <div className="lg:col-span-3">
          {!selectedAdmin ? (
            <div className="card flex flex-col items-center justify-center p-16 text-center">
              <Shield className="w-12 h-12 text-dark-300 dark:text-dark-600 mb-3" />
              <h3 className="text-sm font-bold text-dark-600 dark:text-dark-300">Select an Admin</h3>
              <p className="text-xs text-dark-400 mt-1">Choose an organization admin from the list to manage their feature permissions.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-dark-200 dark:border-dark-700 bg-dark-50/50 dark:bg-dark-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-sm font-bold">
                      {selectedAdmin.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-dark-800 dark:text-white">{selectedAdmin.name}</h3>
                      <p className="text-[10px] text-dark-400">{selectedAdmin.email}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                      {enabledCount}/{totalCount} enabled
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAll(true)}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Enable All
                    </button>
                    <button
                      onClick={() => setAll(false)}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Disable All
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!dirty || saving}
                      className={`text-[10px] font-bold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                        dirty
                          ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/25'
                          : 'bg-dark-100 dark:bg-dark-800 text-dark-400 cursor-not-allowed'
                      }`}
                    >
                      {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* Controls Row */}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {/* Module Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400" />
                    <input
                      type="text"
                      placeholder="Search modules..."
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-dark-800 dark:text-white dark:border-dark-700 focus:ring-1 focus:ring-brand-500 outline-none"
                    />
                  </div>

                  {/* Copy From Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={copyFrom}
                      onChange={(e) => setCopyFrom(e.target.value)}
                      className="text-xs border rounded-lg px-2.5 py-1.5 bg-white dark:bg-dark-800 dark:text-white dark:border-dark-700 outline-none"
                    >
                      <option value="">Copy from...</option>
                      {admins
                        .filter(a => a._id !== selectedAdmin._id)
                        .map(a => (
                          <option key={a._id} value={a._id}>{a.name} ({a.email})</option>
                        ))
                      }
                    </select>
                    <button
                      onClick={handleCopy}
                      disabled={!copyFrom || saving}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* Permissions Grid */}
              <div className="divide-y divide-dark-100 dark:divide-dark-800">
                {groupedPermissions.map(({ section, features: sectionFeatures }) => (
                  <div key={section}>
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-dark-25 dark:bg-dark-850 hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.includes(section) ? (
                          <ChevronDown className="w-3.5 h-3.5 text-dark-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-dark-400" />
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${SECTION_COLORS[section]}`}>
                          {section}
                        </span>
                        <span className="text-[10px] text-dark-400">
                          {sectionFeatures.filter(f => f.can_view).length}/{sectionFeatures.length} enabled
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPermissions(prev => prev.map(p =>
                              p.section === section ? { ...p, can_view: true } : p
                            ));
                            setDirty(true);
                          }}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 hover:bg-emerald-100"
                          title="Enable all in section"
                        >
                          All On
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPermissions(prev => prev.map(p =>
                              p.section === section ? { ...p, can_view: false } : p
                            ));
                            setDirty(true);
                          }}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100"
                          title="Disable all in section"
                        >
                          All Off
                        </button>
                      </div>
                    </button>

                    {/* Section Features */}
                    {expandedSections.includes(section) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-0">
                        {sectionFeatures.map(feature => (
                          <button
                            key={feature._id}
                            onClick={() => togglePermission(feature._id)}
                            className={`flex items-center justify-between px-4 py-2.5 text-left border-b border-r border-dark-100 dark:border-dark-800 transition-all hover:bg-dark-25 dark:hover:bg-dark-850 ${
                              feature.can_view
                                ? ''
                                : 'bg-red-50/30 dark:bg-red-900/5'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                                feature.can_view
                                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                                  : 'bg-dark-100 dark:bg-dark-800 text-dark-400'
                              }`}>
                                {feature.name?.[0]}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-semibold truncate ${
                                  feature.can_view
                                    ? 'text-dark-800 dark:text-white'
                                    : 'text-dark-400 line-through'
                                }`}>
                                  {feature.name}
                                </p>
                                <p className="text-[9px] text-dark-400 truncate">{feature.route}</p>
                              </div>
                            </div>
                            {feature.can_view ? (
                              <ToggleRight className="w-6 h-6 text-emerald-500 shrink-0" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-dark-300 dark:text-dark-600 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
