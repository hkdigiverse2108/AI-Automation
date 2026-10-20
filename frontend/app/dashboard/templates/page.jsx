'use client';
import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  FileText, RefreshCw, Plus, Trash2, CheckCircle2,
  Clock, AlertTriangle, X, Loader2, Sparkles, LayoutGrid, List, Search, ChevronLeft, ChevronRight, Edit3, Image, Settings,
  Filter, Tag
} from 'lucide-react';
import api from '../../../lib/api';
import { usePageData } from '../../../lib/usePageData';
import { useConfirmStore } from '../../../lib/store';
import { formatDateOnly } from '../../../lib/utils';
import Portal from '../../../components/Portal';

export default function TemplatesPage() {
  const confirm = useConfirmStore(state => state.confirm);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);

  // Search & Pagination & View Mode states
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL', 'MARKETING', 'UTILITY', 'AUTHENTICATION'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'APPROVED', 'PENDING', 'REJECTED'
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Create/Edit template modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: 'MARKETING',
    language: 'en',
    headerType: 'NONE',
    headerText: '',
    headerMediaId: '',
    headerMediaUrl: '',
    headerMediaFilename: '',
    bodyText: '',
    footerText: '',
    buttonText: '',
    codeExpirationMinutes: 10,
    addSecurityRecommendation: true,
    copyCodeText: 'Copy Code',
    isCustom: false,
    isCarousel: false,
    carouselCards: [
      { headerMediaId: '', headerMediaUrl: '', bodyText: '', buttonText: '' }
    ]
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCardIdx, setUploadingCardIdx] = useState(null);

  const handleMediaUpload = async (e, cardIdx = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject WebP images since Meta Graph API does not support WebP for template headers
    if (file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) {
      toast.error('WebP images are not supported by Meta for template headers. Please upload a JPG/JPEG or PNG image.');
      return;
    }

    // Create local Object URL for instant preview
    const localUrl = URL.createObjectURL(file);

    if (cardIdx !== null) {
      const cardsCopy = [...newTemplate.carouselCards];
      cardsCopy[cardIdx].headerMediaUrl = localUrl;
      setNewTemplate(prev => ({ ...prev, carouselCards: cardsCopy }));
    } else {
      setNewTemplate(prev => ({ ...prev, headerMediaUrl: localUrl, headerMediaFilename: file.name }));
    }

    const formData = new FormData();
    formData.append('file', file);

    if (cardIdx !== null) {
      setUploadingCardIdx(cardIdx);
    } else {
      setUploadingImage(true);
    }

    try {
      const { data } = await api.post('/campaigns/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        if (cardIdx !== null) {
          const cardsCopy = [...newTemplate.carouselCards];
          cardsCopy[cardIdx].headerMediaId = data.mediaId;
          setNewTemplate(prev => ({ ...prev, carouselCards: cardsCopy }));
        } else {
          setNewTemplate(prev => ({ ...prev, headerMediaId: data.mediaId }));
        }
        toast.success('Header media uploaded successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload media');
    } finally {
      setUploadingImage(false);
      setUploadingCardIdx(null);
    }
  };

  const handleImageUpload = handleMediaUpload;

  const templateFetcher = useCallback(async () => {
    const { data } = await api.get('/templates');
    if (data.success) return data.data.templates;
    throw new Error('Failed');
  }, []);

  const { data: templates = [], loading, refresh: fetchTemplates } = usePageData('templates', templateFetcher);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/templates/sync');
      if (data.success) {
        toast.success(data.message || 'Templates synced from Meta!');
        fetchTemplates();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplate.name) {
      toast.error('Template name is required');
      return;
    }

    if (!newTemplate.isCarousel && newTemplate.category !== 'AUTHENTICATION' && !newTemplate.bodyText) {
      toast.error('Body text is required for standard templates');
      return;
    }

    if (newTemplate.isCarousel) {
      const invalidCard = newTemplate.carouselCards.some(c => !c.bodyText);
      if (invalidCard) {
        toast.error('All carousel cards must contain body text');
        return;
      }
    }

    if (newTemplate.buttonText && newTemplate.category !== 'AUTHENTICATION') {
      const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
      if (emojiRegex.test(newTemplate.buttonText)) {
        toast.error('Meta does not allow emojis in template buttons. Please remove emojis from button text.');
        return;
      }
      if (newTemplate.buttonText.length > 25) {
        toast.error('Button text must not exceed 25 characters');
        return;
      }
    }

    setCreating(true);
    try {
      let payload = {};

      if (newTemplate.isCustom) {
        payload = {
          name: newTemplate.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          category: newTemplate.category,
          language: newTemplate.language,
          isCustom: true,
          isCarousel: newTemplate.isCarousel,
          headerMediaId: newTemplate.headerMediaId,
          components: newTemplate.isCarousel ? [] : [
            ...(newTemplate.headerType === 'TEXT' && newTemplate.headerText ? [{ type: 'HEADER', format: 'TEXT', text: newTemplate.headerText }] : []),
            ...(newTemplate.headerType === 'IMAGE' ? [{ type: 'HEADER', format: 'IMAGE' }] : []),
            ...(newTemplate.headerType === 'VIDEO' ? [{ type: 'HEADER', format: 'VIDEO' }] : []),
            ...(newTemplate.headerType === 'DOCUMENT' ? [{ type: 'HEADER', format: 'DOCUMENT' }] : []),
            { type: 'BODY', text: newTemplate.bodyText },
            ...(newTemplate.footerText ? [{ type: 'FOOTER', text: newTemplate.footerText }] : []),
            ...(newTemplate.buttonText ? [{ type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: newTemplate.buttonText }] }] : [])
          ],
          carouselCards: newTemplate.isCarousel ? newTemplate.carouselCards : null
        };
      } else if (newTemplate.category === 'AUTHENTICATION') {
        // Meta Official Authentication Template Builder
        payload = {
          name: newTemplate.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          category: 'AUTHENTICATION',
          language: newTemplate.language || 'en_US',
          components: [
            {
              type: 'BODY',
              add_security_recommendation: newTemplate.addSecurityRecommendation !== false
            },
            ...(newTemplate.codeExpirationMinutes ? [{
              type: 'FOOTER',
              code_expiration_minutes: Number(newTemplate.codeExpirationMinutes) || 10
            }] : []),
            {
              type: 'BUTTONS',
              buttons: [
                {
                  type: 'OTP',
                  otp_type: 'COPY_CODE',
                  text: newTemplate.copyCodeText || 'Copy Code'
                }
              ]
            }
          ]
        };
      } else {
        // Meta template builder — HEADER must always precede BODY per Meta schema
        const components = [];

        if (newTemplate.headerType === 'TEXT' && newTemplate.headerText) {
          components.push({ type: 'HEADER', format: 'TEXT', text: newTemplate.headerText });
        } else if (newTemplate.headerType === 'IMAGE') {
          components.push({ type: 'HEADER', format: 'IMAGE' });
        } else if (newTemplate.headerType === 'VIDEO') {
          components.push({ type: 'HEADER', format: 'VIDEO' });
        } else if (newTemplate.headerType === 'DOCUMENT') {
          components.push({ type: 'HEADER', format: 'DOCUMENT' });
        }

        components.push({ type: 'BODY', text: newTemplate.bodyText });

        if (newTemplate.footerText) {
          components.push({ type: 'FOOTER', text: newTemplate.footerText });
        }

        if (newTemplate.buttonText) {
          components.push({ type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: newTemplate.buttonText }] });
        }

        payload = {
          name: newTemplate.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          category: newTemplate.category,
          language: newTemplate.language,
          components,
          headerMediaId: newTemplate.headerMediaId
        };
      }

      let res;
      if (editingTemplateId) {
        res = await api.put(`/templates/${editingTemplateId}`, payload);
      } else {
        res = await api.post('/templates', payload);
      }

      if (res.data.success) {
        toast.success(editingTemplateId ? 'Template updated successfully!' : 'Template created/submitted successfully!');
        setIsModalOpen(false);
        setEditingTemplateId(null);
        resetForm();
        fetchTemplates();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 
                       err.response?.data?.details?.error_data?.details || 
                       err.message || 
                       'Failed to submit template';
      toast.error(errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const handleEditTemplateClick = (tmpl) => {
    setEditingTemplateId(tmpl._id);
    const bodyComp = tmpl.components?.find(c => c.type === 'BODY') || {};
    const headerComp = tmpl.components?.find(c => c.type === 'HEADER') || {};
    const footerComp = tmpl.components?.find(c => c.type === 'FOOTER') || {};
    const btnComp = tmpl.components?.find(c => c.type === 'BUTTONS') || {};
    const otpBtn = btnComp.buttons?.find(b => b.type === 'OTP');

    setNewTemplate({
      name: tmpl.name,
      category: tmpl.category || 'MARKETING',
      language: tmpl.language || 'en',
      headerType: headerComp.format ? headerComp.format : (headerComp.text ? 'TEXT' : 'NONE'),
      headerText: headerComp.text || '',
      headerMediaId: tmpl.headerMediaId || '',
      headerMediaUrl: '',
      bodyText: bodyComp.text || '',
      footerText: footerComp.text || '',
      buttonText: btnComp.buttons?.[0]?.text || '',
      codeExpirationMinutes: footerComp.code_expiration_minutes || 10,
      addSecurityRecommendation: bodyComp.add_security_recommendation !== false,
      copyCodeText: otpBtn?.text || 'Copy Code',
      isCustom: !!tmpl.isCustom,
      isCarousel: !!tmpl.isCarousel,
      carouselCards: tmpl.carouselCards && tmpl.carouselCards.length 
        ? tmpl.carouselCards.map(c => ({ ...c, headerMediaUrl: '' })) 
        : [{ headerMediaId: '', headerMediaUrl: '', bodyText: '', buttonText: '' }]
    });
    setIsModalOpen(true);
  };

  const handleDeleteTemplate = async (id) => {
    if (!await confirm('Delete this template?')) return;
    try {
      const { data } = await api.delete(`/templates/${id}`);
      if (data.success) { toast.success('Template deleted'); fetchTemplates(); }
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const resetForm = () => {
    setNewTemplate({
      name: '',
      category: 'MARKETING',
      language: 'en',
      headerType: 'NONE',
      headerText: '',
      headerMediaId: '',
      headerMediaUrl: '',
      bodyText: '',
      footerText: '',
      buttonText: '',
      codeExpirationMinutes: 10,
      addSecurityRecommendation: true,
      copyCodeText: 'Copy Code',
      isCustom: false,
      isCarousel: false,
      carouselCards: [{ headerMediaId: '', headerMediaUrl: '', bodyText: '', buttonText: '' }]
    });
  };

  const renderFormattedBody = (text) => {
    if (!text) return null;
    const parts = text.split(/(\{\{\d+\}\})/g);
    return parts.map((part, index) => {
      const match = part.match(/^\{\{(\d+)\}\}$/);
      if (match) {
        return (
          <span key={index} className="inline-block px-1.5 py-0.5 bg-wa-green/10 dark:bg-emerald-500/20 text-wa-green dark:text-emerald-400 font-bold rounded text-[10px] mx-0.5 select-none">
            {`{Var ${match[1]}}`}
          </span>
        );
      }
      return part;
    });
  };

  const addCarouselCard = () => {
    if (newTemplate.carouselCards.length >= 10) {
      toast.error('Maximum 10 carousel cards allowed');
      return;
    }
    setNewTemplate(prev => ({
      ...prev,
      carouselCards: [...prev.carouselCards, { headerMediaId: '', headerMediaUrl: '', bodyText: '', buttonText: '' }]
    }));
  };

  const removeCarouselCard = (idx) => {
    if (newTemplate.carouselCards.length <= 1) return;
    const cardsCopy = [...newTemplate.carouselCards];
    cardsCopy.splice(idx, 1);
    setNewTemplate(prev => ({ ...prev, carouselCards: cardsCopy }));
  };

  const handleCardFieldChange = (idx, field, val) => {
    const cardsCopy = [...newTemplate.carouselCards];
    cardsCopy[idx][field] = val;
    setNewTemplate(prev => ({ ...prev, carouselCards: cardsCopy }));
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-wa-green/10 text-wa-green"><CheckCircle2 className="w-3 h-3" />Approved</span>;
      case 'PENDING': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"><Clock className="w-3 h-3 animate-pulse" />Pending</span>;
      case 'REJECTED': return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"><AlertTriangle className="w-3 h-3" />Rejected</span>;
      default: return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-wa-search dark:bg-wa-dark-search text-wa-text-secondary">{status || 'Unknown'}</span>;
    }
  };

  const getMediaType = (template) => {
    if (template.category === 'AUTHENTICATION') return 'OTP / CODE';
    if (template.isCarousel) return 'CAROUSEL';
    const header = template.components?.find(c => c.type === 'HEADER');
    if (header) {
      return header.format || 'TEXT';
    }
    return 'TEXT';
  };

  const getCategoryBadge = (category) => {
    switch (category?.toUpperCase()) {
      case 'MARKETING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
            Marketing
          </span>
        );
      case 'UTILITY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40">
            Utility
          </span>
        );
      case 'AUTHENTICATION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
            Authentication
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-wa-search dark:bg-wa-dark-search text-wa-text-secondary">
            {category || 'Marketing'}
          </span>
        );
    }
  };

  const categoryCounts = {
    ALL: templates.length,
    MARKETING: templates.filter(t => t.category?.toUpperCase() === 'MARKETING').length,
    UTILITY: templates.filter(t => t.category?.toUpperCase() === 'UTILITY').length,
    AUTHENTICATION: templates.filter(t => t.category?.toUpperCase() === 'AUTHENTICATION').length,
  };

  const statusCounts = {
    ALL: templates.length,
    APPROVED: templates.filter(t => t.status?.toUpperCase() === 'APPROVED').length,
    PENDING: templates.filter(t => t.status?.toUpperCase() === 'PENDING').length,
    REJECTED: templates.filter(t => t.status?.toUpperCase() === 'REJECTED').length,
  };

  // Filter and Paginate templates
  const filteredTemplates = templates.filter(t => {
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !searchLower ||
      t.name?.toLowerCase().includes(searchLower) ||
      t.category?.toLowerCase().includes(searchLower) ||
      t.components?.some(c => c.text?.toLowerCase().includes(searchLower));

    const matchesCategory =
      categoryFilter === 'ALL' ||
      t.category?.toUpperCase() === categoryFilter.toUpperCase();

    const matchesStatus =
      statusFilter === 'ALL' ||
      t.status?.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPages = Math.ceil(filteredTemplates.length / entriesPerPage) || 1;
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">WhatsApp Templates</h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Design Meta templates, sync structures, build carousels, or create local custom templates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggles */}
          <div className="flex items-center bg-wa-panel-header dark:bg-wa-dark-panel-header p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm' : 'text-wa-text-secondary'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm' : 'text-wa-text-secondary'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-2 px-4 py-2 text-xs font-semibold">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Meta
          </button>
          <button onClick={() => { resetForm(); setEditingTemplateId(null); setIsModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 text-xs font-semibold">
            <Plus className="w-4 h-4" /> Add Template
          </button>
        </div>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search input */}
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-text-light" />
            <input
              type="text"
              placeholder="Search templates by name or text..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-8 py-2 bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-wa-text-light hover:text-wa-text-primary dark:hover:text-white p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Center: Category & Status Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-wa-text-secondary uppercase tracking-wider hidden sm:inline">Category:</span>
              <div className="relative">
                <Tag className="w-3.5 h-3.5 text-wa-text-light absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                  className="pl-8 pr-7 py-2 bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green font-medium cursor-pointer"
                >
                  <option value="ALL">All Categories ({templates.length})</option>
                  <option value="MARKETING">Marketing ({categoryCounts.MARKETING})</option>
                  <option value="UTILITY">Utility ({categoryCounts.UTILITY})</option>
                  <option value="AUTHENTICATION">Authentication ({categoryCounts.AUTHENTICATION})</option>
                </select>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-wa-text-secondary uppercase tracking-wider hidden sm:inline">Status:</span>
              <div className="relative">
                <Filter className="w-3.5 h-3.5 text-wa-text-light absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="pl-8 pr-7 py-2 bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green font-medium cursor-pointer"
                >
                  <option value="ALL">All Statuses ({templates.length})</option>
                  <option value="APPROVED">Approved ({statusCounts.APPROVED})</option>
                  <option value="PENDING">Pending ({statusCounts.PENDING})</option>
                  <option value="REJECTED">Rejected ({statusCounts.REJECTED})</option>
                </select>
              </div>
            </div>

            {/* Reset Filter Button */}
            {(categoryFilter !== 'ALL' || statusFilter !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1 transition-colors border border-red-200 dark:border-red-900/40"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right: Show entries */}
          <div className="flex items-center gap-2 text-xs text-wa-text-secondary self-end lg:self-auto">
            <span>Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => { setEntriesPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
              className="bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border rounded-lg px-2 py-1 focus:outline-none text-xs"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
        </div>

        {/* Quick Filter Pills Row (Marketing, Utility, Pending, Approved) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-wa-border/40 dark:border-wa-dark-border/40 text-xs">
          <span className="text-[11px] font-semibold text-wa-text-light uppercase tracking-wider">Quick Filter:</span>
          
          {/* All */}
          <button
            onClick={() => { setCategoryFilter('ALL'); setStatusFilter('ALL'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              categoryFilter === 'ALL' && statusFilter === 'ALL'
                ? 'bg-wa-green text-white shadow-sm'
                : 'bg-wa-search dark:bg-wa-dark-search text-wa-text-secondary hover:text-wa-text-primary'
            }`}
          >
            All ({templates.length})
          </button>

          {/* Marketing */}
          <button
            onClick={() => { setCategoryFilter(categoryFilter === 'MARKETING' ? 'ALL' : 'MARKETING'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              categoryFilter === 'MARKETING'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
            }`}
          >
            <span>Marketing</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${categoryFilter === 'MARKETING' ? 'bg-blue-700 text-white' : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'}`}>
              {categoryCounts.MARKETING}
            </span>
          </button>

          {/* Utility */}
          <button
            onClick={() => { setCategoryFilter(categoryFilter === 'UTILITY' ? 'ALL' : 'UTILITY'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              categoryFilter === 'UTILITY'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40'
            }`}
          >
            <span>Utility</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${categoryFilter === 'UTILITY' ? 'bg-purple-700 text-white' : 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300'}`}>
              {categoryCounts.UTILITY}
            </span>
          </button>

          <span className="text-wa-border dark:text-wa-dark-border">|</span>

          {/* Approved */}
          <button
            onClick={() => { setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Approved</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${statusFilter === 'APPROVED' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300'}`}>
              {statusCounts.APPROVED}
            </span>
          </button>

          {/* Pending */}
          <button
            onClick={() => { setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Pending</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${statusFilter === 'PENDING' ? 'bg-amber-700 text-white' : 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300'}`}>
              {statusCounts.PENDING}
            </span>
          </button>

          <div className="ml-auto text-[11px] text-wa-text-light font-medium">
            Showing <strong className="text-wa-text-primary dark:text-white font-semibold">{filteredTemplates.length}</strong> of {templates.length} templates
          </div>
        </div>
      </div>

      {/* TEMPLATES CONTAINER */}
      {loading ? (
        <div className="h-[40vh] flex items-center justify-center text-wa-text-secondary">
          <Loader2 className="w-6 h-6 animate-spin text-wa-green mr-2" /> Loading templates...
        </div>
      ) : paginatedTemplates.length === 0 ? (
        <div className="h-[45vh] flex items-center justify-center text-wa-text-secondary border border-dashed border-wa-border dark:border-wa-dark-border rounded-2xl glass-card">
          <div className="text-center space-y-3 max-w-sm">
            <FileText className="w-12 h-12 text-wa-text-light mx-auto opacity-40" />
            <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">No Templates Found</h3>
            <p className="text-xs">
              {searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No templates match your selected filters. Try clearing or adjusting your filter criteria.'
                : 'Create custom templates or synchronize directly from Meta.'}
            </p>
            {(searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                  setCurrentPage(1);
                }}
                className="btn-secondary text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5 font-semibold mx-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedTemplates.map((template, idx) => {
            const bodyComponent = template.components?.find(c => c.type === 'BODY') || {};
            const headerComponent = template.components?.find(c => c.type === 'HEADER') || {};
            const footerComponent = template.components?.find(c => c.type === 'FOOTER') || {};
            const buttonsComponent = template.components?.find(c => c.type === 'BUTTONS') || {};

            return (
              <div
                key={template._id}
                style={{ animationDelay: `${Math.min(idx, 12) * 35}ms` }}
                className="glass-card animate-card-in flex flex-col justify-between hover:shadow-wa-md hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="p-5 border-b border-wa-border dark:border-wa-dark-border space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-wa-text-primary dark:text-wa-dark-text-primary truncate flex items-center gap-1.5">
                        <span>{template.name}</span>
                        {template.isCustom && <span className="bg-wa-green/10 text-wa-green text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Custom</span>}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-wa-text-secondary">
                        {getCategoryBadge(template.category)}
                        <span>·</span>
                        <span className="uppercase font-semibold">{template.language}</span>
                      </div>
                    </div>
                    {getStatusBadge(template.status)}
                  </div>

                  {/* WhatsApp Phone Preview */}
                  <div className="relative mx-auto w-full max-w-[260px]">
                    <div className="rounded-2xl border-2 border-wa-border dark:border-wa-dark-border bg-wa-chat-bg dark:bg-wa-dark-chat-bg p-3 space-y-1.5 shadow-inner">
                      {template.isCarousel && template.carouselCards?.length ? (
                        /* Carousel Scroll Preview */
                        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                          {template.carouselCards.map((card, cIdx) => (
                            <div key={cIdx} className="w-[180px] bg-white dark:bg-wa-dark-panel p-2 rounded-lg border border-wa-border dark:border-wa-dark-border flex-shrink-0 space-y-1.5 shadow-sm">
                              {card.headerMediaId && (
                                <div className="h-20 bg-wa-search dark:bg-wa-dark-search rounded flex items-center justify-center text-xs">📷 Image</div>
                              )}
                              <div className="text-[11px] text-wa-text-primary dark:text-wa-dark-text-primary leading-tight line-clamp-3">{card.bodyText}</div>
                              {card.buttonText && (
                                <div className="py-1 bg-wa-bg dark:bg-wa-dark-header border dark:border-wa-dark-border rounded text-[10px] text-center text-wa-green font-medium">{card.buttonText}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Standard Bubble Preview */
                        <div className="chat-bubble-in !max-w-full !rounded-lg">
                          {headerComponent.format === 'IMAGE' && (
                            <div className="bg-wa-search dark:bg-wa-dark-search rounded-lg py-4 flex flex-col items-center justify-center text-wa-text-light text-xs gap-1 mb-2">
                              <span className="text-base">📷</span>
                              <span className="text-[9px] uppercase font-bold tracking-wider">Header Image</span>
                            </div>
                          )}
                          {headerComponent.text && (
                            <div className="font-bold text-xs text-wa-text-primary dark:text-wa-dark-text-primary pb-1 border-b border-wa-border/30 dark:border-wa-dark-border/30 mb-1.5">{headerComponent.text}</div>
                          )}
                          <div className="text-[12.5px] text-wa-text-primary dark:text-wa-dark-text-primary whitespace-pre-wrap leading-relaxed">
                            {bodyComponent.text || (template.category === 'AUTHENTICATION' ? (
                              <span>
                                <span className="font-bold text-wa-green">{"{{1}}"}</span> is your verification code.
                                {bodyComponent.add_security_recommendation !== false && (
                                  <span className="block mt-1 text-[11px] text-wa-text-secondary">For your security, do not share this code.</span>
                                )}
                              </span>
                            ) : '[No body]')}
                          </div>
                          {footerComponent.text ? (
                            <div className="text-[10px] text-wa-text-light mt-1">{footerComponent.text}</div>
                          ) : footerComponent.code_expiration_minutes ? (
                            <div className="text-[10px] text-wa-text-light mt-1">This code expires in {footerComponent.code_expiration_minutes} minutes.</div>
                          ) : null}
                        </div>
                      )}
                      {!template.isCarousel && buttonsComponent.buttons?.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {buttonsComponent.buttons.map((b, bIdx) => (
                            <div key={bIdx} className="py-1.5 bg-wa-panel dark:bg-wa-dark-panel rounded-lg border border-wa-border dark:border-wa-dark-border text-center text-wa-green font-medium text-xs flex items-center justify-center gap-1.5">
                              {b.type === 'OTP' ? '📋 ' : ''}{b.text || 'Copy Code'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-wa-panel-header/30 dark:bg-wa-dark-panel-header/30 rounded-b-2xl flex items-center justify-between text-xs">
                  <span className="text-wa-text-light">{template.isCarousel ? `${template.carouselCards?.length || 0} cards` : `${template.variableCount || 0} variables`}</span>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditTemplateClick(template)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-wa-text-secondary hover:bg-wa-bg transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template._id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-wa-border dark:border-wa-dark-border text-wa-text-secondary uppercase text-[10px] tracking-wider bg-wa-panel-header/50 dark:bg-wa-dark-panel-header/20">
                <th className="py-3 px-4 font-bold">Serial No</th>
                <th className="py-3 px-4 font-bold">Template Name</th>
                <th className="py-3 px-4 font-bold">Media Type</th>
                <th className="py-3 px-4 font-bold">Category</th>
                <th className="py-3 px-4 font-bold">Language</th>
                <th className="py-3 px-4 font-bold">Created Date</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border dark:divide-wa-dark-border">
              {paginatedTemplates.map((template, idx) => {
                const serialNo = (currentPage - 1) * entriesPerPage + idx + 1;
                return (
                  <tr
                    key={template._id}
                    style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}
                    className="animate-row-in hover:bg-wa-hover/30 dark:hover:bg-wa-dark-hover/10 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold">{serialNo}</td>
                    <td className="py-3.5 px-4 font-semibold text-wa-text-primary dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{template.name}</span>
                        {template.isCustom && <span className="bg-wa-green/10 text-wa-green text-[9px] px-1 py-0.5 rounded font-bold uppercase">Custom</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase text-wa-text-secondary">
                        {getMediaType(template)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{getCategoryBadge(template.category)}</td>
                    <td className="py-3.5 px-4 font-semibold uppercase">{template.language}</td>
                    <td className="py-3.5 px-4 text-wa-text-light">
                      {template.createdAt ? formatDateOnly(template.createdAt) : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(template.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEditTemplateClick(template)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-wa-text-secondary hover:bg-wa-bg transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template._id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between glass-card p-4 text-xs text-wa-text-secondary">
          <span>Showing page {currentPage} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-wa-hover disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 rounded-lg font-semibold transition-colors ${currentPage === i + 1 ? 'bg-wa-green text-white shadow-sm' : 'hover:bg-wa-hover'}`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-wa-hover disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* DESIGN TEMPLATE MODAL */}
      {isModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
            <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-4xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh] shadow-2xl">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4 shrink-0">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-wa-green" /> {editingTemplateId ? 'Edit' : 'Create'} Template Designer
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* Left Column: Form Editor (Scrollable) */}
              <form onSubmit={handleCreateTemplate} className="w-full md:w-[55%] p-5 space-y-4 overflow-y-auto border-b md:border-b-0 md:border-r border-wa-border dark:border-wa-dark-border flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Type toggle */}
                  <div className="flex items-center gap-4 bg-wa-bg dark:bg-wa-dark-header p-2.5 rounded-xl border border-wa-border dark:border-wa-dark-border">
                    <span className="text-xs font-bold text-wa-text-secondary uppercase">Template Mode:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewTemplate(prev => ({ ...prev, isCustom: false, isCarousel: false }))}
                        disabled={!!editingTemplateId}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${!newTemplate.isCustom ? 'bg-wa-green text-white' : 'bg-wa-panel dark:bg-wa-dark-panel text-wa-text-secondary'}`}
                      >
                        Meta Review Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTemplate(prev => ({ ...prev, isCustom: true }))}
                        disabled={!!editingTemplateId}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${newTemplate.isCustom ? 'bg-wa-green text-white' : 'bg-wa-panel dark:bg-wa-dark-panel text-wa-text-secondary'}`}
                      >
                        Local Custom Mode
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Template Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. order_alert"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        disabled={!!editingTemplateId}
                        className="input-field py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Category</label>
                      <select
                        value={newTemplate.category}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewTemplate(prev => ({
                            ...prev,
                            category: val,
                            ...(val === 'AUTHENTICATION' ? { isCustom: false, isCarousel: false, headerType: 'NONE' } : {})
                          }));
                        }}
                        className="input-field py-2 text-xs"
                      >
                        <option value="MARKETING">Marketing</option>
                        <option value="UTILITY">Utility</option>
                        <option value="AUTHENTICATION">Authentication (OTP / Verification)</option>
                      </select>
                    </div>
                  </div>

                  {/* Local custom Carousel toggle */}
                  {newTemplate.isCustom && (
                    <div className="flex items-center justify-between bg-wa-bg dark:bg-wa-dark-header p-2.5 rounded-xl border border-wa-border dark:border-wa-dark-border">
                      <div>
                        <span className="block text-xs font-bold text-wa-text-primary dark:text-white">Multi-Card Carousel Layout</span>
                        <span className="block text-[10px] text-wa-text-secondary">Send a scrollable slider of card images & reply buttons.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewTemplate(prev => ({ ...prev, isCarousel: !prev.isCarousel }))}
                        disabled={!!editingTemplateId}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${newTemplate.isCarousel ? 'bg-wa-green text-white' : 'border border-wa-border text-wa-text-secondary'}`}
                      >
                        {newTemplate.isCarousel ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  )}

                  {/* Category-Specific Form fields */}
                  {newTemplate.category === 'AUTHENTICATION' ? (
                    <div className="space-y-4 animate-fade-in bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 p-4 rounded-xl">
                      <div className="flex items-start gap-2.5">
                        <span className="text-base">🔐</span>
                        <div>
                          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">Meta Official Authentication Format</h4>
                          <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                            Meta strictly enforces standardized OTP text (e.g. <b>{"{{1}}"} is your verification code.</b>) with a <b>Copy Code</b> button. No media headers or links are allowed.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Language</label>
                        <select
                          value={newTemplate.language}
                          onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                          className="input-field py-2 text-xs bg-white dark:bg-wa-dark-header"
                        >
                          <option value="en_US">English (en_US)</option>
                          <option value="en">English (en)</option>
                          <option value="hi">Hindi (hi)</option>
                          <option value="gu">Gujarati (gu)</option>
                          <option value="es">Spanish (es)</option>
                          <option value="pt_BR">Portuguese (pt_BR)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white dark:bg-wa-dark-header rounded-xl border border-wa-border dark:border-wa-dark-border">
                        <div>
                          <span className="block text-xs font-bold text-wa-text-primary dark:text-white">Security Recommendation</span>
                          <span className="block text-[10px] text-wa-text-secondary">&ldquo;For your security, do not share this code.&rdquo;</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={newTemplate.addSecurityRecommendation}
                          onChange={(e) => setNewTemplate({ ...newTemplate, addSecurityRecommendation: e.target.checked })}
                          className="w-4 h-4 accent-wa-green cursor-pointer"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Code Expiry (Minutes)</label>
                          <input
                            type="number"
                            min="1"
                            max="90"
                            value={newTemplate.codeExpirationMinutes}
                            onChange={(e) => setNewTemplate({ ...newTemplate, codeExpirationMinutes: e.target.value })}
                            className="input-field py-2 text-xs bg-white dark:bg-wa-dark-header"
                            placeholder="10"
                          />
                          <p className="text-[10px] text-wa-text-light mt-1">Between 1 to 90 min (e.g. 5 or 10)</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">OTP Button Label</label>
                          <input
                            type="text"
                            maxLength={25}
                            value={newTemplate.copyCodeText}
                            onChange={(e) => setNewTemplate({ ...newTemplate, copyCodeText: e.target.value })}
                            className="input-field py-2 text-xs bg-white dark:bg-wa-dark-header"
                            placeholder="Copy Code"
                          />
                          <p className="text-[10px] text-wa-text-light mt-1">Default &ldquo;Copy Code&rdquo; (Max 25 chars)</p>
                        </div>
                      </div>
                    </div>
                  ) : !newTemplate.isCarousel ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Header Format</label>
                          <select
                            value={newTemplate.headerType}
                            onChange={(e) => setNewTemplate({ ...newTemplate, headerType: e.target.value })}
                            className="input-field py-2 text-xs"
                          >
                            <option value="NONE">None</option>
                            <option value="TEXT">Text</option>
                            <option value="IMAGE">Image</option>
                            <option value="VIDEO">Video</option>
                            <option value="DOCUMENT">Document / PDF</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Language</label>
                          <select
                            value={newTemplate.language}
                            onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                            className="input-field py-2 text-xs"
                          >
                            <option value="en">English (en)</option>
                            <option value="en_US">English (en_US)</option>
                            <option value="hi">Hindi (hi)</option>
                            <option value="gu">Gujarati (gu)</option>
                            <option value="es">Spanish (es)</option>
                            <option value="pt_BR">Portuguese (pt_BR)</option>
                          </select>
                        </div>
                      </div>

                      {newTemplate.headerType === 'TEXT' && (
                        <div className="animate-fade-in">
                          <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Header Text *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Welcome onboard!"
                            value={newTemplate.headerText}
                            onChange={(e) => setNewTemplate({ ...newTemplate, headerText: e.target.value })}
                            className="input-field py-2 text-xs"
                          />
                        </div>
                      )}

                      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newTemplate.headerType) && (
                        <div className="space-y-2 animate-fade-in border-b border-wa-border dark:border-wa-dark-border pb-3">
                          <label className="block text-xs font-bold text-wa-text-secondary uppercase">
                            Header Media ({newTemplate.headerType === 'IMAGE' ? 'Image' : newTemplate.headerType === 'VIDEO' ? 'Video' : 'Document / PDF'}) *
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              accept={
                                newTemplate.headerType === 'IMAGE'
                                  ? 'image/png, image/jpeg, image/jpg'
                                  : newTemplate.headerType === 'VIDEO'
                                  ? 'video/mp4, video/3gpp'
                                  : 'application/pdf, .pdf'
                              }
                              onChange={(e) => handleMediaUpload(e)}
                              disabled={uploadingImage}
                              className="text-xs text-wa-text-secondary file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-wa-search file:text-wa-text-primary hover:file:bg-wa-green/10 cursor-pointer"
                            />
                            {uploadingImage && <Loader2 className="w-4 h-4 animate-spin text-wa-green" />}
                            {!uploadingImage && newTemplate.headerMediaId && (
                              <span className="text-xs font-semibold text-wa-green bg-wa-green/10 px-2.5 py-1 rounded-lg">
                                ✓ {newTemplate.headerType === 'IMAGE' ? 'Image' : newTemplate.headerType === 'VIDEO' ? 'Video' : 'Document'} Uploaded
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Body Message Content *</label>
                        <textarea
                          rows="4"
                          required
                          placeholder="e.g. Hello {{1}}, your booking for {{2}} is confirmed!"
                          value={newTemplate.bodyText}
                          onChange={(e) => setNewTemplate({ ...newTemplate, bodyText: e.target.value })}
                          className="input-field py-2 text-xs"
                        />
                        <p className="text-[10px] text-wa-text-light mt-1">Use {"{{1}}"}, {"{{2}}"} for message variables.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Footer text (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Reply STOP to opt out"
                          value={newTemplate.footerText}
                          onChange={(e) => setNewTemplate({ ...newTemplate, footerText: e.target.value })}
                          className="input-field py-2 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-wa-text-secondary mb-1.5 uppercase">Quick Reply Button Text (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Talk to Agent"
                          value={newTemplate.buttonText}
                          onChange={(e) => setNewTemplate({ ...newTemplate, buttonText: e.target.value })}
                          className="input-field py-2 text-xs"
                        />
                        <p className="text-[10px] text-wa-text-light mt-1">Max 25 chars. (Note: Meta does not allow emojis in template buttons).</p>
                      </div>
                    </>
                  ) : (
                    /* Carousel Templates cards list */
                    <div className="space-y-4 animate-fade-in border-t border-wa-border dark:border-wa-dark-border pt-4">
                      <div className="flex items-center justify-between">
                        <span className="block text-xs font-bold text-wa-text-secondary uppercase">Carousel Cards ({newTemplate.carouselCards.length})</span>
                        <button
                          type="button"
                          onClick={addCarouselCard}
                          className="text-xs text-wa-green hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Card
                        </button>
                      </div>

                      <div className="space-y-3">
                        {newTemplate.carouselCards.map((card, cIdx) => (
                          <div key={cIdx} className="bg-wa-bg dark:bg-wa-dark-header p-4 rounded-xl border border-wa-border dark:border-wa-dark-border relative space-y-3">
                            <button
                              type="button"
                              onClick={() => removeCarouselCard(cIdx)}
                              className="absolute right-3 top-3 text-wa-text-light hover:text-red-500 transition-colors"
                              title="Remove Card"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            
                            <span className="block text-xs font-bold text-wa-text-primary dark:text-white">Card #{cIdx + 1}</span>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-wa-text-secondary mb-1 uppercase">Card Image (Optional)</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/jpg"
                                    onChange={(e) => handleImageUpload(e, cIdx)}
                                    disabled={uploadingCardIdx !== null}
                                    className="text-[10px] text-wa-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-wa-search"
                                  />
                                  {uploadingCardIdx === cIdx && <Loader2 className="w-3.5 h-3.5 animate-spin text-wa-green" />}
                                  {card.headerMediaId && <span className="text-[10px] font-bold text-wa-green">✓</span>}
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-wa-text-secondary mb-1 uppercase">Quick Reply Button</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Yes, please"
                                  value={card.buttonText}
                                  onChange={(e) => handleCardFieldChange(cIdx, 'buttonText', e.target.value)}
                                  className="input-field py-1 text-[11px]"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-wa-text-secondary mb-1 uppercase">Card Body Content *</label>
                              <textarea
                                rows="2"
                                required
                                placeholder="Type card message details..."
                                value={card.bodyText}
                                onChange={(e) => handleCardFieldChange(cIdx, 'bodyText', e.target.value)}
                                className="input-field py-1.5 text-[11px]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end pt-4 mt-6 border-t border-wa-border dark:border-wa-dark-border shrink-0">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary py-2 text-xs px-4" disabled={creating}>Cancel</button>
                  <button type="submit" disabled={creating} className="btn-primary py-2 text-xs px-5 flex items-center gap-1.5">
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingTemplateId ? 'Save Changes' : (newTemplate.isCustom ? 'Save Local Custom' : 'Submit to Meta')}
                  </button>
                </div>
              </form>

              {/* Right Column: Live Mockup Phone Preview */}
              <div className="w-full md:w-[45%] p-5 bg-[#efeae2]/40 dark:bg-[#0b141a]/10 flex flex-col items-center justify-start overflow-y-auto select-none border-t md:border-t-0 border-wa-border dark:border-wa-dark-border min-h-[400px] md:min-h-0">
                <span className="text-[10px] font-bold text-wa-text-secondary mb-4 uppercase tracking-wider block">Live Message Preview</span>
                
                {/* Phone Frame Simulator */}
                <div className="w-full max-w-[280px] rounded-[36px] border-[10px] border-slate-800 dark:border-slate-700 bg-[#efeae2] dark:bg-[#0b141a] overflow-hidden shadow-wa-lg flex flex-col relative aspect-[9/18] shrink-0">
                  {/* Speaker notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 dark:bg-slate-700 rounded-b-xl z-20 flex items-center justify-center">
                    <div className="w-8 h-1 bg-slate-600 dark:bg-slate-500 rounded-full" />
                  </div>

                  {/* Top bar info */}
                  <div className="bg-[#075e54] dark:bg-[#202c33] text-white pt-5 pb-2 px-4 flex items-center justify-between text-[9px] select-none shrink-0 z-10 font-mono">
                    <div className="font-semibold">WhatsApp Live</div>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋 100%</span>
                    </div>
                  </div>

                  {/* Conversation Header */}
                  <div className="bg-[#128c7e] dark:bg-[#202c33] text-white py-2 px-3 flex items-center gap-2 border-b border-[#075e54]/10 dark:border-[#2f3b43] shrink-0 z-10 shadow-sm select-none">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] text-white shrink-0 border border-white/20 uppercase">
                      {(newTemplate.name ? newTemplate.name.substring(0, 2) : 'WA')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[10.5px] leading-tight truncate">
                        {newTemplate.name ? newTemplate.name.toLowerCase().replace(/\s+/g, '_') : 'my_template_name'}
                      </div>
                      <div className="text-[7.5px] text-white/80 leading-none">Template Preview</div>
                    </div>
                  </div>

                  {/* Wallpaper Chat Area */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-2 relative bg-[#efeae2] dark:bg-[#0b141a] min-h-[300px]">
                    <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: "url('/uploads/chat-bg.png')", backgroundSize: 'contain' }} />

                    <div className="relative z-10 space-y-2">
                      {newTemplate.isCarousel && newTemplate.carouselCards?.length ? (
                        /* Carousel cards preview list */
                        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin max-w-full">
                          {newTemplate.carouselCards.map((card, cIdx) => (
                            <div key={cIdx} className="w-[180px] bg-white dark:bg-[#202c33] p-2 rounded-lg border border-wa-border dark:border-[#2f3b43] flex-shrink-0 space-y-1.5 shadow-sm">
                              {card.headerMediaUrl ? (
                                <div className="h-20 rounded overflow-hidden">
                                  <img
                                    src={card.headerMediaUrl}
                                    alt={`Card ${cIdx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : card.headerMediaId ? (
                                <div className="h-20 bg-wa-search dark:bg-[#182229] rounded flex items-center justify-center text-[10px] text-wa-text-secondary">📷 Image Attached</div>
                              ) : (
                                <div className="h-20 bg-slate-50 dark:bg-[#182229] rounded flex items-center justify-center text-[9px] text-wa-text-light border border-dashed border-wa-border dark:border-[#2f3b43]">No Image</div>
                              )}
                              <div className="text-[11px] text-wa-text-primary dark:text-white leading-tight break-words whitespace-pre-wrap">
                                {renderFormattedBody(card.bodyText) || <span className="italic text-wa-text-light">[Card Body]</span>}
                              </div>
                              {card.buttonText && (
                                <div className="py-1 bg-wa-bg dark:bg-[#182229] border dark:border-[#2f3b43] rounded text-[10px] text-center text-wa-green dark:text-[#53bdeb] font-semibold">{card.buttonText}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : newTemplate.category === 'AUTHENTICATION' ? (
                        /* Meta Official Authentication Bubble Preview */
                        <>
                          <div className="chat-bubble-in !max-w-full !rounded-lg bg-white dark:bg-[#202c33] border border-white dark:border-[#202c33] shadow-sm p-3 space-y-1.5 select-text">
                            <div className="text-[12px] text-wa-text-primary dark:text-white leading-relaxed">
                              <span className="font-bold text-wa-green">492018</span> is your verification code.
                              {newTemplate.addSecurityRecommendation !== false && (
                                <span className="block mt-1 text-[10.5px] text-wa-text-secondary">
                                  For your security, do not share this code.
                                </span>
                              )}
                            </div>
                            {newTemplate.codeExpirationMinutes && (
                              <div className="text-[9.5px] text-wa-text-light mt-1 select-none">
                                This code expires in {newTemplate.codeExpirationMinutes} minutes.
                              </div>
                            )}
                          </div>

                          <div className="py-2 bg-white dark:bg-[#202c33] rounded-lg border border-white dark:border-[#202c33] text-center text-wa-green dark:text-[#53bdeb] font-semibold text-[11px] shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-[#233138] transition-colors flex items-center justify-center gap-1.5">
                            <span>📋</span>
                            <span>{newTemplate.copyCodeText || 'Copy Code'}</span>
                          </div>
                        </>
                      ) : (
                        /* Standard bubble preview layout */
                        <>
                          <div className="chat-bubble-in !max-w-full !rounded-lg bg-white dark:bg-[#202c33] border border-white dark:border-[#202c33] shadow-sm p-2 space-y-1 select-text">
                            {newTemplate.headerType === 'IMAGE' && (
                              <div className="bg-wa-search dark:bg-[#182229] rounded-lg overflow-hidden flex flex-col items-center justify-center text-wa-text-light text-[11px] gap-1 mb-1 border border-dashed border-wa-border dark:border-[#2f3b43] relative min-h-[100px]">
                                {newTemplate.headerMediaUrl ? (
                                  <img
                                    src={newTemplate.headerMediaUrl}
                                    alt="Header Media"
                                    className="w-full h-auto max-h-[140px] object-cover"
                                  />
                                ) : newTemplate.headerMediaId ? (
                                  <>
                                    <span className="text-sm">🖼️</span>
                                    <span className="text-[8px] uppercase font-bold text-wa-green">Header Image Uploaded</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-sm">📷</span>
                                    <span className="text-[8px] uppercase font-bold tracking-wider">No Image selected</span>
                                  </>
                                )}
                              </div>
                            )}

                            {newTemplate.headerType === 'VIDEO' && (
                              <div className="bg-wa-search dark:bg-[#182229] rounded-lg overflow-hidden flex flex-col items-center justify-center text-wa-text-light text-[11px] gap-1 mb-1 border border-dashed border-wa-border dark:border-[#2f3b43] relative min-h-[100px]">
                                {newTemplate.headerMediaUrl ? (
                                  <video
                                    src={newTemplate.headerMediaUrl}
                                    controls
                                    className="w-full h-auto max-h-[140px] rounded-lg bg-black"
                                  />
                                ) : newTemplate.headerMediaId ? (
                                  <>
                                    <span className="text-sm">🎥</span>
                                    <span className="text-[8px] uppercase font-bold text-wa-green">Header Video Uploaded</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-sm">🎬</span>
                                    <span className="text-[8px] uppercase font-bold tracking-wider">No Video selected</span>
                                  </>
                                )}
                              </div>
                            )}

                            {newTemplate.headerType === 'DOCUMENT' && (
                              <div className="bg-wa-search dark:bg-[#182229] rounded-lg p-2.5 flex items-center gap-2.5 mb-1 border border-wa-border dark:border-[#2f3b43]">
                                <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  PDF
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-wa-text-primary dark:text-white truncate">
                                    {newTemplate.headerMediaFilename || 'Document.pdf'}
                                  </p>
                                  <p className="text-[9px] text-wa-text-secondary">
                                    {newTemplate.headerMediaId ? '✓ Document Uploaded' : 'No Document selected'}
                                  </p>
                                </div>
                              </div>
                            )}
                            {newTemplate.headerType === 'TEXT' && newTemplate.headerText && (
                              <div className="font-bold text-[11.5px] text-wa-text-primary dark:text-white leading-tight pb-1 border-b border-wa-border/30 dark:border-[#2f3b43] mb-1">
                                {newTemplate.headerText}
                              </div>
                            )}
                            <div className="text-[11.5px] text-wa-text-primary dark:text-white whitespace-pre-wrap leading-normal break-words">
                              {renderFormattedBody(newTemplate.bodyText) || <span className="italic text-wa-text-light">[Empty Body Text]</span>}
                            </div>
                            {newTemplate.footerText && (
                              <div className="text-[9.5px] text-wa-text-light mt-1 select-none">
                                {newTemplate.footerText}
                              </div>
                            )}
                          </div>

                          {newTemplate.buttonText && (
                            <div className="py-1.5 bg-white dark:bg-[#202c33] rounded-lg border border-white dark:border-[#202c33] text-center text-wa-green dark:text-[#53bdeb] font-semibold text-[11px] shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-[#233138] transition-colors">
                              🔗 {newTemplate.buttonText}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info Note about live delivery */}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-[10px] text-blue-600 dark:text-blue-400 space-y-1 max-w-[280px] shrink-0">
                  <span className="font-bold uppercase tracking-wider block">💡 Live Message Delivery:</span>
                  <p className="leading-normal">
                    When sending a campaign or automation, WhatsApp replaces variables like <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.2 rounded font-bold">{"{{1}}"}</span> with actual contact data (e.g. contact name, order details) dynamically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Portal>
      )}
    </div>
  );
}
