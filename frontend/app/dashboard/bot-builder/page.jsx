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

export default function BotBuilderPage() {
  const [flows, setFlows] = useState([]);
  const [currentFlow, setCurrentFlow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
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

      {/* Main Canvas Area */}
      {loading ? (
        <div className="h-[55vh] flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
            <span className="font-semibold">Loading flow details...</span>
          </div>
        </div>
      ) : currentFlow ? (
        <BotFlowCanvas flow={currentFlow} onSave={handleSaveFlow} />
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

      {/* MODAL: INTERACTIVE WHATSAPP SIMULATOR */}
      {isSimulatorOpen && currentFlow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-fade-in flex flex-col md:flex-row h-[85vh]">
            
            {/* Left Column: Simulator Inputs & Capture variables */}
            <div className="w-full md:w-80 border-r border-wa-border dark:border-wa-dark-border flex flex-col justify-between p-5 bg-wa-bg dark:bg-wa-dark-header/40 shrink-0">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-wa-green animate-pulse" />
                    <span>Simulator Settings</span>
                  </h3>
                  <button onClick={() => setIsSimulatorOpen(false)} className="p-1 rounded-xl md:hidden hover:bg-wa-border dark:hover:bg-wa-dark-border">
                    <X className="w-5 h-5 text-wa-text-secondary" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary tracking-wider">Test User Choices</label>
                  <input
                    type="text"
                    placeholder="e.g. yes, sales, John"
                    value={simAnswers}
                    onChange={(e) => setSimAnswers(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30"
                  />
                  <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed">
                    Provide a comma-separated list of values to supply as inputs when the flow encounters "Ask Question" blocks.
                  </p>
                </div>

                <button 
                  onClick={handleSimulate}
                  disabled={testing}
                  className="w-full py-3 text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-md transition-all duration-200"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>Run Flow Simulation</span>
                </button>

                {/* Variables List */}
                {Object.keys(simVars).length > 0 && (
                  <div className="p-4 bg-white dark:bg-wa-dark-panel rounded-xl border border-wa-border dark:border-wa-dark-border space-y-2">
                    <span className="font-bold text-xs text-wa-green block">Captured Variables Map:</span>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin">
                      {Object.entries(simVars).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-xs border-b border-wa-bg dark:border-wa-dark-header pb-1 font-mono">
                          <span className="text-wa-text-secondary">{key}:</span>
                          <span className="font-semibold text-wa-text-primary dark:text-white">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tips */}
              <div className="hidden md:block text-[10px] text-wa-text-secondary leading-relaxed p-3 bg-wa-green/5 border border-wa-green/20 rounded-xl">
                💡 <span className="font-semibold">How to test:</span> Make sure to save the builder canvas before running the simulation to evaluate the latest updates.
              </div>
            </div>

            {/* Right Column: WhatsApp Web Style Simulator Window */}
            <div className="flex-1 flex flex-col h-full bg-wa-chat-bg relative dark:bg-wa-dark-panel">
              {/* Wallpaper overlay */}
              <div className="absolute inset-0 wa-chat-bg opacity-[0.06] dark:opacity-[0.02] pointer-events-none" />

              {/* Chat Header mockup */}
              <div className="relative z-10 px-4 py-2.5 bg-wa-header dark:bg-wa-dark-header border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-wa-green flex items-center justify-center text-white text-base font-bold shadow-sm">
                    {currentFlow.name ? currentFlow.name.substring(0,2).toUpperCase() : 'BF'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-wa-text-primary dark:text-white leading-tight">WABA Simulator Bot</h4>
                    <span className="text-xs text-wa-green font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-wa-green animate-pulse" />
                      Online (Testing mode)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  <Phone className="w-4.5 h-4.5 opacity-50 cursor-not-allowed" />
                  <Video className="w-4.5 h-4.5 opacity-50 cursor-not-allowed" />
                  <div className="w-px h-5 bg-wa-border dark:bg-wa-dark-border" />
                  <MoreVertical className="w-5 h-5 cursor-pointer hover:text-wa-text-primary" />
                  <button onClick={() => setIsSimulatorOpen(false)} className="hidden md:block p-1.5 rounded-xl hover:bg-wa-bg dark:hover:bg-wa-dark-header text-wa-text-secondary hover:text-wa-text-primary transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages Area Mockup */}
              <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4 flex flex-col justify-end scrollbar-thin">
                {simLog.length === 0 ? (
                  <div className="my-auto text-center space-y-3 max-w-sm mx-auto">
                    <div className="w-16 h-16 rounded-full bg-wa-green/10 flex items-center justify-center mx-auto text-wa-green shadow-inner">
                      <Bot className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-wa-text-primary dark:text-white text-sm">Simulation Idle</h4>
                    <p className="text-xs text-wa-text-secondary leading-relaxed">
                      Click the <span className="font-semibold text-wa-green">"Run Flow Simulation"</span> button to generate the conversational trail output.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto max-h-full pr-1">
                    {/* Simulated Start Banner */}
                    <div className="flex justify-center">
                      <span className="px-3 py-1 bg-white/80 dark:bg-wa-dark-header/80 border border-wa-border dark:border-wa-dark-border rounded-lg text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase shadow-sm select-none">
                        Simulation Started
                      </span>
                    </div>

                    {simLog.map((log, idx) => {
                      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      
                      // 1. System notification styles for non-message actions
                      if (log.type === 'condition' || log.type === 'delay' || log.type === 'handoff' || log.type === 'action') {
                        let text = log.action;
                        if (log.type === 'handoff') text = '⚠️ Transferred conversation to live human agent';
                        if (log.type === 'delay') text = `⏱️ Bot delay paused execution for ${log.action.replace('Delay: ', '')}`;
                        
                        return (
                          <div key={idx} className="flex justify-center my-2">
                            <span className="px-3 py-1 bg-wa-header/90 dark:bg-wa-dark-header/90 border border-wa-border/50 dark:border-wa-dark-border/50 text-[10px] font-medium text-wa-text-secondary dark:text-wa-dark-text-secondary rounded-lg shadow-sm">
                              {text}
                            </span>
                          </div>
                        );
                      }

                      // 2. Outbound / Inbound message logs
                      const isBotMessage = log.type === 'message' || log.type === 'ai' || log.type === 'question';
                      const botText = log.action.replace('Send: ', '').replace('Ask: ', '').replace(/AI Response \(prompt: .*\)/, '🤖 AI Response generated.');

                      return (
                        <div key={idx} className="space-y-3">
                          {/* Bot Message (Received from Left) */}
                          {isBotMessage && (
                            <div className="flex justify-start">
                              <div className="relative max-w-[85%] bg-white dark:bg-wa-dark-header rounded-2xl rounded-tl-none px-3.5 py-2 shadow-sm border border-wa-border/30 dark:border-wa-dark-border/10 flex flex-col">
                                {/* WhatsApp tail simulation */}
                                <div className="absolute top-0 -left-[7px] w-2 h-2.5 overflow-hidden">
                                  <div className="w-3.5 h-3.5 bg-white dark:bg-wa-dark-header border-t border-r border-wa-border/20 dark:border-wa-dark-border/10 rotate-45 transform origin-top-right" />
                                </div>
                                <span className="text-xs text-wa-text-primary dark:text-white leading-relaxed pr-10">
                                  {botText}
                                </span>
                                <span className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary text-right mt-1 self-end">
                                  {timeStr}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* User reply (Sent from Right) */}
                          {log.userResponse && (
                            <div className="flex justify-end">
                              <div className="relative max-w-[85%] bg-wa-bubble-out-bg dark:bg-wa-dark-bubble-out-bg rounded-2xl rounded-tr-none px-3.5 py-2 shadow-sm border border-wa-green/10 flex flex-col">
                                {/* WhatsApp tail simulation */}
                                <div className="absolute top-0 -right-[7px] w-2 h-2.5 overflow-hidden">
                                  <div className="w-3.5 h-3.5 bg-wa-bubble-out-bg dark:bg-wa-dark-bubble-out-bg rotate-45 transform origin-top-left" />
                                </div>
                                <span className="text-xs text-wa-text-primary dark:text-white leading-relaxed pr-10">
                                  {log.userResponse}
                                </span>
                                <span className="text-[9px] text-wa-text-secondary dark:text-wa-dark-text-secondary text-right mt-1 self-end flex items-center gap-0.5">
                                  {timeStr}
                                  <span className="text-blue-500 font-bold">✓✓</span>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chat Input Mockup at bottom */}
              <div className="relative z-10 px-4 py-3 bg-wa-header dark:bg-wa-dark-header border-t border-wa-border dark:border-wa-dark-border flex items-center gap-3 shrink-0">
                <Smile className="w-6 h-6 text-wa-text-secondary hover:text-wa-text-primary cursor-pointer shrink-0" />
                <Paperclip className="w-5.5 h-5.5 text-wa-text-secondary hover:text-wa-text-primary cursor-pointer shrink-0" />
                <input
                  type="text"
                  disabled
                  placeholder={simLog.length === 0 ? "Simulate to interact..." : "Simulator view only"}
                  className="flex-1 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2 text-sm focus:outline-none text-wa-text-primary dark:text-white placeholder-wa-text-secondary cursor-not-allowed select-none"
                />
                <button disabled className="w-9 h-9 rounded-full bg-wa-green flex items-center justify-center text-white shrink-0 opacity-80 cursor-not-allowed">
                  <Send className="w-4 h-4 fill-white" />
                </button>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
