'use client';
import { useState, useRef, useEffect } from 'react';
import { useConversationStore, useAuthStore, useConfirmStore } from '../lib/store';
import api from '../lib/api';
import {
  Send, Paperclip, Smile, Check, CheckCheck, User, Bot, Sparkles,
  Phone, MoreVertical, Search, Mic, Image, FileText, Camera,
  UserCircle, ArrowDown, X, Shield, Zap, Info, Tag, Edit2, Trash2, Mail, Loader2, MessageSquare, ChevronLeft
} from 'lucide-react';
import { format, isToday, isYesterday, isSameDay, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function formatMessageDate(date) {
  if (isToday(date)) return 'TODAY';
  if (isYesterday(date)) return 'YESTERDAY';
  return format(date, 'MM/dd/yyyy');
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

  // Quick Replies (WABA templates) States
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const quickRepliesRef = useRef(null);

  const { sendMessage, fetchConversations, fetchMessages, deleteConversation, markConversationAsRead } = useConversationStore();
  const { user } = useAuthStore();

  const isAgent = user?.role === 'agent';
  const isAdmin = ['superadmin', 'owner', 'admin'].includes(user?.role);
  const isLocked = conversation?.lock_status;
  const currentOwner = conversation?.assignedAgent || conversation?.assigned_agent_id;
  const isOwnerMe = currentOwner?._id?.toString() === user?._id?.toString() || currentOwner?.toString() === user?._id?.toString();

  const showTakeoverBanner = isAgent && !isLocked;
  const isLockedByOther = isLocked && !isOwnerMe && !isAdmin;

  const contact = conversation?.contactId || {};

  // Initialize input fields when current contact changes
  useEffect(() => {
    if (contact) {
      setNotesText(contact.notes || '');
      setNameInput(contact.name || '');
      setEmailInput(contact.email || '');
      setNewTag('');
      setEditName(false);
      setEditEmail(false);
    }
  }, [conversation]);

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
      emojis: ['😊','😀','😃','😄','😁','🙂','😉','😌','😍','🥰','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖']
    },
    hands: {
      label: '👋',
      title: 'Hands',
      emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','🫷','🫸','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿']
    },
    people: {
      label: '👤',
      title: 'People',
      emojis: ['👤','👥','🫂','👶','👧','🧒','👦','👩','🧑','👨','👩‍🦱','🧑‍🦱','👨‍🦱','👩‍🦰','🧑‍🦰','👨‍🦰','👱‍♀️','👱','👱‍♂️','👩‍🦳','🧑‍🦳','👨‍🦳','👩‍🦲','🧑‍🦲','👨‍🦲','🧔‍♀️','🧔','🧔‍♂️','👵','🧓','👴','👲','👳‍♀️','👳','👳‍♂️','🧕','👮‍♀️','👮','👮‍♂️','👷‍♀️','👷','👷‍♂️','💂‍♀️','💂','💂‍♂️','🕵️‍♀️','🕵️','🕵️‍♂️','👩‍⚕️','🧑‍⚕️','👨‍⚕️','👩‍🌾','🧑‍🌾','👨‍🌾','👩‍🍳','🧑‍🍳','👨‍🍳','👩‍🎓','🧑‍🎓','👨‍🎓','👩‍💼','🧑‍💼','👨‍💼','👩‍💻','🧑‍💻','👨‍💻','👩‍🔧','🧑‍🔧','👨‍🔧','👩‍🔬','🧑‍🔬','👨‍🔬','👩‍🚀','🧑‍🚀','👨‍🚀']
    },
    business: {
      label: '💼',
      title: 'Business',
      emojis: ['💼','📊','📈','📉','💰','💵','💴','💶','💷','💸','💳','🧾','💹','🏦','🏢','🏬','🏗️','🏭','🏛️','🏠','🏡','📱','💻','🖥️','⌨️','🖨️','📞','☎️','📠','🔋','🔌','💡','🔦','🕯️','📡','🛜','🗂️','📁','📂','🗃️','📋','📌','📍','📎','🖇️','📏','📐','✂️','🗑️','🔒','🔓','🔑','🗝️','🔐']
    },
    objects: {
      label: '📦',
      title: 'Objects',
      emojis: ['📦','📫','📪','📬','📭','📮','🗳️','✏️','✒️','🖊️','🖋️','📝','📄','📃','📑','🗒️','📒','📓','📔','📕','📗','📘','📙','📚','📖','🔗','🗓️','📅','📆','📇','🗄️','🗞️','📰','📑','🏷️','🔖','🧮','⏰','⏱️','⏲️','🕰️','⌛','⏳','🔔','🔕','📢','📣','🎯','🏆','🎖️','🏅','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🎾','🎮']
    },
    symbols: {
      label: '💚',
      title: 'Symbols',
      emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧️','🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️','⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','🟰','♾️','💲','💱','™️','©️','®️','〰️','➰','➿','🔚','🔙','🔛','🔝','🔜','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢','💬','💭','🗯️','♠️','♣️','♥️','♦️','🃏','🎴','🀄','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛','🕜','🕝','🕞','🕟','🕠','🕡','🕢','🕣','🕤','🕥','🕦','🕧']
    },
    flags: {
      label: '🏁',
      title: 'Flags',
      emojis: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇮🇳','🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇩🇪','🇫🇷','🇯🇵','🇨🇳','🇧🇷','🇮🇹','🇪🇸','🇲🇽','🇷🇺','🇰🇷','🇸🇦','🇦🇪','🇸🇬','🇿🇦','🇳🇬','🇪🇬','🇹🇷','🇮🇩','🇵🇰','🇧🇩','🇵🇭','🇻🇳','🇹🇭','🇲🇾','🇳🇿','🇦🇷','🇨🇱','🇨🇴','🇵🇪','🇳🇱','🇧🇪','🇨🇭','🇦🇹','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇺🇦','🇮🇪','🇵🇹','🇬🇷','🇭🇺','🇨🇿','🇷🇴','🇮🇱','🇶🇦','🇰🇼','🇧🇭','🇴🇲','🇯🇴','🇱🇧','🇮🇶','🇰🇪','🇬🇭','🇪🇹','🇹🇿','🇺🇬','🇲🇦','🇹🇳','🇱🇾','🇩🇿','🇭🇰','🇹🇼','🇲🇴','🇰🇭','🇲🇲','🇱🇰','🇳🇵','🇲🇻']
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
      if (result.success) setText('');
      else toast.error(result.error || 'Failed to send');
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

  const handleSaveNotes = async () => {
    await saveCrmField({ notes: notesText.trim() });
  };

  const handleAddTag = async (e) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const existingTags = contact.tags || [];
      if (existingTags.includes(newTag.trim())) {
        toast.error('Tag already exists');
        return;
      }
      const updatedTags = [...existingTags, newTag.trim()];
      await saveCrmField({ tags: updatedTags });
      setNewTag('');
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    const updatedTags = (contact.tags || []).filter(t => t !== tagToRemove);
    await saveCrmField({ tags: updatedTags });
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
    } catch { toast.error('Failed to assign'); }
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

  const handleAI = async () => {
    try {
      await api.post(`/messages/conversations/${conversation._id}/transfer-to-ai`);
      toast.success('Transferred to AI');
      setShowDropdown(false);
      // Just refresh the current conversation, don't refetch all conversations
      await fetchMessages(conversation._id);
    } catch { toast.error('Failed to transfer'); }
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
        <div className="wa-header h-[52px] flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border px-4 shrink-0 relative z-20">
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer min-w-0 flex-1">
            {onBack && (
              <button 
                onClick={(e) => { e.stopPropagation(); onBack(); }} 
                className="lg:hidden p-1.5 rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover text-wa-text-secondary dark:text-wa-dark-text-secondary transition-colors"
                title="Back to chats"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1" onClick={() => setShowSidebar(!showSidebar)}>
              <div className={`w-9 h-9 rounded-full ${avatarClass} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
                  <h3 className="font-semibold text-sm text-wa-text-primary dark:text-white leading-tight truncate">
                    {contact.name || 'Unknown Contact'}
                  </h3>
                  {conversation?.status && (
                    conversation.status === 'human' ? (
                      conversation.lock_status ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink-0 bg-blue-50 text-blue-705 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30">
                          <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                          <span>{`Handled by ${conversation.assignedAgent?.name || 'Agent'}`}</span>
                        </span>
                      ) : conversation.assignedAgent ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink-0 bg-indigo-50 text-indigo-705 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                          <span>Assigned to Human</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink-0 bg-amber-50 text-amber-705 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span>Needs Human Reply</span>
                        </span>
                      )
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider shrink-0 ${
                        conversation.status === 'bot' ? 'bg-purple-50 text-purple-705 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30' :
                        conversation.status === 'ai' ? 'bg-emerald-50 text-emerald-705 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' :
                        'bg-slate-50 text-slate-705 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800/30'
                      }`}>
                        <span className={`w-1 h-1 rounded-full shrink-0 ${
                          conversation.status === 'bot' ? 'bg-purple-500' :
                          conversation.status === 'ai' ? 'bg-emerald-500' :
                          'bg-slate-400'
                        }`} />
                        <span>{conversation.status}</span>
                      </span>
                    )
                  )}
                </div>
                <div className="text-[11px] text-wa-text-secondary dark:text-wa-dark-text-secondary flex flex-wrap sm:flex-nowrap items-center gap-1.5 mt-0.5 min-w-0">
                  <Phone className="w-3 h-3 text-wa-text-light shrink-0" />
                  <span className="font-mono leading-none mr-1.5 shrink-0">{contact.phone || ''}</span>
                  {conversation?.status === 'human' && conversation.assignedAgent?.name && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 font-bold shrink-0">•</span>
                      {conversation.lock_status ? (
                        <div className="flex items-center gap-1 min-w-0 shrink-0">
                          <div className="w-4 h-4 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-[8px] uppercase shrink-0 border border-blue-500/20">
                            {conversation.assignedAgent.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold leading-none font-bold truncate">
                            {conversation.assignedAgent.name}
                          </span>
                          {conversation.assigned_at && (
                            <span className="text-[9px] text-wa-text-light dark:text-wa-dark-text-secondary font-medium ml-1 shrink-0">
                              ({formatRelativeTime(conversation.assigned_at)})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold leading-none animate-pulse truncate">
                          Assigned to {conversation.assignedAgent.name} (Pending Takeover)
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Takeover Actions */}
            {!isLocked && (
              <button
                onClick={handleAssign}
                className="px-3.5 py-1.5 bg-wa-green hover:bg-wa-green-hover text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1"
                title="Take over conversation control from AI"
              >
                <User className="w-3.5 h-3.5" />
                <span>Take Over</span>
              </button>
            )}

            {isLocked && (isOwnerMe || isAdmin) && (
              <button
                onClick={handleAI}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1"
                title="Release conversation and return to AI bot"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Return to Bot</span>
              </button>
            )}

            {isLocked && !isOwnerMe && !isAdmin && (
              <button
                disabled
                className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-400 text-xs font-bold rounded-lg cursor-not-allowed flex items-center gap-1"
                title={`Locked by ${conversation.assignedAgent?.name || 'another agent'}`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Locked</span>
              </button>
            )}

            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showSidebar ? 'text-wa-green bg-wa-green/10' : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'}`}
              title="Toggle CRM Sidebar"
            >
              <Info className="w-5 h-5" />
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showDropdown && (
                <div className="wa-dropdown">
                  <button onClick={handleAssign} className="wa-dropdown-item w-full">
                    <User className="w-4 h-4" /> Take Over
                  </button>
                  <button onClick={handleAI} className="wa-dropdown-item w-full">
                    <Sparkles className="w-4 h-4 text-purple-500" /> Transfer to AI
                  </button>
                  <button onClick={handleResolve} className="wa-dropdown-item w-full">
                    <Check className="w-4 h-4 text-wa-green" /> Resolve
                  </button>
                  {!conversation.isRead && (
                    <button onClick={handleMarkRead} className="wa-dropdown-item w-full">
                      <CheckCheck className="w-4 h-4 text-blue-500" /> Mark as Read
                    </button>
                  )}
                  <div className="border-t border-wa-border dark:border-wa-dark-border my-1"></div>
                  <button onClick={handleDeleteChat} className="wa-dropdown-item w-full text-red-500 hover:text-red-650 hover:bg-red-50/50 dark:hover:bg-red-950/20">
                    <Trash2 className="w-4 h-4 text-red-500" /> Delete Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

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

              let showDateDivider = false;
              if (msgDate) {
                if (!lastDate || !isSameDay(msgDate, lastDate)) {
                  showDateDivider = true;
                }
                lastDate = msgDate;
              }

              return (
                <div key={msg._id || i}>
                  {showDateDivider && msgDate && (
                    <div className="wa-date-divider my-4">
                      <span>{formatMessageDate(msgDate)}</span>
                    </div>
                  )}
                  <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1 msg-wrapper animate-message-pop`}>
                    <div className={`${isOut ? 'chat-bubble-out' : 'chat-bubble-in'} relative group`}>
                      {!isOut && msg.sentBy && <SentByLabel sentBy={msg.sentBy} />}
                      
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
                              {msg.content.filename || msg.content.caption || msg.content.text || "Document File"}
                            </span>
                          </div>
                          <a 
                            href={resolveMediaUrl(msg.content.mediaUrl)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="px-2.5 py-1 text-[10px] font-bold text-wa-green bg-wa-green/10 border border-wa-green/20 rounded-lg hover:bg-wa-green hover:text-white transition-colors shrink-0"
                          >
                            Open
                          </a>
                        </div>
                      )}

                      {msg.type === 'contact' && (
                        <div className="mb-1.5 p-3 rounded-xl bg-wa-panel-header dark:bg-wa-dark-panel-header border border-wa-border dark:border-wa-dark-border flex items-center gap-2 max-w-sm">
                          <UserCircle className="w-6 h-6 text-blue-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-wa-text-primary dark:text-white leading-tight truncate">
                              {msg.content?.contactName || "Contact"}
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
                            {msg.content?.text || msg.content?.caption}
                          </p>
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
            <div ref={quickRepliesRef} className="absolute bottom-16 left-4 bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-2xl shadow-2xl p-4 w-[360px] max-h-[300px] flex flex-col z-30 animate-slide-up">
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
                    return (
                      <button
                        key={tmpl._id}
                        onClick={() => handleSelectQuickReply(bodyText)}
                        className="w-full text-left p-2.5 rounded-xl bg-wa-bg hover:bg-wa-green/10 dark:bg-wa-dark-header/40 border border-wa-border/35 dark:border-wa-dark-border/20 hover:border-wa-green/20 group transition-all"
                      >
                        <span className="block text-xs font-bold text-wa-text-primary dark:text-white truncate group-hover:text-wa-green transition-colors">
                          {tmpl.name}
                        </span>
                        <span className="block text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary truncate mt-0.5 font-sans">
                          {bodyText}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button 
              onClick={toggleQuickReplies}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${showQuickReplies ? 'text-wa-green bg-wa-green/10' : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'}`}
              title="Access Template Shortcuts"
            >
              <Zap className="w-6 h-6" />
            </button>

            <div className="relative" ref={emojiRef}>
              <button
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
                          className={`flex-1 py-1.5 rounded-lg text-center text-sm transition-all duration-150 ${
                            emojiCategory === key
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
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (!e.shiftKey && !e.ctrlKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }
                  }}
                  className="flex-1 px-4 py-[9px] bg-wa-panel dark:bg-wa-dark-input rounded-xl text-[14.5px] text-wa-text-primary dark:text-white placeholder-wa-text-light focus:outline-none border border-transparent focus:border-wa-border resize-none leading-normal min-h-[42px] max-h-[140px]"
                  placeholder="Type a message"
                />

                {text.trim() ? (
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-wa-green hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-6 h-6 fill-wa-green/10" />
                  </button>
                ) : (
                  <button className="w-10 h-10 rounded-full flex items-center justify-center text-wa-text-secondary dark:text-wa-dark-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors shrink-0">
                    <Mic className="w-6 h-6" />
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
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      contact.optedOut ? 'bg-red-500' : 'bg-wa-green'
                    }`}
                    title={contact.optedOut ? 'Opt In' : 'Opt Out'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        contact.optedOut ? 'translate-x-4' : 'translate-x-0'
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
              <span className="block text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-widest px-1">Internal Notes</span>
              
              <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-sm">
                <textarea
                  rows={4}
                  placeholder="Type customer notes here... (CRM internal only)"
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary dark:placeholder-wa-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green scrollbar-thin resize-none transition-all"
                />

                {notesText.trim() !== (contact.notes || '') && (
                  <button
                    onClick={handleSaveNotes}
                    disabled={updatingCrm}
                    className="w-full py-2 bg-wa-green hover:bg-wa-green-dark disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow active:scale-[0.98] transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Notes</span>
                  </button>
                )}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
      )}

    </div>
  );
}
