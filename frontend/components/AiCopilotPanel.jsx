'use client';
import { useState, useEffect } from 'react';
import { 
  Bot, Sparkles, Languages, FileText, ChevronRight, ChevronLeft, 
  HelpCircle, RefreshCw, Check, AlertCircle, Send, Quote
} from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';

export default function AiCopilotPanel({ conversationId, onApplyDraft, isOpen, setIsOpen }) {
  const [provider, setProvider] = useState('openai');
  const [draft, setDraft] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryType, setSummaryType] = useState('quick');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchSuggestions = async () => {
    if (!conversationId) return;
    setLoadingSuggestions(true);
    try {
      const { data } = await api.get(`/ai/copilot/suggestions/${conversationId}`);
      if (data.success) {
        setSuggestions(data.data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (conversationId && isOpen) {
      fetchSuggestions();
      setDraft('');
      setSummary('');
    }
  }, [conversationId, isOpen]);

  const handleGenerateDraft = async () => {
    setLoadingDraft(true);
    setDraft('');
    try {
      const { data } = await api.post('/ai/copilot/generate-draft', {
        conversationId,
        provider
      });
      if (data.success) {
        setDraft(data.data.draft);
        toast.success('AI Draft Generated!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate AI draft');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleChangeTone = async (tone) => {
    if (!draft) {
      toast.error('Generate a draft first before changing tone.');
      return;
    }
    setLoadingDraft(true);
    try {
      const { data } = await api.post('/ai/copilot/change-tone', {
        text: draft,
        tone,
        provider
      });
      if (data.success) {
        setDraft(data.data.text);
        toast.success(`Tone changed to ${tone}!`);
      }
    } catch (err) {
      toast.error('Failed to change tone');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleTranslate = async (lang) => {
    if (!draft) {
      toast.error('Generate a draft first before translating.');
      return;
    }
    setLoadingDraft(true);
    try {
      const { data } = await api.post('/ai/copilot/translate', {
        text: draft,
        targetLanguage: lang,
        provider
      });
      if (data.success) {
        setDraft(data.data.text);
        toast.success(`Translated to ${lang}!`);
      }
    } catch (err) {
      toast.error('Translation failed');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleSummarize = async (type) => {
    setLoadingSummary(true);
    setSummaryType(type);
    try {
      const { data } = await api.post('/ai/copilot/summarize', {
        conversationId,
        summaryType: type
      });
      if (data.success) {
        setSummary(data.data.summary);
      }
    } catch (err) {
      toast.error('Failed to generate summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-20 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-l-2xl flex flex-col items-center justify-center gap-1 shadow-md hover:bg-slate-50 dark:hover:bg-wa-dark-header z-30 group"
        title="Open AI Copilot Sidebar"
      >
        <ChevronLeft className="w-4 h-4 text-wa-text-secondary group-hover:text-wa-green transition-colors" />
        <Bot className="w-4.5 h-4.5 text-wa-green" />
        <span className="text-[9px] font-bold tracking-wider text-wa-text-secondary uppercase select-none [writing-mode:vertical-lr] rotate-180">Copilot</span>
      </button>
    );
  }

  return (
    <div className="w-80 border-l border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel h-full flex flex-col justify-between shrink-0 relative z-30 shadow-xl overflow-hidden glass-card animate-slide-in">
      
      {/* Header */}
      <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-wa-bg dark:bg-wa-dark-header/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-wa-green/10 text-wa-green flex items-center justify-center shadow-inner">
            <Bot className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-wa-text-primary dark:text-white">AI Copilot Sidekick</h4>
            <span className="text-[9px] font-semibold text-wa-text-secondary">Enterprise Agent Assistant</span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-lg hover:bg-wa-border dark:hover:bg-wa-dark-border text-wa-text-secondary hover:text-wa-text-primary transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Main scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        
        {/* AI Provider Switch */}
        <div className="bg-wa-bg dark:bg-wa-dark-header/20 p-2.5 rounded-xl border border-wa-border dark:border-wa-dark-border">
          <label className="block text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider mb-1.5">Dual-Brain Engine</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setProvider('openai')}
              className={`py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                provider === 'openai' 
                  ? 'bg-wa-green text-white border-wa-green shadow-sm' 
                  : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:text-wa-text-primary'
              }`}
            >
              OpenAI (Pro)
            </button>
            <button
              onClick={() => setProvider('grok')}
              className={`py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                provider === 'grok' 
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                  : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:text-wa-text-primary'
              }`}
            >
              xAI Grok (Live)
            </button>
          </div>
        </div>

        {/* Generate Suggested Reply Draft */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider">Suggested Response</label>
            {draft && (
              <button 
                onClick={handleGenerateDraft}
                className="text-[10px] font-semibold text-wa-green flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            )}
          </div>

          {!draft ? (
            <button
              onClick={handleGenerateDraft}
              disabled={loadingDraft}
              className={`w-full py-3 bg-gradient-to-r from-wa-green to-emerald-500 hover:opacity-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 transition-all duration-200`}
            >
              {loadingDraft ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 fill-white/20" />
              )}
              <span>Generate suggested reply</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative p-3 bg-slate-50 dark:bg-wa-dark-header/30 rounded-xl border border-wa-border dark:border-wa-dark-border shadow-inner group">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full text-xs leading-relaxed bg-transparent border-none text-wa-text-primary dark:text-white focus:outline-none scrollbar-thin resize-none"
                  rows="4"
                />
                {loadingDraft && (
                  <div className="absolute inset-0 bg-white/75 dark:bg-wa-dark-panel/75 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-wa-green animate-spin" />
                  </div>
                )}
              </div>

              {/* Action Buttons: Apply / Change Tone / Translate */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { onApplyDraft(draft); toast.success('Draft applied to input box!'); }}
                  className="py-2 bg-wa-green hover:bg-wa-green-hover text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  Apply Draft
                </button>
                
                {/* Tone select dropdown */}
                <select
                  onChange={(e) => handleChangeTone(e.target.value)}
                  defaultValue=""
                  className="py-2 px-2 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-white rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="" disabled>Change Tone...</option>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="sales">Sales / Hook</option>
                  <option value="urgent">Urgent</option>
                  <option value="empathetic">Empathetic</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              {/* Translation bar */}
              <div className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-wa-dark-header/20 rounded-xl border border-wa-border dark:border-wa-dark-border">
                <Languages className="w-3.5 h-3.5 text-wa-text-secondary" />
                <select
                  onChange={(e) => handleTranslate(e.target.value)}
                  defaultValue=""
                  className="flex-1 bg-transparent text-[11px] font-semibold text-wa-text-primary dark:text-white focus:outline-none"
                >
                  <option value="" disabled>Translate Draft...</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Gujarati">Gujarati</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Arabic">Arabic</option>
                  <option value="French">French</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Conversation Summarizer */}
        <div className="border-t border-wa-border dark:border-wa-dark-border pt-4 space-y-2">
          <label className="block text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider">Conversation Summary</label>
          <div className="flex flex-wrap gap-1.5">
            {['quick', 'detailed', 'issues', 'actions'].map(type => (
              <button
                key={type}
                onClick={() => handleSummarize(type)}
                className={`px-2 py-1 text-[10px] font-bold border rounded-lg transition-colors ${
                  summaryType === type && summary
                    ? 'bg-wa-green border-wa-green text-white shadow-sm'
                    : 'bg-white dark:bg-wa-dark-panel border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:text-wa-text-primary'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {loadingSummary ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-wa-text-secondary">
              <RefreshCw className="w-4 h-4 animate-spin text-wa-green" />
              <span>Analyzing logs...</span>
            </div>
          ) : summary ? (
            <div className="p-3 bg-wa-bg dark:bg-wa-dark-header/20 border border-wa-border dark:border-wa-dark-border rounded-xl text-xs leading-relaxed text-wa-text-primary dark:text-slate-200 max-h-48 overflow-y-auto scrollbar-thin markdown-body">
              {summary}
            </div>
          ) : null}
        </div>

        {/* Smart Suggestions & FAQs */}
        <div className="border-t border-wa-border dark:border-wa-dark-border pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider">Smart Quick Replies</label>
            <button 
              onClick={fetchSuggestions}
              className="text-wa-text-secondary hover:text-wa-green"
              title="Reload suggestions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSuggestions ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingSuggestions ? (
            <div className="space-y-2">
              <div className="h-10 bg-slate-100 dark:bg-wa-dark-header/10 animate-pulse rounded-xl" />
              <div className="h-10 bg-slate-100 dark:bg-wa-dark-header/10 animate-pulse rounded-xl" />
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-[11px] text-wa-text-secondary italic">No automatic suggestions available yet.</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => { onApplyDraft(sug); toast.success('Suggestion applied!'); }}
                  className="w-full text-left p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-wa-dark-header/20 dark:hover:bg-wa-dark-header/40 border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-slate-200 transition-colors flex items-start gap-2 shadow-inner group"
                >
                  <Quote className="w-3.5 h-3.5 text-wa-green shrink-0 mt-0.5" />
                  <span className="line-clamp-2 leading-relaxed">{sug}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Usage Analytics Footer */}
      <div className="p-3 border-t border-wa-border dark:border-wa-dark-border bg-slate-50 dark:bg-wa-dark-header/40 text-[9px] font-semibold text-wa-text-secondary flex justify-between shrink-0">
        <span>Token Limit: 100,000 / mon</span>
        <span className="text-wa-green">Securely Sandboxed</span>
      </div>

    </div>
  );
}
