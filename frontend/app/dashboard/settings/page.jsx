'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  User, Shield, Phone, Key, Smartphone, Loader2,
  CheckCircle2, AlertTriangle, Eye, EyeOff, Save, Link2,
  Lock, Settings, Copy, Check, Terminal, HeartPulse, RefreshCw, Info, HelpCircle,
  Globe, Wifi, Radio, Sliders, Server, MessageSquare, Facebook, Instagram, AlertCircle, XCircle,
  Sparkles, Bot, Zap, Cpu
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore, useConfirmStore } from '../../../lib/store';
import { formatDate, formatDateOnly } from '../../../lib/utils';
import Portal from '../../../components/Portal';

// Pre-defined premium SVG avatars
const AVATAR_OPTIONS = [
  { id: 'av1', label: 'Emerald Sage', bg: 'bg-emerald-500' },
  { id: 'av2', label: 'Teal Ocean', bg: 'bg-teal-500' },
  { id: 'av3', label: 'Indigo Sky', bg: 'bg-indigo-500' },
  { id: 'av4', label: 'Violet Dream', bg: 'bg-violet-500' },
  { id: 'av5', label: 'Rose Blush', bg: 'bg-rose-500' },
  { id: 'av6', label: 'Amber Sun', bg: 'bg-amber-500' },
];

export default function SettingsPage() {
  const confirm = useConfirmStore(state => state.confirm);
  const { user, checkAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile states
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Meta configuration and integration states
  const [metaConfig, setMetaConfig] = useState({
    whatsapp: {
      appId: '',
      appSecret: '',
      accessToken: '',
      phoneNumberId: '',
      wabaId: '',
      verifyToken: '',
      businessManagerId: '',
      status: 'disconnected',
      statusDetails: {}
    },
    facebook: {
      pageId: '',
      pageAccessToken: '',
      appId: '',
      appSecret: '',
      status: 'disconnected',
      statusDetails: {}
    },
    instagram: {
      accountId: '',
      accessToken: '',
      businessAccountId: '',
      status: 'disconnected',
      statusDetails: {}
    }
  });

  const [activeSubTab, setActiveSubTab] = useState('whatsapp');
  const [fetchingWa, setFetchingWa] = useState(false);
  const [savingWa, setSavingWa] = useState(false);

  const [testingConnection, setTestingConnection] = useState({ whatsapp: false, facebook: false, instagram: false });
  const [disconnectingConnection, setDisconnectingConnection] = useState({ whatsapp: false, facebook: false, instagram: false });
  const [waTokenLifespan, setWaTokenLifespan] = useState('permanent');

  // Phone registration states
  const [registeringPhone, setRegisteringPhone] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [regPin, setRegPin] = useState('');

  // Credential Visibility Toggles
  const [showWaToken, setShowWaToken] = useState(false);
  const [showWaSecret, setShowWaSecret] = useState(false);
  const [showFbToken, setShowFbToken] = useState(false);
  const [showFbSecret, setShowFbSecret] = useState(false);
  const [showIgToken, setShowIgToken] = useState(false);

  // API settings states
  const [apiKeyData, setApiKeyData] = useState(null);
  const [fetchingApiKey, setFetchingApiKey] = useState(false);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [revokingApiKey, setRevokingApiKey] = useState(false);
  const [rawNewKey, setRawNewKey] = useState(null); // to show raw key once
  const [copiedKey, setCopiedKey] = useState(false);
  const [apiScope, setApiScope] = useState('read');

  // 2FA setup states
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [setupStep, setSetupStep] = useState(1); // 1: Initial, 2: Setup, 3: Success
  const [generating2Fa, setGenerating2Fa] = useState(false);
  const [verifying2Fa, setVerifying2Fa] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Team Chat Settings
  const [roleColors, setRoleColors] = useState({
    admin: '#22c55e',
    manager: '#3b82f6',
    sales: '#f97316',
    support: '#a855f7',
    developer: '#ef4444',
    agent: '#64748b'
  });
  const [fetchingChatSettings, setFetchingChatSettings] = useState(false);
  const [savingChatSettings, setSavingChatSettings] = useState(false);

  const fetchChatSettings = async () => {
    setFetchingChatSettings(true);
    try {
      const { data } = await api.get('/team-chat/settings');
      if (data.success && data.data?.roleColors) {
        setRoleColors(prev => ({
          ...prev,
          ...data.data.roleColors
        }));
      }
    } catch (err) {
      console.error('Failed to load chat settings', err.message);
    } finally {
      setFetchingChatSettings(false);
    }
  };

  const handleSaveChatSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingChatSettings(true);
    try {
      const { data } = await api.put('/team-chat/settings', { roleColors });
      if (data.success) {
        toast.success('Team Chat role colors updated successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update chat settings');
    } finally {
      setSavingChatSettings(false);
    }
  };

  // AI Integration States (Groq, Gemini, OpenAI, Claude, DeepSeek, xAI, Mistral, Perplexity, OpenRouter, Cohere, Custom)
  const [aiConfig, setAiConfig] = useState({
    provider: 'groq',
    apiKey: '',
    apiKeys: {},
    customBaseUrl: '',
    model: 'llama-3.1-8b-instant',
    systemPrompt: '',
    temperature: 0.7,
    isEnabled: true,
    status: 'disconnected',
    statusDetails: {},
    isConfigured: false
  });
  const [fetchingAI, setFetchingAI] = useState(false);
  const [savingAI, setSavingAI] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);

  const PROVIDER_PRESETS = {
    groq: {
      name: 'Groq Cloud',
      tagline: 'Ultra-Fast WhatsApp Replies (Recommended ⚡)',
      models: [
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Recommended — Free & Fast)' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT' }
      ],
      placeholder: 'gsk_••••••••••••••••••••••••••••••••',
      helpUrl: 'https://console.groq.com/keys',
      helpText: 'Get your Groq API key from console.groq.com',
      badge: 'Lightning Fast'
    },
    gemini: {
      name: 'Google Gemini',
      tagline: 'Deep Reasoning & Multimodal Intelligence 🧠',
      models: [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast & Free Tier Recommended)' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen High Speed)' },
        { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B (Lightweight & Free)' }
      ],
      placeholder: 'AIzaSy••••••••••••••••••••••••••••••••',
      helpUrl: 'https://aistudio.google.com/app/apikey',
      helpText: 'Get your Gemini key from Google AI Studio',
      badge: 'Multimodal'
    },
    openai: {
      name: 'OpenAI',
      tagline: 'GPT-4o & GPT-4o-mini Multilingual Models 🌐',
      models: [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Cost-Effective & Smart)' },
        { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Legacy Standard)' }
      ],
      placeholder: 'sk-••••••••••••••••••••••••••••••••',
      helpUrl: 'https://platform.openai.com/api-keys',
      helpText: 'Get your OpenAI key from platform.openai.com',
      badge: 'Industry Standard'
    },
    anthropic: {
      name: 'Anthropic Claude',
      tagline: 'Claude 3.5 Sonnet & Haiku — Nuanced & Human-like 🎭',
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State-of-the-Art)' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (High Speed)' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Deep Analysis)' }
      ],
      placeholder: 'sk-ant-••••••••••••••••••••••••••••••••',
      helpUrl: 'https://console.anthropic.com/settings/keys',
      helpText: 'Get your Claude key from console.anthropic.com',
      badge: 'Human-like Chat'
    },
    deepseek: {
      name: 'DeepSeek',
      tagline: 'DeepSeek-V3 & DeepSeek-R1 (High Performance & Affordable 🚀)',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek-V3 (deepseek-chat)' },
        { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (deepseek-reasoner)' }
      ],
      placeholder: 'sk-••••••••••••••••••••••••••••••••',
      helpUrl: 'https://platform.deepseek.com/api_keys',
      helpText: 'Get your DeepSeek key from platform.deepseek.com',
      badge: 'Trending & Smart'
    },
    xai: {
      name: 'xAI (Grok)',
      tagline: 'Elon Musk\'s Grok-2 Real-Time Intelligence 🤖',
      models: [
        { id: 'grok-2-latest', name: 'Grok-2 Latest' },
        { id: 'grok-2-vision-latest', name: 'Grok-2 Vision' },
        { id: 'grok-beta', name: 'Grok Beta' }
      ],
      placeholder: 'xai-••••••••••••••••••••••••••••••••',
      helpUrl: 'https://console.x.ai',
      helpText: 'Get your Grok API key from console.x.ai',
      badge: 'Real-Time'
    },
    mistral: {
      name: 'Mistral AI',
      tagline: 'European Open-Weight Leader (Mistral Large & Codestral 🌊)',
      models: [
        { id: 'mistral-large-latest', name: 'Mistral Large' },
        { id: 'mistral-small-latest', name: 'Mistral Small' },
        { id: 'codestral-latest', name: 'Codestral' }
      ],
      placeholder: '••••••••••••••••••••••••••••••••',
      helpUrl: 'https://console.mistral.ai/api-keys',
      helpText: 'Get your Mistral key from console.mistral.ai',
      badge: 'Open Weights'
    },
    perplexity: {
      name: 'Perplexity AI',
      tagline: 'Live Web-Augmented Real-Time Search & Sonar Models 🔍',
      models: [
        { id: 'sonar', name: 'Sonar (Search Powered)' },
        { id: 'sonar-pro', name: 'Sonar Pro' },
        { id: 'sonar-reasoning', name: 'Sonar Reasoning' }
      ],
      placeholder: 'pplx-••••••••••••••••••••••••••••••••',
      helpUrl: 'https://www.perplexity.ai/settings/api',
      helpText: 'Get your Perplexity key from perplexity.ai/settings/api',
      badge: 'Web Grounded'
    },
    openrouter: {
      name: 'OpenRouter',
      tagline: 'Universal Gateway — Access 200+ Models with One Key 🔌',
      models: [
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
        { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' }
      ],
      placeholder: 'sk-or-••••••••••••••••••••••••••••••••',
      helpUrl: 'https://openrouter.ai/keys',
      helpText: 'Get your OpenRouter key from openrouter.ai/keys',
      badge: '200+ Models'
    },
    cohere: {
      name: 'Cohere',
      tagline: 'Enterprise Multilingual & RAG Specialists 🧭',
      models: [
        { id: 'command-r-plus-08-2024', name: 'Command R+' },
        { id: 'command-r-08-2024', name: 'Command R' }
      ],
      placeholder: '••••••••••••••••••••••••••••••••',
      helpUrl: 'https://dashboard.cohere.com/api-keys',
      helpText: 'Get your Cohere key from dashboard.cohere.com',
      badge: 'Enterprise'
    },
    custom: {
      name: 'Custom / Self-Hosted',
      tagline: 'Connect Ollama, vLLM, LM Studio, or Private OpenAI API 💻',
      models: [
        { id: 'default', name: 'Default Model' },
        { id: 'llama3', name: 'Llama 3 (Local)' },
        { id: 'mistral', name: 'Mistral (Local)' }
      ],
      placeholder: 'Bearer token or API Key (Optional)',
      helpUrl: 'https://ollama.com',
      helpText: 'Local AI: Ollama running on localhost:11434/v1',
      badge: 'Self-Hosted'
    }
  };

  const fetchAIConfig = async () => {
    setFetchingAI(true);
    try {
      const { data } = await api.get('/settings/integrations/ai');
      if (data.success && data.data) {
        const d = data.data;
        const currentProv = d.provider || 'groq';
        const keyForProv = d.apiKeys?.[currentProv] || '';
        setAiConfig(prev => ({
          ...prev,
          ...d,
          provider: currentProv,
          apiKey: keyForProv,
          model: d.model || PROVIDER_PRESETS[currentProv]?.models[0]?.id || ''
        }));
      }
    } catch (err) {
      console.error('Failed to load AI configuration', err.message);
    } finally {
      setFetchingAI(false);
    }
  };

  const handleSelectProvider = (provKey) => {
    const prov = PROVIDER_PRESETS[provKey];
    const keyForProv = aiConfig.apiKeys?.[provKey] || '';
    const defaultModel = prov?.models[0]?.id || '';
    setAiConfig(prev => ({
      ...prev,
      provider: provKey,
      apiKey: keyForProv,
      model: defaultModel
    }));
  };

  const handleSaveAI = async (e) => {
    if (e) e.preventDefault();
    setSavingAI(true);
    try {
      const { data } = await api.post('/settings/integrations/ai', {
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        customBaseUrl: aiConfig.customBaseUrl,
        model: aiConfig.model,
        systemPrompt: aiConfig.systemPrompt,
        temperature: aiConfig.temperature,
        isEnabled: aiConfig.isEnabled
      });
      if (data.success) {
        toast.success('AI Integration settings saved successfully!');
        fetchAIConfig();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save AI configuration');
    } finally {
      setSavingAI(false);
    }
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    const providerName = (PROVIDER_PRESETS[aiConfig.provider]?.name || aiConfig.provider).toUpperCase();
    const toastId = toast.loading(`Verifying ${providerName} connection...`);
    try {
      // Auto-save active configuration before testing
      await api.post('/settings/integrations/ai', {
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        customBaseUrl: aiConfig.customBaseUrl,
        model: aiConfig.model,
        systemPrompt: aiConfig.systemPrompt,
        temperature: aiConfig.temperature,
        isEnabled: aiConfig.isEnabled
      });

      const { data } = await api.post('/settings/integrations/ai/test', {
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        customBaseUrl: aiConfig.customBaseUrl,
        model: aiConfig.model
      });

      if (data.success) {
        toast.success(data.message || `${providerName} connected successfully!`, { id: toastId });
        if (data.data?.model) {
          setAiConfig(prev => ({ ...prev, model: data.data.model }));
        }
        fetchAIConfig();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || `Verification failed for ${providerName}`;
      toast.error(errorMsg, { id: toastId });
      fetchAIConfig();
    } finally {
      setTestingAI(false);
    }
  };
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileAvatar(user.avatar || 'av1');
    }
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && metaConfig.whatsapp.phoneNumberId) {
      const stored = localStorage.getItem(`wa_lifespan_${metaConfig.whatsapp.phoneNumberId}`);
      if (stored) {
        setWaTokenLifespan(stored);
      } else {
        setWaTokenLifespan('permanent');
      }
    }
  }, [metaConfig.whatsapp.phoneNumberId]);

  // Load Meta Integrations Config
  const fetchMetaConfig = async () => {
    setFetchingWa(true);
    try {
      const { data } = await api.get('/settings/integrations/meta');
      if (data.success && data.data) {
        const config = data.data;
        const defaults = {
          whatsapp: { appId: '', appSecret: '', accessToken: '', phoneNumberId: '', wabaId: '', verifyToken: '', businessManagerId: '', status: 'disconnected', statusDetails: {}, ...config.whatsapp },
          facebook: { pageId: '', pageAccessToken: '', appId: '', appSecret: '', status: 'disconnected', statusDetails: {}, ...config.facebook },
          instagram: { accountId: '', accessToken: '', businessAccountId: '', status: 'disconnected', statusDetails: {}, ...config.instagram }
        };
        setMetaConfig(defaults);
      }
    } catch (err) {
      toast.error('Failed to load Meta integration credentials');
    } finally {
      setFetchingWa(false);
    }
  };



  const handleSaveMeta = async (e) => {
    if (e) e.preventDefault();
    setSavingWa(true);
    try {
      const { data } = await api.post('/settings/integrations/meta', metaConfig);
      if (data.success) {
        toast.success('Meta integration credentials updated successfully!');
        fetchMetaConfig();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save Meta configurations');
    } finally {
      setSavingWa(false);
    }
  };

  const handleTestConnection = async (type) => {
    setTestingConnection(prev => ({ ...prev, [type]: true }));
    try {
      // Auto-save active configuration before testing to catch new credential inputs
      await api.post('/settings/integrations/meta', metaConfig);
      
      const { data } = await api.post('/settings/integrations/meta/test', { type });
      if (data.success) {
        toast.success(`Verification Successful! ${type.toUpperCase()} integration connected.`);
        fetchMetaConfig();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || `Verification failed for ${type.toUpperCase()}`;
      toast.error(errorMsg);
      fetchMetaConfig();
    } finally {
      setTestingConnection(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleDisconnectConnection = async (type) => {
    if (!await confirm(`Are you sure you want to disconnect your active ${type.toUpperCase()} integration? This will suspend all real-time operations, but your saved credentials will remain intact.`)) {
      return;
    }
    setDisconnectingConnection(prev => ({ ...prev, [type]: true }));
    try {
      const { data } = await api.post('/settings/integrations/meta/disconnect', { type });
      if (data.success) {
        toast.success(`${type.toUpperCase()} integration disconnected successfully!`);
        fetchMetaConfig();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || `Failed to disconnect ${type.toUpperCase()}`;
      toast.error(errorMsg);
    } finally {
      setDisconnectingConnection(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleRegisterPhone = async (e) => {
    if (e) e.preventDefault();
    if (!regPin.trim() || regPin.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit PIN.');
      return;
    }

    setRegisteringPhone(true);
    const toastId = toast.loading('Registering phone number with Meta Cloud API...');
    try {
      // Auto-save active configuration before registering
      await api.post('/settings/integrations/meta', metaConfig);

      const { data } = await api.post('/settings/integrations/meta/register-phone', {
        phoneNumberId: metaConfig.whatsapp.phoneNumberId,
        pin: regPin.trim()
      });

      if (data.success) {
        toast.success('WhatsApp number registered successfully!', { id: toastId });
        setShowRegModal(false);
        setRegPin('');
        fetchMetaConfig();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Registration failed. Please verify your PIN and Meta credentials.';
      toast.error(errorMsg, { id: toastId });
    } finally {
      setRegisteringPhone(false);
    }
  };

  // Fetch API key details
  const fetchApiKeyDetails = async () => {
    setFetchingApiKey(true);
    try {
      const { data } = await api.get('/auth/api-key');
      if (data.success) {
        setApiKeyData(data.data);
      }
    } catch (err) {
      console.error('Failed to load API keys');
    } finally {
      setFetchingApiKey(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'meta-integrations') {
      fetchMetaConfig();
    }
    if (activeTab === 'ai-integration') {
      fetchAIConfig();
    }
    if (activeTab === 'api-settings') {
      fetchApiKeyDetails();
    }
    if (activeTab === 'team-chat') {
      fetchChatSettings();
    }
  }, [activeTab]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName) return toast.error('Name cannot be empty');
    setUpdatingProfile(true);
    try {
      const { data } = await api.put('/auth/profile', {
        name: profileName,
        avatar: profileAvatar
      });
      if (data.success) {
        toast.success('Profile details updated successfully');
        await checkAuth();
      }
    } catch (err) {
      toast.error('Failed to save profile changes');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleGenerateApiKey = async () => {
    setGeneratingApiKey(true);
    try {
      const { data } = await api.post('/auth/api-key', { scope: apiScope });
      if (data.success) {
        setRawNewKey(data.data.apiKey);
        toast.success('New API Key generated!');
        fetchApiKeyDetails();
      }
    } catch (err) {
      toast.error('Failed to generate API Key');
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!await confirm('Are you sure you want to revoke your developer API Key? External integrations will lose access.')) return;
    setRevokingApiKey(true);
    try {
      const { data } = await api.delete('/auth/api-key');
      if (data.success) {
        toast.success('API Key revoked successfully');
        setRawNewKey(null);
        fetchApiKeyDetails();
      }
    } catch (err) {
      toast.error('Failed to revoke API Key');
    } finally {
      setRevokingApiKey(false);
    }
  };

  const handleInitiate2Fa = async () => {
    setGenerating2Fa(true);
    try {
      const { data } = await api.post('/auth/setup-2fa');
      if (data.success) {
        setQrCode(data.data.qrCode);
        setSecret(data.data.secret);
        setSetupStep(2);
        toast.success('Scan the QR code to proceed');
      }
    } catch (err) {
      toast.error('Failed to generate 2FA token');
    } finally {
      setGenerating2Fa(false);
    }
  };

  const handleVerify2Fa = async (e) => {
    e.preventDefault();
    if (!verificationCode) return toast.error('Enter verification code');
    setVerifying2Fa(true);
    try {
      const { data } = await api.post('/auth/enable-2fa', { code: verificationCode });
      if (data.success) {
        toast.success(data.message || '2FA enabled successfully!');
        setSetupStep(3);
        await checkAuth();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid authentication code');
    } finally {
      setVerifying2Fa(false);
    }
  };

  const copyToClipboard = (text, setCopiedState) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedState(false), 2000);
  };

  const isWaConnected = metaConfig.whatsapp?.phoneNumberId && metaConfig.whatsapp?.accessToken;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-2">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
          <Settings className="w-5 h-5 text-wa-green" /> Console Settings
        </h2>
        <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
          Configure user accounts, link WABA business accounts, manage API keys, and review developers documentation.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-wa-border dark:border-wa-dark-border overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
            activeTab === 'profile'
              ? 'border-wa-green text-wa-green font-bold'
              : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span>My Profile</span>
        </button>

        {['admin', 'owner', 'superadmin'].includes(user?.role) && (
          <button
            onClick={() => {
              setActiveTab('meta-integrations');
              fetchMetaConfig();
            }}
            className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
              activeTab === 'meta-integrations'
                ? 'border-wa-green text-wa-green font-bold'
                : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Meta Integrations</span>
          </button>
        )}

        {['admin', 'owner', 'superadmin'].includes(user?.role) && (
          <button
            onClick={() => {
              setActiveTab('ai-integration');
              fetchAIConfig();
            }}
            className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
              activeTab === 'ai-integration'
                ? 'border-wa-green text-wa-green font-bold'
                : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Integration</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('api-settings')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
            activeTab === 'api-settings'
              ? 'border-wa-green text-wa-green font-bold'
              : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('api-docs')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
            activeTab === 'api-docs'
              ? 'border-wa-green text-wa-green font-bold'
              : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>API Docs</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
            activeTab === 'security'
              ? 'border-wa-green text-wa-green font-bold'
              : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Two-Factor Lock</span>
        </button>

        {['admin', 'owner', 'superadmin'].includes(user?.role) && (
          <button
            onClick={() => setActiveTab('team-chat')}
            className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-all duration-200 ${
              activeTab === 'team-chat'
                ? 'border-wa-green text-wa-green font-bold'
                : 'border-transparent text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Team Chat Settings</span>
          </button>
        )}
      </div>

      {/* Tab Contents: PROFILE */}
      {activeTab === 'profile' && user && (
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 space-y-6 shadow-sm animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">Profile Preferences</h3>
            <p className="text-xs text-wa-text-secondary mt-0.5">Update display details and select your personal theme avatar.</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-md">
            <div>
              <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Profile Name</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-2">Select Avatar Concept</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {AVATAR_OPTIONS.map((av) => {
                  const isSelected = profileAvatar === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setProfileAvatar(av.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-wa-green bg-wa-green/5'
                          : 'border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-header/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full ${av.bg} text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm`}>
                        {profileName[0] || 'U'}
                      </div>
                      <span className="text-[9px] font-semibold text-wa-text-secondary mt-1.5 truncate max-w-full">
                        {av.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-wa-text-secondary mb-1.5">Email Address</label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-secondary/65 dark:text-wa-dark-text-secondary/65 cursor-not-allowed select-none font-mono"
              />
              <p className="text-[10px] text-wa-text-secondary mt-1">To change login email, please contact a console administrator.</p>
            </div>

            <button
              type="submit"
              disabled={updatingProfile}
              className="flex items-center gap-2 px-5 py-2.5 text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl text-xs font-semibold shadow-md transition-all duration-200"
            >
              {updatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Profile Details</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab Contents: META INTEGRATIONS DASHBOARD & FORMS */}
      {activeTab === 'meta-integrations' && user?.role === 'admin' && (
        <div className="space-y-6 animate-fade-in">
          {/* Health Diagnostics / Alerts Banner */}
          {metaConfig.whatsapp?.status === 'error' && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl flex items-start gap-3 text-xs text-red-700 dark:text-red-400 animate-pulse shadow-sm">
              <XCircle className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-bold">WhatsApp connection lost.</span>
                <p className="mt-0.5">{metaConfig.whatsapp.statusDetails?.errorReason || 'Please verify your permanent access token, Verify Token, and App Configurations.'}</p>
              </div>
            </div>
          )}

          {/* 1. Integration Dashboard Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* WhatsApp Integration Card */}
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-wa-green/10 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    metaConfig.whatsapp?.status === 'connected' ? 'bg-wa-green animate-pulse' :
                    metaConfig.whatsapp?.status === 'error' ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary">
                    {metaConfig.whatsapp?.status === 'connected' ? '🟢 Connected' :
                     metaConfig.whatsapp?.status === 'error' ? '🔴 Connection Failed' : '⚪ Disconnected'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-wa-text-primary dark:text-white">WhatsApp Cloud API</h4>
                <p className="text-[10px] text-wa-text-secondary leading-none">
                  {metaConfig.whatsapp?.statusDetails?.displayName || 'Not Configured'}
                </p>
              </div>
              <div className="border-t border-wa-border/50 dark:border-wa-dark-border/50 pt-3 text-[10px] text-wa-text-secondary space-y-1.5">
                <p className="flex justify-between"><span>Phone Number ID:</span> <span className="font-mono font-semibold text-wa-text-primary dark:text-white truncate max-w-[130px]">{metaConfig.whatsapp?.phoneNumberId || '—'}</span></p>
                <p className="flex justify-between"><span>WABA ID:</span> <span className="font-mono font-semibold text-wa-text-primary dark:text-white truncate max-w-[130px]">{metaConfig.whatsapp?.wabaId || '—'}</span></p>
                <p className="flex justify-between"><span>Last Sync:</span> <span className="font-semibold text-wa-text-primary dark:text-white">{metaConfig.whatsapp?.statusDetails?.lastVerified ? formatDate(metaConfig.whatsapp.statusDetails.lastVerified) : 'Never'}</span></p>
              </div>
            </div>

            {/* Facebook Integration Card */}
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                  <Facebook className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    metaConfig.facebook?.status === 'connected' ? 'bg-wa-green animate-pulse' :
                    metaConfig.facebook?.status === 'error' ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary">
                    {metaConfig.facebook?.status === 'connected' ? '🟢 Connected' :
                     metaConfig.facebook?.status === 'error' ? '🔴 Connection Failed' : '⚪ Disconnected'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-wa-text-primary dark:text-white">Facebook Messenger</h4>
                <p className="text-[10px] text-wa-text-secondary leading-none">
                  {metaConfig.facebook?.statusDetails?.pageName || 'Not Configured'}
                </p>
              </div>
              <div className="border-t border-wa-border/50 dark:border-wa-dark-border/50 pt-3 text-[10px] text-wa-text-secondary space-y-1.5">
                <p className="flex justify-between"><span>Page ID:</span> <span className="font-mono font-semibold text-wa-text-primary dark:text-white truncate max-w-[130px]">{metaConfig.facebook?.pageId || '—'}</span></p>
                <p className="flex justify-between"><span>App ID:</span> <span className="font-mono font-semibold text-wa-text-primary dark:text-white truncate max-w-[130px]">{metaConfig.facebook?.appId || '—'}</span></p>
                <p className="flex justify-between"><span>Last Sync:</span> <span className="font-semibold text-wa-text-primary dark:text-white">{metaConfig.facebook?.statusDetails?.lastVerified ? formatDate(metaConfig.facebook.statusDetails.lastVerified) : 'Never'}</span></p>
              </div>
            </div>

            {/* Instagram Integration Card */}
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-pink-500/10 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-pink-500/10 text-pink-500 rounded-xl flex items-center justify-center shrink-0">
                  <Instagram className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    metaConfig.instagram?.status === 'connected' ? 'bg-wa-green animate-pulse' :
                    metaConfig.instagram?.status === 'error' ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-wa-text-secondary">
                    {metaConfig.instagram?.status === 'connected' ? '🟢 Connected' :
                     metaConfig.instagram?.status === 'error' ? '🔴 Connection Failed' : '⚪ Disconnected'}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-wa-text-primary dark:text-white">Instagram Direct</h4>
                <p className="text-[10px] text-wa-text-secondary leading-none">
                  {metaConfig.instagram?.statusDetails?.accountName || 'Not Configured'}
                </p>
              </div>
              <div className="border-t border-wa-border/50 dark:border-wa-dark-border/50 pt-3 text-[10px] text-wa-text-secondary space-y-1.5">
                <p className="flex justify-between"><span>Account ID:</span> <span className="font-mono font-semibold text-wa-text-primary dark:text-white truncate max-w-[130px]">{metaConfig.instagram?.accountId || '—'}</span></p>
                <p className="flex justify-between"><span>Business ID:</span> <span className="font-mono font-semibold text-wa-text-primary dark:text-white truncate max-w-[130px]">{metaConfig.instagram?.businessAccountId || '—'}</span></p>
                <p className="flex justify-between"><span>Last Sync:</span> <span className="font-semibold text-wa-text-primary dark:text-white">{metaConfig.instagram?.statusDetails?.lastVerified ? formatDate(metaConfig.instagram.statusDetails.lastVerified) : 'Never'}</span></p>
              </div>
            </div>
          </div>

          {/* 2. Main Configuration Panel */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            {/* Sub Tabs Headers */}
            <div className="flex border-b border-wa-border dark:border-wa-dark-border bg-wa-bg dark:bg-wa-dark-header/45">
              <button
                type="button"
                onClick={() => setActiveSubTab('whatsapp')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeSubTab === 'whatsapp' ? 'border-wa-green text-wa-green bg-white dark:bg-wa-dark-panel' : 'border-transparent text-wa-text-secondary hover:text-wa-text-primary'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp Cloud API</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('facebook')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeSubTab === 'facebook' ? 'border-wa-green text-wa-green bg-white dark:bg-wa-dark-panel' : 'border-transparent text-wa-text-secondary hover:text-wa-text-primary'
                }`}
              >
                <Facebook className="w-3.5 h-3.5" />
                <span>Facebook Integration</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('instagram')}
                className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeSubTab === 'instagram' ? 'border-wa-green text-wa-green bg-white dark:bg-wa-dark-panel' : 'border-transparent text-wa-text-secondary hover:text-wa-text-primary'
                }`}
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>Instagram Integration</span>
              </button>
            </div>

            {/* Sub Tab Panel Form */}
            <div className="p-6 space-y-6">
              {fetchingWa ? (
                <div className="flex items-center justify-center py-12 gap-2 text-xs text-wa-text-secondary">
                  <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                  <span>Fetching Meta configuration database records...</span>
                </div>
              ) : (
                <form onSubmit={handleSaveMeta} className="space-y-6">
                  {/* WHATSAPP SUBTAB */}
                  {activeSubTab === 'whatsapp' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Meta App ID *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 10987654321098"
                            value={metaConfig.whatsapp.appId}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              whatsapp: { ...metaConfig.whatsapp, appId: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Meta App Secret *</label>
                          <div className="relative">
                            <input
                              type={showWaSecret ? "text" : "password"}
                              required
                              placeholder="App Secret from developer portal"
                              value={metaConfig.whatsapp.appSecret}
                              onChange={(e) => setMetaConfig({
                                ...metaConfig,
                                whatsapp: { ...metaConfig.whatsapp, appSecret: e.target.value }
                              })}
                              className="w-full pl-4 pr-10 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowWaSecret(!showWaSecret)}
                              className="absolute right-3 top-3.5 text-wa-text-secondary hover:text-wa-text-primary"
                            >
                              {showWaSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Phone Number ID *</label>
                          <input
                            type="text"
                            required
                            placeholder="15-digit Meta Phone ID"
                            value={metaConfig.whatsapp.phoneNumberId}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              whatsapp: { ...metaConfig.whatsapp, phoneNumberId: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">WhatsApp Business Account ID (WABA ID) *</label>
                          <input
                            type="text"
                            required
                            placeholder="15-digit Meta WABA ID"
                            value={metaConfig.whatsapp.wabaId}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              whatsapp: { ...metaConfig.whatsapp, wabaId: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Meta Permanent Access Token *</label>
                        <div className="relative">
                          <input
                            type={showWaToken ? "text" : "password"}
                            required
                            placeholder="EAABw..."
                            value={metaConfig.whatsapp.accessToken}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              whatsapp: { ...metaConfig.whatsapp, accessToken: e.target.value }
                            })}
                            className="w-full pl-4 pr-10 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowWaToken(!showWaToken)}
                            className="absolute right-3 top-3.5 text-wa-text-secondary hover:text-wa-text-primary"
                          >
                            {showWaToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Webhook Verify Token *</label>
                          <input
                            type="text"
                            required
                            placeholder="Enter verify token for Meta webhook setup"
                            value={metaConfig.whatsapp.verifyToken}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              whatsapp: { ...metaConfig.whatsapp, verifyToken: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Business Manager ID (Optional)</label>
                          <input
                            type="text"
                            placeholder="Meta Business ID"
                            value={metaConfig.whatsapp.businessManagerId}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              whatsapp: { ...metaConfig.whatsapp, businessManagerId: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                      </div>

                      {metaConfig.whatsapp.statusDetails?.businessName && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/35 border border-wa-border dark:border-wa-dark-border space-y-3 text-xs text-wa-text-secondary animate-fade-in">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 leading-relaxed">
                            <p>Business Account: <span className="font-bold text-wa-text-primary dark:text-white">{metaConfig.whatsapp.statusDetails.businessName}</span></p>
                            <p>Display Name: <span className="font-bold text-wa-text-primary dark:text-white">{metaConfig.whatsapp.statusDetails.displayName}</span></p>
                            <p>Connected Phone: <span className="font-mono font-bold text-wa-text-primary dark:text-white">{metaConfig.whatsapp.statusDetails.phoneNumber}</span></p>
                            <p>Token Status: <span className="font-bold text-wa-green">{metaConfig.whatsapp.statusDetails.tokenStatus}</span></p>
                          </div>
                          
                          {/* Token Expiration and Guide Details */}
                          <div className="border-t border-wa-border/50 dark:border-wa-dark-border/50 pt-3.5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-extrabold tracking-wider text-wa-text-secondary">Token Lifespan:</span>
                                {metaConfig.whatsapp.accessToken?.trim().startsWith('mock') || metaConfig.whatsapp.accessToken?.trim().startsWith('demo') ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1 animate-pulse">
                                    🧪 Sandbox Mock (Infinite / Dev Only)
                                  </span>
                                ) : waTokenLifespan === 'permanent' ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                    ♾️ Permanent (Lifetime / Never Expires)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 flex items-center gap-1">
                                    ⏱️ Temporary (Expires in 24 Hours)
                                  </span>
                                )}
                              </div>

                              {/* Segmented Toggle Control */}
                              {!(metaConfig.whatsapp.accessToken?.trim().startsWith('mock') || metaConfig.whatsapp.accessToken?.trim().startsWith('demo')) && (
                                <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-wa-border/30 dark:border-wa-dark-border/30 self-start sm:self-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWaTokenLifespan('permanent');
                                      if (typeof window !== 'undefined' && metaConfig.whatsapp.phoneNumberId) {
                                        localStorage.setItem(`wa_lifespan_${metaConfig.whatsapp.phoneNumberId}`, 'permanent');
                                      }
                                      toast.success('Lifespan status set to Permanent!');
                                    }}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                                      waTokenLifespan === 'permanent'
                                        ? 'bg-white dark:bg-wa-dark-panel text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                                        : 'text-wa-text-secondary hover:text-wa-text-primary'
                                    }`}
                                  >
                                    ♾️ Permanent
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWaTokenLifespan('temporary');
                                      if (typeof window !== 'undefined' && metaConfig.whatsapp.phoneNumberId) {
                                        localStorage.setItem(`wa_lifespan_${metaConfig.whatsapp.phoneNumberId}`, 'temporary');
                                      }
                                      toast.success('Lifespan status set to Temporary!');
                                    }}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                                      waTokenLifespan === 'temporary'
                                        ? 'bg-white dark:bg-wa-dark-panel text-amber-600 dark:text-amber-500 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                                        : 'text-wa-text-secondary hover:text-wa-text-primary'
                                    }`}
                                  >
                                    ⏱️ Temporary
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Dynamic descriptive message */}
                            {!(metaConfig.whatsapp.accessToken?.trim().startsWith('mock') || metaConfig.whatsapp.accessToken?.trim().startsWith('demo')) && (
                              <div>
                                {waTokenLifespan === 'temporary' ? (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium leading-normal flex items-start gap-1.5 bg-amber-500/5 dark:bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 animate-fade-in">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                                    <span>Temporary developer sandbox tokens expire every 24 hours. For commercial or reliable long-term operations, please replace this with a permanent System User token.</span>
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-normal flex items-start gap-1.5 bg-emerald-500/5 dark:bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 animate-fade-in">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Permanent System User token is connected. This token has no expiration date, ensuring lifetime messaging connectivity for this business account.</span>
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Webhook Configuration Helper Card */}
                      <div className="p-5 rounded-2xl bg-gradient-to-r from-wa-green/5 to-emerald-500/5 dark:from-wa-green/10 dark:to-emerald-500/10 border border-wa-green/20 dark:border-wa-green/35 space-y-4">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-wa-green animate-pulse" />
                          <h4 className="text-xs font-bold text-wa-text-primary dark:text-white uppercase tracking-wider">
                            Meta Webhook Configuration Setup
                          </h4>
                        </div>
                        <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed">
                          To receive real-time customer messages in this system, configure the Callback URL and Verify Token in your <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-wa-green hover:underline font-semibold inline-flex items-center gap-0.5">Meta Developer Console <Link2 className="w-2.5 h-2.5" /></a> under <strong>WhatsApp &gt; Configuration</strong>:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-wa-text-secondary mb-1 tracking-wider">
                              1. Callback URL
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhook` : 'https://meddlesome-wintrier-kiersten.ngrok-free.dev/api/webhook'}
                                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none font-mono select-all overflow-ellipsis"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const url = typeof window !== 'undefined' ? `${window.location.origin}/api/webhook` : 'https://meddlesome-wintrier-kiersten.ngrok-free.dev/api/webhook';
                                  navigator.clipboard.writeText(url);
                                  toast.success('Callback URL copied to clipboard!');
                                }}
                                className="px-3 py-2 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-hover rounded-xl text-wa-text-secondary hover:text-wa-green transition-all"
                                title="Copy Callback URL"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-wa-text-secondary mb-1 tracking-wider">
                              2. Verify Token
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={metaConfig.whatsapp.verifyToken || 'myverifytoken123'}
                                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none font-mono select-all overflow-ellipsis"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const token = metaConfig.whatsapp.verifyToken || 'myverifytoken123';
                                  navigator.clipboard.writeText(token);
                                  toast.success('Verify Token copied to clipboard!');
                                }}
                                className="px-3 py-2 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-hover rounded-xl text-wa-text-secondary hover:text-wa-green transition-all"
                                title="Copy Verify Token"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 leading-normal flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>
                            <strong>Note:</strong> When you update your ngrok tunnel, this <strong>Callback URL</strong> will change automatically. Ensure you copy the updated URL to Meta for local development to keep receiving webhook messages.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FACEBOOK SUBTAB */}
                  {activeSubTab === 'facebook' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Facebook Page ID *</label>
                          <input
                            type="text"
                            required
                            placeholder="Page ID from Facebook settings"
                            value={metaConfig.facebook.pageId}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              facebook: { ...metaConfig.facebook, pageId: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Facebook App ID *</label>
                          <input
                            type="text"
                            required
                            placeholder="Facebook App ID"
                            value={metaConfig.facebook.appId}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              facebook: { ...metaConfig.facebook, appId: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Facebook App Secret *</label>
                          <div className="relative">
                            <input
                              type={showFbSecret ? "text" : "password"}
                              required
                              placeholder="App Secret from developer console"
                              value={metaConfig.facebook.appSecret}
                              onChange={(e) => setMetaConfig({
                                ...metaConfig,
                                facebook: { ...metaConfig.facebook, appSecret: e.target.value }
                              })}
                              className="w-full pl-4 pr-10 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowFbSecret(!showFbSecret)}
                              className="absolute right-3 top-3.5 text-wa-text-secondary hover:text-wa-text-primary"
                            >
                              {showFbSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Page Access Token *</label>
                          <div className="relative">
                            <input
                              type={showFbToken ? "text" : "password"}
                              required
                              placeholder="Page Token EAACw..."
                              value={metaConfig.facebook.pageAccessToken}
                              onChange={(e) => setMetaConfig({
                                ...metaConfig,
                                facebook: { ...metaConfig.facebook, pageAccessToken: e.target.value }
                              })}
                              className="w-full pl-4 pr-10 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowFbToken(!showFbToken)}
                              className="absolute right-3 top-3.5 text-wa-text-secondary hover:text-wa-text-primary"
                            >
                              {showFbToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {metaConfig.facebook.statusDetails?.pageName && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/35 border border-wa-border dark:border-wa-dark-border text-xs leading-relaxed text-wa-text-secondary">
                          <p>Verified Facebook Page: <span className="font-bold text-wa-text-primary dark:text-white">{metaConfig.facebook.statusDetails.pageName}</span></p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* INSTAGRAM SUBTAB */}
                  {activeSubTab === 'instagram' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Instagram Account ID *</label>
                          <input
                            type="text"
                            required
                            placeholder="Instagram Profile ID"
                            value={metaConfig.instagram.accountId}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              instagram: { ...metaConfig.instagram, accountId: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Instagram Business Account ID *</label>
                          <input
                            type="text"
                            required
                            placeholder="Professional Meta Account ID"
                            value={metaConfig.instagram.businessAccountId}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              instagram: { ...metaConfig.instagram, businessAccountId: e.target.value }
                            })}
                            className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary mb-1">Instagram Access Token *</label>
                        <div className="relative">
                          <input
                            type={showIgToken ? "text" : "password"}
                            required
                            placeholder="Instagram Token EAACw..."
                            value={metaConfig.instagram.accessToken}
                            onChange={(e) => setMetaConfig({
                              ...metaConfig,
                              instagram: { ...metaConfig.instagram, accessToken: e.target.value }
                            })}
                            className="w-full pl-4 pr-10 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowIgToken(!showIgToken)}
                            className="absolute right-3 top-3.5 text-wa-text-secondary hover:text-wa-text-primary"
                          >
                            {showIgToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {metaConfig.instagram.statusDetails?.accountName && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/35 border border-wa-border dark:border-wa-dark-border text-xs leading-relaxed text-wa-text-secondary">
                          <p>Verified Instagram Handle: <span className="font-bold text-wa-text-primary dark:text-white">@{metaConfig.instagram.statusDetails.accountName}</span></p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 border-t border-wa-border dark:border-wa-dark-border pt-4">
                    <button
                      type="submit"
                      disabled={savingWa}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl text-xs font-semibold shadow-md transition-all duration-200 w-full sm:w-auto"
                    >
                      {savingWa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Save Credentials</span>
                    </button>

                    <button
                      type="button"
                      disabled={testingConnection[activeSubTab]}
                      onClick={() => handleTestConnection(activeSubTab)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 text-wa-text-primary dark:text-white border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-hover disabled:opacity-50 rounded-xl text-xs font-semibold transition-all duration-200 w-full sm:w-auto"
                    >
                      {testingConnection[activeSubTab] ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-wa-green" />
                          <span>Testing Connection...</span>
                        </>
                      ) : (
                        <>
                          <Wifi className="w-4 h-4 text-wa-green" />
                          <span>Verify Meta Connection</span>
                        </>
                      )}
                    </button>

                    {activeSubTab === 'whatsapp' && (
                      <button
                        type="button"
                        onClick={() => setShowRegModal(true)}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 text-wa-text-primary dark:text-white border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-hover rounded-xl text-xs font-semibold transition-all duration-200 w-full sm:w-auto"
                      >
                        <Smartphone className="w-4 h-4 text-emerald-500" />
                        <span>Register Phone ID</span>
                      </button>
                    )}

                    {metaConfig[activeSubTab]?.status && metaConfig[activeSubTab]?.status !== 'disconnected' && (
                      <button
                        type="button"
                        disabled={disconnectingConnection[activeSubTab]}
                        onClick={() => handleDisconnectConnection(activeSubTab)}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 w-full sm:w-auto"
                      >
                        {disconnectingConnection[activeSubTab] ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                            <span>Disconnecting...</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-rose-500" />
                            <span>Disconnect Integration</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: AI INTEGRATION DASHBOARD & CONFIGURATION */}
      {activeTab === 'ai-integration' && ['admin', 'owner', 'superadmin'].includes(user?.role) && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Status & Overview Card */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/5 via-violet-500/5 to-transparent rounded-bl-full pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/10 via-emerald-500/10 to-blue-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-bold text-wa-text-primary dark:text-white">AI Assistant Integration</h3>
                    {aiConfig.status === 'connected' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Connected ({PROVIDER_PRESETS[aiConfig.provider]?.name || aiConfig.provider.toUpperCase()})</span>
                      </span>
                    ) : aiConfig.status === 'error' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>Verification Error</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>Not Configured</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-wa-text-secondary mt-1">
                    Connect your preferred AI provider to empower automated WhatsApp replies, conversational intelligence, and one-click agent takeovers.
                  </p>
                </div>
              </div>

              {/* Master AI Toggle */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border px-4 py-2.5 rounded-xl shrink-0 self-start sm:self-auto">
                <div className="text-right">
                  <span className="block text-xs font-bold text-wa-text-primary dark:text-white">Enable AI in Inbox</span>
                  <span className="text-[10px] text-wa-text-secondary">{aiConfig.isEnabled ? 'Ask AI button is active' : 'AI features disabled'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiConfig(prev => ({ ...prev, isEnabled: !prev.isEnabled }))}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    aiConfig.isEnabled ? 'bg-wa-green' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      aiConfig.isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Diagnostics error banner if any */}
            {aiConfig.status === 'error' && aiConfig.statusDetails?.errorReason && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <span className="font-bold">Connection Verification Notice:</span>
                  <p className="mt-0.5 font-mono text-[11px]">{aiConfig.statusDetails.errorReason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Configuration Form */}
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 shadow-sm space-y-6">
            <form onSubmit={handleSaveAI} className="space-y-6">
              
              {/* 1. SELECT PROVIDER */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-wa-text-secondary">
                    1. Choose AI Provider ({Object.keys(PROVIDER_PRESETS).length} Available)
                  </label>
                  <span className="text-[11px] text-wa-text-secondary">
                    Select any provider to configure their API key
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {Object.entries(PROVIDER_PRESETS).map(([key, prov]) => {
                    const isSelected = aiConfig.provider === key;
                    const hasKey = Boolean(aiConfig.apiKeys?.[key] || (isSelected && aiConfig.apiKey));

                    return (
                      <div
                        key={key}
                        onClick={() => handleSelectProvider(key)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-wa-green bg-wa-green/5 dark:bg-wa-green/10 shadow-sm ring-1 ring-wa-green/30'
                            : 'border-wa-border dark:border-wa-dark-border hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-wa-dark-header'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                key === 'groq' ? 'bg-amber-500/10 text-amber-600' :
                                key === 'gemini' ? 'bg-blue-500/10 text-blue-600' :
                                key === 'openai' ? 'bg-emerald-500/10 text-emerald-600' :
                                key === 'anthropic' ? 'bg-orange-500/10 text-orange-600' :
                                key === 'deepseek' ? 'bg-indigo-500/10 text-indigo-600' :
                                key === 'xai' ? 'bg-violet-500/10 text-violet-600' :
                                key === 'mistral' ? 'bg-teal-500/10 text-teal-600' :
                                key === 'perplexity' ? 'bg-cyan-500/10 text-cyan-600' :
                                key === 'openrouter' ? 'bg-pink-500/10 text-pink-600' :
                                key === 'cohere' ? 'bg-rose-500/10 text-rose-600' :
                                'bg-slate-500/10 text-slate-600'
                              }`}>
                                {key === 'groq' ? <Zap className="w-4 h-4" /> :
                                 key === 'gemini' ? <Sparkles className="w-4 h-4" /> :
                                 key === 'openai' ? <Bot className="w-4 h-4" /> :
                                 key === 'anthropic' ? <Sparkles className="w-4 h-4" /> :
                                 key === 'deepseek' ? <Cpu className="w-4 h-4" /> :
                                 key === 'xai' ? <Bot className="w-4 h-4" /> :
                                 key === 'mistral' ? <Cpu className="w-4 h-4" /> :
                                 key === 'perplexity' ? <Globe className="w-4 h-4" /> :
                                 key === 'openrouter' ? <Zap className="w-4 h-4" /> :
                                 key === 'cohere' ? <Sliders className="w-4 h-4" /> :
                                 <Server className="w-4 h-4" />}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-wa-text-primary dark:text-white leading-tight">{prov.name}</h4>
                                {prov.badge && (
                                  <span className="text-[9px] text-wa-text-secondary leading-none">{prov.badge}</span>
                                )}
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-wa-green bg-wa-green/10' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-wa-green" />}
                            </div>
                          </div>

                          <p className="text-[11px] text-wa-text-secondary leading-snug line-clamp-2 mt-1">{prov.tagline}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-wa-border/50 dark:border-wa-dark-border/50 flex items-center justify-between">
                          {hasKey ? (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              ✓ Saved Key
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                              No Key
                            </span>
                          )}
                          <span className="text-[9px] text-wa-text-secondary font-mono">{prov.models?.length || 1} models</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. OPTIONAL CUSTOM BASE URL (FOR SELF-HOSTED / LOCAL AI / PRIVATE ENDPOINTS) */}
              {aiConfig.provider === 'custom' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-wa-text-secondary">
                      Custom API Base URL *
                    </label>
                    <span className="text-[11px] text-wa-text-secondary">
                      e.g. http://localhost:11434/v1 for Ollama
                    </span>
                  </div>
                  <input
                    type="text"
                    value={aiConfig.customBaseUrl || ''}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, customBaseUrl: e.target.value }))}
                    placeholder="http://localhost:11434/v1"
                    className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                  />
                  <p className="text-[11px] text-wa-text-secondary mt-1">
                    Compatible with any OpenAI-compatible API endpoint (Ollama, vLLM, LM Studio, FastChat, etc.).
                  </p>
                </div>
              )}

              {/* 3. API KEY INPUT */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-wa-text-secondary">
                    {aiConfig.provider === 'custom' ? '3.' : '2.'} {PROVIDER_PRESETS[aiConfig.provider]?.name} API Key {aiConfig.provider === 'custom' ? '(Optional for local models)' : '*'}
                  </label>
                  {PROVIDER_PRESETS[aiConfig.provider]?.helpUrl && (
                    <a
                      href={PROVIDER_PRESETS[aiConfig.provider]?.helpUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-wa-green hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>{PROVIDER_PRESETS[aiConfig.provider]?.helpText}</span>
                      <Link2 className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showAiKey ? "text" : "password"}
                    value={aiConfig.apiKey || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAiConfig(prev => ({
                        ...prev,
                        apiKey: val,
                        apiKeys: {
                          ...(prev.apiKeys || {}),
                          [prev.provider]: val
                        }
                      }));
                    }}
                    placeholder={PROVIDER_PRESETS[aiConfig.provider]?.placeholder || 'Enter API Key'}
                    className="w-full pl-4 pr-12 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAiKey(!showAiKey)}
                    className="absolute right-3.5 top-2.5 p-1 text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white transition-colors"
                    title={showAiKey ? "Hide key" : "Show key"}
                  >
                    {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-wa-text-secondary mt-1">
                  Your API key is securely encrypted at rest using AES-256 before being stored in the database.
                </p>
              </div>

              {/* 3. MODEL SELECTION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-wa-text-secondary">
                      3. AI Model
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomModelMode(!customModelMode)}
                      className="text-[11px] text-wa-green hover:underline font-medium"
                    >
                      {customModelMode ? 'Choose from presets' : 'Enter custom model name'}
                    </button>
                  </div>

                  {customModelMode ? (
                    <input
                      type="text"
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="e.g. llama-3.3-70b-versatile or gemini-1.5-flash"
                      className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-mono"
                    />
                  ) : (
                    <select
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30"
                    >
                      {(PROVIDER_PRESETS[aiConfig.provider]?.models || []).map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-wa-text-secondary mt-1">
                    Select the model engine used to craft replies to WhatsApp customer inquiries.
                  </p>
                </div>

                {/* Temperature slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-wa-text-secondary">
                      Response Temperature: <span className="font-mono text-wa-green font-bold">{aiConfig.temperature ?? 0.7}</span>
                    </label>
                    <span className="text-[10px] text-wa-text-secondary">
                      {(aiConfig.temperature ?? 0.7) <= 0.3 ? 'Deterministic' : (aiConfig.temperature ?? 0.7) <= 0.8 ? 'Balanced' : 'Creative'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.2"
                    step="0.05"
                    value={aiConfig.temperature ?? 0.7}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full accent-wa-green h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-wa-text-secondary mt-1">
                    <span>0.0 (Precise)</span>
                    <span>0.7 (Standard)</span>
                    <span>1.2 (Inventive)</span>
                  </div>
                </div>
              </div>

              {/* 4. CUSTOM SYSTEM INSTRUCTIONS */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-wa-text-secondary mb-1.5">
                  4. Custom Business Instructions / Rules (Optional)
                </label>
                <textarea
                  rows={4}
                  value={aiConfig.systemPrompt}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="e.g. Store timings: 10 AM to 8 PM Monday-Saturday. We offer free shipping on prepaid orders over ₹1,000. For refunds, please ask for order receipt and notify support."
                  className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 font-sans leading-relaxed"
                />
                <p className="text-[11px] text-wa-text-secondary mt-1">
                  Add specific company policies, FAQs, or contact guidelines. The AI assistant will adhere to these instructions when conversing with customers.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center gap-2 text-xs text-wa-text-secondary">
                  {aiConfig.statusDetails?.lastTested && (
                    <span>Last tested: {new Date(aiConfig.statusDetails.lastTested).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                  {aiConfig.statusDetails?.latencyMs && (
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">• {aiConfig.statusDetails.latencyMs}ms response</span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleTestAI}
                    disabled={testingAI}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-wa-text-primary dark:text-white border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-hover disabled:opacity-50 rounded-xl text-xs font-bold transition-all duration-200"
                  >
                    {testingAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-wa-green" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 text-amber-500" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={savingAI}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {savingAI ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save AI Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Tab Contents: API SETTINGS */}
      {activeTab === 'api-settings' && (
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 space-y-6 shadow-sm animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">Developer API Keys</h3>
            <p className="text-xs text-wa-text-secondary mt-0.5">Generate access keys to authenticate custom REST calls and CRM webhook push integrations.</p>
          </div>

          {fetchingApiKey ? (
            <div className="flex items-center gap-2 text-xs text-wa-text-secondary py-6">
              <Loader2 className="w-4 h-4 animate-spin text-wa-green" />
              <span>Fetching API keys from repository...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {apiKeyData?.hasKey ? (
                <div className="p-5 rounded-xl border border-wa-border dark:border-wa-dark-border bg-wa-bg dark:bg-wa-dark-header/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-wa-text-primary dark:text-white">Live Production API Key</span>
                      <p className="text-[10px] text-wa-text-secondary mt-0.5">Masked: <code className="font-mono text-wa-green">{apiKeyData.apiKey}</code></p>
                    </div>
                    <button
                      onClick={handleRevokeApiKey}
                      disabled={revokingApiKey}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-3 py-1.5 border border-red-200 dark:border-red-950/40 bg-red-50/50 dark:bg-red-950/10 rounded-lg"
                    >
                      {revokingApiKey ? 'Revoking...' : 'Revoke Key'}
                    </button>
                  </div>
                  <div className="border-t border-wa-border/50 dark:border-wa-dark-border/50 pt-3 text-[10px] text-wa-text-secondary grid grid-cols-2 gap-4">
                    <p>Authorization Scopes: <span className="font-bold text-wa-green uppercase">{apiKeyData.scope}</span></p>
                    <p>Expiry: <span className="font-semibold">{apiKeyData.expiresAt ? formatDateOnly(apiKeyData.expiresAt) : 'Never'}</span></p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl text-xs flex gap-2.5 text-wa-text-secondary leading-relaxed">
                    <Info className="w-5 h-5 text-wa-green shrink-0 mt-0.5" />
                    <span>No developer API keys active. Create one to authenticate external CRM sync tools, chatbots, or reporting dashboards.</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Access Scope</label>
                      <select
                        value={apiScope}
                        onChange={(e) => setApiScope(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-white"
                      >
                        <option value="read">Read Only (Data exports)</option>
                        <option value="write">Read & Write (Send messages/contacts)</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateApiKey}
                      disabled={generatingApiKey}
                      className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1"
                    >
                      {generatingApiKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Generate API Key</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Show raw new generated key */}
              {rawNewKey && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 space-y-3 animate-slide-up">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="text-xs text-amber-900 dark:text-amber-400">
                      <span className="font-bold">Copy Your API Key Now</span>
                      <p className="mt-0.5">For security, this key won't be shown again once you leave this page.</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-wa-dark-panel p-2.5 rounded-lg border border-amber-100 dark:border-amber-950 font-mono text-xs text-wa-text-primary dark:text-white">
                    <span className="select-all break-all">{rawNewKey}</span>
                    <button
                      onClick={() => copyToClipboard(rawNewKey, setCopiedKey)}
                      className="p-1 hover:bg-wa-bg rounded-md text-wa-text-secondary"
                      title="Copy Key"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-wa-green" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: API DOCUMENTATION */}
      {activeTab === 'api-docs' && (
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 space-y-6 shadow-sm animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">Built-in API Documentation</h3>
            <p className="text-xs text-wa-text-secondary mt-0.5">Developer guidelines to programmatically control inbox messages and CRM contacts sync.</p>
          </div>

          <div className="space-y-6 text-xs text-wa-text-secondary leading-relaxed">
            {/* Auth Section */}
            <div className="space-y-2">
              <span className="block font-bold text-wa-text-primary dark:text-white">1. Authentication</span>
              <p>Authenticate all external REST requests by passing the key in the request header:</p>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] border border-slate-800">
                X-API-KEY: your_api_key_here
              </pre>
            </div>

            {/* Endpoints */}
            <div className="space-y-4">
              <span className="block font-bold text-wa-text-primary dark:text-white">2. Core Endpoints</span>

              {/* Endpoint 1 */}
              <div className="space-y-2 border-l-2 border-wa-green pl-3.5">
                <span className="font-bold text-wa-text-primary dark:text-white">POST /api/messages/send</span>
                <p>Send text message or approved Meta WhatsApp templates to customers.</p>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] overflow-x-auto border border-slate-800">
{`curl -X POST https://wa.chatbox.biz/api/messages/send \\
  -H "X-API-KEY: your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+14155552671",
    "type": "text",
    "text": "Hello, how can we assist you today?"
  }'`}
                </pre>
              </div>

              {/* Endpoint 2 */}
              <div className="space-y-2 border-l-2 border-wa-green pl-3.5">
                <span className="font-bold text-wa-text-primary dark:text-white">POST /api/contacts</span>
                <p>Register or update contact entries in your marketing database.</p>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] overflow-x-auto border border-slate-800">
{`curl -X POST https://wa.chatbox.biz/api/contacts \\
  -H "X-API-KEY: your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "+14155552671",
    "name": "Jane Doe",
    "tags": ["vip", "lead"],
    "source": "website"
  }'`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: SECURITY (2FA) */}
      {activeTab === 'security' && user && (
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 space-y-6 shadow-sm animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">Two-Factor Authentication (2FA)</h3>
            <p className="text-xs text-wa-text-secondary mt-0.5">Enforce login validation via hardware/authenticator application TOTP tokens.</p>
          </div>

          {user.twoFactorEnabled ? (
            <div className="p-5 bg-wa-green/10 border border-wa-green/30 dark:border-wa-green/20 rounded-2xl flex items-start gap-4 max-w-lg shadow-sm">
              <div className="w-10 h-10 rounded-full bg-wa-green/20 flex items-center justify-center shrink-0 text-wa-green">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="block font-bold text-xs text-wa-green">MFA Security Protection Active</span>
                <p className="text-xs text-wa-text-secondary leading-relaxed">
                  Your enterprise marketing account is fully locked. Every login session requires verification via standard mobile authenticator challenge codes.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Show initiation */}
              {setupStep === 1 && (
                <div className="space-y-4 max-w-md">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="block font-bold text-xs text-amber-800 dark:text-amber-450">High Risk Profile Alert</span>
                      <span className="block text-xs text-wa-text-secondary mt-0.5">Please secure your account keys to prevent unauthorized blast campaigns from being queued.</span>
                    </div>
                  </div>
                  <button
                    onClick={handleInitiate2Fa}
                    disabled={generating2Fa}
                    className="flex items-center gap-2 px-5 py-2.5 text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl text-xs font-semibold shadow-md transition-all duration-200"
                  >
                    {generating2Fa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                    <span>Set up Authenticator app</span>
                  </button>
                </div>
              )}

              {/* Step 2: Show QR scan and verification input */}
              {setupStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-2xl animate-fade-in bg-wa-bg dark:bg-wa-dark-header/40 p-6 rounded-2xl border border-wa-border dark:border-wa-dark-border">
                  {/* Left QR code column */}
                  <div className="space-y-3.5 flex flex-col items-center">
                    <span className="text-xs font-bold text-wa-text-secondary uppercase tracking-wider text-center">1. Scan QR Code</span>
                    {qrCode ? (
                      <div className="p-3 bg-white border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-sm">
                        <img
                          src={qrCode}
                          alt="2FA QR Code"
                          className="w-40 h-40 select-none pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div className="w-46 h-46 bg-wa-bg dark:bg-wa-dark-header rounded-2xl border border-wa-border dark:border-wa-dark-border flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-wa-green" />
                      </div>
                    )}

                    {/* Secret display box */}
                    <div className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl">
                      <span className="text-[10px] font-mono text-wa-text-secondary select-all truncate">
                        Key: {secret}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(secret, setCopiedSecret)}
                        className="text-wa-text-secondary hover:text-wa-green transition-colors"
                        title="Copy Key secret"
                      >
                        {copiedSecret ? <Check className="w-3.5 h-3.5 text-wa-green" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Right Verification Input column */}
                  <form onSubmit={handleVerify2Fa} className="space-y-4">
                    <span className="block text-xs font-bold text-wa-text-secondary uppercase tracking-wider">2. Verify TOTP Code</span>
                    <p className="text-xs text-wa-text-secondary leading-relaxed font-sans">
                      Import key or scan QR in Microsoft Authenticator or Google Authenticator. Enter the changing 6-digit TOTP challenge code below.
                    </p>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-wa-text-secondary uppercase tracking-wider text-center">Verification Code</label>
                      <input
                        type="text"
                        required
                        maxLength="6"
                        placeholder="123456"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-3 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-center font-mono text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-3 text-xs font-sans">
                      <button
                        type="button"
                        onClick={() => setSetupStep(1)}
                        className="px-3.5 py-2 text-xs font-semibold border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-bg rounded-xl text-wa-text-secondary"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={verifying2Fa}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md transition-colors"
                      >
                        {verifying2Fa && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Verify & Enable</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Step 3: Success details */}
              {setupStep === 3 && (
                <div className="p-5 bg-wa-green/10 border border-wa-green/30 dark:border-wa-green/20 rounded-2xl max-w-md space-y-4 shadow-sm animate-fade-in text-xs font-sans">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-wa-green" />
                    <div>
                      <h4 className="font-bold text-wa-green">Security Completed!</h4>
                      <p className="text-wa-text-secondary mt-0.5">2FA configuration has been successfully saved to your credentials profiles.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSetupStep(1)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-lg transition-colors"
                  >
                    Close Setup
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: TEAM CHAT SETTINGS */}
      {activeTab === 'team-chat' && ['admin', 'owner', 'superadmin'].includes(user?.role) && (
        <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 space-y-6 shadow-sm animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-wa-green" /> Color-Coded Role Schemes
            </h3>
            <p className="text-xs text-wa-text-secondary mt-0.5">
              Customize identification colors assigned to team roles and departments inside the internal chat window.
            </p>
          </div>

          {fetchingChatSettings ? (
            <div className="flex items-center justify-center py-12 gap-2 text-xs text-wa-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
              <span>Fetching team chat configuration...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveChatSettings} className="space-y-6 max-w-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Admin */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary">Admin Role Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={roleColors.admin || '#22c55e'}
                      onChange={(e) => setRoleColors({ ...roleColors, admin: e.target.value })}
                      className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={roleColors.admin || '#22c55e'}
                      onChange={(e) => setRoleColors({ ...roleColors, admin: e.target.value })}
                      className="flex-1 px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                    />
                  </div>
                </div>

                {/* Manager */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary">Manager Role Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={roleColors.manager || '#3b82f6'}
                      onChange={(e) => setRoleColors({ ...roleColors, manager: e.target.value })}
                      className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={roleColors.manager || '#3b82f6'}
                      onChange={(e) => setRoleColors({ ...roleColors, manager: e.target.value })}
                      className="flex-1 px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                    />
                  </div>
                </div>

                {/* Sales */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary">Sales Team Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={roleColors.sales || '#f97316'}
                      onChange={(e) => setRoleColors({ ...roleColors, sales: e.target.value })}
                      className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={roleColors.sales || '#f97316'}
                      onChange={(e) => setRoleColors({ ...roleColors, sales: e.target.value })}
                      className="flex-1 px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                    />
                  </div>
                </div>

                {/* Support */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary">Support Team Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={roleColors.support || '#a855f7'}
                      onChange={(e) => setRoleColors({ ...roleColors, support: e.target.value })}
                      className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={roleColors.support || '#a855f7'}
                      onChange={(e) => setRoleColors({ ...roleColors, support: e.target.value })}
                      className="flex-1 px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                    />
                  </div>
                </div>

                {/* Developer */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary">Developers Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={roleColors.developer || '#ef4444'}
                      onChange={(e) => setRoleColors({ ...roleColors, developer: e.target.value })}
                      className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={roleColors.developer || '#ef4444'}
                      onChange={(e) => setRoleColors({ ...roleColors, developer: e.target.value })}
                      className="flex-1 px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                    />
                  </div>
                </div>

                {/* Agent */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary">Agents (Default) Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={roleColors.agent || '#64748b'}
                      onChange={(e) => setRoleColors({ ...roleColors, agent: e.target.value })}
                      className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={roleColors.agent || '#64748b'}
                      onChange={(e) => setRoleColors({ ...roleColors, agent: e.target.value })}
                      className="flex-1 px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                <button
                  type="button"
                  onClick={fetchChatSettings}
                  className="px-5 py-2.5 text-xs font-semibold border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-hover rounded-xl text-wa-text-secondary"
                >
                  Reset Defaults
                </button>
                <button
                  type="submit"
                  disabled={savingChatSettings}
                  className="flex items-center gap-2 px-5 py-2.5 text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl text-xs font-semibold shadow-md transition-all duration-200"
                >
                  {savingChatSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Color Schemes</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* WhatsApp Registration Modal */}
      {showRegModal && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-up">
              <div className="flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border pb-3">
                <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>Register Phone Number</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowRegModal(false);
                    setRegPin('');
                  }}
                  className="text-wa-text-secondary hover:text-wa-text-primary text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs text-wa-text-secondary leading-relaxed">
                <p>
                  To enable sending messages via Meta Cloud API, you must register your verified phone number. This setup authorizes your number on the WhatsApp servers.
                </p>
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  Current Phone ID: <span className="font-mono">{metaConfig.whatsapp.phoneNumberId}</span>
                </p>
              </div>

              <form onSubmit={handleRegisterPhone} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase text-wa-text-secondary">
                    Two-Step Verification 6-Digit PIN *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="e.g. 123456"
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-center text-wa-text-primary dark:text-white font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-wa-green/30"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegModal(false);
                      setRegPin('');
                    }}
                    className="px-4 py-2 text-xs font-semibold border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-hover rounded-xl text-wa-text-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registeringPhone || regPin.length !== 6}
                    className="flex items-center gap-2 px-4 py-2 text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl text-xs font-semibold shadow-md transition-all duration-200"
                  >
                    {registeringPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Register Number</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
