'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, Play, Calendar, Users, FileText, AlertCircle, Loader2, FolderOpen, Clock } from 'lucide-react';
import api from '../lib/api';
import Portal from './Portal';

function toLocalDatetimeString(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function CampaignForm({ campaign, onClose, onSuccess, isUnofficial }) {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);

  // Groups State
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Form State
  const [name, setName] = useState(campaign ? campaign.name : '');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [audienceType, setAudienceType] = useState(campaign?.audience?.type || 'all');
  const [audienceTags, setAudienceTags] = useState(campaign?.audience?.tags?.join(', ') || '');
  const [selectedGroupId, setSelectedGroupId] = useState(
    campaign?.audience?.type === 'group'
      ? (campaign.audience.groupIds?.[0]?._id || campaign.audience.groupIds?.[0] || '')
      : ''
  );
  const [variables, setVariables] = useState(campaign?.variables || []);
  const [isScheduled, setIsScheduled] = useState(campaign ? !!campaign.scheduledAt : false);
  const [scheduledAt, setScheduledAt] = useState(
    campaign?.scheduledAt ? toLocalDatetimeString(campaign.scheduledAt) : ''
  );
  const [headerMediaId, setHeaderMediaId] = useState(campaign?.headerMediaId || '');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      setLoadingTemplates(true);
      try {
        const { data } = await api.get('/templates');
        if (data.success) {
          // Filter by APPROVED templates or show all
          setTemplates(data.data.templates);
          
          if (campaign && campaign.templateId) {
            const matched = data.data.templates.find(t => t._id === campaign.templateId || t.name === campaign.templateName);
            if (matched) {
              setSelectedTemplate(matched);
              if (campaign.variables?.length) {
                setVariables(campaign.variables);
              }
            }
          }
        }
      } catch (err) {
        toast.error('Failed to load templates');
      } finally {
        setLoadingTemplates(false);
      }
    }
    loadTemplates();
  }, [campaign]);

  useEffect(() => {
    async function loadGroups() {
      setLoadingGroups(true);
      try {
        const { data } = await api.get('/groups', { params: { limit: 1000 } });
        if (data.success) {
          setGroups(data.data.groups || []);
        }
      } catch (err) {
        console.error('Failed to load groups for campaign form:', err);
      } finally {
        setLoadingGroups(false);
      }
    }
    loadGroups();
  }, []);

  const handleTemplateChange = (templateId) => {
    const t = templates.find(temp => temp._id === templateId);
    setSelectedTemplate(t);
    
    // Auto-populate pre-saved image if available on the template
    if (t && t.headerMediaId) {
      setHeaderMediaId(t.headerMediaId);
    } else {
      setHeaderMediaId('');
    }
    
    if (t) {
      // Extract variable count from components text
      let varCount = t.variableCount || 0;
      if (!varCount) {
        varCount = (t.components || []).reduce((acc, c) => {
          const matches = (c.text || '').match(/\{\{[0-9]+\}\}/g);
          return acc + (matches ? matches.length : 0);
        }, 0);
      }
      if (campaign && (campaign.templateId === t._id || campaign.templateName === t.name) && campaign.variables?.length === varCount) {
        setVariables([...campaign.variables]);
      } else {
        setVariables(Array(varCount).fill(''));
      }
    } else {
      setVariables([]);
    }
  };

  const handleVariableChange = (idx, value) => {
    const next = [...variables];
    next[idx] = value;
    setVariables(next);
  };

  const getVariableContext = (varNum) => {
    if (!selectedTemplate) return `Variable {{${varNum}}}`;
    const bodyComp = selectedTemplate.components?.find(c => c.type === 'BODY' || c.type?.toLowerCase() === 'body');
    if (!bodyComp || !bodyComp.text) return `Variable {{${varNum}}}`;
    
    const regex = new RegExp(`(?:([\\w\\s\\.,:₹#\\-]{1,25}))?\\{\\{${varNum}\\}\\}(?:([\\w\\s\\.,:₹#\\-]{1,25}))?`, 'i');
    const match = bodyComp.text.match(regex);
    if (match) {
      const before = (match[1] || '').trim();
      const after = (match[2] || '').trim();
      if (before && after) return `${before} [{{${varNum}}}] ${after}`;
      if (before) return `After "${before}"`;
      if (after) return `Before "${after}"`;
    }
    return `Variable {{${varNum}}}`;
  };

  const headerComponent = selectedTemplate?.components?.find(
    c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format)
  );
  const headerMediaFormat = headerComponent?.format; // 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  const hasMediaHeader = !!headerMediaFormat;
  const hasImageHeader = hasMediaHeader;

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadingImage(true);
    try {
      const { data } = await api.post('/campaigns/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        setHeaderMediaId(data.mediaId);
        toast.success(`Header ${headerMediaFormat ? headerMediaFormat.toLowerCase() : 'media'} uploaded successfully!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload media');
    } finally {
      setUploadingImage(false);
    }
  };
  const handleImageUpload = handleMediaUpload;

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!name || !name.trim()) return toast.error('Campaign name is required');
    if (!selectedTemplate) return toast.error('Please select a template');
    
    if (hasMediaHeader && !headerMediaId) {
      return toast.error(`This template requires a header ${headerMediaFormat.toLowerCase()} to be uploaded`);
    }
    
    if (audienceType === 'tag' && !audienceTags) {
      return toast.error('Please specify target tags');
    }

    if (audienceType === 'group' && !selectedGroupId) {
      return toast.error('Please select a target contact group');
    }

    // Strict validation for template variables
    if (variables.length > 0) {
      for (let i = 0; i < variables.length; i++) {
        if (!variables[i] || !String(variables[i]).trim()) {
          return toast.error(`Please provide a value for Variable {{${i + 1}}} (or use {{name}})`);
        }
      }
    }
    
    if (isScheduled) {
      if (!scheduledAt) {
        return toast.error('Please specify a schedule date and time');
      }
      const schedDate = new Date(scheduledAt);
      if (isNaN(schedDate.getTime())) {
        return toast.error('Invalid schedule date format');
      }
      if (schedDate.getTime() <= Date.now() + 60000) {
        return toast.error('Scheduled time must be at least 1-2 minutes in the future');
      }
    }

    setSaving(true);
    try {
      const payload = {
        name,
        templateId: selectedTemplate._id,
        templateName: selectedTemplate.name,
        audience: {
          type: audienceType === 'group' && !selectedGroupId ? 'all' : audienceType,
          tags: audienceType === 'tag' ? audienceTags.split(',').map(t => t.trim()).filter(Boolean) : [],
          groupIds: audienceType === 'group' && selectedGroupId ? [selectedGroupId] : []
        },
        variables,
        headerMediaId,
        isUnofficial: isUnofficial !== undefined ? isUnofficial : (campaign ? campaign.isUnofficial : false),
        scheduledAt: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined
      };

      let res;
      if (campaign) {
        res = await api.put(`/campaigns/${campaign._id}`, payload);
      } else {
        res = await api.post('/campaigns', payload);
      }

      if (res.data.success) {
        toast.success(res.data.message || (campaign ? 'Campaign updated successfully' : 'Campaign created successfully'));
        onSuccess();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${campaign ? 'update' : 'create'} campaign`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-100 dark:border-dark-700 flex justify-between items-center bg-dark-50 dark:bg-dark-800 shrink-0">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-brand-500" />
            <h3 className="font-bold dark:text-white">{campaign ? 'Edit Blast Campaign' : 'Create Blast Campaign'}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700">
            <X className="w-5 h-5 text-dark-500" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Campaign details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-dark-400 tracking-wider">1. Basic Details</h4>
            <div>
              <label className="block text-xs font-semibold text-dark-600 dark:text-dark-300 mb-1.5">Campaign Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Black Friday Special Blast"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Section 2: Audience Selection */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-dark-400 tracking-wider">2. Target Audience</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className={`border p-4 rounded-xl flex items-start gap-3 cursor-pointer transition-all ${audienceType === 'all' ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-900/10' : 'border-dark-200 dark:border-dark-700'}`}>
                <input 
                  type="radio" 
                  name="audienceType" 
                  value="all"
                  checked={audienceType === 'all'} 
                  onChange={() => { setAudienceType('all'); setSelectedGroupId(''); }} 
                  className="mt-1 accent-brand-500"
                />
                <div>
                  <span className="block font-semibold text-sm dark:text-white">All Active Contacts</span>
                  <span className="block text-xs text-dark-400">Send to all opted-in subscribers</span>
                </div>
              </label>

              <label className={`border p-4 rounded-xl flex items-start gap-3 cursor-pointer transition-all ${audienceType === 'tag' ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-900/10' : 'border-dark-200 dark:border-dark-700'}`}>
                <input 
                  type="radio" 
                  name="audienceType" 
                  value="tag"
                  checked={audienceType === 'tag'} 
                  onChange={() => { setAudienceType('tag'); setSelectedGroupId(''); }} 
                  className="mt-1 accent-brand-500"
                />
                <div>
                  <span className="block font-semibold text-sm dark:text-white">Filter by Tags</span>
                  <span className="block text-xs text-dark-400">Target contacts matching specific tags</span>
                </div>
              </label>

              <label className={`border p-4 rounded-xl flex items-start gap-3 cursor-pointer transition-all ${audienceType === 'group' ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-900/10' : 'border-dark-200 dark:border-dark-700'}`}>
                <input 
                  type="radio" 
                  name="audienceType" 
                  value="group"
                  checked={audienceType === 'group'} 
                  onChange={() => setAudienceType('group')} 
                  className="mt-1 accent-brand-500"
                />
                <div>
                  <span className="block font-semibold text-sm dark:text-white">Target Group</span>
                  <span className="block text-xs text-dark-400">Target contacts from a specific group</span>
                </div>
              </label>
            </div>

            {audienceType === 'tag' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-dark-600 dark:text-dark-300 mb-1.5">Target Tags *</label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 w-4.5 h-4.5 text-dark-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. leads, VIP-customers, promo-optin"
                    value={audienceTags}
                    onChange={(e) => setAudienceTags(e.target.value)}
                    className="input-field pl-10 py-2.5 text-sm"
                  />
                </div>
                <p className="text-[10px] text-dark-400 mt-1">Comma-separated list. Campaign will target contacts matching ANY of these tags.</p>
              </div>
            )}

            {audienceType === 'group' && (
              <div className="animate-fade-in space-y-2">
                <label className="block text-xs font-semibold text-dark-600 dark:text-dark-300 mb-1.5">Select Target Group (Optional)</label>
                {loadingGroups ? (
                  <div className="flex items-center gap-2 text-xs text-dark-500 py-1">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                    <span>Loading groups...</span>
                  </div>
                ) : groups.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-600 text-xs">
                    No groups found. Please create a group in Contacts &gt; Groups first!
                  </div>
                ) : (
                  <div className="relative">
                    <FolderOpen className="absolute left-3 top-3 w-4.5 h-4.5 text-dark-400" />
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="input-field pl-10 py-2.5 text-sm appearance-none"
                    >
                      <option value="">-- Select Group (Optional / Leave blank for All Contacts) --</option>
                      {groups.map(g => (
                        <option key={g._id} value={g._id}>
                          {g.name} ({g.contactCount || 0} contacts)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="text-[10px] text-dark-400 mt-1">
                  If selected, messages go only to contacts in this group. If blank, it goes to all contacts.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: WhatsApp Template Mapping */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-dark-400 tracking-wider">3. Template selection</h4>

            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-dark-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                <span>Loading templates...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-600 flex items-start gap-2 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>No synced templates found. Go to the Templates page to sync templates from Meta first!</span>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-dark-600 dark:text-dark-300 mb-1.5">Choose WhatsApp Template *</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4.5 h-4.5 text-dark-400" />
                  <select
                    required
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    value={selectedTemplate?._id || ''}
                    className="input-field pl-10 py-2.5 text-sm appearance-none"
                  >
                    <option value="">-- Choose template --</option>
                    {templates.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.category} - {t.language}) [{t.status}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Template Body Preview & Parameters Mapping */}
            {selectedTemplate && (
              <div className="p-4 bg-dark-50 dark:bg-dark-800/40 border border-dark-250 dark:border-dark-700/50 rounded-xl space-y-4 animate-fade-in">
                {hasMediaHeader && (
                  <div className="border-b border-dark-200 dark:border-dark-700 pb-4 space-y-2">
                    <label className="block text-xs font-bold uppercase text-dark-600 dark:text-dark-350">
                      {headerMediaFormat === 'VIDEO' ? 'Header Video *' : headerMediaFormat === 'DOCUMENT' ? 'Header Document / PDF *' : 'Header Image *'}
                    </label>
                    <p className="text-xs text-dark-400">
                      {headerMediaFormat === 'VIDEO'
                        ? 'This template requires a header video (MP4/3GP). Select a video from your PC to upload.'
                        : headerMediaFormat === 'DOCUMENT'
                        ? 'This template requires a header document (PDF). Select a PDF file from your PC to upload.'
                        : 'This template requires a header image. Select a JPEG/PNG image from your PC to upload.'}
                    </p>
                    <div className="flex flex-col gap-2">
                      {headerMediaId && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg">
                            {selectedTemplate?.headerMediaId === headerMediaId
                              ? `✓ Pre-saved Template ${headerMediaFormat} Loaded`
                              : `✓ Override ${headerMediaFormat} Uploaded`}
                          </span>
                          <span className="text-[10px] text-dark-400">(ID: {headerMediaId})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <input 
                          type="file" 
                          accept={
                            headerMediaFormat === 'VIDEO'
                              ? 'video/mp4,video/3gpp'
                              : headerMediaFormat === 'DOCUMENT'
                              ? 'application/pdf,.pdf'
                              : 'image/*'
                          }
                          onChange={handleMediaUpload}
                          disabled={uploadingImage}
                          className="text-xs text-dark-600 dark:text-dark-350 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-dark-100 hover:file:bg-brand-100 cursor-pointer"
                        />
                        {uploadingImage && (
                          <div className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading {headerMediaFormat?.toLowerCase() || 'media'}...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <span className="block text-xs font-bold uppercase text-dark-400 mb-1.5">Template Preview</span>
                  <div className="bg-white dark:bg-dark-900 p-3 rounded-lg border border-dark-200 dark:border-dark-800 max-w-sm text-sm shadow-sm space-y-2">
                    {selectedTemplate.components.map((c, i) => {
                      if (c.type === 'HEADER') return (
                        <div key={i} className="font-bold text-dark-800 dark:text-white border-b border-dark-100 dark:border-dark-800 pb-1 text-xs flex items-center gap-1.5">
                          {c.format === 'VIDEO' ? '🎥 [Video Header]' : c.format === 'DOCUMENT' ? '📄 [Document/PDF Header]' : c.format === 'IMAGE' ? '🖼️ [Image Header]' : (c.text || 'Header')}
                        </div>
                      );
                      if (c.type === 'BODY') {
                        const parts = (c.text || '').split(/(\{\{[0-9]+\}\})/g);
                        return (
                          <div key={i} className="text-dark-700 dark:text-dark-300 whitespace-pre-wrap text-xs leading-relaxed">
                            {parts.map((part, pIdx) => {
                              const match = part.match(/^\{\{([0-9]+)\}\}$/);
                              if (match) {
                                const varIndex = parseInt(match[1], 10) - 1;
                                const val = variables[varIndex];
                                if (val && val.trim()) {
                                  return (
                                    <span key={pIdx} className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-semibold px-1 py-0.5 rounded text-[11px] border border-emerald-300 dark:border-emerald-700">
                                      {val}
                                    </span>
                                  );
                                }
                                return (
                                  <span key={pIdx} className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold px-1 py-0.5 rounded text-[11px] border border-amber-300 dark:border-amber-700 animate-pulse" title="Required parameter">
                                    {part}
                                  </span>
                                );
                              }
                              return part;
                            })}
                          </div>
                        );
                      }
                      if (c.type === 'FOOTER') return <div key={i} className="text-xs text-dark-400 mt-1">{c.text}</div>;
                      if (c.type === 'BUTTONS') return (
                        <div key={i} className="flex flex-col gap-1 border-t border-dark-100 dark:border-dark-800 pt-2 text-center text-brand-500 font-semibold text-xs mt-2">
                          {(c.buttons || []).map((b, idx) => <div key={idx} className="py-1 bg-dark-50 dark:bg-dark-850 rounded hover:bg-dark-100">{b.text}</div>)}
                        </div>
                      );
                      return null;
                    })}
                  </div>
                </div>

                {variables.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-dark-200 dark:border-dark-750">
                    <div className="flex items-center justify-between">
                      <span className="block text-xs font-bold uppercase text-dark-500">
                        Template Variables ({variables.length} required) *
                      </span>
                      <span className="text-[11px] text-dark-400">
                        All variables must have a value or tag
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {variables.map((v, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl border border-dark-200 dark:border-dark-700 bg-white/50 dark:bg-dark-850/50 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-medium text-dark-600 dark:text-dark-300">
                            <span className="font-semibold text-brand-600 dark:text-brand-400">Variable `{"{{" + (idx + 1) + "}}"}`</span>
                            <span className="text-[10px] text-dark-400 truncate max-w-[150px]" title={getVariableContext(idx + 1)}>
                              {getVariableContext(idx + 1)}
                            </span>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder={`e.g. {{name}} or custom value`}
                            value={v}
                            onChange={(e) => handleVariableChange(idx, e.target.value)}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                          />
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] text-dark-400">Quick insert:</span>
                            <button
                              type="button"
                              onClick={() => handleVariableChange(idx, (v && !v.includes('{{name}}') ? v + ' ' : '') + '{{name}}')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 text-brand-600 dark:text-brand-400 font-medium transition-colors"
                            >
                              + Name
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVariableChange(idx, (v && !v.includes('{{phone}}') ? v + ' ' : '') + '{{phone}}')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-dark-100 hover:bg-dark-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-300 font-medium transition-colors"
                            >
                              + Phone
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Scheduling */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-dark-400 tracking-wider">4. Send Timing</h4>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold dark:text-white">
                <input 
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="rounded text-brand-500 focus:ring-brand-500/50 w-4.5 h-4.5 accent-brand-500"
                />
                <span>Schedule for later</span>
              </label>
            </div>

            {isScheduled && (
              <div className="space-y-2.5 animate-fade-in">
                <div className="flex items-center gap-2 max-w-sm">
                  <Calendar className="w-5 h-5 text-dark-400 shrink-0" />
                  <input 
                    type="datetime-local" 
                    required
                    min={toLocalDatetimeString(new Date(Date.now() + 2 * 60000))}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="input-field py-2 text-sm"
                  />
                </div>
                {scheduledAt && !isNaN(new Date(scheduledAt).getTime()) && (
                  <div className="p-2.5 rounded-xl bg-brand-50/60 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-900/50 text-xs text-brand-700 dark:text-brand-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0 text-brand-500" />
                    <span>
                      Will trigger on: <strong>{new Date(scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong> ({Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time'})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-dark-100 dark:border-dark-700 flex justify-end gap-3 bg-dark-50 dark:bg-dark-800 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="btn-secondary py-2 text-sm px-4"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary py-2 text-sm px-5 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{campaign ? 'Saving...' : 'Creating...'}</span>
              </>
            ) : (
              <span>{campaign ? 'Save Changes' : (isScheduled ? 'Schedule Campaign' : 'Create Campaign')}</span>
            )}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
