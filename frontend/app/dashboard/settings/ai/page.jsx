'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Brain, Shield, Key, Eye, EyeOff, Save, Loader2, RefreshCw,
  Lock, AlertTriangle, CheckCircle2, History, HeartPulse, Sliders, Settings, ShieldAlert, Cpu
} from 'lucide-react';
import api from '../../../../lib/api';

export default function AiSettingsPage() {
  const [keysConfig, setKeysConfig] = useState({
    openaiApiKey: '',
    grokApiKey: ''
  });
  
  const [hasKeys, setHasKeys] = useState({
    hasOpenaiKey: false,
    hasGrokKey: false
  });

  const [aiParams, setAiParams] = useState({
    openaiModel: 'gpt-4o',
    grokModel: 'grok-2',
    temperature: 0.7,
    maxTokens: 400,
    copilotPrompt: `You are an expert customer service AI Copilot assisting a human support agent.
Your goal is to draft a helpful, accurate, and concise response to the customer.
Read the recent message logs and the customer's details, then provide a single draft response.`
  });

  const [encryptionStatus, setEncryptionStatus] = useState({
    enabled: false,
    lastRotatedAt: null,
    keyRotationHistory: [],
    logs: []
  });

  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGrokKey, setShowGrokKey] = useState(false);
  
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [savingKeys, setSavingKeys] = useState(false);
  const [savingParams, setSavingParams] = useState(false);
  const [togglingEncryption, setTogglingEncryption] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);

  // Load configuration and encryption status
  const fetchConfigAndStatus = async () => {
    setLoadingStatus(true);
    try {
      const [keysRes, encRes] = await Promise.all([
        api.get('/ai/settings/keys'),
        api.get('/ai/encryption/status')
      ]);

      if (keysRes.data?.success) {
        setHasKeys(keysRes.data.data);
      }
      
      if (encRes.data?.success) {
        setEncryptionStatus(encRes.data.data);
      }

      // Load local config parameters from localStorage if exists
      if (typeof window !== 'undefined') {
        const storedParams = localStorage.getItem('ai_params_config');
        if (storedParams) {
          try {
            setAiParams(prev => ({ ...prev, ...JSON.parse(storedParams) }));
          } catch (_) {}
        }
      }
    } catch (err) {
      toast.error('Failed to load AI & security configurations.');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchConfigAndStatus();
  }, []);

  const handleSaveKeys = async (e) => {
    e.preventDefault();
    setSavingKeys(true);
    try {
      const { data } = await api.post('/ai/settings/keys', {
        openaiApiKey: keysConfig.openaiApiKey,
        grokApiKey: keysConfig.grokApiKey
      });
      if (data.success) {
        toast.success('API Keys securely saved and encrypted.');
        setKeysConfig({ openaiApiKey: '', grokApiKey: '' });
        fetchConfigAndStatus();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save API keys.');
    } finally {
      setSavingKeys(false);
    }
  };

  const handleSaveParams = (e) => {
    e.preventDefault();
    setSavingParams(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_params_config', JSON.stringify(aiParams));
      }
      toast.success('AI Model parameters and Prompts saved successfully.');
    } catch (err) {
      toast.error('Failed to save parameters.');
    } finally {
      setSavingParams(false);
    }
  };

  const handleToggleEncryption = async () => {
    const actionText = encryptionStatus.enabled 
      ? 'disable Zero-Knowledge Privacy? Legacy decrypted contacts/messages will remain, but newly written data will no longer be encrypted using secure envelopes.' 
      : 'ACTIVATE Zero-Knowledge Encryption? Once enabled, all contacts, incoming/outgoing messages, and CRM notes will be encrypted on-the-fly inside the database. No database administrator or host can read your customer data.';
      
    if (!confirm(`Are you absolutely sure you want to ${actionText}`)) return;
    
    setTogglingEncryption(true);
    try {
      const { data } = await api.post('/ai/encryption/toggle', {
        enabled: !encryptionStatus.enabled
      });
      if (data.success) {
        toast.success(data.message);
        fetchConfigAndStatus();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle encryption mode.');
    } finally {
      setTogglingEncryption(false);
    }
  };

  const handleRotateKey = async () => {
    if (!confirm('Warning: You are about to rotate your Organization Encryption Key (OEK). This generates a new random 256-bit GCM envelope key and flushes in-memory cache layers. Are you sure you want to proceed?')) return;
    
    setRotatingKey(true);
    try {
      const { data } = await api.post('/ai/encryption/rotate');
      if (data.success) {
        toast.success('OEK rotated successfully. Caches flushed.');
        fetchConfigAndStatus();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Key rotation failed.');
    } finally {
      setRotatingKey(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
        <span className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary font-bold">
          Loading AI & Enterprise Security Console...
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Brain className="w-5 h-5 text-wa-green" /> AI & Cryptographic Privacy Console
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Manage LLM model routing, tune agent custom prompt scopes, and configure zero-knowledge client database encryption.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: AI Provider Keys */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
                <Key className="w-4.5 h-4.5 text-wa-green" /> AI Provider API Keys
              </h3>
              <p className="text-xs text-wa-text-secondary mt-0.5">
                Supply your own API credentials to override platform-wide defaults.
              </p>
            </div>

            <form onSubmit={handleSaveKeys} className="space-y-4">
              <div className="space-y-4">
                {/* OpenAI Key */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary">
                      OpenAI API Key
                    </label>
                    {hasKeys.hasOpenaiKey && (
                      <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Configured & Encrypted
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showOpenaiKey ? "text" : "password"}
                      placeholder={hasKeys.hasOpenaiKey ? "••••••••••••••••••••••••••••" : "sk-proj-..."}
                      value={keysConfig.openaiApiKey}
                      onChange={(e) => setKeysConfig({ ...keysConfig, openaiApiKey: e.target.value })}
                      className="w-full pl-4 pr-10 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-3 top-3 text-wa-text-secondary hover:text-wa-text-primary"
                    >
                      {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Grok Key */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary">
                      xAI Grok / Groq API Key
                    </label>
                    {hasKeys.hasGrokKey && (
                      <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Configured & Encrypted
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showGrokKey ? "text" : "password"}
                      placeholder={hasKeys.hasGrokKey ? "••••••••••••••••••••••••••••" : "xai-..."}
                      value={keysConfig.grokApiKey}
                      onChange={(e) => setKeysConfig({ ...keysConfig, grokApiKey: e.target.value })}
                      className="w-full pl-4 pr-10 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGrokKey(!showGrokKey)}
                      className="absolute right-3 top-3 text-wa-text-secondary hover:text-wa-text-primary"
                    >
                      {showGrokKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingKeys || (!keysConfig.openaiApiKey && !keysConfig.grokApiKey)}
                className="flex items-center gap-2 px-4 py-2 text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl text-xs font-semibold shadow-md transition-all duration-200"
              >
                {savingKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Encrypt & Save Keys</span>
              </button>
            </form>
          </div>

          {/* Card 2: AI Parameters & Prompts */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
                <Sliders className="w-4.5 h-4.5 text-wa-green" /> AI Models & Prompt Scopes
              </h3>
              <p className="text-xs text-wa-text-secondary mt-0.5">
                Tune temperature sliders, select LLM layers, and customize unified copilot prompt scopes.
              </p>
            </div>

            <form onSubmit={handleSaveParams} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* OpenAI model selection */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">OpenAI Model</label>
                  <select
                    value={aiParams.openaiModel}
                    onChange={(e) => setAiParams({ ...aiParams, openaiModel: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30"
                  >
                    <option value="gpt-4o">gpt-4o (High Precision / Slow)</option>
                    <option value="gpt-4o-mini">gpt-4o-mini (Cheaper / Recommended)</option>
                    <option value="o1-mini">o1-mini (Structured Reasoning)</option>
                  </select>
                </div>

                {/* Grok model selection */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">xAI Grok Model</label>
                  <select
                    value={aiParams.grokModel}
                    onChange={(e) => setAiParams({ ...aiParams, grokModel: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30"
                  >
                    <option value="grok-2">grok-2 (Real-time Internet Research)</option>
                    <option value="grok-2-mini">grok-2-mini (Efficient lookup)</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Ultra Low Latency)</option>
                  </select>
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-wa-text-secondary">
                  <span className="text-[10px] uppercase font-extrabold">Creativity (Temperature)</span>
                  <span className="font-mono text-wa-green">{aiParams.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={aiParams.temperature}
                  onChange={(e) => setAiParams({ ...aiParams, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-wa-green h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* System Prompt Template */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">
                  AI Copilot System Instruction Prompt
                </label>
                <textarea
                  rows={4}
                  value={aiParams.copilotPrompt}
                  onChange={(e) => setAiParams({ ...aiParams, copilotPrompt: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-sans"
                />
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 text-white bg-wa-green hover:bg-wa-green-hover rounded-xl text-xs font-semibold shadow-md transition-all duration-200 animate-pulse"
              >
                <Save className="w-4 h-4" />
                <span>Save Parameters & Prompt</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column - Zero Knowledge Security Status */}
        <div className="space-y-6">
          {/* Encryption Dashboard Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden group border border-slate-800">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-500" />
            
            <div className="flex items-center justify-between mb-6">
              <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 animate-pulse" />
              </div>
              <button
                onClick={handleToggleEncryption}
                disabled={togglingEncryption}
                className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all duration-200 ${
                  encryptionStatus.enabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                }`}
              >
                {togglingEncryption ? 'Processing...' : encryptionStatus.enabled ? '🟢 Active / Enabled' : '🔴 Disabled / Click to On'}
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-1">
                Zero-Knowledge Privacy Shield
              </h3>
              <p className="text-[11px] text-slate-300 leading-normal">
                Ensures database columns (contacts, messages, CRM comments) are GCM-encrypted at the local server boundary. Even platform superadmins cannot read customer chats.
              </p>
            </div>

            {encryptionStatus.enabled && (
              <div className="border-t border-slate-800 pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Last Key Rotation:</span>
                  <span className="font-bold text-white font-mono">
                    {encryptionStatus.lastRotatedAt ? new Date(encryptionStatus.lastRotatedAt).toLocaleDateString() : 'Never'}
                  </span>
                </div>
                
                <button
                  onClick={handleRotateKey}
                  disabled={rotatingKey}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  {rotatingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Rotate Envelope OEK Key</span>
                </button>
              </div>
            )}
          </div>

          {/* Compliance & Health Check Card */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase text-wa-text-secondary tracking-wider flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-rose-500" /> Security Health Audit
            </h4>
            
            <div className="space-y-2.5 text-xs text-wa-text-secondary">
              <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${encryptionStatus.enabled ? 'text-emerald-500' : 'text-slate-300'}`} /> GDPR Privacy Rule
                </span>
                <span className="font-bold text-wa-text-primary dark:text-white">Ready</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${encryptionStatus.enabled ? 'text-emerald-500' : 'text-slate-300'}`} /> HIPAA Safeguard
                </span>
                <span className="font-bold text-wa-text-primary dark:text-white">Ready</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${encryptionStatus.enabled ? 'text-emerald-500' : 'text-slate-300'}`} /> ISO 27001 Cryptography
                </span>
                <span className="font-bold text-wa-text-primary dark:text-white">Certified</span>
              </div>
            </div>
          </div>

          {/* Cryptographic Audit Trail */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase text-wa-text-secondary tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-500" /> Cryptographic Key Logs
            </h4>
            
            {encryptionStatus.logs && encryptionStatus.logs.length > 0 ? (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {encryptionStatus.logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start text-xs border-b border-slate-50 dark:border-slate-800/40 pb-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <div className="space-y-0.5 leading-tight">
                      <p className="font-bold text-wa-text-primary dark:text-white">
                        {log.action === 'ROTATE_OEK' ? 'OEK Key Rotated' : 'Encryption Shield Toggled'}
                      </p>
                      <p className="text-[10px] text-wa-text-secondary">
                        By {log.actorName} from IP {log.ip || '127.0.0.1'}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-[11px] text-wa-text-secondary">
                No key rotations or status modifications logged.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
