'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useConversationStore, useAuthStore, useConfirmStore } from '../lib/store';
import api from '../lib/api';
import {
  Send, Paperclip, Smile, Check, CheckCheck, User, Bot, Sparkles,
  Phone, MoreVertical, Search, Mic, Image, FileText, Camera,
  UserCircle, ArrowDown, X, Shield, Zap, Info, Tag, Edit2, Trash2, Mail, Loader2, MessageSquare, ChevronLeft,
  Download, Pin, Plus, Save, Star, RefreshCw, ArrowUpLeft, ChevronDown, ChevronUp, Copy, CheckCircle2, Clock,
  Globe, Languages, RotateCcw, Square, MicOff, Calendar
} from 'lucide-react';
import { format, isToday, isYesterday, isSameDay, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import Portal from './Portal';
import { GOOGLE_TRANSLATE_LANGUAGES, POPULAR_LANGUAGES } from '../lib/googleTranslateLanguages';

function formatMessageDate(date) {
  if (isToday(date)) return 'TODAY';
  if (isYesterday(date)) return 'YESTERDAY';
  return format(date, 'dd/MM/yyyy');
}

function formatRelativeTime(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    const str = formatDistanceToNow(d);
    if (str.includes('less than a minute')) {
      return 'just now';
    }
    return str.replace('about ', '').replace('almost ', '') + ' ago';
  } catch (e) {
    return '';
  }
}

// Helper to highlight matching search keywords inside text (WhatsApp style)
function renderHighlightedText(text, query, isSearchActive) {
  if (!text || typeof text !== 'string') return text || '';
  if (!isSearchActive || !query || !query.trim()) return text;

  const trimmedQuery = query.trim();
  const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.toLowerCase() === trimmedQuery.toLowerCase()) {
      return (
        <mark
          key={i}
          className="bg-amber-300 dark:bg-amber-400 text-slate-900 font-bold rounded-xs px-0.5 shadow-2xs"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}


// Helper to generate a soft avatar background color
const getAvatarBg = (name) => {
  if (!name) return 'bg-wa-green/10 text-wa-green';
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
    'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
    'bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400',
  ];
  return colors[charCodeSum % colors.length];
};

// Helper for colored dots on tags
const getTagColorClass = (tag) => {
  const charCodeSum = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dotColors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-indigo-500', 'bg-pink-500'
  ];
  const textColors = [
    'text-emerald-700 bg-emerald-50 dark:text-emerald-350 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30',
    'text-blue-700 bg-blue-50 dark:text-blue-350 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30',
    'text-purple-700 bg-purple-50 dark:text-purple-350 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30',
    'text-amber-700 bg-amber-50 dark:text-amber-350 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30',
    'text-indigo-700 bg-indigo-50 dark:text-indigo-350 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30',
    'text-pink-700 bg-pink-50 dark:text-pink-350 dark:bg-pink-950/20 border-pink-100 dark:border-pink-900/30'
  ];
  const index = charCodeSum % dotColors.length;
  return { dot: dotColors[index], badge: textColors[index] };
};

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('/uploads')) {
    if (typeof window !== 'undefined') {
      return `/api${url}`;
    }
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
    const baseUrl = apiBase.endsWith('/api') ? apiBase : `${apiBase.replace(/\/$/, '')}/api`;
    return `${baseUrl}${url}`;
  }
  return url;
};

export default function ChatWindow({ conversation, messages, onBack }) {
  const confirm = useConfirmStore(state => state.confirm);

  // Guard: If no conversation is loaded, show empty state
  if (!conversation?._id) {
    return (
      <div className="flex h-full w-full overflow-hidden bg-wa-bg/15 dark:bg-wa-dark-bg/10 items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-wa-text-light mx-auto mb-4 opacity-30" />
          <p className="text-wa-text-secondary dark:text-wa-dark-text-secondary">Select a conversation to start</p>
        </div>
      </div>
    );
  }

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState('smileys');
  const [emojiSearch, setEmojiSearch] = useState('');
  const endRef = useRef(null);
  const chatRef = useRef(null);
  const dropdownRef = useRef(null);
  const attachRef = useRef(null);
  const emojiRef = useRef(null);
  const textareaRef = useRef(null);

  // Attachment input refs
  const docInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // File Uploading & Contact Card States
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactCardName, setContactCardName] = useState('');
  const [contactCardPhone, setContactCardPhone] = useState('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewPdfName, setPreviewPdfName] = useState('');

  // AI Translation per message states
  const [messageTranslations, setMessageTranslations] = useState({});
  const [translateModalMsg, setTranslateModalMsg] = useState(null); // { msgId, text, isOut }
  const [translateSearch, setTranslateSearch] = useState('');
  const [translateActiveTab, setTranslateActiveTab] = useState('popular'); // 'popular' | 'all'

  // Filter 130+ languages by search query
  const filteredLanguages = GOOGLE_TRANSLATE_LANGUAGES.filter((l) => {
    if (!translateSearch.trim()) return true;
    const q = translateSearch.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  // In-Chat Keyword Search States & Handlers (WhatsApp style)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const searchInputRef = useRef(null);

  // Helper to extract searchable text from a message
  const getMessageSearchableText = useCallback((msg, msgId) => {
    const parts = [];
    if (typeof msg.content === 'string') parts.push(msg.content);
    if (msg.content?.text) parts.push(msg.content.text);
    if (msg.content?.caption) parts.push(msg.content.caption);
    if (msg.content?.filename) parts.push(msg.content.filename);
    if (msg.content?.contactName) parts.push(msg.content.contactName);
    if (msg.content?.contactPhone) parts.push(msg.content.contactPhone);
    if (msg.text) parts.push(msg.text);
    if (messageTranslations[msgId]?.translatedText) {
      parts.push(messageTranslations[msgId].translatedText);
    }
    return parts.join(' ');
  }, [messageTranslations]);

  // Find all matching message indices in the current conversation
  const matchedIndices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !messages?.length) return [];
    const indices = [];
    messages.forEach((msg, idx) => {
      const msgId = msg._id || `msg-${idx}`;
      const searchTarget = getMessageSearchableText(msg, msgId).toLowerCase();
      if (searchTarget.includes(q)) {
        indices.push(idx);
      }
    });
    return indices;
  }, [searchQuery, messages, getMessageSearchableText]);

  // When search query or matched results update, keep current match index in sync
  useEffect(() => {
    if (!searchQuery.trim() || matchedIndices.length === 0) {
      setCurrentMatchIndex(-1);
    } else {
      setCurrentMatchIndex((prev) => {
        if (prev >= 0 && prev < matchedIndices.length) {
          return prev;
        }
        return matchedIndices.length - 1; // Default to most recent match (WhatsApp style)
      });
    }
  }, [searchQuery, matchedIndices]);

  // Smooth scroll to the current matched message
  useEffect(() => {
    if (!isSearchOpen || currentMatchIndex < 0 || currentMatchIndex >= matchedIndices.length) return;
    const targetIdx = matchedIndices[currentMatchIndex];
    if (targetIdx === undefined) return;
    const targetMsg = messages[targetIdx];
    if (!targetMsg) return;
    const msgId = targetMsg._id || `msg-${targetIdx}`;
    const el = document.getElementById(`chat-msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, matchedIndices, isSearchOpen, messages]);

  const goToNextMatch = useCallback(() => {
    if (matchedIndices.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchedIndices.length);
  }, [matchedIndices.length]);

  const goToPrevMatch = useCallback(() => {
    if (matchedIndices.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchedIndices.length) % matchedIndices.length);
  }, [matchedIndices.length]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setCurrentMatchIndex(-1);
  }, []);

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  }, [goToPrevMatch, goToNextMatch, closeSearch]);

  // Reset search when active conversation changes
  useEffect(() => {
    closeSearch();
  }, [conversation?._id, closeSearch]);

  // Open search on Ctrl+F / Cmd+F inside chat window
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 80);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle translation for a specific separate message
  const handleTranslateMessage = async (msgId, rawText, targetLang = 'en', targetLangName = 'English') => {
    if (!rawText || !rawText.trim()) {
      toast.error('No text content found to translate');
      return;
    }

    setMessageTranslations(prev => ({
      ...prev,
      [msgId]: {
        loading: true,
        targetLang,
        targetLangName,
        translatedText: prev[msgId]?.translatedText || '',
        error: null
      }
    }));

    try {
      const res = await api.post('/messages/translate', {
        text: rawText.trim(),
        targetLang,
        targetLangName
      });

      if (res.data?.success && res.data?.data) {
        setMessageTranslations(prev => ({
          ...prev,
          [msgId]: {
            loading: false,
            translatedText: res.data.data.translatedText,
            targetLang: res.data.data.targetLang || targetLang,
            targetLangName: res.data.data.targetLangName || targetLangName,
            detectedSourceLang: res.data.data.detectedSourceLang,
            provider: res.data.data.provider,
            error: null
          }
        }));
      } else {
        throw new Error(res.data?.error || 'Translation failed');
      }
    } catch (err) {
      console.error('Translation error:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to translate message');
      setMessageTranslations(prev => ({
        ...prev,
        [msgId]: {
          ...(prev[msgId] || {}),
          loading: false,
          error: 'Translation failed. Please try again.'
        }
      }));
    }
  };

  const handleClearTranslation = (msgId) => {
    setMessageTranslations(prev => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });
  };

  // Voice-to-Text (Speech Recognition) states & handlers
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('hi-IN'); // Default Hindi (supports Hinglish/English too)
  const [voiceDuration, setVoiceDuration] = useState(0);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const isListeningRef = useRef(false);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startListening = useCallback((langToUse = speechLang) => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice-to-text is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langToUse;

      let baseText = text ? (text.trim() + ' ') : '';

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setVoiceDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setVoiceDuration(prev => prev + 1);
        }, 1000);
        const langName = langToUse === 'hi-IN' ? 'हिन्दी (Hindi)' : langToUse === 'gu-IN' ? 'ગુજરાતી (Gujarati)' : 'English';
        toast.success(`Voice-to-Text active (${langName})! Speak into your mic.`, { icon: '🎙️' });
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const speechResult = finalTranscript || interimTranscript;
        if (speechResult) {
          setText(baseText + speechResult);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Microphone permission denied. Please allow microphone access in your browser address bar.');
          stopListening();
        } else if (event.error === 'no-speech') {
          // Silent pause, keep listening
        } else {
          toast.error(`Voice error: ${event.error}`);
          stopListening();
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          setIsListening(false);
          isListeningRef.current = false;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      toast.error('Failed to access microphone. Please check permissions.');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [speechLang, text, stopListening]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
      toast('Voice recording stopped', { icon: '⏹️' });
    } else {
      startListening(speechLang);
    }
  };

  // Clean up listening when conversation switches
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [conversation?._id, stopListening]);


  const handleFileUpload = async (e, forcedType = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type = forcedType;
    if (!type) {
      if (file.type.startsWith('image/')) {
        type = 'image';
      } else if (file.type.startsWith('video/')) {
        type = 'video';
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
      } else {
        type = 'document';
      }
    }

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const { data } = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (data.success) {
        toast.loading('Sending message...', { id: toastId });

        const sendRes = await api.post('/messages/send', {
          contactId: contact._id,
          mediaUrl: data.data.url,
          type: type,
          filename: file.name,
          caption: (type === 'image' || type === 'video') ? file.name : undefined
        });

        if (sendRes.data.success) {
          toast.success('Sent successfully!', { id: toastId });
          setShowAttach(false);
        } else {
          toast.error(sendRes.data.error || 'Failed to send file', { id: toastId });
        }
      } else {
        toast.error('Upload failed', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload file', { id: toastId });
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleSendContactCard = async (e) => {
    e.preventDefault();
    if (!contactCardName.trim() || !contactCardPhone.trim()) {
      toast.error('Name and phone number are required');
      return;
    }

    const toastId = toast.loading('Sending contact card...');
    try {
      const sendRes = await api.post('/messages/send', {
        contactId: contact._id,
        type: 'contact',
        contactName: contactCardName.trim(),
        contactPhone: contactCardPhone.trim()
      });

      if (sendRes.data.success) {
        toast.success('Contact card sent!', { id: toastId });
        setIsContactModalOpen(false);
        setContactCardName('');
        setContactCardPhone('');
        setShowAttach(false);
      } else {
        toast.error(sendRes.data.error || 'Failed to send contact card', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send contact card', { id: toastId });
    }
  };



  // CRM Sidebar toggle
  const [showSidebar, setShowSidebar] = useState(false);

  // CRM Sidebar Edit States
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editEmail, setEditEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [notesText, setNotesText] = useState('');
  const [newTag, setNewTag] = useState('');
  const [updatingCrm, setUpdatingCrm] = useState(false);

  // CRM Notes Timeline States
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Quick Replies (WABA templates) States
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const quickRepliesRef = useRef(null);

  const { sendMessage, fetchConversations, fetchMessages, deleteConversation, markConversationAsRead, togglePinConversation, toggleStarConversation } = useConversationStore();
  const { user } = useAuthStore();

  const handleTogglePin = async () => {
    if (!conversation?._id) return;
    const res = await togglePinConversation(conversation._id);
    if (res?.success) toast.success(res.message);
    else if (res?.error) toast.error(res.error);
  };

  const handleToggleStar = async () => {
    if (!conversation?._id) return;
    const res = await toggleStarConversation(conversation._id);
    if (res?.success) toast.success(res.message);
    else if (res?.error) toast.error(res.error);
  };

  const isAgent = user?.role === 'agent';
  const isAdmin = ['superadmin', 'owner', 'admin'].includes(user?.role);
  const isAIActive = conversation?.status === 'ai' || Boolean(conversation?.ai_active);
  const [togglingAI, setTogglingAI] = useState(false);
  const [isAIConfigured, setIsAIConfigured] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkAIStatus = async () => {
      try {
        const { data } = await api.get('/messages/ai-status');
        if (isMounted && data.success) {
          setIsAIConfigured(Boolean(data.data?.isConfigured && data.data?.isEnabled));
        }
      } catch (err) {
        // Silently catch
      }
    };
    checkAIStatus();
    return () => { isMounted = false; };
  }, []);

  const isLocked = conversation?.lock_status;
  const currentOwner = conversation?.assignedAgent || conversation?.assigned_agent_id;
  const isOwnerMe = currentOwner?._id?.toString() === user?._id?.toString() || currentOwner?.toString() === user?._id?.toString();

  const showTakeoverBanner = isAgent && !isLocked;
  const isLockedByOther = isLocked && !isOwnerMe && !isAdmin;

  // AI Reply Suggestion System (Strictly only active when Human Reply Mode is ON)
  const isHumanReplyMode = (conversation?.status === 'human' || conversation?.takeover_status === 'human' || Boolean(isLocked && !isAIActive)) && !isAIActive;
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [draftSuggestions, setDraftSuggestions] = useState([]);
  const [suggestionTab, setSuggestionTab] = useState('customer'); // 'customer' | 'draft'
  const [originalDraft, setOriginalDraft] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(true);

  const fetchAISuggestions = useCallback(async (isManual = false, overrideDraftText = null) => {
    if (!conversation?._id || !isHumanReplyMode) {
      setAiSuggestions([]);
      setDraftSuggestions([]);
      return;
    }

    const isEnhancingDraft = typeof overrideDraftText === 'string'
      ? Boolean(overrideDraftText.trim())
      : false;

    setLoadingSuggestions(true);
    try {
      const payload = isEnhancingDraft ? { draftText: overrideDraftText.trim() } : {};
      const { data } = await api.post(`/messages/conversations/${conversation._id}/suggest-reply`, payload);
      if (data.success && Array.isArray(data.data?.suggestions)) {
        if (data.data.isDraftEnhancement) {
          setDraftSuggestions(data.data.suggestions);
          setSuggestionTab('draft');
          setShowSuggestionsPanel(true);
          if (isManual) {
            toast.success('Generated 3 improved versions of your draft ✨');
          }
        } else {
          setAiSuggestions(data.data.suggestions);
          if (isManual) {
            toast.success('Generated fresh AI reply suggestions ✨');
          }
        }
      }
    } catch (err) {
      if (isManual) {
        toast.error(err.response?.data?.error || 'Failed to generate suggestions');
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }, [conversation?._id, isHumanReplyMode]);

  const handlePolishDraft = useCallback(() => {
    if (!text.trim()) {
      toast.error('Please type a reply first to polish!');
      return;
    }
    setOriginalDraft(text);
    fetchAISuggestions(true, text.trim());
  }, [text, fetchAISuggestions]);

  const handleRestoreDraft = () => {
    if (originalDraft) {
      setText(originalDraft);
      toast.success('Original draft restored! ↩️');
    }
  };

  // Auto-fetch suggestions when entering human reply mode or switching conversation in human reply mode
  useEffect(() => {
    if (isHumanReplyMode && conversation?._id) {
      fetchAISuggestions(false, null);
      setDraftSuggestions([]);
      setSuggestionTab('customer');
      setOriginalDraft('');
    } else {
      setAiSuggestions([]);
      setDraftSuggestions([]);
      setOriginalDraft('');
    }
  }, [conversation?._id, isHumanReplyMode, fetchAISuggestions]);

  // Auto-fetch suggestions when a new inbound message is received from the customer
  const lastInboundMsgIdRef = useRef(null);
  useEffect(() => {
    if (!isHumanReplyMode || !messages?.length) return;
    const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');
    if (lastInbound?._id && lastInbound._id !== lastInboundMsgIdRef.current) {
      lastInboundMsgIdRef.current = lastInbound._id;
      fetchAISuggestions(false, null);
    }
  }, [messages, isHumanReplyMode, fetchAISuggestions]);

  const handleUseSuggestion = (suggestion, isFromDraft = false) => {
    if (!suggestion) return;
    if (isFromDraft || suggestionTab === 'draft') {
      if (text && text !== suggestion && !originalDraft) {
        setOriginalDraft(text);
      }
      setText(suggestion);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      toast.success('Polished version applied! ✍️');
    } else {
      setText(suggestion);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      toast.success('Suggestion copied to message input! ✍️');
    }
  };

  const handleQuickSendSuggestion = async (suggestion) => {
    if (!suggestion?.trim() || !contact?._id) return;
    const toastId = toast.loading('Sending AI suggestion...');
    try {
      const result = await sendMessage(contact._id, suggestion.trim());
      if (result.success) {
        toast.success('Message sent successfully! 🚀', { id: toastId });
        setText('');
        setDraftSuggestions([]);
        setOriginalDraft('');
      } else {
        toast.error(result.error || 'Failed to send', { id: toastId });
      }
    } catch (err) {
      toast.error('Failed to send message', { id: toastId });
    }
  };

  const contact = conversation?.contactId || {};

  const fetchContactNotes = async () => {
    if (!contact || !contact._id) return;
    setNotesLoading(true);
    try {
      const { data } = await api.get(`/contacts/${contact._id}/notes`);
      if (data.success) {
        setNotes(data.data.notes);
      }
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setNotesLoading(false);
    }
  };

  const prevContactIdRef = useRef(null);

  // Initialize input fields when current contact changes
  useEffect(() => {
    if (contact && contact._id) {
      if (prevContactIdRef.current !== contact._id) {
        setNotesText(contact.notes || '');
        setNameInput(contact.name || '');
        setEmailInput(contact.email || '');
        setNewTag('');
        setEditName(false);
        setEditEmail(false);
        setNewNoteText('');
        setEditingNoteId(null);
        fetchContactNotes();
        prevContactIdRef.current = contact._id;
      }
    } else {
      setNotes([]);
      prevContactIdRef.current = null;
    }
  }, [contact?._id]);

  // AI Conversation Summary States & Functions (supports month-wise filtering & multi-language translation)
  const [summaryData, setSummaryData] = useState(null);
  const [selectedSummaryMonth, setSelectedSummaryMonth] = useState('');
  const [availableSummaryMonths, setAvailableSummaryMonths] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [savingSummaryNote, setSavingSummaryNote] = useState(false);
  const [summaryTranslation, setSummaryTranslation] = useState(null); // { targetLang, targetLangName, executiveSummary, keyPoints, actionItems, customerIntent, showOriginal }
  const [translatingSummary, setTranslatingSummary] = useState(false);

  // Sync summary from conversation when selected conversation changes
  useEffect(() => {
    setSelectedSummaryMonth('');
    setAvailableSummaryMonths([]);
    setSummaryTranslation(null);
    if (conversation?.summary?.executiveSummary) {
      setSummaryData(conversation.summary);
      if (conversation.summary.month) {
        setSelectedSummaryMonth(conversation.summary.month);
      }
    } else {
      setSummaryData(null);
    }
  }, [conversation?._id]);

  const fetchConversationSummary = useCallback(async (forceRegenerate = false, targetMonth = null) => {
    if (!conversation?._id) return;
    setLoadingSummary(true);
    setSummaryTranslation(null);
    const toastId = forceRegenerate ? toast.loading('Analyzing chat & generating AI summary...') : null;
    try {
      const monthToFetch = targetMonth !== null ? targetMonth : selectedSummaryMonth;
      const queryParam = monthToFetch ? `?month=${encodeURIComponent(monthToFetch)}` : '';
      const endpoint = `/messages/conversations/${conversation._id}/summary${queryParam}`;
      
      const { data } = forceRegenerate
        ? await api.post(`/messages/conversations/${conversation._id}/summary`, { month: monthToFetch || undefined })
        : await api.get(endpoint);

      if (data.success && data.data) {
        setSummaryData(data.data);
        if (data.availableMonths && data.availableMonths.length > 0) {
          setAvailableSummaryMonths(data.availableMonths);
        }
        if (data.selectedMonth) {
          setSelectedSummaryMonth(data.selectedMonth);
        } else if (targetMonth) {
          setSelectedSummaryMonth(targetMonth);
        }
        if (forceRegenerate) {
          toast.success('Conversation summary updated ✨', { id: toastId });
        }
      } else {
        if (forceRegenerate) toast.error('Failed to generate summary', { id: toastId });
      }
    } catch (err) {
      if (forceRegenerate) {
        toast.error(err.response?.data?.error || 'Failed to generate summary', { id: toastId });
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [conversation?._id, selectedSummaryMonth]);

  // Translate AI Summary into 130+ Google Translate / AI languages
  const handleTranslateSummary = async (targetLang = 'en', targetLangName = 'English') => {
    if (!summaryData?.executiveSummary) {
      toast.error('No summary content to translate');
      return;
    }

    setTranslatingSummary(true);
    const toastId = toast.loading(`Translating summary to ${targetLangName}...`);

    try {
      const promises = [
        api.post('/messages/translate', { text: summaryData.executiveSummary, targetLang, targetLangName })
      ];

      if (summaryData.keyPoints?.length) {
        promises.push(api.post('/messages/translate', { text: summaryData.keyPoints.join('\n'), targetLang, targetLangName }));
      }
      if (summaryData.actionItems?.length) {
        promises.push(api.post('/messages/translate', { text: summaryData.actionItems.join('\n'), targetLang, targetLangName }));
      }
      if (summaryData.customerIntent) {
        promises.push(api.post('/messages/translate', { text: summaryData.customerIntent, targetLang, targetLangName }));
      }

      const results = await Promise.all(promises);

      const execResult = results[0]?.data?.data;
      const translatedExec = execResult?.translatedText || summaryData.executiveSummary;
      let nextIdx = 1;

      let translatedKeyPoints = summaryData.keyPoints;
      if (summaryData.keyPoints?.length) {
        const raw = results[nextIdx]?.data?.data?.translatedText;
        if (raw) translatedKeyPoints = raw.split('\n').map(s => s.trim()).filter(Boolean);
        nextIdx++;
      }

      let translatedActionItems = summaryData.actionItems;
      if (summaryData.actionItems?.length) {
        const raw = results[nextIdx]?.data?.data?.translatedText;
        if (raw) translatedActionItems = raw.split('\n').map(s => s.trim()).filter(Boolean);
        nextIdx++;
      }

      let translatedIntent = summaryData.customerIntent;
      if (summaryData.customerIntent) {
        const raw = results[nextIdx]?.data?.data?.translatedText;
        if (raw) translatedIntent = raw.trim();
        nextIdx++;
      }

      setSummaryTranslation({
        targetLang,
        targetLangName,
        provider: execResult?.provider || 'google-translate',
        executiveSummary: translatedExec,
        keyPoints: translatedKeyPoints,
        actionItems: translatedActionItems,
        customerIntent: translatedIntent,
        showOriginal: false
      });

      toast.success(`Summary translated to ${targetLangName} 🌐`, { id: toastId });
    } catch (err) {
      console.error('Summary translation error:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to translate summary', { id: toastId });
    } finally {
      setTranslatingSummary(false);
    }
  };

  const handleCopySummary = () => {
    if (!summaryData) return;
    const isTranslated = summaryTranslation && !summaryTranslation.showOriginal;
    const execText = isTranslated ? summaryTranslation.executiveSummary : summaryData.executiveSummary;
    const kPoints = isTranslated ? summaryTranslation.keyPoints : summaryData.keyPoints;
    const aItems = isTranslated ? summaryTranslation.actionItems : summaryData.actionItems;
    const intentText = isTranslated ? summaryTranslation.customerIntent : summaryData.customerIntent;
    const langTag = isTranslated ? ` [${summaryTranslation.targetLangName}]` : '';
    const periodLabel = summaryData.monthLabel ? ` [${summaryData.monthLabel}]` : '';

    const copyText = [
      `📋 AI Conversation Summary${periodLabel}${langTag}: ${contact.name || contact.phone || 'Customer'}`,
      `Period: ${summaryData.monthLabel || 'Current Month'}${langTag} | Intent: ${intentText || 'Inquiry'} | Status: ${summaryData.resolutionStatus || 'Active'} | Sentiment: ${summaryData.sentiment || 'neutral'}`,
      `\nExecutive Overview:\n${execText}`,
      kPoints?.length ? `\nKey Discussion Points:\n• ${kPoints.join('\n• ')}` : '',
      aItems?.length ? `\nAction Items & Next Steps:\n• ${aItems.join('\n• ')}` : ''
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(copyText);
    toast.success('Conversation summary copied to clipboard! 📋');
  };

  const handleSaveSummaryAsNote = async () => {
    if (!summaryData?.executiveSummary) return;
    setSavingSummaryNote(true);
    const toastId = toast.loading('Saving summary to contact notes...');
    try {
      const isTranslated = summaryTranslation && !summaryTranslation.showOriginal;
      const dataToSave = isTranslated ? {
        ...summaryData,
        executiveSummary: summaryTranslation.executiveSummary,
        keyPoints: summaryTranslation.keyPoints,
        actionItems: summaryTranslation.actionItems,
        customerIntent: summaryTranslation.customerIntent,
        monthLabel: `${summaryData.monthLabel || 'Current Period'} (${summaryTranslation.targetLangName})`
      } : summaryData;

      const { data } = await api.post(`/messages/conversations/${conversation._id}/summary/save-note`, {
        month: selectedSummaryMonth || summaryData.month || undefined,
        summary: dataToSave
      });
      if (data.success) {
        toast.success('Summary saved to internal contact notes! 📝', { id: toastId });
        fetchContactNotes();
      } else {
        toast.error(data.error || 'Failed to save as note', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note', { id: toastId });
    } finally {
      setSavingSummaryNote(false);
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '42px'; // Default base height
      const scrollHeight = textareaRef.current.scrollHeight;
      if (scrollHeight > 42) {
        textareaRef.current.style.height = `${Math.min(scrollHeight, 140)}px`;
      }
    }
  }, [text]);

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevConversationIdRef = useRef(conversation?._id);
  const prevMessagesFirstIdRef = useRef(messages[0]?._id);
  const hasScrolledToBottomForActiveConv = useRef(false);

  // Reset scroll flag when conversation ID changes
  useEffect(() => {
    if (conversation?._id) {
      hasScrolledToBottomForActiveConv.current = false;
    }
  }, [conversation?._id]);

  useEffect(() => {
    if (!conversation?._id) return;

    // Handle initial scroll to bottom when a new conversation loads its messages
    if (!hasScrolledToBottomForActiveConv.current && messages.length > 0) {
      hasScrolledToBottomForActiveConv.current = true;
      prevConversationIdRef.current = conversation._id;
      prevMessagesLengthRef.current = messages.length;
      prevMessagesFirstIdRef.current = messages[0]?._id;
      setHasMore(true);
      setLoadingOlder(false);
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);
      return;
    }

    // Scroll to bottom smoothly only when new messages are appended to the active conversation
    const firstMsgChanged = messages[0]?._id !== prevMessagesFirstIdRef.current;
    prevMessagesFirstIdRef.current = messages[0]?._id;

    if (prevConversationIdRef.current === conversation._id) {
      if (!firstMsgChanged && messages.length > prevMessagesLengthRef.current) {
        setTimeout(() => {
          endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    }

    prevConversationIdRef.current = conversation._id;
    prevMessagesLengthRef.current = messages.length;
  }, [messages, conversation]);

  // Track scroll position and load older messages on scroll to top
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;

    const handleScroll = async () => {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      setShowScrollBtn(!isNearBottom);

      if (el.scrollTop < 50 && !loadingOlder && hasMore && messages.length >= 100) {
        const oldestMessage = messages[0];
        if (!oldestMessage) return;

        setLoadingOlder(true);
        const previousScrollHeight = el.scrollHeight;

        try {
          const params = {
            before: oldestMessage.timestamp || oldestMessage.createdAt,
            limit: 50
          };
          const { data } = await api.get(`/messages/conversations/${conversation._id}`, { params });
          if (data.success) {
            const olderMessages = data.data.messages || [];
            if (olderMessages.length < 50) {
              setHasMore(false);
            }
            if (olderMessages.length > 0) {
              useConversationStore.setState({
                messages: [...olderMessages, ...messages]
              });
              // Adjust scroll position after render
              setTimeout(() => {
                if (chatRef.current) {
                  chatRef.current.scrollTop = chatRef.current.scrollHeight - previousScrollHeight;
                }
              }, 0);
            }
          }
        } catch (err) {
          console.error('Failed to load older messages:', err);
        } finally {
          setLoadingOlder(false);
        }
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [messages, loadingOlder, hasMore, conversation]);

  // Professional emoji data — curated for business communication
  const emojiData = {
    smileys: {
      label: '😊',
      title: 'Smileys',
      emojis: ['😊', '😀', '😃', '😄', '😁', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥴', '😵', '🤯', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '🥹', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖']
    },
    hands: {
      label: '👋',
      title: 'Hands',
      emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '🫷', '🫸', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿']
    },
    people: {
      label: '👤',
      title: 'People',
      emojis: ['👤', '👥', '🫂', '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '🧑‍🦱', '👨‍🦱', '👩‍🦰', '🧑‍🦰', '👨‍🦰', '👱‍♀️', '👱', '👱‍♂️', '👩‍🦳', '🧑‍🦳', '👨‍🦳', '👩‍🦲', '🧑‍🦲', '👨‍🦲', '🧔‍♀️', '🧔', '🧔‍♂️', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳', '👳‍♂️', '🧕', '👮‍♀️', '👮', '👮‍♂️', '👷‍♀️', '👷', '👷‍♂️', '💂‍♀️', '💂', '💂‍♂️', '🕵️‍♀️', '🕵️', '🕵️‍♂️', '👩‍⚕️', '🧑‍⚕️', '👨‍⚕️', '👩‍🌾', '🧑‍🌾', '👨‍🌾', '👩‍🍳', '🧑‍🍳', '👨‍🍳', '👩‍🎓', '🧑‍🎓', '👨‍🎓', '👩‍💼', '🧑‍💼', '👨‍💼', '👩‍💻', '🧑‍💻', '👨‍💻', '👩‍🔧', '🧑‍🔧', '👨‍🔧', '👩‍🔬', '🧑‍🔬', '👨‍🔬', '👩‍🚀', '🧑‍🚀', '👨‍🚀']
    },
    business: {
      label: '💼',
      title: 'Business',
      emojis: ['💼', '📊', '📈', '📉', '💰', '💵', '💴', '💶', '💷', '💸', '💳', '🧾', '💹', '🏦', '🏢', '🏬', '🏗️', '🏭', '🏛️', '🏠', '🏡', '📱', '💻', '🖥️', '⌨️', '🖨️', '📞', '☎️', '📠', '🔋', '🔌', '💡', '🔦', '🕯️', '📡', '🛜', '🗂️', '📁', '📂', '🗃️', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗑️', '🔒', '🔓', '🔑', '🗝️', '🔐']
    },
    objects: {
      label: '📦',
      title: 'Objects',
      emojis: ['📦', '📫', '📪', '📬', '📭', '📮', '🗳️', '✏️', '✒️', '🖊️', '🖋️', '📝', '📄', '📃', '📑', '🗒️', '📒', '📓', '📔', '📕', '📗', '📘', '📙', '📚', '📖', '🔗', '🗓️', '📅', '📆', '📇', '🗄️', '🗞️', '📰', '📑', '🏷️', '🔖', '🧮', '⏰', '⏱️', '⏲️', '🕰️', '⌛', '⏳', '🔔', '🔕', '📢', '📣', '🎯', '🏆', '🎖️', '🏅', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🎮']
    },
    symbols: {
      label: '💚',
      title: 'Symbols',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
    },
    flags: {
      label: '🏁',
      title: 'Flags',
      emojis: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇮🇳', '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇯🇵', '🇨🇳', '🇧🇷', '🇮🇹', '🇪🇸', '🇲🇽', '🇷🇺', '🇰🇷', '🇸🇦', '🇦🇪', '🇸🇬', '🇿🇦', '🇳🇬', '🇪🇬', '🇹🇷', '🇮🇩', '🇵🇰', '🇧🇩', '🇵🇭', '🇻🇳', '🇹🇭', '🇲🇾', '🇳🇿', '🇦🇷', '🇨🇱', '🇨🇴', '🇵🇪', '🇳🇱', '🇧🇪', '🇨🇭', '🇦🇹', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇵🇱', '🇺🇦', '🇮🇪', '🇵🇹', '🇬🇷', '🇭🇺', '🇨🇿', '🇷🇴', '🇮🇱', '🇶🇦', '🇰🇼', '🇧🇭', '🇴🇲', '🇯🇴', '🇱🇧', '🇮🇶', '🇰🇪', '🇬🇭', '🇪🇹', '🇹🇿', '🇺🇬', '🇲🇦', '🇹🇳', '🇱🇾', '🇩🇿', '🇭🇰', '🇹🇼', '🇲🇴', '🇰🇭', '🇲🇲', '🇱🇰', '🇳🇵', '🇲🇻']
    }
  };

  const handleEmojiSelect = (emoji) => {
    setText(prev => prev + emoji);
  };

  const filteredEmojis = emojiSearch.trim()
    ? Object.values(emojiData).flatMap(cat => cat.emojis)
    : emojiData[emojiCategory]?.emojis || [];

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttach(false);
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target)) setShowQuickReplies(false);
      if (emojiRef.current && !emojiRef.current.contains(e.target)) { setShowEmojiPicker(false); setEmojiSearch(''); }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch templates for quick reply list
  const toggleQuickReplies = async () => {
    const nextState = !showQuickReplies;
    setShowQuickReplies(nextState);
    if (nextState && templates.length === 0) {
      setLoadingTemplates(true);
      try {
        const { data } = await api.get('/templates');
        if (data.success) {
          setTemplates(data.data.templates);
        }
      } catch (err) {
        toast.error('Failed to load templates for quick replies');
      } finally {
        setLoadingTemplates(false);
      }
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const result = await sendMessage(contact._id, text.trim());
      if (result.success) {
        setText('');
        setDraftSuggestions([]);
        setOriginalDraft('');
      } else {
        toast.error(result.error || 'Failed to send');
      }
    } catch (err) {
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  // Profile Save Helpers
  const saveCrmField = async (fieldsToUpdate) => {
    setUpdatingCrm(true);
    try {
      const { data } = await api.put(`/contacts/${contact._id}`, fieldsToUpdate);
      if (data.success) {
        toast.success('Contact profile updated successfully');
        await fetchConversations();
        await fetchMessages(conversation._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setUpdatingCrm(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return toast.error('Name cannot be empty');
    await saveCrmField({ name: nameInput.trim() });
    setEditName(false);
  };

  const handleSaveEmail = async () => {
    await saveCrmField({ email: emailInput.trim() });
    setEditEmail(false);
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setUpdatingCrm(true);
    try {
      const { data } = await api.post(`/contacts/${contact._id}/notes`, { note: newNoteText.trim() });
      if (data.success) {
        toast.success('Note added');
        setNewNoteText('');
        fetchContactNotes();
      }
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setUpdatingCrm(false);
    }
  };

  const handlePinNote = async (noteId, currentPinned) => {
    try {
      const { data } = await api.put(`/notes/${noteId}`, { isPinned: !currentPinned });
      if (data.success) {
        toast.success(currentPinned ? 'Note unpinned' : 'Note pinned');
        fetchContactNotes();
      }
    } catch (err) {
      toast.error('Failed to update note pin');
    }
  };

  const handleSaveEditNote = async (noteId) => {
    if (!editingNoteText.trim()) return;
    try {
      const { data } = await api.put(`/notes/${noteId}`, { note: editingNoteText.trim() });
      if (data.success) {
        toast.success('Note updated');
        setEditingNoteId(null);
        fetchContactNotes();
      }
    } catch (err) {
      toast.error('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      const { data } = await api.delete(`/notes/${noteId}`);
      if (data.success) {
        toast.success('Note deleted');
        fetchContactNotes();
      }
    } catch (err) {
      toast.error('Failed to delete note');
    }
  };

  const handleAddTag = async (e) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const tagName = newTag.trim();
      const existingTags = contact.tags || [];
      if (existingTags.includes(tagName)) {
        toast.error('Tag already exists');
        return;
      }

      setUpdatingCrm(true);
      try {
        // 1. Fetch tags to find if it exists in library
        const tagsRes = await api.get('/tags');
        let targetTag = tagsRes.data?.data?.tags?.find(t => t.name.toLowerCase() === tagName.toLowerCase());

        if (!targetTag) {
          // Create tag in library first
          const createRes = await api.post('/tags', { name: tagName });
          targetTag = createRes.data?.data?.tag;
        }

        // 2. Attach tag to contact
        const { data } = await api.post(`/contacts/${contact._id}/add-tag`, { tagId: targetTag._id });
        if (data.success) {
          toast.success('Tag assigned');
          setNewTag('');
          await fetchConversations();
          await fetchMessages(conversation._id);
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to add tag');
      } finally {
        setUpdatingCrm(false);
      }
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    setUpdatingCrm(true);
    try {
      const { data } = await api.post(`/contacts/${contact._id}/remove-tag`, { tagName: tagToRemove });
      if (data.success) {
        toast.success('Tag removed');
        await fetchConversations();
        await fetchMessages(conversation._id);
      }
    } catch (err) {
      toast.error('Failed to remove tag');
    } finally {
      setUpdatingCrm(false);
    }
  };

  const handleToggleOptOut = async () => {
    const nextStatus = !contact.optedOut;
    await saveCrmField({ optedOut: nextStatus });
  };

  const handleMarkRead = async () => {
    try {
      await markConversationAsRead(conversation._id);
      toast.success('Conversation marked as read');
      setShowDropdown(false);
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleAssign = async () => {
    try {
      await api.post(`/messages/conversations/${conversation._id}/assign`);
      toast.success('Conversation assigned to you');
      setShowDropdown(false);
      // Just refresh the current message thread, don't refetch all conversations
      // The socket event 'conversation_assigned' will handle updating the conversation list
      await fetchMessages(conversation._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign');
    }
  };

  const handleResolve = async () => {
    try {
      await api.post(`/messages/conversations/${conversation._id}/resolve`);
      toast.success('Conversation resolved');
      setShowDropdown(false);
      // Just refresh the current conversation, don't refetch all conversations
      await fetchMessages(conversation._id);
    } catch { toast.error('Failed to resolve'); }
  };

  const handleToggleAskAI = async () => {
    if (!conversation?._id) return;
    setTogglingAI(true);
    const toastId = toast.loading(isAIActive ? 'Stopping AI Assistant...' : 'Activating Ask AI ✨...');
    try {
      const { data } = await api.post(`/messages/conversations/${conversation._id}/toggle-ai`);
      if (data.success) {
        toast.success(data.message, { id: toastId });
        setShowDropdown(false);
        await fetchMessages(conversation._id);
        await fetchConversations({}, true);
      } else {
        toast.error(data.error || 'Failed to toggle AI mode', { id: toastId });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle AI mode', { id: toastId });
    } finally {
      setTogglingAI(false);
    }
  };

  const handleAI = async () => {
    try {
      await api.post(`/messages/conversations/${conversation._id}/transfer-to-ai`);
      toast.success('Returned to Bot');
      setShowDropdown(false);
      // Just refresh the current conversation, don't refetch all conversations
      await fetchMessages(conversation._id);
    } catch { toast.error('Failed to return to bot'); }
  };

  const handleDeleteChat = async () => {
    if (!conversation?._id) return;
    if (await confirm("Are you sure you want to delete this chat? This will permanently delete all messages in this conversation.")) {
      try {
        const result = await deleteConversation(conversation._id);
        if (result.success) {
          toast.success("Chat deleted successfully");
          setShowDropdown(false);
        } else {
          toast.error(result.error || "Failed to delete chat");
        }
      } catch (err) {
        toast.error("Failed to delete chat");
      }
    }
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const StatusIcon = ({ status }) => {
    if (status === 'read') return <CheckCheck className="w-4 h-4 text-[#53bdeb]" />;
    if (status === 'delivered') return <CheckCheck className="w-4 h-4 text-wa-text-light" />;
    if (status === 'sent') return <Check className="w-4 h-4 text-wa-text-light" />;
    if (status === 'failed') return <span className="text-[11px] text-red-500 font-medium">Failed</span>;
    return <div className="w-3.5 h-3.5 border border-wa-text-light rounded-full" />;
  };

  const SentByLabel = ({ sentBy }) => {
    const colors = {
      bot: 'text-purple-500',
      ai: 'text-amber-500',
      system: 'text-wa-green',
      human: 'text-blue-500',
    };
    const icons = {
      bot: <Bot className="w-3 h-3" />,
      ai: <Sparkles className="w-3 h-3" />,
      system: <Zap className="w-3 h-3" />,
      human: <User className="w-3 h-3" />,
    };
    const labels = {
      bot: 'Bot',
      ai: 'AI Assistant',
      system: contact.name || contact.phone || 'System',
      human: 'Agent',
    };
    return (
      <span className={`flex items-center gap-1 text-[11px] font-semibold ${colors[sentBy] || 'text-wa-text-secondary'} mb-1`}>
        {icons[sentBy]}
        {labels[sentBy] || sentBy}
      </span>
    );
  };

  // Extract the text of the BODY component from a Meta WABA template
  const getTemplateBodyText = (tmpl) => {
    const bodyComponent = tmpl.components?.find(c => c.type === 'BODY');
    return bodyComponent ? bodyComponent.text : '';
  };

  const handleSelectQuickReply = (tmplText) => {
    setText(tmplText);
    setShowQuickReplies(false);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleSendTemplate = async (tmpl) => {
    setShowQuickReplies(false);
    const toastId = toast.loading(`Sending template ${tmpl.name}...`);
    try {
      const sendRes = await api.post('/messages/send', {
        contactId: contact._id,
        type: 'template',
        templateId: tmpl._id,
        variables: [contact.name || 'Customer']
      });

      if (sendRes.data.success && sendRes.data.data?.message?.status !== 'failed') {
        toast.success('Template sent successfully!', { id: toastId });
        await fetchMessages(conversation._id);
        await fetchConversations();
      } else {
        const errMsg = sendRes.data.data?.message?.errorDetails || sendRes.data.error || 'Failed to send template';
        toast.error(errMsg, { id: toastId });
        await fetchMessages(conversation._id);
        await fetchConversations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send template', { id: toastId });
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    getTemplateBodyText(t).toLowerCase().includes(templateSearch.toLowerCase())
  );

  let lastDate = null;
  const initials = contact.name ? contact.name.substring(0, 2).toUpperCase() : '?';
  const avatarClass = getAvatarBg(contact.name);

  return (
    <div className="flex h-full w-full overflow-hidden">

      {/* LEFT COLUMN: CHAT WINDOW */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-wa-bg/15 dark:bg-wa-dark-bg/10 relative">

        {/* HEADER */}
        <div className="wa-header min-h-[56px] sm:min-h-[58px] h-[56px] sm:h-[58px] !py-0 flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-2 sm:px-4 shrink-0 relative z-20 bg-wa-panel-header dark:bg-wa-dark-panel-header">
          {/* LEFT: Contact info (always prioritized and never squeezed to 0) */}
          <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer min-w-0 flex-1 overflow-hidden mr-1 sm:mr-2" onClick={() => setShowSidebar(!showSidebar)}>
            {onBack && (
              <button
                onClick={(e) => { e.stopPropagation(); onBack(); }}
                className="lg:hidden p-1.5 -ml-1 rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover text-wa-text-secondary dark:text-wa-dark-text-secondary transition-colors shrink-0"
                title="Back to chats"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${avatarClass} flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 shadow-xs ring-1 ring-black/5 dark:ring-white/10`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              {/* Line 1: Contact Name & Status Badge - Contact Name ALWAYS prioritized */}
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <h3 className="font-semibold text-xs sm:text-sm text-wa-text-primary dark:text-white leading-tight truncate shrink-0 max-w-[130px] sm:max-w-[200px]">
                  {contact.name || 'Unknown Contact'}
                </h3>
                {isAIActive ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink min-w-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="truncate">AI Active</span>
                  </span>
                ) : conversation?.status && (
                  conversation.status === 'human' ? (
                    conversation.lock_status ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink min-w-0 max-w-[110px] bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30">
                        <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                        <span className="truncate">
                          <span className="hidden md:inline">Handled by </span>
                          {conversation.assignedAgent?.name ? conversation.assignedAgent.name.split(' ')[0] : 'Agent'}
                        </span>
                      </span>
                    ) : conversation.assignedAgent ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink min-w-0 bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30">
                        <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                        <span className="truncate">Assigned</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink min-w-0 bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30">
                        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">
                          <span className="hidden md:inline">Needs Human Reply</span>
                          <span className="md:hidden">Reply</span>
                        </span>
                      </span>
                    )
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink min-w-0 ${conversation.status === 'bot' ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30' :
                        'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800/30'
                      }`}>
                      <span className={`w-1 h-1 rounded-full shrink-0 ${conversation.status === 'bot' ? 'bg-purple-500' : 'bg-slate-400'}`} />
                      <span className="truncate">{conversation.status}</span>
                    </span>
                  )
                )}
              </div>

              {/* Line 2: Phone number & Assigned Agent */}
              <div className="text-[10px] sm:text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary flex items-center gap-1.5 mt-0.5 min-w-0 overflow-hidden">
                <Phone className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-wa-text-light shrink-0" />
                <span className="font-mono leading-none truncate shrink-0 max-w-[120px] sm:max-w-none">{contact.phone || ''}</span>
                {isAIActive ? (
                  <>
                    <span className="text-slate-300 dark:text-slate-700 font-bold shrink-0 hidden sm:inline">•</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold leading-none items-center gap-1 truncate hidden sm:flex">
                      <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                      <span className="truncate">AI Active</span>
                    </span>
                  </>
                ) : (
                  conversation?.status === 'human' && conversation.assignedAgent?.name && (
                    <div className="hidden sm:flex items-center gap-1 min-w-0 truncate">
                      <span className="text-slate-300 dark:text-slate-700 font-bold shrink-0">•</span>
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-[7px] uppercase shrink-0 border border-blue-500/20">
                        {conversation.assignedAgent.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">
                        {conversation.assignedAgent.name}
                      </span>
                      {conversation.assigned_at && (
                        <span className="text-[9px] text-wa-text-light dark:text-wa-dark-text-secondary font-normal shrink-0 hidden md:inline">
                          ({formatRelativeTime(conversation.assigned_at)})
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* RIGHT ACTION BUTTONS: Icon-only for Bot/Take-Over below 2xl so name is never crowded */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
            {/* Take Over Button */}
            {(!isLocked || isAIActive) && (
              <button
                onClick={handleAssign}
                className="w-8 h-8 2xl:w-auto 2xl:px-3 2xl:py-1.5 bg-wa-green hover:bg-wa-green-hover text-white text-xs font-bold rounded-lg shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 shrink-0"
                title="Take over conversation control from AI/Bot"
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="hidden 2xl:inline">Take Over</span>
              </button>
            )}

            {/* Return to Bot Button */}
            {isLocked && !isAIActive && (isOwnerMe || isAdmin) && (
              <button
                onClick={handleAI}
                className="w-8 h-8 2xl:w-auto 2xl:px-3 2xl:py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 shrink-0"
                title="Release conversation and return to AI bot"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span className="hidden 2xl:inline">Return to Bot</span>
              </button>
            )}

            {/* Locked Indicator */}
            {isLocked && !isAIActive && !isOwnerMe && !isAdmin && (
              <button
                disabled
                className="w-8 h-8 2xl:w-auto 2xl:px-3 2xl:py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-400 text-xs font-bold rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0"
                title={`Locked by ${conversation.assignedAgent?.name || 'another agent'}`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span className="hidden 2xl:inline">Locked</span>
              </button>
            )}

            {/* ASK AI BUTTON - visible on 2xl:, always in 3-dots menu */}
            {(isAIConfigured || isAIActive) && (
              <button
                onClick={handleToggleAskAI}
                disabled={togglingAI}
                className={`hidden 2xl:flex relative px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 items-center gap-1.5 shrink-0 select-none disabled:opacity-60 shadow-xs ${
                  isAIActive
                    ? 'group bg-emerald-600 hover:bg-rose-600 text-white border border-emerald-500 hover:border-rose-500'
                    : 'bg-white dark:bg-wa-dark-header border border-slate-200 dark:border-wa-dark-border text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-wa-dark-hover hover:border-slate-300 dark:hover:border-slate-600'
                }`}
                title={isAIActive ? 'AI Assistant is active. Click to stop and return control.' : 'Activate AI Assistant for this chat'}
              >
                {isAIActive ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
                    <span>AI Active</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Ask AI</span>
                  </>
                )}
              </button>
            )}

            {/* Pin Button — visible ONLY on ultra-wide screens (2xl:), always in 3-dots dropdown */}
            <button
              onClick={handleTogglePin}
              className={`hidden 2xl:flex w-8 h-8 rounded-full items-center justify-center transition-colors shrink-0 ${
                conversation?.isPinned
                  ? 'text-wa-green bg-wa-green/10'
                  : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
              }`}
              title={conversation?.isPinned ? 'Unpin chat' : 'Pin chat to top'}
            >
              <Pin className={`w-3.5 h-3.5 rotate-45 ${conversation?.isPinned ? 'fill-wa-green/40' : ''}`} />
            </button>

            {/* Star Button — visible ONLY on ultra-wide screens (2xl:), always in 3-dots dropdown */}
            <button
              onClick={handleToggleStar}
              className={`hidden 2xl:flex w-8 h-8 rounded-full items-center justify-center transition-colors shrink-0 ${
                conversation?.isStarred
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
              }`}
              title={conversation?.isStarred ? 'Unstar chat' : 'Star chat'}
            >
              <Star className={`w-3.5 h-3.5 ${conversation?.isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
            </button>

            {/* AI Conversation Summary Button — visible ONLY on ultra-wide screens (2xl:), always in 3-dots dropdown */}
            <button
              onClick={() => {
                setShowSummaryModal(true);
                fetchConversationSummary(false);
              }}
              className="hidden 2xl:flex px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 hover:from-teal-500/20 hover:to-emerald-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/20 transition-all items-center gap-1.5 shrink-0 shadow-xs active:scale-95"
              title="View AI Conversation Summary & Key Points"
            >
              <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="font-bold">Summary</span>
            </button>

            {/* Info Toggle Button (CRM Sidebar) - visible on sm: and above, accessible on mobile via tapping contact header or 3-dots menu */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-full items-center justify-center transition-colors shrink-0 ${
                showSidebar
                  ? 'text-wa-green bg-wa-green/10'
                  : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
              }`}
              title={showSidebar ? 'Hide Contact Info' : 'View Contact Info'}
            >
              <Info className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* 3-Dots More Menu — Always visible and contains ALL actions */}
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                title="More Options"
              >
                <MoreVertical className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
              {showDropdown && (
                <div className="wa-dropdown absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-xl py-1.5 z-50 animate-scale-up">
                  {/* 1. Search Messages (WhatsApp Style) */}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setIsSearchOpen(true);
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                      }, 100);
                    }}
                    className="wa-dropdown-item w-full"
                  >
                    <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Search Messages</span>
                  </button>

                  {/* 2. AI Summary */}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowSummaryModal(true);
                      fetchConversationSummary(false);
                    }}
                    className="wa-dropdown-item w-full"
                  >
                    <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>AI Summary</span>
                  </button>

                  {/* 2. Contact Details & CRM sidebar */}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowSidebar(!showSidebar);
                    }}
                    className="wa-dropdown-item w-full"
                  >
                    <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>{showSidebar ? 'Hide Contact Details' : 'View Contact Details'}</span>
                  </button>

                  {/* 3. Take Over */}
                  {(!isLocked || isAIActive) && (
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleAssign();
                      }}
                      className="wa-dropdown-item w-full"
                    >
                      <User className="w-4 h-4 text-wa-green" />
                      <span>Take Over Chat</span>
                    </button>
                  )}

                  {/* 4. Return to Bot */}
                  {isLocked && !isAIActive && (isOwnerMe || isAdmin) && (
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleAI();
                      }}
                      className="wa-dropdown-item w-full"
                    >
                      <Bot className="w-4 h-4 text-purple-500" />
                      <span>Return to Bot</span>
                    </button>
                  )}

                  {/* 5. Ask AI Assistant */}
                  {(isAIConfigured || isAIActive) && (
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleToggleAskAI();
                      }}
                      className="wa-dropdown-item w-full"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>{isAIActive ? 'Stop AI Assistant' : 'Ask AI Assistant'}</span>
                    </button>
                  )}

                  <div className="border-t border-wa-border dark:border-wa-dark-border my-1" />

                  {/* 6. Pin Chat */}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      handleTogglePin();
                    }}
                    className="wa-dropdown-item w-full"
                  >
                    <Pin className={`w-4 h-4 rotate-45 ${conversation?.isPinned ? 'text-wa-green fill-wa-green/40' : ''}`} />
                    <span>{conversation?.isPinned ? 'Unpin Chat' : 'Pin Chat to Top'}</span>
                  </button>

                  {/* 7. Star Chat */}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      handleToggleStar();
                    }}
                    className="wa-dropdown-item w-full"
                  >
                    <Star className={`w-4 h-4 ${conversation?.isStarred ? 'text-amber-500 fill-amber-400' : ''}`} />
                    <span>{conversation?.isStarred ? 'Unstar Chat' : 'Star Chat'}</span>
                  </button>

                  {/* 8. Resolve Chat */}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      handleResolve();
                    }}
                    className="wa-dropdown-item w-full"
                  >
                    <Check className="w-4 h-4 text-wa-green" />
                    <span>Resolve Conversation</span>
                  </button>

                  {/* 9. Mark as Read */}
                  {!conversation?.isRead && (
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleMarkRead();
                      }}
                      className="wa-dropdown-item w-full"
                    >
                      <CheckCheck className="w-4 h-4 text-blue-500" />
                      <span>Mark as Read</span>
                    </button>
                  )}

                  <div className="border-t border-wa-border dark:border-wa-dark-border my-1" />

                  {/* 10. Delete Chat */}
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      handleDeleteChat();
                    }}
                    className="wa-dropdown-item w-full text-red-500 hover:text-red-650 hover:bg-red-50/50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <span>Delete Chat</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* IN-CHAT MESSAGE SEARCH BAR (WhatsApp Style) */}
        {isSearchOpen && (
          <div className="bg-wa-panel-header dark:bg-wa-dark-panel-header border-b border-wa-border dark:border-wa-dark-border px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 shrink-0 z-20 shadow-xs animate-slide-down">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-wa-text-secondary absolute left-3 top-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search in chat... (Press Enter for next, Esc to close)"
                className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-[13px] bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-1.5 focus:ring-wa-green/60 shadow-2xs"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-wa-text-secondary hover:text-wa-text-primary p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Results counter & Match navigators */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {searchQuery.trim() && (
                <span className="text-[11px] sm:text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-wa-text-secondary dark:text-wa-dark-text-secondary whitespace-nowrap">
                  {matchedIndices.length > 0 ? (
                    <span>{currentMatchIndex + 1} of {matchedIndices.length}</span>
                  ) : (
                    <span className="text-rose-500 font-bold">No results</span>
                  )}
                </span>
              )}

              <button
                type="button"
                onClick={goToPrevMatch}
                disabled={matchedIndices.length === 0}
                className="p-1.5 rounded-lg text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title="Previous message (Shift + Enter)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={goToNextMatch}
                disabled={matchedIndices.length === 0}
                className="p-1.5 rounded-lg text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title="Next message (Enter)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-wa-border dark:border-wa-dark-border mx-0.5" />

              <button
                type="button"
                onClick={closeSearch}
                className="p-1.5 rounded-lg text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                title="Close search (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* AI ACTIVE NOTICE BANNER */}
        {isAIActive && (
          <div className="bg-gradient-to-r from-violet-600/10 via-fuchsia-600/10 to-indigo-600/10 border-b border-violet-400/25 px-4 py-2 flex items-center justify-between text-xs text-violet-800 dark:text-violet-300 shrink-0 z-10 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-spin-slow" />
              <span className="font-bold">Ask AI is Active (Groq Llama 3)</span>
              <span className="text-[11px] opacity-75 hidden sm:inline">— AI automatically chats with this customer</span>
            </div>
            <button
              onClick={handleToggleAskAI}
              className="text-[11px] font-bold text-violet-700 dark:text-violet-300 hover:text-rose-600 dark:hover:text-rose-400 underline transition-colors"
            >
              Stop AI & Return Control
            </button>
          </div>
        )}

        {/* MESSAGES CONTAINER */}
        <div className="flex-1 overflow-y-auto px-[5%] py-4 relative wa-chat-pattern bg-[#efeae2]/15 dark:bg-slate-900/10" ref={chatRef}>
          <div className="absolute inset-0 wa-chat-bg opacity-[0.06] dark:opacity-[0.02] pointer-events-none z-0" />

          <div className="relative z-10 space-y-2">
            {loadingOlder && (
              <div className="flex items-center justify-center py-2 text-wa-green">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
            {messages.map((msg, i) => {
              const isOut = msg.direction === 'outbound';
              const msgDate = msg.timestamp ? new Date(msg.timestamp) : null;
              const msgId = msg._id || `msg-${i}`;
              const messageRawText = msg.content?.text || msg.content?.caption || (typeof msg.content === 'string' ? msg.content : '') || (msg.text || '');
              const msgTranslation = messageTranslations[msgId];

              let showDateDivider = false;
              if (msgDate) {
                if (!lastDate || !isSameDay(msgDate, lastDate)) {
                  showDateDivider = true;
                }
                lastDate = msgDate;
              }

              const isCurrentMatch = isSearchOpen && matchedIndices[currentMatchIndex] === i;
              const isAnyMatch = isSearchOpen && searchQuery.trim() && matchedIndices.includes(i);

              return (
                <div key={msg._id || i} id={`chat-msg-${msgId}`}>
                  {showDateDivider && msgDate && (
                    <div className="wa-date-divider my-4">
                      <span>{formatMessageDate(msgDate)}</span>
                    </div>
                  )}
                  <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1 msg-wrapper animate-message-pop`}>
                    <div className={`${isOut ? 'chat-bubble-out' : 'chat-bubble-in'} relative group transition-all duration-300 ${
                      isCurrentMatch
                        ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 shadow-lg scale-[1.01]'
                        : isAnyMatch
                        ? 'ring-1.5 ring-amber-400/70 shadow-xs'
                        : ''
                    }`}>
                      {!isOut && msg.sentBy && <SentByLabel sentBy={msg.sentBy} />}

                      {/* Quick Hover Translate Trigger Button (Gemini AI Rotating Border Highlight) */}
                      {messageRawText && messageRawText.trim() && (
                        <div
                          className={`absolute -top-3 ${isOut ? '-left-2' : '-right-2'} opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTranslateModalMsg({
                                msgId,
                                text: messageRawText.trim(),
                                isOut
                              });
                              setTranslateSearch('');
                              setTranslateActiveTab('popular');
                            }}
                            className="gemini-border-btn"
                            title="Translate this message (AI & Google Translate 130+ languages)"
                          >
                            <span className="gemini-border-btn-inner">
                              <Globe className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                              <span className="hidden sm:inline">Translate</span>
                            </span>
                          </button>
                        </div>
                      )}

                      {msg.type === 'image' && msg.content?.mediaUrl && (
                        <div className="mb-1.5 max-w-sm rounded-lg overflow-hidden border border-wa-border dark:border-wa-dark-border shadow-sm">
                          <img
                            src={resolveMediaUrl(msg.content.mediaUrl)}
                            alt={msg.content.caption || "Image"}
                            className="max-h-60 w-full object-cover hover:scale-[1.01] transition-transform duration-200 cursor-pointer"
                            onClick={() => window.open(resolveMediaUrl(msg.content.mediaUrl), '_blank')}
                          />
                        </div>
                      )}

                      {msg.type === 'video' && msg.content?.mediaUrl && (
                        <div className="mb-1.5 max-w-sm rounded-lg overflow-hidden border border-wa-border dark:border-wa-dark-border shadow-sm bg-black">
                          <video
                            src={resolveMediaUrl(msg.content.mediaUrl)}
                            controls
                            className="max-h-60 w-full object-contain"
                          />
                        </div>
                      )}

                      {msg.type === 'audio' && msg.content?.mediaUrl && (
                        <div className="mb-1.5 p-2 rounded-xl bg-wa-panel-header dark:bg-wa-dark-panel-header border border-wa-border dark:border-wa-dark-border flex items-center gap-2 min-w-[260px] max-w-sm shadow-sm">
                          <audio
                            src={resolveMediaUrl(msg.content.mediaUrl)}
                            controls
                            className="w-full h-8"
                          />
                        </div>
                      )}

                      {msg.type === 'sticker' && msg.content?.mediaUrl && (
                        <div className="mb-1.5 max-w-[120px] overflow-hidden rounded-lg">
                          <img
                            src={resolveMediaUrl(msg.content.mediaUrl)}
                            alt="Sticker"
                            className="w-full h-auto object-contain"
                          />
                        </div>
                      )}

                      {msg.type === 'document' && msg.content?.mediaUrl && (
                        <div className="mb-1.5 p-2.5 rounded-xl bg-wa-panel-header dark:bg-wa-dark-panel-header border border-wa-border dark:border-wa-dark-border flex items-center gap-2 max-w-sm">
                          <FileText className="w-5 h-5 text-purple-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-wa-text-primary dark:text-white truncate">
                              {renderHighlightedText(msg.content.filename || msg.content.caption || msg.content.text || "Document File", searchQuery, isSearchOpen)}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const url = resolveMediaUrl(msg.content.mediaUrl);
                              const name = msg.content.filename || msg.content.caption || msg.content.text || "Document File";
                              if (url.toLowerCase().includes('.pdf') || name.toLowerCase().endsWith('.pdf')) {
                                setPreviewPdfUrl(url);
                                setPreviewPdfName(name);
                              } else {
                                window.open(url, '_blank');
                              }
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold text-wa-green bg-wa-green/10 border border-wa-green/20 rounded-lg hover:bg-wa-green hover:text-white transition-colors shrink-0"
                          >
                            Open
                          </button>
                        </div>
                      )}

                      {msg.type === 'contact' && (
                        <div className="mb-1.5 p-3 rounded-xl bg-wa-panel-header dark:bg-wa-dark-panel-header border border-wa-border dark:border-wa-dark-border flex items-center gap-2 max-w-sm">
                          <UserCircle className="w-6 h-6 text-blue-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-wa-text-primary dark:text-white leading-tight truncate">
                              {renderHighlightedText(msg.content?.contactName || "Contact", searchQuery, isSearchOpen)}
                            </span>
                            <span className="block text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono mt-0.5 leading-none">
                              {msg.content?.contactPhone || ""}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Display text or caption if exists, or if type is text */}
                      {(msg.type === 'text' || (!msg.content?.mediaUrl && (msg.content?.text || msg.content?.caption))) && (
                        <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap text-wa-text-primary dark:text-wa-dark-text-primary">
                          {renderHighlightedText(msg.content?.text || msg.content?.caption, searchQuery, isSearchOpen)}
                        </p>
                      )}

                      {/* TRANSLATION BOX (Per-message result) */}
                      {msgTranslation && (
                        <div className="mt-2 pt-1.5 border-t border-teal-500/20 dark:border-teal-400/20 animate-fade-in">
                          {msgTranslation.loading ? (
                            <div className="p-2 rounded-lg bg-teal-500/10 dark:bg-teal-950/30 border border-teal-500/20 flex items-center gap-2 text-xs text-teal-700 dark:text-teal-300">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400" />
                              <span className="font-medium">
                                Translating to {msgTranslation.targetLangName || 'selected language'}...
                              </span>
                            </div>
                          ) : msgTranslation.error ? (
                            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                              <span>{msgTranslation.error}</span>
                              <button
                                type="button"
                                onClick={() => handleTranslateMessage(msgId, messageRawText.trim(), msgTranslation.targetLang, msgTranslation.targetLangName)}
                                className="underline font-bold hover:text-rose-900"
                              >
                                Retry
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-xl p-2.5 bg-gradient-to-br from-teal-500/10 via-emerald-500/10 to-cyan-500/10 dark:from-teal-950/40 dark:via-emerald-950/40 dark:to-cyan-950/40 border border-teal-500/25 dark:border-teal-500/30 shadow-xs">
                              {/* Header with language & controls */}
                              <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-teal-500/15 dark:border-teal-400/15 text-[11px]">
                                <div className="flex items-center gap-1.5 font-semibold text-teal-800 dark:text-teal-200">
                                  <Globe className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                                  <span className="font-bold">{msgTranslation.targetLangName}</span>
                                  {msgTranslation.detectedSourceLang && msgTranslation.detectedSourceLang !== 'auto' && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-teal-600/10 text-teal-700 dark:text-teal-300 font-mono">
                                      from {msgTranslation.detectedSourceLang.toUpperCase()}
                                    </span>
                                  )}
                                  {msgTranslation.provider === 'google-translate' && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 font-sans hidden sm:inline">
                                      Google
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Copy translated text */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(msgTranslation.translatedText);
                                      toast.success('Translated text copied!');
                                    }}
                                    title="Copy translated text"
                                    className="p-1 rounded-md text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>

                                  {/* Change target language */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTranslateModalMsg({
                                        msgId,
                                        text: messageRawText.trim(),
                                        isOut
                                      });
                                      setTranslateSearch('');
                                      setTranslateActiveTab('popular');
                                    }}
                                    title="Translate to another language"
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
                                  >
                                    Change
                                  </button>

                                  {/* Dismiss/Hide translation */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClearTranslation(msgId);
                                    }}
                                    title="Hide translation"
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Translated Content */}
                              <p className="text-[13.5px] leading-relaxed text-slate-900 dark:text-slate-100 font-sans select-text whitespace-pre-wrap">
                                {renderHighlightedText(msgTranslation.translatedText, searchQuery, isSearchOpen)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <span className="text-[9px] text-wa-text-light leading-none">
                          {msgDate ? format(msgDate, 'h:mm a') : ''}
                        </span>
                        {isOut && <StatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="fixed bottom-24 right-10 w-10 h-10 rounded-full bg-white dark:bg-wa-dark-panel shadow-wa-md flex items-center justify-center hover:shadow-wa-lg transition-all z-10 text-wa-text-secondary"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* INPUT AND QUICK REPLY AREA */}
        <div className="bg-wa-panel-header dark:bg-wa-dark-panel-header px-4 py-2.5 border-t border-wa-border dark:border-wa-dark-border relative shrink-0">

          {/* Quick replies dropdown overlay */}
          {showQuickReplies && (
            <div
              ref={quickRepliesRef}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute bottom-16 left-4 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-2xl p-4 w-[360px] max-h-[300px] flex flex-col z-30 animate-slide-up"
            >
              <div className="flex items-center justify-between border-b dark:border-wa-dark-border pb-2 mb-2 shrink-0">
                <span className="text-xs font-bold text-wa-green uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 fill-wa-green/25" /> Quick replies templates
                </span>
                <button onClick={() => setShowQuickReplies(false)} className="p-1 rounded-lg hover:bg-wa-bg">
                  <X className="w-4 h-4 text-wa-text-secondary" />
                </button>
              </div>

              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search synced templates..."
                className="w-full text-xs px-3 py-2 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none mb-2 shrink-0"
              />

              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-8 gap-1.5 text-xs text-wa-text-secondary">
                    <Loader2 className="w-4 h-4 animate-spin text-wa-green" />
                    <span>Loading templates...</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <p className="text-[11px] text-center text-wa-text-secondary py-6">No matching templates synced.</p>
                ) : (
                  filteredTemplates.map(tmpl => {
                    const bodyText = getTemplateBodyText(tmpl);
                    const hasButtons = tmpl.components?.some(c => c.type === 'BUTTONS' && c.buttons?.length > 0);
                    return (
                      <div
                        key={tmpl._id}
                        className="w-full text-left p-2.5 rounded-xl bg-wa-bg hover:bg-wa-green/10 dark:bg-wa-dark-header/40 border border-wa-border/35 dark:border-wa-dark-border/20 hover:border-wa-green/20 group transition-all"
                      >
                        <div className="flex items-center justify-between mb-1 gap-1">
                          <span
                            onClick={() => handleSendTemplate(tmpl)}
                            className="block text-xs font-bold text-wa-text-primary dark:text-white truncate group-hover:text-wa-green transition-colors cursor-pointer flex-1"
                            title={tmpl.name}
                          >
                            {tmpl.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {hasButtons && (
                              <span className="text-[9px] px-1 py-0.5 bg-wa-green/15 text-wa-green rounded font-normal font-sans">
                                Buttons
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectQuickReply(bodyText);
                              }}
                              title="Insert into chat input"
                              className="text-[10px] text-wa-text-secondary hover:text-wa-green px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-0.5 transition-colors"
                            >
                              <ArrowUpLeft className="w-2.5 h-2.5" /> Text
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendTemplate(tmpl);
                              }}
                              title="Send WhatsApp Template"
                              className="text-[10px] font-bold text-white bg-wa-green hover:bg-wa-green-hover px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Send className="w-2.5 h-2.5" /> Send
                            </button>
                          </div>
                        </div>
                        <p
                          onClick={() => handleSendTemplate(tmpl)}
                          className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary line-clamp-2 cursor-pointer font-sans"
                        >
                          {bodyText}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* AI REPLY SUGGESTIONS BAR (ONLY IN HUMAN REPLY MODE) */}
          {isHumanReplyMode && (
            <div className="mb-2 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-indigo-950/30 border border-emerald-500/20 dark:border-emerald-600/30 rounded-2xl p-2.5 backdrop-blur-md transition-all duration-200 shadow-sm animate-fade-in">
              {/* Suggestions Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-xs font-bold text-wa-text-primary dark:text-white">
                      AI Reply Assistant
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 uppercase tracking-wider">
                      Human Mode
                    </span>
                  </div>

                  {/* Mode / Tabs: Customer Inquiry vs Polished Draft */}
                  <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg border border-black/5 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setSuggestionTab('customer')}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 ${
                        suggestionTab === 'customer'
                          ? 'bg-white dark:bg-wa-dark-panel text-emerald-700 dark:text-emerald-400 shadow-xs'
                          : 'text-wa-text-secondary hover:text-wa-text-primary'
                      }`}
                    >
                      💬 Customer Reply {aiSuggestions.length > 0 && `(${aiSuggestions.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSuggestionTab('draft');
                        if (draftSuggestions.length === 0 && text.trim()) {
                          handlePolishDraft();
                        }
                      }}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 ${
                        suggestionTab === 'draft'
                          ? 'bg-white dark:bg-wa-dark-panel text-indigo-700 dark:text-indigo-400 shadow-xs'
                          : 'text-wa-text-secondary hover:text-wa-text-primary'
                      }`}
                      title={text.trim() ? "Polish what you've typed" : "Type a reply below to polish it"}
                    >
                      <span>✨ Polish Draft</span>
                      {draftSuggestions.length > 0 ? (
                        `(${draftSuggestions.length})`
                      ) : text.trim() ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      ) : null}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (suggestionTab === 'draft') {
                        if (text.trim()) {
                          handlePolishDraft();
                        } else {
                          toast.error('Type a draft message first to polish!');
                        }
                      } else {
                        fetchAISuggestions(true, null);
                      }
                    }}
                    disabled={loadingSuggestions}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 px-2 py-0.5 rounded-lg hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    title={suggestionTab === 'draft' ? "Regenerate draft improvements" : "Regenerate smart customer replies"}
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                    <span>{loadingSuggestions ? 'Thinking...' : 'Regenerate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSuggestionsPanel(!showSuggestionsPanel)}
                    className="p-1 rounded-lg text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                    title={showSuggestionsPanel ? 'Minimize suggestions' : 'Expand suggestions'}
                  >
                    {showSuggestionsPanel ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Suggestions Cards (collapsible) */}
              {showSuggestionsPanel && (
                <div className="space-y-1.5">
                  {loadingSuggestions ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-wa-text-secondary">
                      <Loader2 className="w-4 h-4 animate-spin text-wa-green" />
                      <span>
                        {suggestionTab === 'draft'
                          ? 'Polishing your draft into 3 better variations...'
                          : 'Analyzing chat & drafting smart suggestions...'}
                      </span>
                    </div>
                  ) : suggestionTab === 'draft' ? (
                    /* DRAFT POLISH VIEW */
                    draftSuggestions.length === 0 ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between p-2.5 rounded-xl bg-white/70 dark:bg-wa-dark-panel/70 border border-indigo-200 dark:border-indigo-900/40 text-xs gap-2">
                        <div className="flex items-center gap-1.5 text-wa-text-secondary text-[11px]">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>
                            {text.trim()
                              ? `You have typed: "${text.length > 40 ? text.slice(0, 40) + '...' : text}". Click to get 3 improved versions!`
                              : 'Type your reply in the message box below, then click "Polish Draft" to get better versions!'}
                          </span>
                        </div>
                        {text.trim() && (
                          <button
                            type="button"
                            onClick={handlePolishDraft}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all shrink-0 shadow-xs"
                          >
                            <Sparkles className="w-3 h-3" /> Polish My Draft
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-[11px] px-1 pb-1">
                          <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                            <Sparkles className="w-3 h-3" /> 3 Improved versions of your draft:
                          </span>
                          {originalDraft && text !== originalDraft && (
                            <button
                              type="button"
                              onClick={handleRestoreDraft}
                              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 font-bold"
                              title={`Restore: "${originalDraft.slice(0, 30)}..."`}
                            >
                              ↩️ Restore original draft
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {draftSuggestions.map((suggestion, idx) => {
                            const badges = [
                              { label: 'Polished & Direct', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
                              { label: 'Warm & Friendly', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
                              { label: 'Action-Oriented', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
                            ];
                            const badge = badges[idx % badges.length];

                            return (
                              <div
                                key={idx}
                                className="group relative flex flex-col justify-between p-2.5 rounded-xl bg-white/80 dark:bg-wa-dark-panel/90 border border-indigo-200/80 dark:border-indigo-900/60 hover:border-indigo-500 hover:shadow-sm transition-all duration-150 text-left"
                              >
                                <div
                                  onClick={() => handleUseSuggestion(suggestion, true)}
                                  className="cursor-pointer flex-1"
                                  title="Click to replace input with this version"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badge.color}`}>
                                      {badge.label}
                                    </span>
                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                      Use version ✍️
                                    </span>
                                  </div>
                                  <p className="text-[12px] text-wa-text-primary dark:text-white line-clamp-3 leading-snug font-sans">
                                    {suggestion}
                                  </p>
                                </div>

                                <div className="mt-2 pt-1.5 border-t border-wa-border/40 dark:border-wa-dark-border/40 flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUseSuggestion(suggestion, true)}
                                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium flex items-center gap-1 hover:underline"
                                  >
                                    <ArrowUpLeft className="w-3 h-3" /> Apply to input
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickSendSuggestion(suggestion)}
                                    className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all shadow-xs"
                                    title="Send this reply immediately"
                                  >
                                    <Send className="w-2.5 h-2.5" /> Send
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )
                  ) : (
                    /* CUSTOMER CONTEXT SUGGESTIONS VIEW */
                    aiSuggestions.length === 0 ? (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-wa-dark-panel/70 border border-wa-border/40 text-xs">
                        <span className="text-wa-text-secondary text-[11px]">No suggestions generated yet.</span>
                        <button
                          type="button"
                          onClick={() => fetchAISuggestions(true, null)}
                          className="text-xs font-bold text-wa-green hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> Generate Suggestions
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {aiSuggestions.map((suggestion, idx) => {
                          const badges = [
                            { label: 'Direct', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
                            { label: 'Friendly', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
                            { label: 'Action', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
                          ];
                          const badge = badges[idx % badges.length];

                          return (
                            <div
                              key={idx}
                              className="group relative flex flex-col justify-between p-2.5 rounded-xl bg-white/80 dark:bg-wa-dark-panel/90 border border-wa-border/60 dark:border-wa-dark-border/60 hover:border-wa-green hover:shadow-sm transition-all duration-150 text-left"
                            >
                              <div
                                onClick={() => handleUseSuggestion(suggestion, false)}
                                className="cursor-pointer flex-1"
                                title="Click to insert into input field"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badge.color}`}>
                                    {badge.label}
                                  </span>
                                  <span className="text-[10px] text-wa-text-secondary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                    Click to insert ✍️
                                  </span>
                                </div>
                                <p className="text-[12px] text-wa-text-primary dark:text-white line-clamp-3 leading-snug font-sans">
                                  {suggestion}
                                </p>
                              </div>

                              <div className="mt-2 pt-1.5 border-t border-wa-border/40 dark:border-wa-dark-border/40 flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUseSuggestion(suggestion, false)}
                                  className="text-[10px] text-wa-text-secondary hover:text-wa-text-primary font-medium flex items-center gap-1 hover:underline"
                                >
                                  <ArrowUpLeft className="w-3 h-3 text-wa-green" /> Use text
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickSendSuggestion(suggestion)}
                                  className="text-[10px] font-bold text-white bg-wa-green hover:bg-wa-green-hover px-2 py-0.5 rounded-md flex items-center gap-1 transition-all shadow-xs"
                                  title="Send this reply immediately"
                                >
                                  <Send className="w-2.5 h-2.5" /> Send
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* AI Suggestion Button for Human Mode */}
            {isHumanReplyMode && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (text.trim()) {
                    handlePolishDraft();
                  } else {
                    fetchAISuggestions(true, null);
                  }
                }}
                disabled={loadingSuggestions}
                className="w-10 h-10 rounded-full flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors shrink-0"
                title={text.trim() ? "Polish typed message with AI" : "Generate AI Reply Suggestions"}
              >
                <Sparkles className={`w-5 h-5 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={toggleQuickReplies}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${showQuickReplies ? 'text-wa-green bg-wa-green/10' : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'}`}
              title="Access Template Shortcuts"
            >
              <Zap className="w-6 h-6" />
            </button>

            <div className="relative" ref={emojiRef}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setEmojiSearch(''); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${showEmojiPicker ? 'text-wa-green bg-wa-green/10' : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'}`}
                title="Emoji Picker"
              >
                <Smile className="w-6 h-6" />
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-14 left-0 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-2xl w-[340px] flex flex-col z-30 animate-slide-up overflow-hidden" style={{ height: '380px' }}>
                  {/* Header */}
                  <div className="px-3 pt-3 pb-2 border-b border-wa-border dark:border-wa-dark-border shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-text-light" />
                      <input
                        type="text"
                        value={emojiSearch}
                        onChange={(e) => setEmojiSearch(e.target.value)}
                        placeholder="Search emojis..."
                        className="w-full pl-9 pr-3 py-2 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-1 focus:ring-wa-green/30 transition-all"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Category Tabs */}
                  {!emojiSearch.trim() && (
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-wa-border/50 dark:border-wa-dark-border/50 shrink-0 bg-wa-bg/30 dark:bg-wa-dark-header/20">
                      {Object.entries(emojiData).map(([key, cat]) => (
                        <button
                          key={key}
                          onClick={() => setEmojiCategory(key)}
                          title={cat.title}
                          className={`flex-1 py-1.5 rounded-lg text-center text-sm transition-all duration-150 ${emojiCategory === key
                              ? 'bg-wa-green/15 shadow-sm scale-105'
                              : 'hover:bg-wa-hover dark:hover:bg-wa-dark-hover opacity-60 hover:opacity-100'
                            }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category Title */}
                  <div className="px-3 pt-2 pb-1 shrink-0">
                    <span className="text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider">
                      {emojiSearch.trim() ? `Search results` : emojiData[emojiCategory]?.title}
                    </span>
                  </div>

                  {/* Emoji Grid */}
                  <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
                    <div className="grid grid-cols-8 gap-0.5">
                      {filteredEmojis.map((emoji, idx) => (
                        <button
                          key={`${emoji}-${idx}`}
                          onClick={() => handleEmojiSelect(emoji)}
                          className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-wa-green/10 hover:scale-110 active:scale-95 transition-all duration-100"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    {filteredEmojis.length === 0 && (
                      <div className="text-center py-8 text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
                        No emojis found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={attachRef}>
              <button
                onClick={() => setShowAttach(!showAttach)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors shrink-0"
              >
                <Paperclip className="w-6 h-6" />
              </button>

              {/* Hidden file input elements */}
              <input
                type="file"
                ref={docInputRef}
                onChange={(e) => handleFileUpload(e, 'document')}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              />
              <input
                type="file"
                ref={imageInputRef}
                onChange={(e) => handleFileUpload(e, 'image')}
                className="hidden"
                accept="image/*"
              />

              {showAttach && (
                <div className="absolute bottom-14 left-0 bg-white dark:bg-wa-dark-panel rounded-xl shadow-wa-lg border border-wa-border dark:border-wa-dark-border py-2 animate-slide-up z-20 min-w-[180px]">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="wa-dropdown-item w-full disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white"><Image className="w-4 h-4" /></div>
                    Photos
                  </button>
                </div>
              )}
            </div>

            {showTakeoverBanner ? (
              <div className="flex-1 flex items-center justify-between bg-purple-50 dark:bg-purple-950/20 border border-purple-100/50 dark:border-purple-900/30 rounded-xl px-4 py-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4.5 h-4.5 text-purple-500 animate-pulse" />
                  <span className="text-[12.5px] text-purple-900 dark:text-purple-300 font-medium">
                    AI is currently handling this chat. Take over to start chatting.
                  </span>
                </div>
                <button
                  onClick={handleAssign}
                  className="px-3.5 py-1.5 bg-wa-green hover:bg-wa-green-hover text-white text-xs font-bold rounded-lg shadow-sm hover:shadow active:scale-[0.98] transition-all flex items-center gap-1 shrink-0"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Take Over</span>
                </button>
              </div>
            ) : isLockedByOther ? (
              <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/30 rounded-xl px-4 py-2.5">
                <Shield className="w-4.5 h-4.5 text-slate-400" />
                <span className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium">
                  Locked and assigned to {conversation.assignedAgent?.name || 'another agent'}.
                </span>
              </div>
            ) : (
              <>
                <div className="relative flex-1 flex flex-col justify-end">
                  {/* Active Voice-to-Text Listening Banner */}
                  {isListening && (
                    <div className="absolute left-0 -top-11 right-0 z-20 flex items-center justify-between px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500/15 via-amber-500/15 to-emerald-500/15 dark:from-rose-950/40 dark:via-amber-950/40 dark:to-emerald-950/40 border border-rose-500/30 backdrop-blur-md shadow-md animate-fade-in">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 shrink-0">
                          <Mic className="w-3.5 h-3.5 animate-pulse" />
                          <span>Listening...</span>
                          <span className="font-mono text-[10px] bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded">
                            {Math.floor(voiceDuration / 60)}:{(voiceDuration % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden md:inline">
                          Speak now — voice automatically types into box
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Language switcher chips */}
                        <div className="flex items-center gap-0.5 bg-white/70 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                          {[
                            { code: 'hi-IN', label: 'हिन्दी' },
                            { code: 'en-IN', label: 'English' },
                            { code: 'gu-IN', label: 'ગુજરાતી' },
                          ].map((l) => (
                            <button
                              key={l.code}
                              type="button"
                              onClick={() => {
                                setSpeechLang(l.code);
                                stopListening();
                                setTimeout(() => startListening(l.code), 120);
                              }}
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                speechLang === l.code
                                  ? 'bg-rose-500 text-white'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-rose-600'
                              }`}
                            >
                              {l.label}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={stopListening}
                          className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold rounded-md flex items-center gap-1 transition-colors"
                        >
                          <Square className="w-2.5 h-2.5 fill-white" /> Done
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Floating 'Polish Draft' button when human mode is ON and user has typed >= 2 characters */}
                  {isHumanReplyMode && text.trim().length >= 2 && !isListening && (
                    <button
                      type="button"
                      onClick={handlePolishDraft}
                      disabled={loadingSuggestions}
                      className="absolute right-2 -top-7 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-60 animate-fade-in"
                      title="Generate 3 better & improved versions of what you typed"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${loadingSuggestions && suggestionTab === 'draft' ? 'animate-spin' : ''}`} />
                      <span>{loadingSuggestions && suggestionTab === 'draft' ? 'Polishing...' : '✨ Polish Draft'}</span>
                    </button>
                  )}

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (!e.shiftKey && !e.ctrlKey) {
                          e.preventDefault();
                          if (isListening) stopListening();
                          handleSend();
                        }
                      }
                    }}
                    className="w-full px-4 py-[9px] bg-wa-panel dark:bg-wa-dark-input rounded-xl text-[14.5px] text-wa-text-primary dark:text-white placeholder-wa-text-light focus:outline-none border border-transparent focus:border-wa-border resize-none leading-normal min-h-[42px] max-h-[140px]"
                    placeholder={isListening ? "Listening to your voice... Speak now..." : "Type a message..."}
                  />
                </div>

                {/* Voice-to-Text Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    isListening
                      ? 'bg-rose-500 text-white shadow-lg animate-pulse scale-105'
                      : text.trim()
                        ? 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover hover:text-rose-500'
                        : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                  title={isListening ? "Listening... Click to stop voice-to-text" : "Click to speak (Voice-to-Text in Hindi / English / Gujarati)"}
                >
                  {isListening ? (
                    <Square className="w-4 h-4 fill-white" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>

                {/* Send Button */}
                {text.trim() && (
                  <button
                    onClick={() => {
                      if (isListening) stopListening();
                      handleSend();
                    }}
                    disabled={sending}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-wa-green hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors disabled:opacity-50 shrink-0"
                    title="Send message"
                  >
                    <Send className="w-6 h-6 fill-wa-green/10" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: CRM SIDEBAR PANEL — MODAL OVERLAY */}
      {showSidebar && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-30 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
          {/* Sidebar */}
          <div className="fixed md:static right-0 top-0 bottom-0 w-[330px] md:w-[330px] border-l border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel flex flex-col h-full animate-slide-in-right shrink-0 z-40 md:z-20 md:relative">

            {/* Header */}
            <div className="h-[60px] border-b border-wa-border dark:border-wa-dark-border px-5 flex items-center justify-between bg-wa-bg/30 dark:bg-wa-dark-header/40 shrink-0">
              <span className="font-bold text-sm text-wa-text-primary dark:text-white uppercase tracking-wider">Contact Info</span>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1.5 rounded-xl text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-bg dark:hover:bg-wa-dark-header transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">

              {/* Avatar & Profile */}
              <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-wa-border dark:border-wa-dark-border">
                <div className={`w-20 h-20 rounded-full ${avatarClass} flex items-center justify-center font-bold text-2xl shadow-inner relative border-2 border-white dark:border-wa-dark-panel`}>
                  {initials}
                </div>
                <div className="w-full space-y-2">
                  {editName ? (
                    <div className="flex items-center gap-1.5 max-w-[260px] mx-auto bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl p-1">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-center font-bold text-sm bg-transparent border-none focus:outline-none dark:text-white"
                        disabled={updatingCrm}
                      />
                      <button
                        onClick={handleSaveName}
                        className="p-1.5 bg-wa-green/10 text-wa-green hover:bg-wa-green/20 rounded-lg transition-colors"
                        title="Save Name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditName(false); setNameInput(contact.name || ''); }}
                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h4 className="font-bold text-base text-wa-text-primary dark:text-white flex items-center justify-center gap-1.5 group">
                      <span>{contact.name || 'Unknown Contact'}</span>
                      <button
                        onClick={() => setEditName(true)}
                        className="text-wa-text-secondary hover:text-wa-green p-1 rounded-md hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                        title="Edit Name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </h4>
                  )}

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-full text-xs font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono">
                    <Phone className="w-3 h-3 text-wa-text-light" />
                    <span>{contact.phone}</span>
                  </div>
                </div>
              </div>

              {/* AI Conversation Summary Card in CRM Sidebar */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="block text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    AI Chat Summary
                  </span>
                  {summaryData?.executiveSummary && (
                    <button
                      onClick={() => fetchConversationSummary(true)}
                      disabled={loadingSummary}
                      className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                      title="Re-generate AI summary"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${loadingSummary ? 'animate-spin' : ''}`} />
                      <span>{loadingSummary ? 'Updating...' : 'Refresh'}</span>
                    </button>
                  )}
                </div>

                <div className="bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-indigo-500/10 dark:from-teal-950/30 dark:via-emerald-950/20 dark:to-indigo-950/30 border border-teal-500/20 dark:border-teal-800/40 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                  {loadingSummary ? (
                    <div className="py-3 text-center text-xs text-wa-text-secondary flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                      <span>Generating AI Summary...</span>
                    </div>
                  ) : summaryData?.executiveSummary ? (
                    <>
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {summaryData.customerIntent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
                            🎯 {summaryData.customerIntent}
                          </span>
                        )}
                        {summaryData.sentiment && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold capitalize ${
                            summaryData.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' :
                            summaryData.sentiment === 'frustrated' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' :
                            summaryData.sentiment === 'urgent' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                          }`}>
                            {summaryData.sentiment === 'positive' ? '😊 Positive' :
                             summaryData.sentiment === 'frustrated' ? '😠 Frustrated' :
                             summaryData.sentiment === 'urgent' ? '🚨 Urgent' : '😐 Neutral'}
                          </span>
                        )}
                        {summaryData.resolutionStatus && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                            {summaryData.resolutionStatus}
                          </span>
                        )}
                      </div>

                      {/* Summary Body */}
                      <p className="text-xs text-wa-text-primary dark:text-white leading-relaxed line-clamp-3 font-sans">
                        {summaryData.executiveSummary}
                      </p>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-teal-500/15 dark:border-teal-800/30 text-[11px]">
                        <button
                          onClick={() => setShowSummaryModal(true)}
                          className="font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                        >
                          View Full Details →
                        </button>
                        <button
                          onClick={handleSaveSummaryAsNote}
                          disabled={savingSummaryNote}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-wa-dark-header border border-wa-border text-wa-text-secondary hover:text-wa-text-primary hover:border-wa-green transition-colors flex items-center gap-1"
                          title="Save this summary to internal contact notes timeline"
                        >
                          <Save className="w-2.5 h-2.5 text-wa-green" />
                          <span>{savingSummaryNote ? 'Saving...' : 'Save as Note'}</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2 space-y-2">
                      <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
                        No summary generated yet for this chat.
                      </p>
                      <button
                        onClick={() => fetchConversationSummary(true)}
                        disabled={loadingSummary}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Sparkles className="w-3 h-3" /> Generate AI Summary
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile fields card */}
              <div className="space-y-3">
                <span className="block text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-widest px-1">Metadata Profile</span>

                <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-4 shadow-sm">

                  {/* Email profile field */}
                  <div className="space-y-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider">
                      <Mail className="w-3.5 h-3.5" />
                      Email Address
                    </span>
                    {editEmail ? (
                      <div className="flex items-center gap-1.5 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl p-1">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs bg-transparent border-none focus:outline-none dark:text-white"
                          disabled={updatingCrm}
                          placeholder="Enter email..."
                        />
                        <button
                          onClick={handleSaveEmail}
                          className="p-1.5 bg-wa-green/10 text-wa-green hover:bg-wa-green/20 rounded-lg transition-colors"
                          title="Save Email"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditEmail(false); setEmailInput(contact.email || ''); }}
                          className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 group min-h-[28px]">
                        <span className="text-xs text-wa-text-primary dark:text-white font-medium select-all truncate">
                          {contact.email || <span className="italic text-slate-400 dark:text-slate-500">No email linked</span>}
                        </span>
                        <button
                          onClick={() => setEditEmail(true)}
                          className="text-wa-text-secondary hover:text-wa-green p-1 rounded-md hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors shrink-0"
                          title="Edit Email"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Database Source field */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider">
                      <User className="w-3.5 h-3.5" />
                      Signup Source
                    </span>
                    <span className="inline-block text-xs font-semibold text-wa-text-primary dark:text-white capitalize px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-650 dark:text-slate-355">
                      {contact.source || 'manual'}
                    </span>
                  </div>

                  {/* Marketing Campaign Opt-out field */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider">
                        <Shield className="w-3.5 h-3.5" />
                        Campaign Subscription
                      </span>
                      <span className={`text-[10px] font-medium ${contact.optedOut ? 'text-red-550' : 'text-emerald-500'}`}>
                        {contact.optedOut ? 'Opted-Out (Stopped)' : 'Subscribed (Receiving)'}
                      </span>
                    </div>
                    <button
                      onClick={handleToggleOptOut}
                      disabled={updatingCrm}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${contact.optedOut ? 'bg-red-500' : 'bg-wa-green'
                        }`}
                      title={contact.optedOut ? 'Opt In' : 'Opt Out'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${contact.optedOut ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tags section card */}
              <div className="space-y-3 pt-1">
                <span className="block text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-widest px-1">Audience Tags</span>

                <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3.5 shadow-sm">
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags && contact.tags.length > 0 ? (
                      contact.tags.map(t => {
                        const tagStyles = getTagColorClass(t);
                        return (
                          <span
                            key={t}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${tagStyles.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${tagStyles.dot}`} />
                            <span>{t}</span>
                            <button
                              onClick={() => handleRemoveTag(t)}
                              className="hover:text-red-500 font-bold shrink-0 ml-1 transition-colors hover:scale-110"
                              title="Remove Tag"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary italic">No tags associated.</span>
                    )}
                  </div>

                  <div className="relative mt-1">
                    <Tag className="absolute left-3 top-2.5 w-3.5 h-3.5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                    <input
                      type="text"
                      placeholder="Type tag & press Enter..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={handleAddTag}
                      disabled={updatingCrm}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Notes Section card */}
              <div className="space-y-3 pt-1">
                <span className="block text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-widest px-1">Internal Notes & Timeline</span>

                <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-sm">

                  {/* Note Entry Area */}
                  <form onSubmit={handleCreateNote} className="space-y-2">
                    <textarea
                      rows={2}
                      placeholder="Add internal note..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green resize-none transition-all"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={updatingCrm || !newNoteText.trim()}
                        className="px-3 py-1 bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 text-white font-semibold text-[11px] rounded-lg flex items-center gap-1 shadow-sm transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Note</span>
                      </button>
                    </div>
                  </form>

                  {/* Notes History list */}
                  <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800">
                    {notesLoading ? (
                      <div className="py-4 text-center text-wa-text-secondary flex items-center justify-center gap-2 text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-wa-green" /> Loading notes...
                      </div>
                    ) : notes.length === 0 ? (
                      <div className="py-4 text-center text-wa-text-secondary italic text-xs">
                        No internal notes logged yet.
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2">
                        {notes.map((note) => {
                          const author = note.createdBy || {};
                          const authorInitials = author.name ? author.name.substring(0, 2).toUpperCase() : 'US';
                          const isEditing = editingNoteId === note._id;

                          return (
                            <div
                              key={note._id}
                              className={`group border relative transition-all duration-200 rounded-xl p-3 shadow-xs bg-white dark:bg-wa-dark-panel ${note.isPinned
                                  ? 'border-wa-green/35 dark:border-wa-green/30 bg-wa-green/[0.01]'
                                  : 'border-wa-border dark:border-wa-dark-border/60 hover:border-wa-border-hover'
                                }`}
                            >
                              {/* Note Header */}
                              <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-wa-bg dark:bg-wa-dark-header flex items-center justify-center font-bold text-[9px] text-wa-text-secondary border border-wa-border shrink-0">
                                    {authorInitials}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-wa-text-primary dark:text-white text-[11px] block leading-none truncate">
                                      {author.name || 'User'}
                                    </span>
                                    <span className="text-[8px] text-wa-text-secondary font-mono">
                                      {new Date(note.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handlePinNote(note._id, note.isPinned)}
                                    className={`p-1 rounded hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors ${note.isPinned ? 'text-wa-green' : 'text-wa-text-light'
                                      }`}
                                    title={note.isPinned ? 'Unpin' : 'Pin'}
                                  >
                                    <Pin className={`w-3 h-3 ${note.isPinned ? '' : 'rotate-45'}`} />
                                  </button>
                                  {!isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => { setEditingNoteId(note._id); setEditingNoteText(note.note); }}
                                      className="p-1 rounded hover:bg-wa-hover dark:hover:bg-wa-dark-hover text-blue-500 transition-colors"
                                      title="Edit"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(note._id)}
                                    className="p-1 rounded hover:bg-wa-hover dark:hover:bg-wa-dark-hover text-red-500 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Note Body */}
                              <div className="text-[11px] text-wa-text-primary dark:text-wa-dark-text-primary leading-relaxed font-medium pl-6">
                                {isEditing ? (
                                  <div className="space-y-1.5 mt-1">
                                    <textarea
                                      rows={2}
                                      value={editingNoteText}
                                      onChange={(e) => setEditingNoteText(e.target.value)}
                                      className="w-full px-2 py-1 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green resize-none"
                                    />
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditingNoteId(null)}
                                        className="px-2 py-1 bg-wa-bg dark:bg-wa-dark-panel hover:bg-wa-hover border border-wa-border dark:border-wa-dark-border text-[9px] font-bold text-wa-text-secondary rounded transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditNote(note._id)}
                                        className="px-2 py-1 bg-wa-green hover:bg-wa-green-hover text-white text-[9px] font-bold rounded transition-colors flex items-center gap-0.5"
                                      >
                                        <Save className="w-2.5 h-2.5" /> Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap">{note.note}</p>
                                )}
                              </div>

                              {/* Pin label */}
                              {note.isPinned && (
                                <span className="absolute top-0 right-14 text-[8px] bg-wa-green/10 text-wa-green px-1 py-0.2 rounded-b border-b border-x border-wa-green/20 font-bold uppercase tracking-wider scale-90 origin-top">
                                  Pinned
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Delete Chat Action card */}
              <div className="space-y-3 pt-1">
                <span className="block text-[10px] font-bold text-red-500 uppercase tracking-widest px-1">Danger Zone</span>

                <div className="bg-red-50/30 dark:bg-red-950/5 border border-red-100 dark:border-red-900/20 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex gap-2 text-xs text-red-700 dark:text-red-450">
                    <Trash2 className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <span>Deleting this chat will permanently remove all messages and history with this customer.</span>
                  </div>
                  <button
                    onClick={handleDeleteChat}
                    disabled={updatingCrm}
                    className="w-full py-2 bg-transparent hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Chat History
                  </button>
                </div>
              </div>

            </div>

            {/* Footer loader indicator */}
            {updatingCrm && (
              <div className="p-3 bg-wa-bg dark:bg-wa-dark-header border-t border-wa-border dark:border-wa-dark-border flex items-center justify-center gap-1.5 text-xs text-wa-text-secondary shrink-0">
                <Loader2 className="w-4.5 h-4.5 animate-spin text-wa-green" />
                <span>Saving changes...</span>
              </div>
            )}

          </div>
        </>
      )}


      {/* MODAL: SEND CONTACT CARD */}
      {isContactModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in">
              <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
                <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Send Contact Card</h3>
                <button onClick={() => setIsContactModalOpen(false)} className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors">
                  <X className="w-5 h-5 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                </button>
              </div>

              <form onSubmit={handleSendContactCard} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Contact Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                    <input
                      type="text"
                      required
                      placeholder="Name of contact"
                      value={contactCardName}
                      onChange={(e) => setContactCardName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-wa-text-secondary dark:text-wa-dark-text-secondary mb-1.5">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-wa-text-secondary dark:text-wa-dark-text-secondary" />
                    <input
                      type="tel"
                      required
                      placeholder="+1234567890"
                      value={contactCardPhone}
                      onChange={(e) => setContactCardPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-wa-border dark:border-wa-dark-border">
                  <button
                    type="button"
                    onClick={() => setIsContactModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold border border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel hover:bg-wa-bg rounded-xl text-wa-text-primary dark:text-wa-dark-text-primary transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md transition-all duration-200"
                  >
                    Send Card
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* MODAL: PDF PREVIEW */}
      {previewPdfUrl && (
        <Portal>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-5xl h-[85vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-bg dark:bg-wa-dark-header">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-wa-text-primary dark:text-wa-dark-text-primary truncate mr-4">
                    {previewPdfName || "PDF Document"}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={previewPdfUrl}
                    download={previewPdfName || "document.pdf"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-wa-green/10 text-wa-green border border-wa-green/20 hover:bg-wa-green hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </a>
                  <button
                    onClick={() => {
                      setPreviewPdfUrl(null);
                      setPreviewPdfName('');
                    }}
                    className="p-1.5 rounded-xl hover:bg-wa-border dark:hover:bg-wa-dark-border transition-colors text-wa-text-secondary dark:text-wa-dark-text-secondary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-wa-bg/15 dark:bg-wa-dark-bg/10 relative p-4 flex justify-center items-center">
                <iframe
                  src={previewPdfUrl}
                  className="w-full h-full border-none rounded-xl bg-white shadow-inner"
                  title={previewPdfName || "PDF Preview"}
                />
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* AI CONVERSATION SUMMARY MODAL */}
      {showSummaryModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-wa-text-primary dark:text-white leading-tight">
                      Conversation Summary & Intelligence
                    </h3>
                    <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary">
                      {contact.name || contact.phone || 'Customer'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="p-1.5 rounded-xl text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Month / Period & Translation Bar */}
              <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/40 border-b border-wa-border dark:border-wa-dark-border flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-xs font-bold text-wa-text-primary dark:text-white">
                    Summary Period:
                  </span>
                  <select
                    value={selectedSummaryMonth}
                    onChange={(e) => {
                      const newMonth = e.target.value;
                      setSelectedSummaryMonth(newMonth);
                      setSummaryTranslation(null);
                      fetchConversationSummary(false, newMonth);
                    }}
                    disabled={loadingSummary || translatingSummary}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-teal-500/30 bg-white dark:bg-wa-dark-header text-wa-text-primary dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
                  >
                    {availableSummaryMonths.length > 0 ? (
                      availableSummaryMonths.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} {m.isCurrent ? '• (Current Month)' : ''} ({m.messageCount || 0} msgs)
                        </option>
                      ))
                    ) : (
                      <option value="">Current Month</option>
                    )}
                  </select>
                </div>

                {/* Translation Controls */}
                <div className="flex items-center gap-1.5">
                  {summaryTranslation ? (
                    <div className="flex items-center gap-1 bg-white dark:bg-wa-dark-header border border-teal-500/30 rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setSummaryTranslation(prev => ({ ...prev, showOriginal: true }))}
                        className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                          summaryTranslation.showOriginal
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                        title="Show original untranslated summary"
                      >
                        Original
                      </button>
                      <button
                        type="button"
                        onClick={() => setSummaryTranslation(prev => ({ ...prev, showOriginal: false }))}
                        className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                          !summaryTranslation.showOriginal
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                        title={`Showing in ${summaryTranslation.targetLangName}`}
                      >
                        <Globe className="w-3 h-3 shrink-0" />
                        <span>{summaryTranslation.targetLangName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTranslateModalMsg({
                            isSummary: true,
                            text: summaryData?.executiveSummary || ''
                          });
                          setTranslateSearch('');
                          setTranslateActiveTab('popular');
                        }}
                        disabled={translatingSummary}
                        className="p-1 text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:bg-teal-500/10 rounded transition-colors"
                        title="Change translation language"
                      >
                        <Languages className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTranslateModalMsg({
                          isSummary: true,
                          text: summaryData?.executiveSummary || ''
                        });
                        setTranslateSearch('');
                        setTranslateActiveTab('popular');
                      }}
                      disabled={loadingSummary || translatingSummary || !summaryData?.executiveSummary}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-95 shadow-2xs"
                      title="Translate Summary into 130+ languages (Hindi, Gujarati, Marathi, Spanish, etc.)"
                    >
                      <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>{translatingSummary ? 'Translating...' : 'Translate'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
                {loadingSummary || translatingSummary ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-wa-text-secondary">
                    <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
                    <span className="text-sm font-semibold">
                      {translatingSummary ? 'Translating AI Summary...' : 'Generating AI Conversation Summary...'}
                    </span>
                    <span className="text-xs text-wa-text-light">
                      {translatingSummary
                        ? 'Translating overview, key discussion points, and action items...'
                        : `Reading messages ${summaryData?.monthLabel ? `for ${summaryData.monthLabel}` : ''} and analyzing context...`}
                    </span>
                  </div>
                ) : !summaryData?.executiveSummary ? (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-sm text-wa-text-secondary">No summary has been generated for this period yet.</p>
                    <button
                      onClick={() => fetchConversationSummary(true, selectedSummaryMonth)}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Sparkles className="w-4 h-4" /> Generate Summary Now
                    </button>
                  </div>
                ) : (() => {
                  const isTranslatedActive = summaryTranslation && !summaryTranslation.showOriginal;
                  const displayExecutiveSummary = isTranslatedActive ? summaryTranslation.executiveSummary : summaryData.executiveSummary;
                  const displayKeyPoints = isTranslatedActive ? summaryTranslation.keyPoints : summaryData.keyPoints;
                  const displayActionItems = isTranslatedActive ? summaryTranslation.actionItems : summaryData.actionItems;
                  const displayIntent = isTranslatedActive ? summaryTranslation.customerIntent : summaryData.customerIntent;

                  return (
                    <>
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        {summaryData.monthLabel && (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-slate-400 font-medium">Period:</span>
                            <span className="font-bold text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/40">
                              📅 {summaryData.monthLabel}
                            </span>
                          </div>
                        )}
                        {isTranslatedActive && summaryTranslation?.targetLangName && (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-slate-400 font-medium">Language:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                              <Globe className="w-3 h-3" /> {summaryTranslation.targetLangName}
                            </span>
                          </div>
                        )}
                        {displayIntent && (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-slate-400 font-medium">Intent:</span>
                            <span className="font-bold text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/30">
                              🎯 {displayIntent}
                            </span>
                          </div>
                        )}
                        {summaryData.sentiment && (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-slate-400 font-medium">Sentiment:</span>
                            <span className={`font-bold px-2 py-0.5 rounded capitalize ${
                              summaryData.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' :
                              summaryData.sentiment === 'frustrated' ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' :
                              summaryData.sentiment === 'urgent' ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' :
                              'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {summaryData.sentiment === 'positive' ? '😊 Positive' :
                               summaryData.sentiment === 'frustrated' ? '😠 Frustrated' :
                               summaryData.sentiment === 'urgent' ? '🚨 Urgent' : '😐 Neutral'}
                            </span>
                          </div>
                        )}
                        {summaryData.resolutionStatus && (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-slate-400 font-medium">Status:</span>
                            <span className="font-bold text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30">
                              {summaryData.resolutionStatus}
                            </span>
                          </div>
                        )}
                        {summaryData.messageCountAtGeneration > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-wa-text-secondary ml-auto">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{summaryData.messageCountAtGeneration} msgs analyzed</span>
                          </div>
                        )}
                      </div>

                      {/* Executive Summary */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-teal-600" /> Executive Overview {summaryData.monthLabel ? `(${summaryData.monthLabel})` : ''}
                          </h4>
                          {isTranslatedActive && (
                            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                              <Globe className="w-3 h-3" /> In {summaryTranslation.targetLangName}
                            </span>
                          )}
                        </div>
                        <div className="p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 text-xs sm:text-[13px] leading-relaxed text-wa-text-primary dark:text-white">
                          {displayExecutiveSummary}
                        </div>
                      </div>

                      {/* Key Discussion Points */}
                      {displayKeyPoints && displayKeyPoints.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Key Discussion Points
                          </h4>
                          <div className="p-3 rounded-xl bg-white dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border space-y-1.5">
                            {displayKeyPoints.map((pt, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-wa-text-primary dark:text-white">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                                <span className="leading-snug">{pt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Next Steps & Action Items */}
                      {displayActionItems && displayActionItems.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-500" /> Next Steps & Action Items
                          </h4>
                          <div className="p-3 rounded-xl bg-amber-50/30 dark:bg-amber-950/15 border border-amber-200/60 dark:border-amber-800/40 space-y-1.5">
                            {displayActionItems.map((act, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-wa-text-primary dark:text-white">
                                <span className="text-amber-500 font-bold shrink-0">→</span>
                                <span className="leading-snug font-medium">{act}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-wa-border dark:border-wa-dark-border flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/30 shrink-0">
                <button
                  type="button"
                  onClick={() => fetchConversationSummary(true, selectedSummaryMonth)}
                  disabled={loadingSummary}
                  className="px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
                  <span>{loadingSummary ? 'Re-analyzing...' : 'Regenerate'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    disabled={!summaryData?.executiveSummary}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-white hover:bg-wa-hover dark:hover:bg-wa-dark-hover flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSummaryAsNote}
                    disabled={savingSummaryNote || !summaryData?.executiveSummary}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-wa-green hover:bg-wa-green-hover text-white flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingSummaryNote ? 'Saving...' : 'Save as Note'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* AI TRANSLATION MODAL (130+ Google Translate Languages) */}
      {translateModalMsg && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-wa-text-primary dark:text-white leading-tight flex items-center gap-1.5">
                      <span>{translateModalMsg.isSummary ? 'Translate AI Summary' : 'Translate Message'}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">
                        133 Languages
                      </span>
                    </h3>
                    <p className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary truncate">
                      Powered by AI & Google Translate
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTranslateModalMsg(null)}
                  className="p-1.5 rounded-xl text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Message Preview Quote */}
              <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {translateModalMsg.isSummary ? 'Translating Conversation Summary' : 'Translating Message'}
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2">
                  &ldquo;{translateModalMsg.text}&rdquo;
                </p>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-wa-border dark:border-wa-dark-border space-y-3 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-wa-text-secondary absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={translateSearch}
                    onChange={(e) => setTranslateSearch(e.target.value)}
                    placeholder="Search languages (e.g. Hindi, Gujarati, Marathi, Spanish, Arabic...)"
                    className="w-full pl-9 pr-8 py-2 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-1 focus:ring-teal-500"
                    autoFocus
                  />
                  {translateSearch && (
                    <button
                      type="button"
                      onClick={() => setTranslateSearch('')}
                      className="absolute right-2.5 top-2.5 text-wa-text-secondary hover:text-wa-text-primary"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                {!translateSearch && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTranslateActiveTab('popular')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        translateActiveTab === 'popular'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-wa-bg dark:bg-wa-dark-header text-wa-text-secondary hover:text-wa-text-primary'
                      }`}
                    >
                      Popular ({POPULAR_LANGUAGES.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranslateActiveTab('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        translateActiveTab === 'all'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-wa-bg dark:bg-wa-dark-header text-wa-text-secondary hover:text-wa-text-primary'
                      }`}
                    >
                      All Languages ({GOOGLE_TRANSLATE_LANGUAGES.length})
                    </button>
                  </div>
                )}
              </div>

              {/* Language List */}
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                {/* Popular Grid when tab is popular and no search */}
                {!translateSearch && translateActiveTab === 'popular' ? (
                  <div className="space-y-3">
                    <span className="block text-[10px] font-bold text-wa-text-secondary uppercase tracking-wider">
                      Quick Access (Most Used)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {POPULAR_LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            if (translateModalMsg.isSummary) {
                              handleTranslateSummary(lang.code, lang.name);
                            } else {
                              handleTranslateMessage(translateModalMsg.msgId, translateModalMsg.text, lang.code, lang.name);
                            }
                            setTranslateModalMsg(null);
                          }}
                          className="flex flex-col items-start p-2.5 rounded-xl border border-wa-border dark:border-wa-dark-border hover:border-teal-500/50 bg-wa-bg/60 dark:bg-wa-dark-header/40 hover:bg-teal-500/10 dark:hover:bg-teal-950/30 transition-all text-left group"
                        >
                          <span className="text-xs font-bold text-wa-text-primary dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                            {lang.name}
                          </span>
                          <span className="text-[11px] text-teal-700 dark:text-teal-300 font-sans mt-0.5">
                            {lang.native}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // All Languages (Filtered by Search)
                  <div className="space-y-1">
                    {filteredLanguages.length === 0 ? (
                      <div className="py-8 text-center text-xs text-wa-text-secondary">
                        No languages matching &ldquo;{translateSearch}&rdquo;
                      </div>
                    ) : (
                      filteredLanguages.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            if (translateModalMsg.isSummary) {
                              handleTranslateSummary(lang.code, lang.name);
                            } else {
                              handleTranslateMessage(translateModalMsg.msgId, translateModalMsg.text, lang.code, lang.name);
                            }
                            setTranslateModalMsg(null);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-teal-500/10 dark:hover:bg-teal-950/30 border border-transparent hover:border-teal-500/20 transition-all text-left group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-wa-text-primary dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
                              {lang.name}
                            </span>
                            <span className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">
                              ({lang.native})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-teal-600">
                            {lang.code}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

    </div>
  );
}
