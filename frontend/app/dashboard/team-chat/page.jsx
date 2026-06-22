'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../../lib/store';
import { getSocket } from '../../../lib/socket';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import {
  Search, MessageSquare, Plus, Users, User, Phone, CheckCircle2,
  Trash2, Edit3, X, Paperclip, Send, Smile, MoreVertical,
  Pin, Archive, Info, Loader2, Volume2, VolumeX, LogOut, Check, CheckCheck,
  Copy, CornerUpLeft
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

// Subtle incoming notification beep sound
const PLAY_NOTIFICATION_SOUND = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.warn('Audio synthesis blocked by browser autoplay policy.');
  }
};

function formatChatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MM/dd/yyyy');
}

export default function TeamChatPage() {
  const { user } = useAuthStore();
  const socketRef = useRef(null);
  
  // Data State
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { chatId: { userId: name } }
  
  // Interface State
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, pinned, group, private, archived
  const [messageText, setMessageText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (activeChat?._id) {
      window.activeTeamChatId = activeChat._id;
    } else {
      window.activeTeamChatId = null;
    }
    return () => {
      window.activeTeamChatId = null;
    };
  }, [activeChat?._id]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Loading States
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Editing state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');

  // Replying & Reactions States
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState(null);
  const [activeMenuDropdownId, setActiveMenuDropdownId] = useState(null);

  // Global click listener to dismiss menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveReactionPickerId(null);
      setActiveMenuDropdownId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Modals
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState([]);

  // Search in chat messages
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showInChatSearch, setShowInChatSearch] = useState(false);

  // Refs for scrolling and typing throttle
  const messagesEndRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  // Load chat listing and user directory
  const loadChats = async (silent = false) => {
    if (!silent) setLoadingChats(true);
    try {
      const { data } = await api.get('/team-chat/chats');
      if (data.success) {
        setChats(data.data.chats);
      }
    } catch (err) {
      toast.error('Failed to load conversations');
    } finally {
      if (!silent) setLoadingChats(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await api.get('/team-chat/users');
      if (data.success) {
        setUsers(data.data.users);
      }
    } catch (err) {
      toast.error('Failed to load user directory');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadMessages = async (chatId) => {
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/team-chat/chats/${chatId}/messages`);
      if (data.success) {
        setMessages(data.data.messages);
      }
    } catch (err) {
      toast.error('Failed to load chat history');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Initial Boot
  useEffect(() => {
    loadChats();
    loadUsers();
    
    // Set up Socket listeners
    const socket = getSocket();
    if (socket) {
      socketRef.current = socket;

      // Listen for presence
      socket.on('team_user_online', (data) => {
        setOnlineUserIds(prev => [...new Set([...prev, data.userId])]);
      });

      socket.on('team_user_offline', (data) => {
        setOnlineUserIds(prev => prev.filter(id => id !== data.userId));
      });

      // Listen for new messages
      socket.on('team_new_message', (data) => {
        // If we are actively viewing this chat, append the message
        if (activeChat && activeChat._id === data.chatId) {
          setMessages(prev => {
            // Prevent duplicates
            if (prev.some(m => m._id === data.message._id)) return prev;
            return [...prev, data.message];
          });
          // Call endpoint to mark it read
          api.post(`/team-chat/messages/${data.message._id}/read`).catch(() => {});
        } else {
          // Play sound for background messages
          if (soundEnabled && data.message.senderId !== user?._id) {
            PLAY_NOTIFICATION_SOUND();
          }
        }
        // Refresh chats list to update last message & unread badge
        loadChats(true);
      });

      // Listen for typing updates
      socket.on('team_typing_update', (data) => {
        setTypingUsers(prev => {
          const chatTyping = prev[data.chatId] || {};
          if (data.isTyping) {
            chatTyping[data.userId] = data.userName;
          } else {
            delete chatTyping[data.userId];
          }
          return {
            ...prev,
            [data.chatId]: { ...chatTyping }
          };
        });
      });

      // Listen for message edits
      socket.on('team_message_edited', (data) => {
        if (activeChat && activeChat._id === data.chatId) {
          setMessages(prev =>
            prev.map(m => m._id === data.messageId ? { ...m, message: data.message, isEdited: true, editedAt: data.editedAt } : m)
          );
        }
      });

      // Listen for reaction updates
      socket.on('team_message_reaction_updated', (data) => {
        if (activeChat && activeChat._id === data.chatId) {
          setMessages(prev =>
            prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m)
          );
        }
      });

      // Listen for deletions for everyone
      socket.on('team_message_deleted_everyone', (data) => {
        if (activeChat && activeChat._id === data.chatId) {
          setMessages(prev =>
            prev.map(m => m._id === data.messageId ? { ...m, message: '[This message was deleted]', messageType: 'text', fileUrl: '' } : m)
          );
        }
        loadChats(true);
      });

      // Listen for read receipts
      socket.on('team_read_receipt', (data) => {
        if (activeChat && activeChat._id === data.chatId) {
          setMessages(prev =>
            prev.map(m => {
              if (m.senderId === user?._id && !m.readReceipts.some(r => r.userId === data.userId)) {
                return {
                  ...m,
                  readReceipts: [...m.readReceipts, { userId: data.userId, status: 'read', timestamp: data.readAt }]
                };
              }
              return m;
            })
          );
        }
        loadChats(true);
      });

      // Listen for chat changes
      socket.on('team_chat_created', () => {
        loadChats(true);
      });

      socket.on('team_chat_removed', (data) => {
        if (activeChat && activeChat._id === data.chatId) {
          setActiveChat(null);
          setMessages([]);
          toast.error('The conversation was deleted by an administrator.');
        }
        loadChats(true);
      });

      socket.on('team_members_added', (data) => {
        if (activeChat && activeChat._id === data.chatId) {
          setActiveChat(prev => ({
            ...prev,
            participants: [...prev.participants, ...data.members]
          }));
        }
      });

      socket.on('team_member_removed', (data) => {
        if (activeChat && activeChat._id === data.chatId) {
          if (data.userId === user?._id) {
            setActiveChat(null);
            setMessages([]);
            toast('You left the group chat.');
          } else {
            setActiveChat(prev => ({
              ...prev,
              participants: prev.participants.filter(p => p._id !== data.userId)
            }));
          }
        }
        loadChats(true);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('team_user_online');
        socketRef.current.off('team_user_offline');
        socketRef.current.off('team_new_message');
        socketRef.current.off('team_typing_update');
        socketRef.current.off('team_message_edited');
        socketRef.current.off('team_message_reaction_updated');
        socketRef.current.off('team_message_deleted_everyone');
        socketRef.current.off('team_read_receipt');
        socketRef.current.off('team_chat_created');
        socketRef.current.off('team_chat_removed');
        socketRef.current.off('team_members_added');
        socketRef.current.off('team_member_removed');
      }
    };
  }, [activeChat, soundEnabled]);

  // Load active chat details
  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat._id);
      
      // Join socket room
      if (socketRef.current) {
        socketRef.current.emit('team_join_chat', activeChat._id);
      }

      // Mark unread as read
      if (activeChat.unreadCount > 0) {
        api.post(`/team-chat/chats/${activeChat._id}`).catch(() => {});
        // If last message exists, mark it read
        if (activeChat.lastMessage) {
          api.post(`/team-chat/messages/${activeChat.lastMessage._id}/read`).catch(() => {});
        }
      }
    }

    return () => {
      if (activeChat && socketRef.current) {
        socketRef.current.emit('team_leave_chat', activeChat._id);
      }
    };
  }, [activeChat?._id]);

  // Autoscroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing state
  const handleMessageChange = (e) => {
    setMessageText(e.target.value);

    if (!socketRef.current || !activeChat) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit('team_typing', { chatId: activeChat._id, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socketRef.current.emit('team_typing', { chatId: activeChat._id, isTyping: false });
    }, 2000);
  };

  // Send Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !activeChat) return;

    const textToSend = messageText;
    setMessageText('');
    setShowEmojiPicker(false);

    // Stop typing immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    socketRef.current?.emit('team_typing', { chatId: activeChat._id, isTyping: false });

    try {
      await api.post('/team-chat/messages', {
        chatId: activeChat._id,
        messageType: 'text',
        message: textToSend,
        parentMessageId: replyingToMessage?._id || undefined
      });
      setReplyingToMessage(null);
      // Listing refetches automatically on socket callback
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  // Upload attachment file
  const handleAttachFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/team-chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (data.success && data.data?.url) {
        let type = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type === 'application/pdf') type = 'pdf';
        else if (file.type.startsWith('audio/')) type = 'audio';
        else if (file.type.startsWith('video/')) type = 'video';

        await api.post('/team-chat/messages', {
          chatId: activeChat._id,
          messageType: type,
          fileUrl: data.data.url,
          message: file.name
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'File upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  // Start Private Chat
  const handleStartPrivateChat = async (recipientId) => {
    setIsNewChatModalOpen(false);
    try {
      const { data } = await api.post('/team-chat/chats', {
        type: 'private',
        recipientId
      });
      if (data.success) {
        // Find newly selected chat from lists or refresh
        await loadChats();
        // Set as active
        const matchedChat = chats.find(c => c._id === data.data.chat._id);
        if (matchedChat) {
          setActiveChat(matchedChat);
        } else {
          // Fallback, fetch it
          setActiveChat({
            _id: data.data.chat._id,
            type: 'private',
            title: users.find(u => u._id === recipientId)?.name || 'Direct Chat'
          });
        }
      }
    } catch (err) {
      toast.error('Failed to initialize conversation');
    }
  };

  // Create Group Chat
  const handleCreateGroupChat = async (e) => {
    if (e) e.preventDefault();
    if (!groupName.trim()) return toast.error('Group name is required');

    try {
      const { data } = await api.post('/team-chat/chats', {
        type: 'group',
        name: groupName,
        memberIds: selectedGroupMembers
      });
      if (data.success) {
        toast.success('Group created successfully!');
        setGroupName('');
        setSelectedGroupMembers([]);
        setIsGroupModalOpen(false);
        loadChats();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    }
  };

  // Group rename
  const handleRenameGroup = async (newName) => {
    if (!newName.trim() || !activeChat) return;
    try {
      await api.put(`/team-chat/chats/${activeChat._id}`, { name: newName });
      setActiveChat(prev => ({ ...prev, name: newName, title: newName }));
      toast.success('Group renamed!');
    } catch (err) {
      toast.error('Failed to rename group');
    }
  };

  // Member leave group
  const handleLeaveGroup = async () => {
    if (!activeChat) return;
    if (!confirm('Are you sure you want to leave this group chat?')) return;

    try {
      await api.delete(`/team-chat/chats/${activeChat._id}/members/${user?._id}`);
      setActiveChat(null);
      setMessages([]);
      loadChats();
      toast.success('You have left the group.');
    } catch (err) {
      toast.error('Failed to leave group');
    }
  };

  // Member remove from group
  const handleRemoveMember = async (targetUserId) => {
    if (!activeChat) return;
    try {
      await api.delete(`/team-chat/chats/${activeChat._id}/members/${targetUserId}`);
      toast.success('Member removed!');
    } catch (err) {
      toast.error('Failed to remove member');
    }
  };

  // Member add to group
  const handleAddMembersToGroup = async () => {
    if (!activeChat || membersToAdd.length === 0) return;

    try {
      await api.post(`/team-chat/chats/${activeChat._id}/members`, { memberIds: membersToAdd });
      toast.success('Members added successfully!');
      setMembersToAdd([]);
      setIsMembersModalOpen(false);
    } catch (err) {
      toast.error('Failed to add members');
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId, deleteFor) => {
    try {
      await api.delete(`/team-chat/messages/${messageId}`, { data: { deleteFor } });
      if (deleteFor === 'me') {
        setMessages(prev => prev.filter(m => m._id !== messageId));
      }
      toast.success('Message deleted');
    } catch (err) {
      toast.error('Failed to delete message');
    }
  };

  // Edit Message
  const handleEditMessage = async (e) => {
    if (e) e.preventDefault();
    if (!editText.trim() || !editingMessageId) return;

    try {
      await api.put(`/team-chat/messages/${editingMessageId}`, { message: editText });
      setEditingMessageId(null);
      setEditText('');
      toast.success('Message updated');
    } catch (err) {
      toast.error('Failed to edit message');
    }
  };

  // React to message
  const handleReactToMessage = async (messageId, emoji) => {
    setActiveReactionPickerId(null);
    try {
      const targetMsg = messages.find(m => m._id === messageId);
      const existingReaction = targetMsg?.reactions?.find(
        r => r.userId?._id?.toString() === user?._id?.toString() || r.userId?.toString() === user?._id?.toString()
      );

      let response;
      if (existingReaction && existingReaction.emoji === emoji) {
        response = await api.delete(`/team-chat/messages/${messageId}/reactions`);
      } else {
        response = await api.post(`/team-chat/messages/${messageId}/reactions`, { emoji });
      }

      if (response.data.success) {
        setMessages(prev =>
          prev.map(m => m._id === messageId ? { ...m, reactions: response.data.data.reactions } : m)
        );
      }
    } catch (err) {
      toast.error('Failed to update reaction');
    }
  };

  // Copy message text
  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Message copied to clipboard!');
  };

  // Pin / Archive / Unread Preferences
  const handleTogglePreference = async (chatId, type, val) => {
    try {
      await api.put(`/team-chat/chats/${chatId}`, { [type]: val });
      loadChats(true);
      
      // Update active state if applicable
      if (activeChat && activeChat._id === chatId) {
        setActiveChat(prev => ({ ...prev, [type]: val }));
      }
      
      toast.success('Preferences updated');
    } catch (err) {
      toast.error('Failed to update preferences');
    }
  };

  // Filter & Search chats
  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.title?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'unread') return chat.unreadCount > 0;
    if (filter === 'pinned') return chat.isPinned;
    if (filter === 'archived') return chat.isArchived;
    if (filter === 'group') return chat.type === 'group';
    if (filter === 'private') return chat.type === 'private';
    
    // Hide archived from main list
    if (filter === 'all' && chat.isArchived) return false;

    return true;
  });

  // Filter messages based on search query
  const filteredMessages = messages.filter(msg => {
    if (!messageSearchQuery.trim()) return true;
    return msg.message?.toLowerCase().includes(messageSearchQuery.toLowerCase());
  });

  // Quick Emoji Pick
  const EMOJIS = ['😀', '😂', '👍', '❤️', '🔥', '👏', '🎉', '💡', '🤔', '👀', '🚀', '✔️'];

  return (
    <div className="flex h-[calc(100vh-80px)] border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden bg-white dark:bg-wa-dark-panel shadow-sm">
      {/* 1. CHATS SIDEBAR PANEL */}
      <div className="w-80 border-r border-wa-border dark:border-wa-dark-border flex flex-col h-full bg-slate-50/50 dark:bg-wa-dark-header/20 shrink-0">
        
        {/* Header toolbar */}
        <div className="p-4 border-b border-wa-border dark:border-wa-dark-border space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-wa-green" /> Team Channels
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-lg text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors`}
                title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-wa-green" /> : <VolumeX className="w-4 h-4" />}
              </button>
              
              {/* Add menu (Group or Direct) */}
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                className="p-1.5 rounded-lg bg-wa-green/10 text-wa-green hover:bg-wa-green/20 transition-colors"
                title="Start new conversation"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-wa-text-secondary" />
            <input
              type="text"
              placeholder="Search chat or group..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-1 focus:ring-wa-green"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-wa-border dark:border-wa-dark-border overflow-x-auto scrollbar-none text-[10px] font-bold shrink-0 bg-white dark:bg-wa-dark-panel/40">
          {['all', 'unread', 'pinned', 'group', 'private', 'archived'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-2.5 border-b-2 -mb-[2px] whitespace-nowrap transition-colors ${
                filter === tab 
                  ? 'border-wa-green text-wa-green' 
                  : 'border-transparent text-wa-text-secondary hover:text-wa-text-primary'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Chat Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-wa-border/50 dark:divide-wa-dark-border/40 scrollbar-thin">
          {loadingChats ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-wa-text-secondary">
              <Loader2 className="w-6 h-6 animate-spin text-wa-green" />
              <span>Syncing team chats...</span>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-wa-text-secondary h-48 gap-1.5">
              <Info className="w-5 h-5 opacity-40 text-wa-green" />
              <span>No conversations found matching this criteria.</span>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = activeChat && activeChat._id === chat._id;
              const typingList = typingUsers[chat._id] || {};
              const typingNames = Object.values(typingList);
              
              return (
                <div
                  key={chat._id}
                  onClick={() => setActiveChat(chat)}
                  className={`flex gap-3 p-3.5 cursor-pointer relative hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors ${
                    isActive ? 'bg-wa-green/10 dark:bg-wa-green/15 border-l-3 border-wa-green' : 'bg-white dark:bg-wa-dark-panel/20'
                  }`}
                >
                  {/* Avatar with Presence dot */}
                  <div className="relative shrink-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold uppercase text-sm shadow-sm"
                      style={{ backgroundColor: chat.chatColor }}
                    >
                      {chat.type === 'group' ? (
                        <Users className="w-4.5 h-4.5" />
                      ) : (
                        chat.title?.[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    {chat.type === 'private' && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-wa-dark-panel ${
                        chat.isOnline ? 'bg-wa-green' : 'bg-slate-300 dark:bg-slate-600'
                      }`} />
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-wa-text-primary dark:text-white truncate">
                        {chat.title}
                      </span>
                      <span className="text-[9px] text-wa-text-secondary shrink-0">
                        {chat.lastMessage ? formatChatTime(chat.lastMessage.createdAt) : formatChatTime(chat.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      {/* Subtitle / Last Message */}
                      <p className="text-[11px] text-wa-text-secondary truncate flex-1 font-sans">
                        {typingNames.length > 0 ? (
                          <span className="text-wa-green font-medium italic animate-pulse">
                            {typingNames[0]} typing...
                          </span>
                        ) : chat.lastMessage ? (
                          <>
                            {chat.type === 'group' && (
                              <span className="font-semibold">{chat.lastMessage.senderName}: </span>
                            )}
                            {chat.lastMessage.messageType === 'text' ? chat.lastMessage.message : `📎 [${chat.lastMessage.messageType}]`}
                          </>
                        ) : (
                          <span className="italic opacity-60">No messages yet</span>
                        )}
                      </p>

                      {/* Icons / Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {chat.isPinned && <Pin className="w-2.5 h-2.5 text-wa-green fill-wa-green/30" />}
                        {chat.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-wa-green text-white text-[9px] font-bold leading-none min-w-[16px] text-center">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. CHAT FEED & WORKSPACE PANEL */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-wa-dark-header/10 relative">
        {activeChat ? (
          <>
            {/* Active Chat Header */}
            <div className="px-4 py-3 border-b border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel flex items-center justify-between shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold uppercase text-sm shadow-sm"
                  style={{ backgroundColor: activeChat.chatColor }}
                >
                  {activeChat.type === 'group' ? <Users className="w-4.5 h-4.5" /> : activeChat.title?.[0]?.toUpperCase()}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-wa-text-primary dark:text-white truncate">
                      {activeChat.title}
                    </span>
                    {activeChat.type === 'group' && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {activeChat.participants?.length || 0} members
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-wa-text-secondary truncate mt-0.5 leading-none">
                    {activeChat.type === 'private' ? (
                      activeChat.isOnline ? (
                        <span className="text-wa-green font-medium">🟢 Online now</span>
                      ) : activeChat.lastSeenAt ? (
                        <span>Last seen: {formatDistanceToNow(new Date(activeChat.lastSeenAt), { addSuffix: true })}</span>
                      ) : (
                        <span>Offline</span>
                      )
                    ) : (
                      <span>Group Created: {format(new Date(activeChat.createdAt), 'MMM dd, yyyy')}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Chat action toolbar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInChatSearch(!showInChatSearch)}
                  className={`p-2 rounded-lg hover:bg-wa-bg dark:hover:bg-wa-dark-hover text-wa-text-secondary transition-colors ${
                    showInChatSearch ? 'bg-wa-green/10 text-wa-green' : ''
                  }`}
                  title="Search message history"
                >
                  <Search className="w-4 h-4" />
                </button>

                {/* Pin toggle */}
                <button
                  onClick={() => handleTogglePreference(activeChat._id, 'isPinned', !activeChat.isPinned)}
                  className={`p-2 rounded-lg hover:bg-wa-bg dark:hover:bg-wa-dark-hover transition-colors ${
                    activeChat.isPinned ? 'text-wa-green' : 'text-wa-text-secondary'
                  }`}
                  title={activeChat.isPinned ? "Unpin chat" : "Pin chat"}
                >
                  <Pin className="w-4 h-4" />
                </button>

                {/* Archive toggle */}
                <button
                  onClick={() => handleTogglePreference(activeChat._id, 'isArchived', !activeChat.isArchived)}
                  className="p-2 rounded-lg hover:bg-wa-bg dark:hover:bg-wa-dark-hover text-wa-text-secondary transition-colors"
                  title={activeChat.isArchived ? "Unarchive chat" : "Archive chat"}
                >
                  <Archive className="w-4 h-4" />
                </button>

                {/* Group configuration details */}
                {activeChat.type === 'group' && (
                  <div className="relative group/menu">
                    <button
                      className="p-2 rounded-lg hover:bg-wa-bg dark:hover:bg-wa-dark-hover text-wa-text-secondary transition-colors"
                      title="Group management"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {/* Hover Dropdown */}
                    <div className="absolute right-0 top-9 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-wa-lg py-1.5 min-w-[160px] hidden group-hover/menu:block z-50">
                      {['admin', 'owner', 'superadmin'].includes(user?.role) && (
                        <button
                          onClick={() => {
                            setGroupName(activeChat.title);
                            setIsMembersModalOpen(true);
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-bg dark:hover:bg-wa-dark-hover flex items-center gap-2"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Members</span>
                        </button>
                      )}
                      
                      {['admin', 'owner', 'superadmin'].includes(user?.role) && (
                        <button
                          onClick={() => {
                            const name = prompt('Enter new group name:', activeChat.title);
                            if (name) handleRenameGroup(name);
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-bg dark:hover:bg-wa-dark-hover flex items-center gap-2"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Rename Group</span>
                        </button>
                      )}

                      <button
                        onClick={handleLeaveGroup}
                        className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Leave Group</span>
                      </button>

                      {['admin', 'owner', 'superadmin'].includes(user?.role) && (
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to permanently delete this group chat and clear all message logs?')) {
                              try {
                                await api.delete(`/team-chat/chats/${activeChat._id}`);
                                setActiveChat(null);
                                setMessages([]);
                                loadChats();
                                toast.success('Group deleted');
                              } catch (err) {
                                toast.error('Failed to delete group');
                              }
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-100 dark:hover:bg-red-950/40 border-t border-wa-border dark:border-wa-dark-border flex items-center gap-2 font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Group</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* In-Chat Message Search Box */}
            {showInChatSearch && (
              <div className="bg-white dark:bg-wa-dark-panel border-b border-wa-border dark:border-wa-dark-border px-4 py-2.5 flex items-center gap-2.5 animate-slide-down shrink-0">
                <Search className="w-3.5 h-3.5 text-wa-text-secondary" />
                <input
                  type="text"
                  placeholder="Filter messages in this conversation..."
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  className="flex-1 text-xs bg-slate-50 dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-lg px-3 py-1.5 text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green"
                />
                <button
                  onClick={() => {
                    setMessageSearchQuery('');
                    setShowInChatSearch(false);
                  }}
                  className="p-1 hover:bg-wa-bg rounded-md"
                >
                  <X className="w-3.5 h-3.5 text-wa-text-secondary" />
                </button>
              </div>
            )}

            {/* Messages Feed list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scroll-smooth bg-slate-50 dark:bg-wa-dark-header/5">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-wa-text-secondary">
                  <Loader2 className="w-6 h-6 animate-spin text-wa-green" />
                  <span>Retrieving chat logs...</span>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-xs text-wa-text-secondary p-8 gap-2">
                  <MessageSquare className="w-10 h-10 opacity-30 text-wa-green" />
                  <span>No messages found in this history. Start the conversation!</span>
                </div>
              ) : (
                filteredMessages.map((msg, index) => {
                  const isSelf = msg.senderId === user?._id;
                  const isDeleted = msg.message === '[This message was deleted]';
                  
                  // Read status resolver
                  const hasBeenRead = msg.readReceipts?.some(r => r.userId !== user?._id && r.status === 'read');
                  const hasBeenDelivered = msg.readReceipts?.some(r => r.userId !== user?._id && r.status === 'delivered');

                  return (
                    <div
                      key={msg._id}
                      id={`msg-${msg._id}`}
                      className={`flex gap-3 max-w-[70%] group relative w-fit ${isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                    >
                      {/* Avatar */}
                      {!isSelf && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold uppercase text-xs shadow-sm shrink-0 mt-0.5"
                          style={{ backgroundColor: msg.senderColor }}
                          title={`${msg.senderName} (${msg.senderRole})`}
                        >
                          {msg.senderName?.[0]?.toUpperCase()}
                        </div>
                      )}

                      {/* Bubble Body */}
                      <div className="space-y-1 w-fit">
                        {/* Sender tag for groups */}
                        {!isSelf && activeChat.type === 'group' && (
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="text-[10px] font-bold text-wa-text-primary dark:text-white" style={{ color: msg.senderColor }}>
                              {msg.senderName}
                            </span>
                            <span className="text-[8px] font-bold uppercase px-1 py-0.2 bg-slate-100 dark:bg-slate-800 text-wa-text-secondary rounded border border-wa-border/30">
                              {msg.senderRole}
                            </span>
                          </div>
                        )}

                        <div
                          id={`msg-bubble-${msg._id}`}
                          className={`p-3.5 rounded-2xl relative shadow-sm text-xs leading-relaxed transition-all duration-300 ${
                            isSelf 
                              ? 'bg-wa-green text-white rounded-tr-none' 
                              : 'bg-white dark:bg-wa-dark-panel text-wa-text-primary dark:text-wa-dark-text-primary rounded-tl-none border border-wa-border dark:border-wa-dark-border'
                          } ${isDeleted ? 'italic opacity-60' : ''}`}
                        >
                          {/* Replied-to message preview */}
                          {msg.parentMessageId && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const parentId = msg.parentMessageId._id || msg.parentMessageId;
                                const el = document.getElementById(`msg-${parentId}`);
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  const bubble = document.getElementById(`msg-bubble-${parentId}`);
                                  if (bubble) {
                                    bubble.classList.add('ring-4', 'ring-wa-green/45');
                                    setTimeout(() => {
                                      bubble.classList.remove('ring-4', 'ring-wa-green/45');
                                    }, 2000);
                                  }
                                }
                              }}
                              className="mb-2 p-2 rounded bg-black/5 dark:bg-white/5 border-l-4 border-wa-green text-[10px] cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-left"
                            >
                              <div className="font-bold text-wa-green truncate">
                                {msg.parentMessageId.senderId?.name || 'User'}
                              </div>
                              <div className="truncate opacity-80 mt-0.5">
                                {msg.parentMessageId.messageType === 'text' ? msg.parentMessageId.message : `📎 [${msg.parentMessageId.messageType}]`}
                              </div>
                            </div>
                          )}
                          
                          {/* File Content Renderer */}
                          {!isDeleted && msg.messageType !== 'text' && (
                            <div className="mb-2.5 overflow-hidden rounded-xl border border-wa-border/20">
                              {msg.messageType === 'image' && (
                                <img
                                  src={msg.fileUrl}
                                  alt="Attachment"
                                  className="max-h-60 max-w-full rounded-xl object-cover select-none"
                                />
                              )}
                              {msg.messageType === 'video' && (
                                <video src={msg.fileUrl} controls className="max-h-60 max-w-full rounded-xl" />
                              )}
                              {msg.messageType === 'audio' && (
                                <audio src={msg.fileUrl} controls className="w-full max-w-[240px]" />
                              )}
                              {msg.messageType === 'pdf' && (
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-3 bg-red-500/10 text-red-600 rounded-xl hover:underline font-semibold"
                                >
                                  <Paperclip className="w-5 h-5 shrink-0" />
                                  <span className="truncate max-w-[150px]">{msg.message || 'Download PDF'}</span>
                                </a>
                              )}
                              {msg.messageType === 'document' && (
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 text-wa-text-primary dark:text-white rounded-xl hover:underline"
                                >
                                  <Paperclip className="w-5 h-5 shrink-0" />
                                  <span className="truncate max-w-[150px]">{msg.message || 'Download File'}</span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Message Text */}
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>

                          {/* Metadata (Time + receipts) */}
                          <div className={`flex items-center gap-1 mt-1.5 justify-end text-[9px] ${
                            isSelf ? 'text-white/70' : 'text-wa-text-secondary'
                          }`}>
                            <span>{format(new Date(msg.createdAt), 'h:mm a')}</span>
                            {msg.isEdited && <span className="italic leading-none">• edited</span>}
                            
                            {isSelf && (
                              <span className="ml-1 leading-none shrink-0">
                                {hasBeenRead ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-300 fill-blue-300" />
                                ) : hasBeenDelivered ? (
                                  <CheckCheck className="w-3.5 h-3.5" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </span>
                            )}
                          </div>

                          {/* Reactions display */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div
                              title={msg.reactions.map(r => r.userId?.name || 'Someone').join(', ')}
                              className={`absolute bottom-[-10px] flex items-center gap-1 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-full px-1.5 py-0.5 shadow-sm text-[10px] select-none z-10 ${
                                isSelf ? 'right-3' : 'left-3'
                              }`}
                            >
                              <div className="flex -space-x-0.5">
                                {Array.from(new Set(msg.reactions.map(r => r.emoji))).map((emoji, idx) => (
                                  <span key={idx} className="scale-90">{emoji}</span>
                                ))}
                              </div>
                              {msg.reactions.length > 0 && (
                                <span className="text-[9px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary pl-0.5">
                                  {msg.reactions.length}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Hover action menu for messages */}
                      {!isDeleted && (
                        <div className={`absolute top-1/2 -translate-y-1/2 items-center gap-1 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-md p-0.5 z-20 before:absolute before:top-0 before:bottom-0 before:w-4 ${
                          isSelf ? 'right-full mr-2 before:-right-4' : 'left-full ml-2 before:-left-4'
                        } ${
                          activeReactionPickerId === msg._id || activeMenuDropdownId === msg._id
                            ? 'flex'
                            : 'hidden group-hover:flex'
                        }`}>
                          {/* Emoji Trigger */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReactionPickerId(activeReactionPickerId === msg._id ? null : msg._id);
                              setActiveMenuDropdownId(null);
                            }}
                            className="p-1 hover:bg-wa-bg rounded-lg text-wa-text-secondary hover:text-wa-green animate-none"
                            title="React"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>

                          {/* Options Trigger */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuDropdownId(activeMenuDropdownId === msg._id ? null : msg._id);
                              setActiveReactionPickerId(null);
                            }}
                            className="p-1 hover:bg-wa-bg rounded-lg text-wa-text-secondary hover:text-wa-green animate-none"
                            title="More Actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Emoji Picker Popover */}
                      {activeReactionPickerId === msg._id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute bottom-full mb-1 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl p-1.5 shadow-wa-lg z-30 flex gap-1 animate-scale-up ${
                            isSelf ? 'right-0' : 'left-0'
                          }`}
                        >
                          {['👍', '❤️', '😂', '😮', '😢', '🙏', '🥰'].map(emoji => {
                            const userReacted = msg.reactions?.some(
                              r => (r.userId?._id?.toString() === user?._id?.toString() || r.userId?.toString() === user?._id?.toString()) && r.emoji === emoji
                            );
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReactToMessage(msg._id, emoji)}
                                className={`text-base p-1 hover:scale-125 transition-transform rounded-lg ${
                                  userReacted ? 'bg-wa-green/20' : ''
                                }`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Actions Dropdown Menu */}
                      {activeMenuDropdownId === msg._id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl shadow-wa-lg py-1.5 min-w-[120px] z-30 animate-slide-up ${
                            isSelf ? 'right-0 top-full mt-1' : 'left-0 top-full mt-1'
                          }`}
                        >
                          {/* Reply */}
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToMessage({
                                _id: msg._id,
                                senderName: msg.senderName,
                                message: msg.message,
                                messageType: msg.messageType
                              });
                              setActiveMenuDropdownId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-bg dark:hover:bg-wa-dark-hover flex items-center gap-2"
                          >
                            <CornerUpLeft className="w-3.5 h-3.5 text-wa-text-secondary" />
                            <span>Reply</span>
                          </button>

                          {/* Copy */}
                          {msg.messageType === 'text' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleCopyMessage(msg.message);
                                setActiveMenuDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-wa-text-primary dark:text-wa-dark-text-primary hover:bg-wa-bg dark:hover:bg-wa-dark-hover flex items-center gap-2"
                            >
                              <Copy className="w-3.5 h-3.5 text-wa-text-secondary" />
                              <span>Copy</span>
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              const delFor = isSelf && confirm('Do you want to delete this message for everyone? (Select Cancel to delete only for yourself)')
                                ? 'everyone'
                                : 'me';
                              handleDeleteMessage(msg._id, delFor);
                              setActiveMenuDropdownId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Typing indicator inside feed */}
              {activeChat && typingUsers[activeChat._id] && Object.keys(typingUsers[activeChat._id]).length > 0 && (
                <div className="flex gap-3 max-w-[50%] mr-auto items-center animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border p-3.5 rounded-2xl rounded-tl-none text-[11px] text-wa-green font-medium italic flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {Object.values(typingUsers[activeChat._id]).join(', ')} typing...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer Panel */}
            <div className="p-3 border-t border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel shrink-0 z-10">
              
              {/* Message Composer Reply overlay */}
              {replyingToMessage && (
                <div className="bg-wa-bg dark:bg-wa-dark-header/80 p-2.5 border border-wa-border dark:border-wa-dark-border rounded-xl flex items-center justify-between mb-2 text-xs animate-slide-down">
                  <div className="flex items-center gap-2 truncate text-wa-text-secondary">
                    <CornerUpLeft className="w-3.5 h-3.5 text-wa-green shrink-0" />
                    <span className="truncate">
                      Replying to <strong>{replyingToMessage.senderName}</strong>: <span className="font-sans italic">{replyingToMessage.message || `[${replyingToMessage.messageType}]`}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingToMessage(null)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-wa-text-secondary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Message Composer Edit overlay */}
              {editingMessageId && (
                <div className="bg-wa-bg dark:bg-wa-dark-header/80 p-2 border border-wa-border dark:border-wa-dark-border rounded-xl flex items-center justify-between mb-2 text-xs animate-slide-down">
                  <div className="flex items-center gap-2 truncate text-wa-text-secondary">
                    <Edit3 className="w-3.5 h-3.5 text-wa-green" />
                    <span className="truncate">Editing message: <strong className="font-sans">{editText}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingMessageId(null);
                        setEditText('');
                      }}
                      className="px-2.5 py-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-wa-text-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditMessage}
                      className="px-3 py-1 bg-wa-green text-white font-semibold rounded-lg shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Composer Toolbar & Text Input Form */}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 relative">
                {/* Emoji button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2.5 rounded-xl hover:bg-wa-bg dark:hover:bg-wa-dark-hover transition-colors ${
                    showEmojiPicker ? 'text-wa-green bg-wa-green/10' : 'text-wa-text-secondary'
                  }`}
                  title="Emoji picker"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Emoji popover */}
                {showEmojiPicker && (
                  <div className="absolute bottom-13 left-2 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl p-2.5 shadow-wa-lg z-50 flex gap-2.5">
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setMessageText(prev => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="text-lg hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* File attachment button */}
                <label className="p-2.5 rounded-xl hover:bg-wa-bg dark:hover:bg-wa-dark-hover text-wa-text-secondary transition-colors cursor-pointer shrink-0">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleAttachFile}
                    disabled={uploadingFile}
                  />
                  {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin text-wa-green" /> : <Paperclip className="w-5 h-5" />}
                </label>

                {/* Textarea Input */}
                <input
                  type="text"
                  placeholder="Type a message to team channels..."
                  value={messageText}
                  onChange={handleMessageChange}
                  className="flex-1 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-1 focus:ring-wa-green font-sans"
                />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="p-2.5 bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 text-white rounded-xl shadow-md transition-all shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty State Chat Window */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-wa-text-secondary gap-3 bg-slate-50 dark:bg-wa-dark-header/5">
            <div className="w-16 h-16 rounded-full bg-wa-green/10 flex items-center justify-center text-wa-green shadow-sm">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-wa-text-primary dark:text-white">Select a chat to begin</h4>
              <p className="mt-1 max-w-sm">Search the user directory or start group channels to collaborate in real-time with other organization team members.</p>
            </div>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="mt-2 px-5 py-2.5 bg-wa-green hover:bg-wa-green-hover text-white font-semibold rounded-xl shadow-md transition-colors"
            >
              Start Conversation
            </button>
          </div>
        )}
      </div>

      {/* --- NEW CONVERSATION DIRECTORY MODAL --- */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl max-w-md w-full shadow-wa-lg overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-wa-dark-header/10">
              <h4 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
                <User className="w-4.5 h-4.5 text-wa-green" /> Team User Directory
              </h4>
              <button onClick={() => setIsNewChatModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4 text-wa-text-secondary" />
              </button>
            </div>

            <div className="p-4 shrink-0 flex gap-2">
              <button
                onClick={() => {
                  setIsNewChatModalOpen(false);
                  setIsGroupModalOpen(true);
                }}
                className="w-full py-2.5 bg-wa-green/10 text-wa-green hover:bg-wa-green/20 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Users className="w-4 h-4" />
                <span>Create Group Chat</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-wa-border/40 dark:divide-wa-dark-border/40 p-4 pt-0 scrollbar-thin">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-12 gap-2 text-xs text-wa-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin text-wa-green" />
                  <span>Loading team directory...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="py-8 text-center text-xs text-wa-text-secondary">No other active members found.</div>
              ) : (
                users.map(u => (
                  <div
                    key={u._id}
                    onClick={() => handleStartPrivateChat(u._id)}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-wa-hover dark:hover:bg-wa-dark-hover px-2.5 rounded-xl transition-colors"
                  >
                    <div className="relative">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold uppercase text-xs shadow-sm"
                        style={{ backgroundColor: u.chatColor }}
                      >
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-wa-dark-panel ${
                        u.isOnline ? 'bg-wa-green' : 'bg-slate-300'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <span className="block text-xs font-bold text-wa-text-primary dark:text-white truncate">
                        {u.name}
                      </span>
                      <p className="text-[10px] text-wa-text-secondary truncate mt-0.5 leading-none">
                        {u.designation || u.role} • {u.department || 'General'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE GROUP MODAL --- */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateGroupChat}
            className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl max-w-md w-full shadow-wa-lg overflow-hidden animate-slide-up flex flex-col max-h-[85vh]"
          >
            <div className="px-5 py-4 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-wa-dark-header/10">
              <h4 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
                <Users className="w-4.5 h-4.5 text-wa-green" /> Create Group Channel
              </h4>
              <button type="button" onClick={() => setIsGroupModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4 text-wa-text-secondary" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-wa-text-secondary">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Department"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-wa-text-secondary">Select Initial Members</label>
                <div className="border border-wa-border dark:border-wa-dark-border rounded-xl divide-y divide-wa-border/50 dark:divide-wa-dark-border/50 max-h-48 overflow-y-auto p-2 space-y-1 bg-wa-bg/30 dark:bg-wa-dark-header/10 scrollbar-thin">
                  {users.map(u => {
                    const isSelected = selectedGroupMembers.includes(u._id.toString());
                    return (
                      <div
                        key={u._id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedGroupMembers(prev => prev.filter(id => id !== u._id.toString()));
                          } else {
                            setSelectedGroupMembers(prev => [...prev, u._id.toString()]);
                          }
                        }}
                        className={`flex items-center gap-3 p-2 cursor-pointer rounded-xl transition-all ${
                          isSelected ? 'bg-wa-green/10 text-wa-green font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-wa-text-secondary'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold uppercase text-[10px] shrink-0"
                          style={{ backgroundColor: u.chatColor }}
                        >
                          {u.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0 text-xs">
                          <span className="block truncate font-medium">{u.name}</span>
                          <span className="block text-[9px] opacity-70 truncate leading-none mt-0.5">{u.department || 'General'}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-3.5 h-3.5 accent-wa-green rounded"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-wa-border dark:border-wa-dark-border bg-slate-50/50 dark:bg-wa-dark-header/15 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg rounded-xl text-wa-text-secondary bg-white dark:bg-wa-dark-panel"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-wa-green hover:bg-wa-green-hover rounded-xl shadow-md"
              >
                Create Channel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- ADD MEMBERS TO ACTIVE GROUP MODAL --- */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl max-w-md w-full shadow-wa-lg overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-wa-dark-header/10">
              <h4 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-1.5">
                <Users className="w-4.5 h-4.5 text-wa-green" /> Add Members to "{activeChat?.title}"
              </h4>
              <button onClick={() => setIsMembersModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4 text-wa-text-secondary" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1 scrollbar-thin">
              <div className="border border-wa-border dark:border-wa-dark-border rounded-xl divide-y divide-wa-border/50 dark:divide-wa-dark-border/50 max-h-60 overflow-y-auto p-2 space-y-1 bg-wa-bg/30 dark:bg-wa-dark-header/10 scrollbar-thin">
                {users
                  .filter(u => !activeChat?.participants?.some(p => p._id.toString() === u._id.toString()))
                  .map(u => {
                    const isSelected = membersToAdd.includes(u._id.toString());
                    return (
                      <div
                        key={u._id}
                        onClick={() => {
                          if (isSelected) {
                            setMembersToAdd(prev => prev.filter(id => id !== u._id.toString()));
                          } else {
                            setMembersToAdd(prev => [...prev, u._id.toString()]);
                          }
                        }}
                        className={`flex items-center gap-3 p-2 cursor-pointer rounded-xl transition-all ${
                          isSelected ? 'bg-wa-green/10 text-wa-green font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-wa-text-secondary'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold uppercase text-[10px] shrink-0"
                          style={{ backgroundColor: u.chatColor }}
                        >
                          {u.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0 text-xs">
                          <span className="block truncate font-medium">{u.name}</span>
                          <span className="block text-[9px] opacity-70 truncate leading-none mt-0.5">{u.department || 'General'}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-3.5 h-3.5 accent-wa-green rounded"
                        />
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="p-4 border-t border-wa-border dark:border-wa-dark-border bg-slate-50/50 dark:bg-wa-dark-header/15 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg rounded-xl text-wa-text-secondary bg-white dark:bg-wa-dark-panel"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembersToGroup}
                disabled={membersToAdd.length === 0}
                className="px-5 py-2 text-xs font-semibold text-white bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 rounded-xl shadow-md"
              >
                Add Member(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
