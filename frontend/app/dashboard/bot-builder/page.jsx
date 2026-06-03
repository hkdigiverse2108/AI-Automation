'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Bot, Plus, Play, ToggleLeft, ToggleRight, Sparkles, 
  HelpCircle, RefreshCw, Loader2, ArrowRight, CheckCircle2, ChevronRight, X,
  Phone, Video, MoreVertical, Send, Smile, Paperclip, Trash2
} from 'lucide-react';
import api from '../../../lib/api';
import BotFlowCanvas from '../../../components/BotFlowCanvas';
import FlowSimulatorPanel from '../../../components/FlowSimulatorPanel';
import BotMediaLibrary from '../../../components/BotMediaLibrary';
import { useConfirmStore } from '../../../lib/store';

export default function BotBuilderPage() {
  const confirm = useConfirmStore((state) => state.confirm);
  const [flows, setFlows] = useState([]);
  const [currentFlow, setCurrentFlow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' or 'media'
  
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

  const fetchFlows = async (selectId = null) => {
    setLoading(true);
    try {
      const { data } = await api.get('/flows');
      if (data.success) {
        setFlows(data.data.flows);
        if (selectId) {
          const selected = data.data.flows.find(f => f._id === selectId);
          setCurrentFlow(selected);
        } else if (data.data.flows.length > 0 && !currentFlow) {
          // Select first by default
          setCurrentFlow(data.data.flows[0]);
        }
      }
    } catch (err) {
      toast.error('Failed to load bot flows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

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
          {currentFlow && currentFlow._id !== 'new_flow' && (
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
          <div className="flex-1">
            <span className="block text-[10px] font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider">Active Flow Builder</span>
            <select
              value={currentFlow?._id || ''}
              onChange={(e) => {
                const selected = flows.find(f => f._id === e.target.value);
                setCurrentFlow(selected || null);
                setActiveTab('builder');
              }}
              className="bg-transparent text-wa-text-primary dark:text-white font-bold text-sm focus:outline-none py-1 min-w-[220px]"
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
              <BotFlowCanvas flow={currentFlow} onSave={handleSaveFlow} />
            </div>
            <FlowSimulatorPanel
              flow={currentFlow}
              isOpen={isSimulatorOpen}
              onClose={() => setIsSimulatorOpen(false)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
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
      )}
    </div>
  );
}
