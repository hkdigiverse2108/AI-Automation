'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Bot, Plus, Play, ToggleLeft, ToggleRight, Sparkles, 
  HelpCircle, RefreshCw, Loader2, ArrowRight, CheckCircle2, ChevronRight, X,
  Phone, Video, MoreVertical, Send, Smile, Paperclip, Trash2,
  Download, FileText, FileSpreadsheet, ChevronDown, BookOpen, FileDown
} from 'lucide-react';
import api from '../../../lib/api';
import { usePageData } from '../../../lib/usePageData';
import dynamic from 'next/dynamic';
import { useConfirmStore } from '../../../lib/store';
import Portal from '../../../components/Portal';
import { exportFlowToPDF, exportFlowToExcel, buildExecutiveWalkthrough } from '../../../lib/flowExportUtils';

const BotFlowCanvas = dynamic(() => import('../../../components/BotFlowCanvas'), {
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        <span className="text-xs text-slate-500">Loading flow canvas...</span>
      </div>
    </div>
  ),
  ssr: false,
});
const FlowSimulatorPanel = dynamic(() => import('../../../components/FlowSimulatorPanel'), { ssr: false });
const BotMediaLibrary = dynamic(() => import('../../../components/BotMediaLibrary'), { ssr: false });
const AIBotBuilderModal = dynamic(() => import('../../../components/AIBotBuilderModal'), { ssr: false });

export default function BotBuilderPage() {
  const confirm = useConfirmStore((state) => state.confirm);
  const [flows, setFlows] = useState([]);
  const [currentFlow, setCurrentFlow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' or 'media'
  
  // AI Bot Builder state
  const [isAIBotBuilderOpen, setIsAIBotBuilderOpen] = useState(false);
  const [flowToRefineWithAI, setFlowToRefineWithAI] = useState(null);
  
  // Simulator state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simAnswers, setSimAnswers] = useState('');
  const [simLog, setSimLog] = useState([]);
  const [simVars, setSimVars] = useState({});
  const [testing, setTesting] = useState(false);

  // Template Library state
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Flow Export & Explanation State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const canvasRef = useRef(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportPDF = async () => {
    if (!currentFlow) {
      toast.error('No bot flow selected to export');
      return;
    }
    const flowToExport = canvasRef.current?.getFlowData?.() || currentFlow;
    if (!flowToExport.nodes || flowToExport.nodes.length === 0) {
      toast.error('The selected flow has no steps to export');
      return;
    }
    setExportingPdf(true);
    const toastId = toast.loading('Generating branded PDF flow report with logo...');
    try {
      await exportFlowToPDF(flowToExport);
      toast.success('Chatbot Flow PDF downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('Export PDF error:', err);
      toast.error('Failed to export PDF: ' + (err.message || 'Error'), { id: toastId });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!currentFlow) {
      toast.error('No bot flow selected to export');
      return;
    }
    const flowToExport = canvasRef.current?.getFlowData?.() || currentFlow;
    if (!flowToExport.nodes || flowToExport.nodes.length === 0) {
      toast.error('The selected flow has no steps to export');
      return;
    }
    setExportingExcel(true);
    const toastId = toast.loading('Generating Excel workbook (.xlsx)...');
    try {
      await exportFlowToExcel(flowToExport);
      toast.success('Chatbot Flow Excel downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('Failed to export Excel: ' + (err.message || 'Error'), { id: toastId });
    } finally {
      setExportingExcel(false);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await api.get('/flows/templates');
      if (data.success) {
        setTemplates(data.data.templates);
      }
    } catch (err) {
      toast.error('Failed to load pre-built templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    if (isLibraryOpen) {
      fetchTemplates();
    }
  }, [isLibraryOpen]);

  const handleImportTemplate = (template) => {
    const importedFlow = {
      _id: 'new_flow',
      name: template.name,
      description: template.description,
      trigger: { ...template.trigger },
      nodes: JSON.parse(JSON.stringify(template.nodes))
    };
    setCurrentFlow(importedFlow);
    setIsLibraryOpen(false);
    setActiveTab('builder');
    toast.success(`${template.name} loaded into the builder. Click "Save" to save it.`);
  };

  const handleApplyAIFlow = (generatedFlow) => {
    const newAIFlow = {
      _id: 'new_flow',
      name: generatedFlow.name || 'AI Generated Bot Flow',
      description: generatedFlow.description || '',
      trigger: generatedFlow.trigger || { type: 'keyword', keywords: ['hi', 'hello'] },
      nodes: JSON.parse(JSON.stringify(generatedFlow.nodes || []))
    };
    setCurrentFlow(newAIFlow);
    setActiveTab('builder');
    toast.success(`✨ "${newAIFlow.name}" loaded into the canvas! You can test it in Simulate Flow or click Save.`);
  };

  const flowsFetcher = useCallback(async () => {
    const { data } = await api.get('/flows');
    if (data.success) return data.data.flows;
    throw new Error('Failed');
  }, []);

  const { data: cachedFlows, loading, refresh: refreshFlows } = usePageData('bot-flows', flowsFetcher);

  // Sync cached flows with local state
  useEffect(() => {
    if (cachedFlows) {
      setFlows(cachedFlows);
      if (!currentFlow && cachedFlows.length > 0) {
        setCurrentFlow(cachedFlows[0]);
      }
    }
  }, [cachedFlows]);

  const fetchFlows = async (selectId = null) => {
    const result = await refreshFlows();
    if (selectId && result) {
      const selected = result.find(f => f._id === selectId);
      if (selected) setCurrentFlow(selected);
    }
  };

  const handleCreateNewFlow = () => {
    const defaultFlow = {
      _id: 'new_flow',
      name: 'Untitled Inbound Bot Flow',
      description: 'Trigger actions on incoming keyword prompts.',
      trigger: { type: 'keyword', keywords: ['hello'] },
      nodes: []
    };
    setCurrentFlow(defaultFlow);
    setActiveTab('builder');
  };

  const handleSaveFlow = async (canvasData) => {
    if (!currentFlow) return;
    setSaving(true);

    try {
      const payload = {
        name: currentFlow.name,
        description: currentFlow.description,
        trigger: canvasData.trigger,
        nodes: canvasData.nodes
      };

      if (currentFlow._id === 'new_flow') {
        // Create new
        const { data } = await api.post('/flows', payload);
        if (data.success) {
          toast.success('Bot flow created successfully!');
          fetchFlows(data.data.flow._id);
        }
      } else {
        // Update existing
        const { data } = await api.put(`/flows/${currentFlow._id}`, payload);
        if (data.success) {
          toast.success('Bot flow updated successfully!');
          fetchFlows(currentFlow._id);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (flowItem) => {
    try {
      const url = `/flows/${flowItem._id}/${flowItem.isActive ? 'deactivate' : 'activate'}`;
      const { data } = await api.post(url);
      if (data.success) {
        toast.success(flowItem.isActive ? 'Flow deactivated' : 'Flow activated successfully!');
        fetchFlows(currentFlow?._id === flowItem._id ? currentFlow._id : null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update active state');
    }
  };

  const handleDeleteFlow = async () => {
    if (!currentFlow || currentFlow._id === 'new_flow') return;
    const confirmed = await confirm(`Are you sure you want to delete the flow "${currentFlow.name}"? This action cannot be undone.`, 'Delete Bot Flow');
    if (!confirmed) {
      return;
    }
    
    try {
      const { data } = await api.delete(`/flows/${currentFlow._id}`);
      if (data.success) {
        toast.success('Bot flow deleted successfully');
        setCurrentFlow(null);
        fetchFlows();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete flow');
    }
  };

  const handleSimulate = async () => {
    if (!currentFlow || currentFlow._id === 'new_flow') return;
    setTesting(true);
    setSimLog([]);

    try {
      const simulatedResponses = simAnswers ? simAnswers.split(',').map(a => a.trim()) : [];
      const { data } = await api.post(`/flows/${currentFlow._id}/test`, { simulatedResponses });
      if (data.success) {
        setSimLog(data.data.executionLog || []);
        setSimVars(data.data.variables || {});
        toast.success('Simulation executed');
      }
    } catch (err) {
      toast.error('Simulation failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Bot Flow Builder</h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">Design multi-step auto-response workflows, conversational Q&A forms, and trigger AI prompts visually.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Download & Explain Flow Dropdown Button */}
          {currentFlow && (
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-wa-dark-text-primary bg-white dark:bg-wa-dark-panel hover:bg-wa-bg dark:hover:bg-wa-dark-header rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm"
                title="Download Flow (PDF / Excel) or View Explanation Walkthrough"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Download Flow</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-2xl z-50 p-2.5 animate-fade-in">
                  <div className="px-3 py-2 border-b border-wa-border dark:border-wa-dark-border">
                    <p className="text-xs font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
                      <FileDown className="w-4 h-4 text-emerald-600" />
                      <span>Export Bot Documentation</span>
                    </p>
                    <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                      Easy-to-understand reports to explain flow
                    </p>
                  </div>

                  <div className="space-y-1 mt-1.5">
                    {/* PDF Export Button */}
                    <button
                      onClick={() => { setIsExportMenuOpen(false); handleExportPDF(); }}
                      disabled={exportingPdf}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Download className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-wa-text-primary dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>PDF Guide</span>
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded font-semibold">PDF</span>
                        </div>
                        <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                          Official branded PDF, customer journey story, step tables & decision matrix.
                        </p>
                      </div>
                    </button>

                    {/* Excel Export Button */}
                    <button
                      onClick={() => { setIsExportMenuOpen(false); handleExportExcel(); }}
                      disabled={exportingExcel}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Download className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-wa-text-primary dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span>Excel (.xlsx)</span>
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded font-semibold">5 Sheets</span>
                        </div>
                        <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                          Multi-sheet workbook: Overview, Step-by-Step, Decision Matrix, and Captured Variables.
                        </p>
                      </div>
                    </button>

                    {/* Explain Flow Walkthrough Modal Trigger */}
                    <button
                      onClick={() => { setIsExportMenuOpen(false); setIsWalkthroughOpen(true); }}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-amber-50/80 dark:hover:bg-amber-950/30 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                        <BookOpen className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-wa-text-primary dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 flex items-center justify-between">
                          <span>View Flow Walkthrough</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded font-semibold">On-Screen</span>
                        </div>
                        <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                          Preview the step-by-step narration on-screen to easily explain.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Bot Builder Button (Fresh / New Generation) */}
          <button 
            onClick={() => {
              setFlowToRefineWithAI(null);
              setIsAIBotBuilderOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 border border-purple-200/90 dark:border-purple-800/70 bg-gradient-to-b from-purple-50/70 via-white to-purple-50/30 dark:from-purple-950/30 dark:via-wa-dark-panel dark:to-wa-dark-panel hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-600 text-purple-950 dark:text-purple-100 rounded-xl text-sm font-semibold transition-all duration-200 shadow-xs hover:shadow-sm active:scale-[0.98]"
            title="Generate a complete WhatsApp chatbot flow automatically using AI"
          >
            <Sparkles className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>AI Bot Builder</span>
          </button>

          {currentFlow && (currentFlow.nodes?.length > 0 || currentFlow._id !== 'new_flow') && (
            <button 
              onClick={() => { setIsSimulatorOpen(true); setSimLog([]); setSimAnswers(''); setSimVars({}); }}
              className="flex items-center gap-2 px-4 py-2 border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-wa-dark-text-primary bg-white dark:bg-wa-dark-panel hover:bg-wa-bg dark:hover:bg-wa-dark-header rounded-xl text-sm font-semibold transition-all duration-200"
            >
              <Play className="w-4 h-4 text-wa-green fill-wa-green/20" />
              <span>Simulate Flow</span>
            </button>
          )}
          <button 
            onClick={() => setIsLibraryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-wa-dark-text-primary bg-white dark:bg-wa-dark-panel hover:bg-wa-bg dark:hover:bg-wa-dark-header rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <Sparkles className="w-4.5 h-4.5 text-amber-500 fill-amber-500/20" />
            <span>Workflow Library</span>
          </button>
          <button 
            onClick={handleCreateNewFlow}
            className="flex items-center gap-2 px-4 py-2 text-white bg-wa-green hover:bg-wa-green-hover rounded-xl text-sm font-semibold shadow-md transition-all duration-200"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>Create New Flow</span>
          </button>
        </div>
      </div>

      {/* Select active flow dropdown/selector */}
      <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-10 h-10 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center shrink-0 shadow-inner">
            <Bot className="w-5.5 h-5.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[10px] font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider">Active Flow Builder</span>
            <div 
              className="relative inline-flex items-center gap-1.5 max-w-full group cursor-pointer pt-0.5"
              title={currentFlow?.name || 'Select Flow'}
            >
              <span className="font-bold text-sm text-wa-text-primary dark:text-white truncate max-w-[200px] xs:max-w-[260px] sm:max-w-[340px] md:max-w-[420px]">
                {currentFlow?._id === 'new_flow' 
                  ? '* Creating New Flow *' 
                  : (currentFlow?.name || (flows.length === 0 ? 'No flows created' : 'Select Flow'))}
              </span>
              {currentFlow?.isActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Active Flow" />
              )}
              <ChevronDown className="w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary shrink-0 transition-transform group-hover:translate-y-0.5" />

              {/* Native select overlaid invisibly for full accessibility & mobile support */}
              <select
                value={currentFlow?._id || ''}
                onChange={(e) => {
                  const selected = flows.find(f => f._id === e.target.value);
                  setCurrentFlow(selected || null);
                  setActiveTab('builder');
                }}
                aria-label="Active Flow Builder"
                title={currentFlow?.name || 'Select Flow'}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              >
                {currentFlow?._id === 'new_flow' && (
                  <option value="new_flow">* Creating New Flow *</option>
                )}
                {flows.length === 0 && currentFlow?._id !== 'new_flow' && (
                  <option value="">No flows created</option>
                )}
                {flows.map(f => (
                  <option key={f._id} value={f._id}>{f.name} {f.isActive ? '● [ACTIVE]' : ''}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {currentFlow && (
          <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 border-wa-border dark:border-wa-dark-border pt-3 md:pt-0">
            <div className="flex-1 md:text-right">
              <span className="block text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-semibold">Flow Name</span>
              <input 
                type="text" 
                value={currentFlow.name}
                onChange={(e) => setCurrentFlow({ ...currentFlow, name: e.target.value })}
                className="bg-transparent font-bold text-sm border-b border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-white focus:outline-none w-48 text-left md:text-right focus:border-wa-green transition-colors"
              />
            </div>

            {currentFlow._id !== 'new_flow' && (
              <>
                <div className="flex items-center gap-2.5 bg-wa-bg dark:bg-wa-dark-header/40 px-3 py-1.5 rounded-xl border border-wa-border dark:border-wa-dark-border">
                  <span className="text-xs font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary">Status</span>
                  <button onClick={() => handleToggleActive(currentFlow)} className="focus:outline-none">
                    {currentFlow.isActive ? (
                      <ToggleRight className="w-8.5 h-8.5 text-wa-green cursor-pointer hover:scale-105 active:scale-95 transition-transform" />
                    ) : (
                      <ToggleLeft className="w-8.5 h-8.5 text-wa-text-secondary dark:text-wa-dark-text-secondary cursor-pointer hover:scale-105 active:scale-95 transition-transform" />
                    )}
                  </button>
                </div>
                <button 
                  onClick={handleDeleteFlow}
                  className="w-10 h-10 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-500 rounded-xl flex items-center justify-center border border-red-200 dark:border-red-900 transition-colors"
                  title="Delete Flow"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs Switcher */}
      {currentFlow && (
        <div className="flex border-b border-wa-border dark:border-wa-dark-border gap-6 text-sm">
          <button
            onClick={() => setActiveTab('builder')}
            className={`pb-3 font-semibold transition-all relative ${
              activeTab === 'builder'
                ? 'text-wa-green'
                : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            Workflow Builder
            {activeTab === 'builder' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-wa-green rounded-full animate-fade-in" />
            )}
          </button>
          
          {currentFlow._id !== 'new_flow' && (
            <button
              onClick={() => setActiveTab('media')}
              className={`pb-3 font-semibold transition-all relative ${
                activeTab === 'media'
                  ? 'text-wa-green'
                  : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
              }`}
            >
              Media Library
              {activeTab === 'media' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-wa-green rounded-full animate-fade-in" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Main Canvas Area */}
      {loading ? (
        <div className="h-[55vh] flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
            <span className="font-semibold">Loading flow details...</span>
          </div>
        </div>
      ) : currentFlow ? (
        activeTab === 'builder' ? (
          <div className="flex gap-4 h-[75vh] w-full items-start overflow-hidden">
            <div className="flex-1 h-full min-w-0">
              <BotFlowCanvas 
                flow={currentFlow} 
                onSave={handleSaveFlow} 
                canvasRef={canvasRef}
              />
            </div>
            <FlowSimulatorPanel
              flow={currentFlow}
              isOpen={isSimulatorOpen}
              onClose={() => setIsSimulatorOpen(false)}
              onModifyWithAI={() => {
                const liveData = canvasRef.current?.getFlowData?.() || currentFlow;
                setFlowToRefineWithAI({
                  ...currentFlow,
                  ...liveData,
                  name: currentFlow?.name || liveData?.name || 'Active Bot Flow'
                });
                setIsAIBotBuilderOpen(true);
              }}
            />
          </div>
        ) : (
          <div className="w-full">
            <BotMediaLibrary botId={currentFlow._id} />
          </div>
        )
      ) : (
        <div className="h-[55vh] flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary border-2 border-dashed border-wa-border dark:border-wa-dark-border rounded-2xl bg-white dark:bg-wa-dark-panel shadow-sm">
          <div className="text-center space-y-4 max-w-sm p-6">
            <Bot className="w-12 h-12 text-wa-green mx-auto" />
            <h3 className="font-bold text-wa-text-primary dark:text-white text-base">No Bot Flow Selected</h3>
            <p className="text-xs text-wa-text-secondary leading-relaxed">Launch automated marketing sequences, reply instantly to triggers, and map customers visually.</p>
            <button onClick={handleCreateNewFlow} className="px-5 py-2.5 text-xs text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md font-semibold transition-all duration-200">
              Create First Flow
            </button>
          </div>
        </div>
      )}

      {/* Workflow Library Modal */}
      {isLibraryOpen && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
            <div className="relative bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-wa-border dark:border-wa-dark-border bg-wa-bg/30 dark:bg-wa-dark-header/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center shadow-inner">
                    <Sparkles className="w-5.5 h-5.5 fill-amber-500/20" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-wa-text-primary dark:text-white">Workflow Library / વર્કફ્લો લાઇબ્રેરી</h3>
                    <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">Deploy premium pre-built chatbot campaigns in seconds.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLibraryOpen(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-wa-bg dark:hover:bg-wa-dark-header text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white transition-colors"
                >
                  <X className="w-5.5 h-5.5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {loadingTemplates ? (
                  <div className="h-48 flex flex-col items-center justify-center gap-2 text-wa-text-secondary dark:text-wa-dark-text-secondary">
                    <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
                    <span className="text-sm font-semibold">Loading library templates...</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary text-sm">
                    No templates available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {templates.map((tpl, i) => (
                      <div key={i} className="flex flex-col bg-wa-bg/40 dark:bg-wa-dark-header/20 border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 hover:border-wa-green/40 hover:shadow-lg hover:scale-[1.01] transition-all duration-300">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-wa-green/10 text-wa-green rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                            <Bot className="w-6.5 h-6.5" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-wa-text-primary dark:text-white text-base leading-snug">{tpl.name}</h4>
                            <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed">{tpl.description}</p>
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-wa-border/50 dark:border-wa-dark-border/50 flex items-center justify-between gap-4">
                          <div className="text-[10px] bg-wa-green/10 text-wa-green font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">
                            {tpl.nodes.length} Steps
                          </div>
                          <button
                            onClick={() => handleImportTemplate(tpl)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md transition-all duration-200"
                          >
                            <span>Import & Customize</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-wa-border dark:border-wa-dark-border bg-wa-bg/30 dark:bg-wa-dark-header/30 flex items-center justify-end text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
                Need custom workflows? Build them in the visual canvas.
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* On-Screen Walkthrough & Explanation Modal for Sir / Clients */}
      {isWalkthroughOpen && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
            <div className="relative bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-wa-border dark:border-wa-dark-border bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
                      <span>How This Bot Works / બોટ કેવી રીતે કાર્ય કરે છે</span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
                        {currentFlow?.name}
                      </span>
                    </h3>
                    <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                      Clear step-by-step customer journey to explain how the bot operates in meetings.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPDF}
                    disabled={exportingPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={exportingExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-white hover:bg-wa-bg dark:hover:bg-wa-dark-header rounded-xl text-xs font-bold transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel</span>
                  </button>
                  <button 
                    onClick={() => setIsWalkthroughOpen(false)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-wa-bg dark:hover:bg-wa-dark-header text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {/* Flow Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-wa-bg/60 dark:bg-wa-dark-header/40 p-3.5 rounded-2xl border border-wa-border dark:border-wa-dark-border">
                    <span className="text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider block">Trigger Rule</span>
                    <span className="text-xs font-bold text-wa-text-primary dark:text-white mt-1 block">
                      {currentFlow?.trigger?.type === 'keyword' ? 'Keyword Match' : 'First Inbound Message'}
                    </span>
                  </div>
                  <div className="bg-wa-bg/60 dark:bg-wa-dark-header/40 p-3.5 rounded-2xl border border-wa-border dark:border-wa-dark-border">
                    <span className="text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider block">Trigger Keywords</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 block truncate" title={currentFlow?.trigger?.keywords?.join(', ')}>
                      {currentFlow?.trigger?.keywords?.join(', ') || 'Any Inbound'}
                    </span>
                  </div>
                  <div className="bg-wa-bg/60 dark:bg-wa-dark-header/40 p-3.5 rounded-2xl border border-wa-border dark:border-wa-dark-border">
                    <span className="text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider block">Total Steps / Nodes</span>
                    <span className="text-xs font-bold text-wa-text-primary dark:text-white mt-1 block">
                      {(canvasRef.current?.getFlowData?.()?.nodes || currentFlow?.nodes || []).length} Interactive Steps
                    </span>
                  </div>
                  <div className="bg-wa-bg/60 dark:bg-wa-dark-header/40 p-3.5 rounded-2xl border border-wa-border dark:border-wa-dark-border">
                    <span className="text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider block">Status</span>
                    <span className={`text-xs font-bold mt-1 inline-block ${currentFlow?.isActive ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {currentFlow?.isActive ? '● Live Active Bot' : '○ Draft / Inactive'}
                    </span>
                  </div>
                </div>

                {/* Step by step journey */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-wa-text-secondary tracking-wider">
                    Customer Journey Progression
                  </h4>

                  {buildExecutiveWalkthrough(canvasRef.current?.getFlowData?.() || currentFlow).map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-wa-bg/40 dark:bg-wa-dark-header/20 border border-wa-border dark:border-wa-dark-border hover:border-emerald-500/30 transition-all"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-wa-text-primary dark:text-white">
                            {item.action}
                          </span>
                          <span className="text-[10px] font-semibold text-wa-text-secondary uppercase">
                            {item.stage}
                          </span>
                        </div>
                        <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed">
                          {item.explanation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Explanation Tip Box */}
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <span className="font-bold block flex items-center gap-1.5">
                    <span>💡 Presentation Tip:</span>
                  </span>
                  <p className="leading-relaxed">
                    You can explain this bot as an automated 24/7 receptionist. It greets customers immediately when they text your WhatsApp number, asks them structured qualification questions, collects their requirements, and either routes them through automated branches or immediately alerts your human team.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-wa-border dark:border-wa-dark-border bg-wa-bg/30 dark:bg-wa-dark-header/30 flex items-center justify-between text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
                <span>Both PDF & Excel exports contain the complete branding, tables, and logic matrix.</span>
                <button
                  onClick={() => setIsWalkthroughOpen(false)}
                  className="px-4 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl font-bold hover:bg-wa-bg dark:hover:bg-wa-dark-header transition-all text-wa-text-primary dark:text-white"
                >
                  Close Walkthrough
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* AI Bot Builder Modal */}
      {isAIBotBuilderOpen && (
        <Portal>
          <AIBotBuilderModal
            isOpen={isAIBotBuilderOpen}
            onClose={() => {
              setIsAIBotBuilderOpen(false);
              setFlowToRefineWithAI(null);
            }}
            initialFlowToRefine={flowToRefineWithAI}
            onApplyFlow={handleApplyAIFlow}
            onOpenSimulator={() => {
              setIsSimulatorOpen(true);
              setSimLog([]);
              setSimAnswers('');
              setSimVars({});
            }}
          />
        </Portal>
      )}
    </div>
  );
}
