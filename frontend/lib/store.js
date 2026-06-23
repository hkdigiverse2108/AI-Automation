import { create } from 'zustand';
import api from './api';

export const useAuthStore = create((set) => ({
  user: null,
  permissions: null, // Array of enabled feature slugs (null = all access for superadmin)
  isAuthenticated: false,
  loading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.success && !data.data.requires2FA) {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      set({ user: data.data.user, permissions: data.data.permissions || null, isAuthenticated: true });
    }
    return data;
  },

  verify2FA: async (tempToken, code) => {
    const { data } = await api.post('/auth/verify-2fa', { tempToken, code });
    if (data.success) {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      set({ user: data.data.user, permissions: data.data.permissions || null, isAuthenticated: true });
    }
    return data;
  },

  register: async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    if (data.success) {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      set({ user: data.data.user, isAuthenticated: true });
    }
    return data;
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, permissions: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) { set({ loading: false }); return; }
      const { data } = await api.get('/auth/me');
      if (data.success) set({ user: data.data.user, permissions: data.data.permissions || null, isAuthenticated: true, loading: false });
      else set({ loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));

export const useConversationStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,

  fetchConversations: async (params = {}, silent = false) => {
    if (!silent) set({ loading: true });
    try {
      const { data } = await api.get('/messages/conversations', { params });
      if (data.success) set({ conversations: data.data.conversations });
    } catch {}
    if (!silent) set({ loading: false });
  },

  fetchMessages: async (conversationId) => {
    // Optimistically mark as read in the conversations list for instant UI feedback
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id?.toString() === conversationId?.toString()
          ? { ...c, unreadCount: 0, isRead: true }
          : c
      ),
    }));

    try {
      const { data } = await api.get(`/messages/conversations/${conversationId}`);
      if (data.success) {
        set({ currentConversation: data.data.conversation, messages: data.data.messages });
      }
    } catch {}
  },

  markConversationAsRead: async (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id?.toString() === conversationId?.toString()
          ? { ...c, unreadCount: 0, isRead: true }
          : c
      ),
      currentConversation:
        state.currentConversation?._id?.toString() === conversationId?.toString()
          ? { ...state.currentConversation, unreadCount: 0, isRead: true }
          : state.currentConversation
    }));

    try {
      await api.post(`/messages/conversations/${conversationId}/read`);
    } catch (err) {
      console.error('Failed to mark conversation as read:', err.message);
    }
  },

  addMessage: (message) => {
    set((state) => {
      const isActiveConv = state.currentConversation?._id?.toString() === message.conversationId?.toString();
      
      // Check if message already exists to prevent duplicates
      const messageExists = state.messages.some(m => m._id === message._id);
      
      const adjustedMessage = (isActiveConv && message.direction === 'inbound')
        ? { ...message, status: 'read' }
        : message;

      const msgs = isActiveConv && !messageExists
        ? [...state.messages, adjustedMessage]
        : state.messages;

      let exists = false;
      const updatedConversations = state.conversations.map((c) => {
        if (c._id?.toString() === message.conversationId?.toString()) {
          exists = true;
          return {
            ...c,
            lastMessage: adjustedMessage,
            lastMessageAt: message.timestamp || new Date().toISOString(),
            unreadCount: isActiveConv ? 0 : (c.unreadCount || 0) + (message.direction === 'inbound' ? 1 : 0),
            isRead: isActiveConv ? true : (message.direction === 'outbound' ? true : false),
          };
        }
        return c;
      });

      if (exists) {
        updatedConversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        return { messages: msgs, conversations: updatedConversations };
      } else {
        // If it's a completely new conversation not in our list, trigger fetch
        setTimeout(() => get().fetchConversations(), 0);
        return { messages: msgs };
      }
    });
  },

  sendMessage: async (contactId, text) => {
    const { data } = await api.post('/messages/send', { contactId, text });
    return data;
  },

  updateMessageStatus: (messageId, status) => {
    set((state) => ({
      messages: state.messages.map((m) => (m._id === messageId ? { ...m, status } : m)),
    }));
  },

  deleteConversation: async (conversationId) => {
    try {
      const { data } = await api.delete(`/messages/conversations/${conversationId}`);
      if (data.success) {
        set((state) => {
          const nextCurrent = state.currentConversation?._id === conversationId ? null : state.currentConversation;
          const nextMessages = state.currentConversation?._id === conversationId ? [] : state.messages;
          const nextConversations = state.conversations.filter((c) => c._id !== conversationId);
          return {
            currentConversation: nextCurrent,
            messages: nextMessages,
            conversations: nextConversations,
          };
        });
      }
      return data;
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  },
}));

export const useDashboardStore = create((set) => ({
  stats: null,
  loading: false,

  fetchStats: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/messages/stats');
      if (data.success) set({ stats: data.data });
    } catch {}
    set({ loading: false });
  },
}));

export const useThemeStore = create((set) => ({
  dark: false,
  toggle: () =>
    set((state) => {
      const next = !state.dark;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', next ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', next);
      }
      return { dark: next };
    }),
  init: () => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('theme') === 'dark';
      document.documentElement.classList.toggle('dark', isDark);
      set({ dark: isDark });
    }
  }
}));

export const useConfirmStore = create((set) => ({
  isOpen: false,
  message: '',
  title: 'Confirm Action',
  resolve: null,
  confirm: (message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        message,
        title,
        resolve: (val) => {
          set({ isOpen: false });
          resolve(val);
        }
      });
    });
  }
}));
