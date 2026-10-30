'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Bot, Globe, Tag, Languages, Wand2, ArrowRight, CheckCircle2, 
  RotateCcw, Play, X, Loader2, Layers, MessageSquare, HelpCircle, 
  ChevronRight, Compass, ShieldCheck, Flame, ExternalLink, Zap, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../lib/api';

const PRESET_TEMPLATES = [
  {
    id: 'it_agency',
    label: '🚀 IT & Digital Agency',
    businessName: 'HK DigiVerse',
    industry: 'IT & Software / Digital Marketing',
    websiteUrl: '',
    offers: 'Flat 20% OFF on all custom automation & website builds this month!',
    language: 'English',
    prompt: 'Build a comprehensive 12-16 node WhatsApp bot modeled after HK DigiVerse IT Solutions Bot. Welcome visitors with an interactive menu (Explore Services, Get Quote, Portfolio, Special Offers, Talk to Expert), 4 dedicated detail cards for Web, Mobile, AI Automation & Cloud, a 2-step qualification funnel (project scope & launch timeline), client testimonials, smart WhatsApp phone capture with "Same Number" button, live agent escalation, and instant CRM sync confirmation.'
  },
  {
    id: 'clinic',
    label: '🏥 Clinic & Healthcare',
    businessName: 'Apex Health Clinic',
    industry: 'Healthcare / Clinic & Hospital',
    websiteUrl: '',
    offers: 'Free initial health consultation & dental checkup on first visit!',
    language: 'English',
    prompt: 'Create a multi-tier patient consultation bot. Welcome patients with an interactive menu, 4 dedicated cards for Doctor Consultations, Preventive Checkup Packages, Dental Care, and Clinic Hours/Emergency, 2-step appointment triage (visit type & preferred day), patient name and smart phone capture, and instant booking confirmation with CRM sync.'
  },
  {
    id: 'real_estate',
    label: '🏡 Real Estate & Property',
    businessName: 'Skyline Luxury Homes',
    industry: 'Real Estate / Property',
    websiteUrl: '',
    offers: 'Zero brokerage fees + exclusive pre-launch booking discounts!',
    language: 'English',
    prompt: 'Create an enterprise property consultation bot. Welcome leads with options (2/3 BHK Flats, Gated Villas, Commercial Spaces, Free VIP Site Visit), dedicated cards with floor plans & amenities, 2-step buyer qualification (possession timeline & investment tier), lead name and WhatsApp phone capture, and instant callback confirmation.'
  },
  {
    id: 'food_dining',
    label: '🍕 Restaurant & Cafe',
    businessName: 'Spice & Wood Oven Cafe',
    industry: 'Restaurant & Hospitality',
    websiteUrl: '',
    offers: 'Get a complimentary beverage or dessert on orders above ₹500!',
    language: 'English',
    prompt: 'Create a rich dining and ordering bot. Greet food lovers with an interactive hub (Chef Specials, Table Reservation, Doorstep Delivery, Banquet Catering), dedicated cards for each category with pricing & preparation timelines, 2-step booking qualification (dining occasion & timing), contact details capture, and instant table reservation confirmation.'
  },
  {
    id: 'ecommerce',
    label: '🛍️ E-Commerce & Retail',
    businessName: 'UrbanStyle Boutique',
    industry: 'E-Commerce & Retail',
    websiteUrl: '',
    offers: 'Use code FESTIVE15 for flat 15% discount on checkout!',
    language: 'English',
    prompt: 'Build a multi-tier automated store assistant. Greet shoppers warmly, showcase 4 dedicated cards for Bestsellers, Live Order Tracking, Value Gift Bundles, and Bulk Orders/Support, 2-step shopping triage, customer name and WhatsApp phone capture, and instant dispatch/support confirmation.'
  },
  {
    id: 'bilingual_gujarati',
    label: '🇮🇳 Bilingual (English + ગુજરાતી)',
    businessName: 'HK DigiVerse',
    industry: 'IT & Software / Digital Marketing',
    websiteUrl: '',
    offers: 'નવા ગ્રાહકો માટે ખાસ 20% ડિસ્કાઉન્ટ!',
    language: 'Bilingual (English + Gujarati)',
    prompt: 'નમસ્તેથી વ્યાવસાયિક સ્વાગત કરો. અમારી 4 મુખ્ય સેવાઓ (વેબસાઇટ, મોબાઇલ એપ, AI વોટ્સએપ ઓટોમેશન, ક્લાઉડ ERP) માટે વિગતવાર કાર્ડ્સ, પ્રોજેક્ટ સ્કોપ અને સમય-મર્યાદા પૂછવા માટે 2-સ્ટેપ ક્વોટેશન, પોર્ટફોલિયો, ખાસ ઑફર, એક્સપર્ટ સાથે લાઈવ હેન્ડઓફ, ગ્રાહકનું નામ અને સ્માર્ટ ફોન નંબર કલેક્ટ કરો અને CRM કન્ફર્મેશન મેસેજ આપો.'
  }
];

export default function AIBotBuilderModal({ 
  isOpen, 
  onClose, 
  onApplyFlow, 
  onOpenSimulator, 
  initialFlowToRefine = null 
}) {
  const [businessName, setBusinessName] = useState('');
  const [businessNameError, setBusinessNameError] = useState('');
  const businessNameInputRef = useRef(null);
  const [industry, setIndustry] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [offers, setOffers] = useState('');
  const [language, setLanguage] = useState('English');
  const [prompt, setPrompt] = useState('');
  const [promptError, setPromptError] = useState('');
  const promptInputRef = useRef(null);
  
  // Scraper State
  const [scraping, setScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);

  // Generation State
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generatedResult, setGeneratedResult] = useState(null);

  // Refiner State
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBusinessNameError('');
      setPromptError('');
      if (initialFlowToRefine && Array.isArray(initialFlowToRefine.nodes) && initialFlowToRefine.nodes.length > 0) {
        setGeneratedResult({
          flow: initialFlowToRefine,
          source: 'Active Flow from Simulator'
        });
        setBusinessName(initialFlowToRefine.name || 'Active Bot Flow');
        setPrompt(initialFlowToRefine.description || '');
      } else if (!initialFlowToRefine) {
        setGeneratedResult(null);
      }
    } else {
      setGenerating(false);
      setGenerationStep(0);
      setRefinePrompt('');
      setRefining(false);
      setBusinessNameError('');
      setPromptError('');
    }
  }, [isOpen, initialFlowToRefine]);

  if (!isOpen) return null;

  const handleClearForm = () => {
    setBusinessName('');
    setBusinessNameError('');
    setIndustry('');
    setWebsiteUrl('');
    setOffers('');
    setLanguage('English');
    setPrompt('');
    setPromptError('');
    setScrapedData(null);
    setRefinePrompt('');
    toast('Form cleared. Ready for your custom details or website scan.', { icon: '🧹' });
  };

  const handleApplyPreset = (preset) => {
    setBusinessName(preset.businessName);
    setBusinessNameError('');
    setIndustry(preset.industry);
    setWebsiteUrl(preset.websiteUrl);
    setOffers(preset.offers);
    setLanguage(preset.language);
    setPrompt(preset.prompt);
    setPromptError('');
    setScrapedData(null);
    toast.success(`Loaded preset: ${preset.label}`);
  };

  const handleScrapeWebsite = async () => {
    if (!websiteUrl.trim()) {
      toast.error('Please enter a website URL first');
      return;
    }
    setScraping(true);
    const toastId = toast.loading('Scanning website content, brand & services...');
    try {
      const { data } = await api.post('/flows/ai-builder/scrape', { url: websiteUrl });
      if (data.success && data.data) {
        const info = data.data;
        setScrapedData(info);

        // 1. Auto-fill Brand Name from Scanned Website
        const detectedName = info.brandName || (info.title ? info.title.split(/[-|–•:;]/)[0].trim() : '');
        if (detectedName) {
          setBusinessName(detectedName);
          setBusinessNameError('');
        }

        // 2. Auto-fill Industry / Category from Scanned Website
        if (info.detectedIndustry) {
          setIndustry(info.detectedIndustry);
        }

        // 3. Auto-fill Special Offers / Discounts from Scanned Website
        if (info.detectedOffer) {
          setOffers(info.detectedOffer);
        }

        // 4. Auto-fill Smart Prompt with Extracted Services
        if (info.suggestedPrompt) {
          setPrompt(info.suggestedPrompt);
          setPromptError('');
        }

        const offerNote = info.detectedOffer ? ' & Offers' : '';
        toast.success(`✨ Website Scanned! Brand "${detectedName}", Category${offerNote} auto-filled!`, { 
          id: toastId,
          duration: 4500 
        });
      } else {
        toast('Website reached, but limited metadata found. You can enter details manually.', { id: toastId, icon: 'ℹ️' });
      }
    } catch (err) {
      toast.error('Could not scan website automatically. You can enter details manually or use presets.', { id: toastId });
    } finally {
      setScraping(false);
    }
  };

  const handleGenerate = async () => {
    const trimmedBusinessName = businessName.trim();
    const trimmedPrompt = prompt.trim();
    let hasError = false;

    if (!trimmedBusinessName) {
      setBusinessNameError('Business / Brand Name is required.');
      hasError = true;
    } else {
      setBusinessNameError('');
    }

    if (!trimmedPrompt) {
      setPromptError('Bot requirements prompt is required to design your flow.');
      hasError = true;
    } else {
      setPromptError('');
    }

    if (hasError) {
      if (!trimmedBusinessName && !trimmedPrompt) {
        toast.error('Please enter Business Name and Bot Requirements Prompt');
        if (businessNameInputRef.current) businessNameInputRef.current.focus();
      } else if (!trimmedBusinessName) {
        toast.error('Please enter your Business / Brand Name');
        if (businessNameInputRef.current) businessNameInputRef.current.focus();
      } else {
        toast.error('Please describe what your bot should do in the requirements prompt');
        if (promptInputRef.current) promptInputRef.current.focus();
      }
      return;
    }

    setBusinessNameError('');
    setPromptError('');
    setGenerating(true);
    setGenerationStep(1);
    setGeneratedResult(null);

    // Animated progress simulation while API executes
    const stepInterval = setInterval(() => {
      setGenerationStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1800);

    try {
      const { data } = await api.post('/flows/ai-builder/generate', {
        businessName,
        industry,
        websiteUrl,
        offers,
        language,
        prompt
      });

      clearInterval(stepInterval);
      setGenerationStep(4);

      if (data.success && data.data?.flow) {
        setGeneratedResult(data.data);
        toast.success('✨ WhatsApp Bot Flow crafted successfully by AI!');
      } else {
        throw new Error(data.error || 'Failed to generate flow');
      }
    } catch (err) {
      clearInterval(stepInterval);
      toast.error(err.response?.data?.error || err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefineFlow = async (customInstruction = null) => {
    const instructionToUse = customInstruction || refinePrompt;
    if (!instructionToUse || !instructionToUse.trim() || !generatedResult?.flow) return;

    setRefining(true);
    const toastId = toast.loading('AI is refining your bot flow...');
    try {
      const { data } = await api.post('/flows/ai-builder/refine', {
        flow: generatedResult.flow,
        refineInstruction: instructionToUse,
        businessName,
        language
      });

      if (data.success && data.data?.flow) {
        setGeneratedResult(prev => ({
          ...prev,
          flow: data.data.flow,
          source: data.data.note || 'Refined with AI'
        }));
        setRefinePrompt('');
        toast.success('✨ Flow refined with AI successfully!', { id: toastId });
      } else {
        throw new Error(data.error || 'Failed to refine flow');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Refinement failed', { id: toastId });
    } finally {
      setRefining(false);
    }
  };

  const handleLoadIntoCanvas = (andSimulate = false) => {
    if (!generatedResult?.flow) return;
    onApplyFlow(generatedResult.flow);
    onClose();
    if (andSimulate && onOpenSimulator) {
      setTimeout(() => {
        onOpenSimulator();
      }, 350);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Glow Accents */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-purple-500/15 dark:bg-purple-500/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/15 dark:bg-emerald-500/25 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-purple-200/90 dark:border-purple-800/70 bg-gradient-to-b from-purple-50/70 via-white to-purple-50/30 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  AI Bot Builder
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/70">
                  AI Generator
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instantly architect complete WhatsApp chatbot flows, welcome menus, interactive buttons, and lead capture.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="relative flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* If already generated, show Flow Review Screen */}
          {generatedResult ? (
            <div className="space-y-6 animate-fade-in">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-purple-50/50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-purple-950/20 border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Generated Successfully ({generatedResult.source})
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {generatedResult.flow?.name}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                      {generatedResult.flow?.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGeneratedResult(null)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Edit Prompt
                    </button>
                  </div>
                </div>

                {/* Key Metrics / Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Total Steps / Nodes</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {generatedResult.flow?.nodes?.length || 0} Blocks
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Trigger Keywords</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                      {generatedResult.flow?.trigger?.keywords?.slice(0, 3).join(', ')}...
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Lead Variables</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {generatedResult.flow?.nodes?.filter(n => n.data?.variable).length || 0} Captured
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Target Language</span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {language}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Interactive Flow Refiner Bar */}
              <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/90 dark:border-purple-800/70 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    AI Flow Refiner (Chat to tweak or add buttons/nodes)
                  </span>
                  {refining && (
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Refining flow...
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleRefineFlow();
                      }
                    }}
                    placeholder="e.g. Add 20% discount button, add Human Agent handoff, or collect email too..."
                    disabled={refining}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => handleRefineFlow()}
                    disabled={refining || !refinePrompt.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 border border-purple-200/90 dark:border-purple-800/70 bg-gradient-to-b from-purple-50/70 via-white to-purple-50/30 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-600 text-purple-950 dark:text-purple-100 rounded-xl text-xs font-semibold transition-all duration-200 shadow-xs hover:shadow-sm active:scale-[0.98] disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>{refining ? 'Refining...' : 'Refine Flow'}</span>
                  </button>
                </div>
                {/* Quick suggestions pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Quick Suggestions:</span>
                  {[
                    '+ Add 15% Festive Discount',
                    '+ Add Human Handoff Node',
                    '+ Collect Customer Email Too',
                    'Make Welcome Message Shorter'
                  ].map((suggestion, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      disabled={refining}
                      onClick={() => handleRefineFlow(suggestion)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-purple-100/70 hover:bg-purple-200/80 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step by Step Flow Preview */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  Conversational Journey Walkthrough ({generatedResult.flow?.nodes?.length} Steps)
                </h5>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {generatedResult.flow?.nodes?.map((node, idx) => {
                    const isQuestion = node.type === 'question';
                    const isHandoff = node.type === 'handoff';
                    const buttons = node.data?.message?.buttons || [];
                    const msgText = node.data?.message?.text || node.data?.message?.body || '';
                    const hasCrmSync = node.data?.crmSync || node.data?.action === 'crm_lead_sync';
                    return (
                      <div
                        key={node.id || idx}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                          isHandoff
                            ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-bold text-[11px] ${
                          isHandoff
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                            : isQuestion 
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
                            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white capitalize flex items-center gap-1.5">
                              {node.id.replace('node_', '').replace(/_/g, ' ')}
                              {isHandoff && <span className="text-red-600 dark:text-red-400 font-bold text-[10px]">• Live Agent Transfer</span>}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                              isHandoff
                                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold'
                                : 'bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {node.type}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-3">
                            {msgText}
                          </p>

                          {/* Quick Reply Buttons */}
                          {buttons.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {buttons.map((b, bi) => (
                                <span
                                  key={bi}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1"
                                >
                                  <ChevronRight className="w-3 h-3 opacity-60" />
                                  {b.text}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Interactive List Menu Sections / Rows */}
                          {Array.isArray(node.data?.message?.sections) && node.data.message.sections.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {node.data.message.sections.flatMap(s => s.rows || []).map((row, ri) => (
                                <span
                                  key={ri}
                                  className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] font-semibold flex items-center gap-1"
                                  title={row.description || ''}
                                >
                                  <ChevronRight className="w-3 h-3 opacity-60" />
                                  {row.title || row.text || `Row ${ri + 1}`}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Variable Capture Badge */}
                          {node.data?.variable && (
                            <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400 pt-0.5">
                              Saves to variable: <span className="font-bold">{`{{${node.data.variable}}}`}</span>
                            </div>
                          )}

                          {/* CRM Sync Badge */}
                          {hasCrmSync && (
                            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 pt-0.5 flex items-center gap-1">
                              <span>⚡ Auto-syncs Lead to CRM & Notifies Owner</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => handleLoadIntoCanvas(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  Load into Canvas
                </button>
                <button
                  onClick={() => handleLoadIntoCanvas(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-200/90 dark:border-emerald-800/70 bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-600 text-emerald-950 dark:text-emerald-100 text-sm font-semibold transition-all duration-200 shadow-xs hover:shadow-sm active:scale-[0.98]"
                >
                  <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-600/20 shrink-0" />
                  <span>Load & Test in WABA Simulator</span>
                </button>
              </div>
            </div>
          ) : (
            /* Input & Generation Form */
            <div className="space-y-6">
              
              {/* Presets Row */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-purple-500" />
                    One-Click Industry Presets (Or Scan Website Below)
                  </label>
                  {(businessName || websiteUrl || offers || prompt) && (
                    <button
                      type="button"
                      onClick={handleClearForm}
                      className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 flex items-center gap-1 hover:underline transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Clear Form
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TEMPLATES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/80 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:hover:border-purple-600 text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Business Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Business / Brand Name <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {scrapedData?.brandName && businessName === scrapedData.brandName && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-filled from Website
                      </span>
                    )}
                  </div>
                  <input
                    ref={businessNameInputRef}
                    type="text"
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      if (businessNameError) setBusinessNameError('');
                    }}
                    placeholder="e.g. My Brand, Sunrise Clinic, or Royal Realty"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none ${
                      businessNameError
                        ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-slate-900 dark:text-white ring-2 ring-rose-500/20 dark:ring-rose-500/30 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/40'
                    }`}
                  />
                  {businessNameError && (
                    <p className="text-xs text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1.5 pt-0.5 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{businessNameError}</span>
                    </p>
                  )}
                </div>

                {/* Industry Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Industry / Category
                    </label>
                    {scrapedData?.detectedIndustry && industry === scrapedData.detectedIndustry && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-detected from Website
                      </span>
                    )}
                  </div>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
                      !industry ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    <option value="" disabled>-- Select Category or Scan Website to Auto-Detect --</option>
                    <option value="IT & Software / Digital Marketing">IT, Software & Digital Agency</option>
                    <option value="Healthcare / Clinic & Hospital">Healthcare, Clinic & Hospital</option>
                    <option value="Real Estate / Property">Real Estate & Construction</option>
                    <option value="E-Commerce & Retail">E-Commerce & Retail Store</option>
                    <option value="Restaurant & Hospitality">Restaurant, Cafe & Dining</option>
                    <option value="Education & Coaching">Education, Coaching & Academy</option>
                    <option value="Travel & Tourism">Travel & Tourism Agency</option>
                    <option value="Finance & Insurance">Finance, Loans & Insurance</option>
                    <option value="Automotive & Car Service">Automobile & Garage Services</option>
                    <option value="Other / General Business">Other / Custom Business</option>
                  </select>
                </div>

                {/* Website URL with Scan Option */}
                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      Website URL (Optional — AI auto-extracts services & details)
                    </label>
                    {websiteUrl && (
                      <button
                        type="button"
                        onClick={handleScrapeWebsite}
                        disabled={scraping}
                        className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        {scraping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        {scraping ? 'Scanning...' : 'Scan Website Now'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourwebsite.com (Type URL & click 'Scan Website Now' to auto-fill)"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>

                  {/* Scraped Info Preview */}
                  {scrapedData && (
                    <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-1.5 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Scanned: {scrapedData.brandName || scrapedData.title}
                        </span>
                        {scrapedData.detectedIndustry && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-200/60 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300">
                            {scrapedData.detectedIndustry}
                          </span>
                        )}
                      </div>
                      {scrapedData.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                          {scrapedData.description}
                        </p>
                      )}
                      {scrapedData.detectedOffer && (
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold text-[11px] pt-0.5">
                          <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Special Offer Detected: <span className="underline decoration-amber-400">{scrapedData.detectedOffer}</span></span>
                        </div>
                      )}
                      {scrapedData.headings && scrapedData.headings.length > 0 && (
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pt-0.5">
                          <span className="font-semibold">Detected Services: </span>
                          <span>{scrapedData.headings.join(' • ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Promotional Offers & Deals */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      Special Offer / Coupon Code (Optional)
                    </label>
                    {scrapedData?.detectedOffer && offers === scrapedData.detectedOffer && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-filled from Website
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={offers}
                    onChange={(e) => setOffers(e.target.value)}
                    placeholder="e.g. 20% discount on first booking or Free consultation"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>

                {/* Target Language */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-emerald-500" />
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  >
                    <option value="English">English</option>
                    <option value="Gujarati">ગુજરાતી (Gujarati)</option>
                    <option value="Hindi">हिन्दी (Hindi)</option>
                    <option value="Bilingual (English + Gujarati)">Bilingual (English + ગુજરાતી)</option>
                    <option value="Bilingual (English + Hindi)">Bilingual (English + हिन्दी)</option>
                    <option value="Hinglish">Hinglish (Conversational)</option>
                  </select>
                </div>

                {/* Custom Goal / Flow Prompt */}
                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>
                        Specific Bot Requirements / Conversational Steps <span className="text-rose-500 font-bold">*</span>
                      </span>
                    </label>
                    {scrapedData?.suggestedPrompt && prompt === scrapedData.suggestedPrompt && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-filled from Website Services
                      </span>
                    )}
                  </div>
                  <textarea
                    ref={promptInputRef}
                    rows={3}
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      if (promptError) setPromptError('');
                    }}
                    placeholder="Describe what your bot should do (e.g. greeting menu, showcase services, capture customer name & phone, book appointments)..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none resize-none ${
                      promptError
                        ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-slate-900 dark:text-white ring-2 ring-rose-500/20 dark:ring-rose-500/30 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/40'
                    }`}
                  />
                  {promptError && (
                    <p className="text-xs text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1.5 pt-0.5 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{promptError}</span>
                    </p>
                  )}
                </div>

              </div>

              {/* Generating Animation Overlay if Active */}
              {generating && (
                <div className="p-5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/80 space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" />
                    <div>
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-200 block">
                        AI Bot Builder is crafting your flow...
                      </span>
                      <span className="text-[11px] text-purple-700 dark:text-purple-400">
                        {generationStep === 1 && '1. Scanning website & extracting business services...'}
                        {generationStep === 2 && '2. Architecting conversational hierarchy & branching...'}
                        {generationStep === 3 && '3. Wiring interactive WhatsApp buttons & lead variables...'}
                        {generationStep === 4 && '4. Finalizing canvas coordinates & integrity checks...'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress Line */}
                  <div className="w-full h-1.5 bg-purple-200/70 dark:bg-purple-900/60 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-500" 
                      style={{ width: `${Math.min(generationStep * 25, 100)}%` }} 
                    />
                  </div>
                </div>
              )}

              {/* Generate Button Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-xs text-slate-400">
                  Powered by High-Speed Conversational LLM Engine
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 px-5 py-2.5 border border-purple-200/90 dark:border-purple-800/70 bg-gradient-to-b from-purple-50/70 via-white to-purple-50/30 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-600 text-purple-950 dark:text-purple-100 rounded-xl text-sm font-semibold transition-all duration-200 shadow-xs hover:shadow-sm active:scale-[0.98] disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin shrink-0" />
                        <span>Architecting Bot Flow...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>Generate Bot Flow with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
