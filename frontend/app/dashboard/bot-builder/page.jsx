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

export default function BotBuilderPage() {
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
    if (!confirm(`Are you sure you want to delete the flow "${currentFlow.name}"? This action cannot be undone.`)) {
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
    </div>
  );
}
