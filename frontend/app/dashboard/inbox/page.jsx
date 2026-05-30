'use client';
import { useState, useEffect, useRef } from 'react';
import { useConversationStore, useAuthStore } from '../../../lib/store';
import { getSocket } from '../../../lib/socket';
import ChatWindow from '../../../components/ChatWindow';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import {
  Search, MessageSquare, Bot as BotIcon, User, Sparkles, Plus, X, Loader2,
  Filter, MoreVertical, Archive, Clock
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

const STATUS_BADGES = {
  bot: { label: 'Bot', class: 'badge-purple', icon: BotIcon },
  human: { label: 'Human', class: 'badge-blue', icon: User },
  ai: { label: 'AI', class: 'badge-green', icon: Sparkles },
  waiting: { label: 'Waiting', class: 'badge-yellow', icon: Clock },
  resolved: { label: 'Resolved', class: 'badge-green', icon: Sparkles },
};

function formatConversationTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MM/dd/yyyy');
}

export default function InboxPage() {
  const { user } = useAuthStore();
  const { conversations, fetchConversations, fetchMessages, currentConversation, messages, addMessage, updateMessageStatus } = useConversationStore();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState(user?.role === 'agent' ? 'assigned' : '');
  const [selectedId, setSelectedId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef(null);

  // Set default filter once user role loads
  useEffect(() => {
    if (user?.role === 'agent') {
      setFilter('assigned');
    }
  }, [user]);

  // New Chat Modal States
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = { search: debouncedSearch || undefined };
    if (user?.role === 'agent') {
      if (filter === 'assigned') {
        params.assignedAgent = user._id;
      } else if (filter === 'unassigned') {
        params.assignedAgent = 'unassigned';
      }
    } else {
      if (filter) params.status = filter;
    }
    fetchConversations(params);
  }, [debouncedSearch, filter, user]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('new_message', (data) => {
      addMessage(data.message);
    });

    socket.on('message_status', (data) => {
      updateMessageStatus(data.messageId, data.status);
    });

    socket.on('conversation_assigned', (data) => {
      // Re-fetch conversations list to update items
      const params = { search: debouncedSearch || undefined };
      if (user?.role === 'agent') {
        if (filter === 'assigned') params.assignedAgent = user._id;
        else if (filter === 'unassigned') params.assignedAgent = 'unassigned';
      }
      fetchConversations(params);
      
      // If we are currently viewing the modified chat, reload message details
      if (useConversationStore.getState().currentConversation?._id === data.conversationId) {
        fetchMessages(data.conversationId);
      }
    });

    return () => {
      socket.off('new_message');
      socket.off('message_status');
      socket.off('conversation_assigned');
    };
  }, [debouncedSearch, filter, user]);

  // Fetch contacts for New Chat modal
  useEffect(() => {
    if (!isNewChatOpen) return;

    const fetchContacts = async () => {
      setLoadingContacts(true);
      try {
        const { data } = await api.get('/contacts', {
          params: { search: contactSearch || undefined, limit: 50 }
        });
        if (data.success) {
          setContacts(data.data.contacts);
        }
      } catch (err) {
        toast.error('Failed to load contacts');
      } finally {
        setLoadingContacts(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchContacts();
    }, contactSearch ? 300 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [isNewChatOpen, contactSearch]);

  useEffect(() => {
    if (showSearch && searchRef.current) {
      searchRef.current.focus();
    }
  }, [showSearch]);

  const selectConversation = (conv) => {
    setSelectedId(conv._id);
    fetchMessages(conv._id);
  };

  const handleStartChat = async (contactId) => {
    try {
      const { data } = await api.post('/messages/conversations', { contactId });
      if (data.success) {
        setIsNewChatOpen(false);
        setContactSearch('');
        await fetchConversations({ search, status: filter || undefined });
        selectConversation(data.data.conversation);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start chat');
    }
  };

  const isAgent = user?.role === 'agent';
  const filterTabs = isAgent
    ? [
        { key: 'assigned', label: 'My Assigned' },
        { key: 'unassigned', label: 'Unassigned Queue' }
      ]
    : [
        { key: '', label: 'All' },
        { key: 'human', label: 'Unread' },
        { key: 'bot', label: 'Bots' },
        { key: 'ai', label: 'AI' },
        { key: 'waiting', label: 'Waiting' },
      ];

  return (
    <div className="flex h-[calc(100vh-1px)] -m-6 lg:-m-8 animate-fade-in">
      {/* Left Panel — WhatsApp Web Conversation List */}
      <div className="w-[420px] border-r border-wa-border dark:border-wa-dark-border flex flex-col bg-wa-panel dark:bg-wa-dark-panel shrink-0">
        {/* Header */}
        <div className="wa-header flex items-center justify-between h-[60px] border-b border-wa-border dark:border-wa-dark-border px-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-wa-text-primary dark:text-wa-dark-text-primary">
              Chats
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {!isAgent && (
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                title="New Chat"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className={`px-3 py-2 transition-all duration-200 ${showSearch ? 'max-h-14 opacity-100' : 'max-h-14 opacity-100'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-text-light" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-[7px] bg-wa-search dark:bg-wa-dark-search rounded-lg text-sm text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-light focus:outline-none transition-colors"
              placeholder="Search or start new chat"
            />
          </div>
        </div>

        {/* Filter Tabs — WhatsApp Web style */}
        <div className="flex items-center gap-1.5 px-3 pb-2">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            let activeClass = 'bg-wa-green/15 text-wa-green dark:bg-wa-green/20 dark:text-wa-green-light';
            
            if (isActive) {
              if (tab.key === 'bot') {
                activeClass = 'bg-purple-100 text-purple-755 dark:bg-purple-950/40 dark:text-purple-300 font-bold border-purple-200/20 dark:border-purple-800/20';
              } else if (tab.key === 'ai') {
                activeClass = 'bg-emerald-100 text-emerald-755 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border-emerald-200/20 dark:border-emerald-800/20';
              } else if (tab.key === 'waiting') {
                activeClass = 'bg-amber-100 text-amber-755 dark:bg-amber-950/40 dark:text-amber-300 font-bold border-amber-200/20 dark:border-amber-800/20';
              } else if (tab.key === 'human') {
                activeClass = 'bg-blue-100 text-blue-755 dark:bg-blue-950/40 dark:text-blue-300 font-bold border-blue-200/20 dark:border-blue-800/20';
              } else {
                activeClass = 'bg-wa-green/15 text-wa-green dark:bg-wa-green/20 dark:text-wa-green-light font-bold';
              }
            }
            
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border border-transparent ${
                  isActive
                    ? activeClass
                    : 'bg-wa-search dark:bg-wa-dark-search text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-wa-text-light px-8">
              <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs mt-1 text-center opacity-70">Start a new chat to begin messaging</p>
            </div>
          ) : conversations.map((conv) => {
            const contact = conv.contactId || {};
            const badge = STATUS_BADGES[conv.status] || {};
            const BadgeIcon = badge.icon;
            const isActive = selectedId === conv._id;
            const hasUnread = conv.unreadCount > 0;

            return (
              <button
                key={conv._id}
                onClick={() => selectConversation(conv)}
                className={`w-full text-left flex items-center gap-3 px-3 py-3 transition-colors duration-100 border-b border-wa-border/50 dark:border-wa-dark-border/50 ${
                  isActive
                    ? 'bg-wa-hover dark:bg-wa-dark-hover'
                    : 'hover:bg-wa-hover/60 dark:hover:bg-wa-dark-hover/60'
                }`}
              >
                {/* Avatar */}
                <div className="wa-avatar wa-avatar-lg shrink-0">
                  {contact.name?.[0]?.toUpperCase() || '#'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-[15px] text-wa-text-primary dark:text-wa-dark-text-primary truncate">
                        {contact.name || contact.phone || 'Unknown'}
                      </span>
                      {conv.status && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink-0 ${
                          conv.status === 'bot' ? 'bg-purple-50 text-purple-705 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30' :
                          conv.status === 'human' ? 'bg-blue-50 text-blue-705 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30' :
                          conv.status === 'ai' ? 'bg-emerald-50 text-emerald-705 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' :
                          conv.status === 'waiting' ? 'bg-amber-50 text-amber-705 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 animate-pulse' :
                          'bg-slate-50 text-slate-705 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800/30'
                        }`}>
                          <span className={`w-1 h-1 rounded-full shrink-0 ${
                            conv.status === 'bot' ? 'bg-purple-500' :
                            conv.status === 'human' ? 'bg-blue-500' :
                            conv.status === 'ai' ? 'bg-emerald-500' :
                            conv.status === 'waiting' ? 'bg-amber-500' :
                            'bg-slate-400'
                          }`} />
                          <span>{conv.status}</span>
                        </span>
                      )}
                    </div>
                    <span className={`text-xs shrink-0 ${hasUnread ? 'text-wa-green font-medium' : 'text-wa-text-light'}`}>
                      {formatConversationTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {BadgeIcon && (
                        <BadgeIcon className={`w-3.5 h-3.5 shrink-0 ${
                          conv.status === 'bot' ? 'text-purple-500' :
                          conv.status === 'human' ? 'text-blue-500' :
                          conv.status === 'ai' ? 'text-emerald-500' :
                          conv.status === 'waiting' ? 'text-amber-500' :
                          'text-wa-text-light'
                        }`} />
                      )}
                      <p className="text-[13px] text-wa-text-secondary dark:text-wa-dark-text-secondary truncate">
                        {conv.lastMessage?.content?.text || '[media]'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasUnread && (
                        <span className="min-w-[20px] h-5 bg-wa-green text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Panel — Chat */}
      <div className="flex-1 wa-chat-pattern">
        {currentConversation ? (
          <ChatWindow conversation={currentConversation} messages={messages} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-[250px] h-[250px] mx-auto mb-6 flex items-center justify-center">
                <div className="relative">
                  <div className="w-40 h-40 rounded-full bg-wa-green/10 dark:bg-wa-green/5 flex items-center justify-center">
                    <MessageSquare className="w-16 h-16 text-wa-green/40" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-wa-green/15 flex items-center justify-center animate-pulse-dot">
                    <Sparkles className="w-5 h-5 text-wa-green/50" />
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-light text-wa-text-primary dark:text-wa-dark-text-primary mb-2">
                WhatsApp Business
              </h3>
              <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed">
                Send and receive messages from your customers.<br />
                Select a conversation to start chatting.
              </p>
              <div className="mt-6 flex items-center justify-center gap-1 text-xs text-wa-text-light">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>End-to-end encrypted</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {isNewChatOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-wa-panel dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl w-full max-w-md overflow-hidden animate-slide-up flex flex-col max-h-[80vh] shadow-wa-lg">
            <div className="wa-header flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-5 py-4">
              <h3 className="font-semibold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-wa-green" /> New Chat
              </h3>
              <button
                onClick={() => { setIsNewChatOpen(false); setContactSearch(''); }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
              >
                <X className="w-5 h-5 text-wa-text-secondary" />
              </button>
            </div>

            <div className="p-3 border-b border-wa-border dark:border-wa-dark-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-text-light" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-wa-search dark:bg-wa-dark-search rounded-lg text-sm text-wa-text-primary dark:text-wa-dark-text-primary placeholder-wa-text-light focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[250px]">
              {loadingContacts ? (
                <div className="flex justify-center items-center py-16 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                  <span className="text-sm text-wa-text-secondary">Loading...</span>
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-16 text-wa-text-light">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No contacts found</p>
                </div>
              ) : (
                contacts.map((contact) => (
                  <button
                    key={contact._id}
                    onClick={() => handleStartChat(contact._id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-left border-b border-wa-border/30 dark:border-wa-dark-border/30"
                  >
                    <div className="wa-avatar wa-avatar-lg">
                      {contact.name?.[0]?.toUpperCase() || '#'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-wa-text-primary dark:text-wa-dark-text-primary truncate">
                        {contact.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary truncate">
                        {contact.phone}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
