const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Contact = require('../models/Contact');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const whatsapp = require('../services/whatsapp');
const { decryptField } = require('../services/encryption');

const cloudinaryService = require('../services/cloudinaryService');

// Always use memoryStorage so the file buffer is available regardless of
// whether Cloudinary is configured. We decide where to persist in the handler.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper: persist a file buffer. Tries Cloudinary first; falls back to local
// disk only when Cloudinary is not configured. Returns the URL/path to store.
async function persistFileBuffer(buffer, originalname, mimetype) {
  if (cloudinaryService.isConfigured()) {
    try {
      const url = await cloudinaryService.uploadStream(buffer, 'messages', 'auto', originalname);
      return { url, isLocal: false };
    } catch (err) {
      // Log and fall through to local fallback
      console.error('[UPLOAD] Cloudinary upload failed, falling back to local disk:', err.message);
    }
  }

  // Local disk fallback
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const filename = uniqueSuffix + path.extname(originalname);
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);
  return { url: `/uploads/${filename}`, isLocal: true };
}

router.use(verifyToken);
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
router.use(checkFeatureAccess('inbox'));

// POST /messages/upload — upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded', code: 'MISSING_FILE' });
    }

    const { url: fileUrl } = await persistFileBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);

    res.json({
      success: true,
      data: {
        url: fileUrl,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'File upload failed', code: 'UPLOAD_ERROR' });
  }
});

// GET /messages/conversations — list all conversations
router.get('/conversations', async (req, res) => {
  try {
    const { status, assignedAgent, search, page = 1, limit = 20, sort = '-lastMessageAt' } = req.query;
    const userId = req.userId;
    const query = { userId };

    if (status) {
      if (status === 'starred') {
        query.isStarred = true;
      } else if (status === 'pinned') {
        query.isPinned = true;
      } else {
        query.status = status;
      }
    }

    if (req.user.role === 'agent') {
      const agentId = req.user._id;
      const agentSelfMatch = {
        $or: [
          { assignedAgent: agentId },
          { assigned_agent_id: agentId }
        ]
      };

      if (assignedAgent === 'unassigned' || assignedAgent === 'null') {
        query.$and = (query.$and || []).concat([
          {
            $and: [
              { $or: [{ assignedAgent: { $exists: false } }, { assignedAgent: null }] },
              { $or: [{ assigned_agent_id: { $exists: false } }, { assigned_agent_id: null }] }
            ]
          }
        ]);
      } else {
        // Strictly show ONLY conversations assigned to this specific agent
        query.$and = (query.$and || []).concat([agentSelfMatch]);
      }
    } else {
      // Admin/Owner can view anything
      if (assignedAgent) {
        if (assignedAgent === 'unassigned' || assignedAgent === 'null') {
          query.$and = (query.$and || []).concat([
            {
              $and: [
                { $or: [{ assignedAgent: { $exists: false } }, { assignedAgent: null }] },
                { $or: [{ assigned_agent_id: { $exists: false } }, { assigned_agent_id: null }] }
              ]
            }
          ]);
        } else {
          if (!mongoose.Types.ObjectId.isValid(assignedAgent)) {
            return res.status(400).json({ success: false, error: 'Invalid agent ID', code: 'INVALID_ID' });
          }
          query.$and = (query.$and || []).concat([
            {
              $or: [
                { assignedAgent: assignedAgent },
                { assigned_agent_id: assignedAgent }
              ]
            }
          ]);
        }
      }
    }

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedSearch = escapeRegex(cleanSearch);
      const searchTokens = cleanSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const digitsOnly = cleanSearch.replace(/\D/g, '');

      const { getOekForUser, decryptContact } = require('../services/oekService');
      const rawOek = await getOekForUser(userId);

      // Check if user has encrypted contacts or rawOek exists
      const hasEncryptedContacts = rawOek || await Contact.exists({ userId, isDeleted: { $ne: true }, isEncrypted: true });

      let matchedContactIds = [];

      if (hasEncryptedContacts) {
        // Fetch contacts for this user and decrypt to allow true substring/fuzzy search
        const userContacts = await Contact.find({ userId, isDeleted: { $ne: true } })
          .select('_id name phone email tags notes isEncrypted encryptedFields')
          .lean();

        const decryptedContacts = userContacts.map((c) => decryptContact(c, rawOek));

        matchedContactIds = decryptedContacts
          .filter((c) => {
            const nameStr = (c.name || '').toLowerCase();
            const phoneStr = (c.phone || '').toString();
            const phoneClean = phoneStr.replace(/\D/g, '');
            const emailStr = (c.email || '').toLowerCase();
            const tagsStr = Array.isArray(c.tags) ? c.tags.join(' ').toLowerCase() : '';

            // Clean phone digits match (e.g. typing "9123" matches "+919123456789")
            if (digitsOnly && digitsOnly.length >= 2 && phoneClean.includes(digitsOnly)) {
              return true;
            }

            // Word tokens match (e.g. "neh" matches "Neha Gupta")
            const fullBlob = `${nameStr} ${phoneStr} ${emailStr} ${tagsStr}`;
            return searchTokens.every((tok) => fullBlob.includes(tok));
          })
          .map((c) => c._id);
      } else {
        const dbConditions = [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { phone: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
          { tags: { $regex: escapedSearch, $options: 'i' } }
        ];
        if (digitsOnly && digitsOnly.length >= 2) {
          dbConditions.push({ phone: { $regex: digitsOnly } });
        }
        const contacts = await Contact.find({
          userId,
          isDeleted: { $ne: true },
          $or: dbConditions
        }).select('_id').lean();
        matchedContactIds = contacts.map((c) => c._id);
      }

      // Also search message content (WhatsApp Web feature: find chats by message text)
      let matchedConvIdsFromMessages = [];
      try {
        const matchingMessages = await Message.find({
          userId,
          text: { $regex: escapedSearch, $options: 'i' }
        })
          .select('conversationId')
          .limit(100)
          .lean();
        matchedConvIdsFromMessages = matchingMessages.map((m) => m.conversationId).filter(Boolean);
      } catch (err) {
        // Safe regex fallback
      }

      // Build combined search clause
      const searchOr = [];
      if (matchedContactIds.length > 0) {
        searchOr.push({ contactId: { $in: matchedContactIds } });
      }
      if (matchedConvIdsFromMessages.length > 0) {
        searchOr.push({ _id: { $in: matchedConvIdsFromMessages } });
      }

      if (searchOr.length > 0) {
        if (query.$or) {
          query.$and = (query.$and || []).concat([
            { $or: query.$or },
            { $or: searchOr }
          ]);
          delete query.$or;
        } else {
          query.$or = searchOr;
        }
      } else {
        query.contactId = { $in: [] };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Conversation.countDocuments(query);

    const effectiveSort = sort === '-lastMessageAt' ? { isPinned: -1, pinnedAt: -1, lastMessageAt: -1 } : sort;

    const conversations = await Conversation.find(query)
      .sort(effectiveSort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('contactId', 'name phone profilePic source tags')
      .populate('assignedAgent', 'name email')
      .populate('assigned_agent_id', 'name email')
      .lean();

    // Attach last message for each conversation
    const convIds = conversations.map((c) => c._id);
    const lastMessages = await Message.aggregate([
      { $match: { conversationId: { $in: convIds }, userId } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$conversationId', lastMessage: { $first: '$$ROOT' } } },
    ]);

    const { getOekForUser, decryptContact, decryptMessage } = require('../services/oekService');
    const rawOek = await getOekForUser(userId);

    // Decrypt conversations contacts
    conversations.forEach((c) => {
      if (c.contactId) {
        c.contactId = decryptContact(c.contactId, rawOek);
      }
    });

    const msgMap = {};
    lastMessages.forEach((m) => {
      let msg = m.lastMessage;
      if (msg) {
        msg = decryptMessage(msg, rawOek);
      }
      msgMap[m._id.toString()] = msg;
    });

    const data = conversations.map((c) => ({
      ...c,
      lastMessage: msgMap[c._id.toString()] || null,
    }));

    res.json({
      success: true,
      data: { conversations: data, total, page: parseInt(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch conversations', code: 'FETCH_ERROR' });
  }
});

// GET /messages/conversations/:id — single conversation with messages
router.get('/conversations/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId })
      .populate('contactId')
      .populate('assignedAgent', 'name email')
      .populate('assigned_agent_id', 'name email');

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    if (req.user.role === 'agent') {
      const assignedId = conversation.assigned_agent_id?._id || conversation.assigned_agent_id || conversation.assignedAgent?._id || conversation.assignedAgent;
      if (assignedId && assignedId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Access denied: Conversation is assigned to another agent', code: 'FORBIDDEN' });
      }
    }

    // Mark conversation and its unread messages as read
    conversation.isRead = true;
    conversation.unreadCount = 0;
    await conversation.save();

    try {
      const unreadMessages = await Message.find({
        conversationId: conversation._id,
        direction: 'inbound',
        status: { $ne: 'read' }
      });

      if (unreadMessages.length > 0) {
        const waAccount = await WhatsAppAccount.findOne({ userId: req.userId, isActive: true });
        if (waAccount) {
          const token = decryptField(waAccount.accessToken);
          const phoneNumberId = waAccount.phoneNumberId;
          for (const msg of unreadMessages) {
            if (msg.metaMessageId) {
              whatsapp.markAsRead(phoneNumberId, token, msg.metaMessageId).catch((err) => {
                console.error(`Failed to mark message ${msg._id} as read on WhatsApp:`, err.message);
              });
            }
            msg.status = 'read';
            await msg.save();
          }
        }
      }
    } catch (err) {
      console.error('Error marking unread messages as read on fetch:', err.message);
    }

    const limit = parseInt(req.query.limit, 10) || 100;
    const before = req.query.before;
    const msgQuery = { conversationId: conversation._id, userId: req.userId };
    if (before) {
      msgQuery.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(msgQuery)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    messages.reverse();

    const { getOekForUser, decryptContact, decryptMessage } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);

    // Decrypt conversation contact
    let conversationObj = conversation.toObject();
    if (conversationObj.contactId) {
      conversationObj.contactId = decryptContact(conversationObj.contactId, rawOek);
    }

    // Decrypt messages
    const decryptedMessages = messages.map((m) => decryptMessage(m, rawOek));

    res.json({
      success: true,
      data: { conversation: conversationObj, messages: decryptedMessages },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch conversation', code: 'FETCH_ERROR' });
  }
});

// POST /messages/conversations/:id/read — explicitly mark conversation as read
router.post('/conversations/:id/read', ...validateObjectId('id'), async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    conversation.isRead = true;
    conversation.unreadCount = 0;
    await conversation.save();

    try {
      const unreadMessages = await Message.find({
        conversationId: conversation._id,
        direction: 'inbound',
        status: { $ne: 'read' }
      });

      if (unreadMessages.length > 0) {
        const waAccount = await WhatsAppAccount.findOne({ userId: req.userId, isActive: true });
        if (waAccount) {
          const token = decryptField(waAccount.accessToken);
          const phoneNumberId = waAccount.phoneNumberId;
          for (const msg of unreadMessages) {
            if (msg.metaMessageId) {
              whatsapp.markAsRead(phoneNumberId, token, msg.metaMessageId).catch((err) => {
                console.error(`Failed to mark message ${msg._id} as read on WhatsApp:`, err.message);
              });
            }
            msg.status = 'read';
            await msg.save();
          }
        }
      }
    } catch (err) {
      console.error('Error marking unread messages as read on explicit POST:', err.message);
    }

    // Emit live update so client state is synced
    const io = req.app.get('io');
    if (io) {
      const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
      io.to(roomId).emit('conversation_read', {
        conversationId: conversation._id
      });
    }

    res.json({ success: true, message: 'Conversation marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark conversation as read', code: 'READ_ERROR' });
  }
});

// POST /messages/conversations/:id/pin — toggle pin status
const handleTogglePin = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    conversation.isPinned = !conversation.isPinned;
    conversation.pinnedAt = conversation.isPinned ? new Date() : null;
    await conversation.save();

    const io = req.app.get('io');
    if (io) {
      const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
      io.to(roomId).emit('conversation_pinned', {
        conversationId: conversation._id,
        isPinned: conversation.isPinned,
        pinnedAt: conversation.pinnedAt,
      });
    }

    res.json({
      success: true,
      message: conversation.isPinned ? 'Chat pinned to top' : 'Chat unpinned',
      isPinned: conversation.isPinned,
      data: { conversation },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to toggle pin', code: 'PIN_ERROR' });
  }
};
router.post('/conversations/:id/pin', ...validateObjectId('id'), handleTogglePin);
router.patch('/conversations/:id/pin', ...validateObjectId('id'), handleTogglePin);

// POST /messages/conversations/:id/star — toggle star status
const handleToggleStar = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    conversation.isStarred = !conversation.isStarred;
    conversation.starredAt = conversation.isStarred ? new Date() : null;
    await conversation.save();

    const io = req.app.get('io');
    if (io) {
      const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
      io.to(roomId).emit('conversation_starred', {
        conversationId: conversation._id,
        isStarred: conversation.isStarred,
        starredAt: conversation.starredAt,
      });
    }

    res.json({
      success: true,
      message: conversation.isStarred ? 'Chat starred' : 'Chat unstarred',
      isStarred: conversation.isStarred,
      data: { conversation },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to toggle star', code: 'STAR_ERROR' });
  }
};
router.post('/conversations/:id/star', ...validateObjectId('id'), handleToggleStar);
router.patch('/conversations/:id/star', ...validateObjectId('id'), handleToggleStar);

// POST /conversations — find or create conversation for a contact
router.post('/conversations', async (req, res) => {
  try {
    const { contactId } = req.body;
    const userId = req.userId;

    if (!contactId || !mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ success: false, error: 'Valid contactId required', code: 'INVALID_CONTACT' });
    }

    const contact = await Contact.findOne({ _id: contactId, userId, isDeleted: { $ne: true } });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found', code: 'NOT_FOUND' });
    }

    let conversation = await Conversation.findOne({ userId, contactId: contact._id })
      .populate('contactId', 'name phone profilePic source tags')
      .populate('assignedAgent', 'name email');

    const User = require('../models/User');

    if (conversation) {
      // If the conversation exists, check if it's assigned to someone else
      if (req.user.role === 'agent') {
        const assignedId = conversation.assigned_agent_id || (conversation.assignedAgent?._id || conversation.assignedAgent);
        if (assignedId && assignedId.toString() !== req.user._id.toString()) {
          const assignedUser = await User.findById(assignedId);
          const agentName = assignedUser ? assignedUser.name : 'another agent';
          return res.status(403).json({
            success: false,
            error: `This conversation is already assigned to ${agentName}`,
            code: 'FORBIDDEN'
          });
        }

        // If it exists but is currently unassigned/bot-controlled, assign it to this agent automatically
        if (!assignedId) {
          conversation.assignedAgent = req.user._id;
          conversation.assigned_agent_id = req.user._id;
          conversation.assigned_at = new Date();
          conversation.lock_status = true;
          conversation.takeover_status = 'human';
          conversation.status = 'human';
          await conversation.save();

          const { recordAgentActivity } = require('../services/roundRobinService');
          await recordAgentActivity(req.user._id);

          // Re-populate
          conversation = await Conversation.findById(conversation._id)
            .populate('contactId', 'name phone profilePic source tags')
            .populate('assignedAgent', 'name email')
            .populate('assigned_agent_id', 'name email');
        }
      }
    } else {
      const Organization = require('../models/Organization');
      const adminUser = await User.findById(userId);
      const org = adminUser ? await Organization.findById(adminUser.organizationId) : null;
      if (org) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const count = await Conversation.countDocuments({ userId, createdAt: { $gte: startOfMonth } });
        if (count >= org.maxMonthlyConversations) {
          return res.status(400).json({ success: false, error: `Maximum monthly conversations limit of ${org.maxMonthlyConversations} reached under your organization subscription plan.` });
        }
      }

      const isCallerAgent = req.user.role === 'agent';
      const initialAgentId = isCallerAgent ? req.user._id : null;

      // Create conversation
      conversation = await Conversation.create({
        userId,
        contactId: contact._id,
        status: 'human', // Default to human control when manually started
        source: contact.source || 'direct',
        lastMessageAt: new Date(),
        organization_id: adminUser ? adminUser.organizationId : null,
        assignedAgent: initialAgentId,
        assigned_agent_id: initialAgentId,
        assigned_at: isCallerAgent ? new Date() : null,
        lock_status: isCallerAgent ? true : false,
        takeover_status: isCallerAgent ? 'human' : 'ai',
      });

      if (isCallerAgent) {
        const { recordAgentActivity } = require('../services/roundRobinService');
        await recordAgentActivity(req.user._id);
      } else {
        // If created by Admin/Owner, automatically distribute to next agent via Round-Robin!
        const { assignConversationRoundRobin } = require('../services/roundRobinService');
        const io = req.app.get('io');
        await assignConversationRoundRobin({
          conversation,
          organizationId: adminUser ? adminUser.organizationId : null,
          ownerId: userId,
          io,
          contactName: contact.name || contact.phone
        });
      }

      conversation = await Conversation.findById(conversation._id)
        .populate('contactId', 'name phone profilePic source tags')
        .populate('assignedAgent', 'name email')
        .populate('assigned_agent_id', 'name email');
    }

    const { getOekForUser, decryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(userId);
    let conversationObj = conversation.toObject();
    if (conversationObj.contactId) {
      conversationObj.contactId = decryptContact(conversationObj.contactId, rawOek);
    }

    res.json({ success: true, data: { conversation: conversationObj } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create conversation', code: 'CONVERSATION_CREATE_ERROR' });
  }
});

// POST /messages/send — send a message
router.post('/send', async (req, res) => {
  try {
    const { contactId, text, type = 'text', mediaUrl, caption, filename } = req.body;
    const userId = req.userId;

    if (!contactId || !mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ success: false, error: 'Valid contactId required', code: 'INVALID_CONTACT' });
    }

    const contact = await Contact.findOne({ _id: contactId, userId, isDeleted: { $ne: true } });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found', code: 'NOT_FOUND' });
    }

    if (req.user.role === 'agent') {
      const conversation = await Conversation.findOne({ userId, contactId: contact._id });
      const assignedId = conversation ? (conversation.assigned_agent_id || (conversation.assignedAgent?._id || conversation.assignedAgent)) : null;
      if (!conversation || !assignedId || assignedId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'You must take over this conversation before sending messages', code: 'TAKEOVER_REQUIRED' });
      }
    }

    if (contact.optedOut) {
      return res.status(403).json({ success: false, error: 'Contact has opted out', code: 'OPTED_OUT' });
    }

    const waAccount = await WhatsAppAccount.findOne({ userId, isActive: true });
    if (!waAccount) {
      return res.status(400).json({ success: false, error: 'No active WhatsApp account', code: 'NO_WA_ACCOUNT' });
    }

    const token = decryptField(waAccount.accessToken);
    let result;

    // MIME type map used for both Cloudinary re-upload and Meta Media API upload
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.3gp': 'video/3gpp',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mpeg': 'video/mpeg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4',
      '.amr': 'audio/amr',
    };

    // For local uploads, resolve to a publicly accessible URL before sending.
    // Priority:
    //   1. If Cloudinary is configured → upload file to Cloudinary and use that URL.
    //      This guarantees the live server (and Meta) can always reach the media.
    //   2. Otherwise → upload directly to Meta's Media API to get a media_id so
    //      Meta never needs to fetch the file from our (possibly private) server.
    //   3. Last resort → construct an absolute URL from the request host.
    let finalMediaUrl = mediaUrl;
    let metaMediaId = null;

    if (mediaUrl && mediaUrl.startsWith('/uploads')) {
      const filePath = path.join(__dirname, '..', mediaUrl);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = mimeMap[ext] || 'application/octet-stream';

        // 1. Try Cloudinary first — produces a stable public URL stored in the DB
        if (cloudinaryService.isConfigured()) {
          try {
            const cloudinaryUrl = await cloudinaryService.uploadStream(
              fileBuffer, 'messages', 'auto', path.basename(filePath)
            );
            finalMediaUrl = cloudinaryUrl;
          } catch (cloudErr) {
            console.error('[SEND] Cloudinary re-upload failed, falling back to Meta Media API:', cloudErr.message);
            // Fall through to Meta Media API upload below
          }
        }

        // 2. If still a local path (Cloudinary not configured or failed), use Meta Media API
        if (finalMediaUrl.startsWith('/uploads')) {
          const uploadResult = await whatsapp.uploadMedia(waAccount.phoneNumberId, token, fileBuffer, mimeType);
          if (uploadResult.success && uploadResult.data?.id) {
            metaMediaId = uploadResult.data.id;
          }
          // Build an absolute URL as fallback reference for the message record
          const protocol = req.headers['x-forwarded-proto'] || req.protocol;
          finalMediaUrl = `${protocol}://${req.headers.host}${mediaUrl}`;
        }
      } else {
        // File not found locally — build absolute URL and let proxyImageUrl in whatsapp.js handle it
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        finalMediaUrl = `${protocol}://${req.headers.host}${mediaUrl}`;
      }
    }

    // Extract original filename from the upload path
    const originalFilename = mediaUrl ? path.basename(mediaUrl) : 'document';

    let messageText = text;

    if (type === 'image' && (metaMediaId || finalMediaUrl)) {
      result = await whatsapp.sendImageMessage(waAccount.phoneNumberId, token, contact.phone, finalMediaUrl, caption, metaMediaId);
    } else if (type === 'video' && (metaMediaId || finalMediaUrl)) {
      result = await whatsapp.sendVideoMessage(waAccount.phoneNumberId, token, contact.phone, finalMediaUrl, caption, metaMediaId);
    } else if (type === 'audio' && (metaMediaId || finalMediaUrl)) {
      result = await whatsapp.sendAudioMessage(waAccount.phoneNumberId, token, contact.phone, finalMediaUrl, metaMediaId);
    } else if (type === 'document' && (metaMediaId || finalMediaUrl)) {
      result = await whatsapp.sendDocumentMessage(waAccount.phoneNumberId, token, contact.phone, finalMediaUrl, originalFilename, metaMediaId);
    } else if (type === 'contact') {
      const { contactName, contactPhone } = req.body;
      if (!contactName || !contactPhone) {
        return res.status(400).json({ success: false, error: 'contactName and contactPhone required for contact message', code: 'MISSING_FIELDS' });
      }
      result = await whatsapp.sendContactMessage(waAccount.phoneNumberId, token, contact.phone, contactName, contactPhone);
    } else if (type === 'template') {
      const { templateId, variables = [] } = req.body;
      if (!templateId) {
        return res.status(400).json({ success: false, error: 'templateId is required for template message', code: 'MISSING_FIELDS' });
      }
      const Template = require('../models/Template');
      const tmpl = await Template.findOne({ _id: templateId, userId });
      if (!tmpl) {
        return res.status(404).json({ success: false, error: 'Template not found', code: 'NOT_FOUND' });
      }
      
      if (tmpl.isCustom) {
        // Send local custom templates as interactive button messages
        const bodyText = tmpl.components?.find(c => c.type === 'BODY')?.text || '';
        const buttons = tmpl.components?.find(c => c.type === 'BUTTONS')?.buttons || [];
        const formattedButtons = buttons.map(btn => ({
          id: btn.text,
          title: btn.text
        }));

        result = await whatsapp.sendButtonMessage(
          waAccount.phoneNumberId,
          token,
          contact.phone,
          bodyText,
          formattedButtons
        );
        messageText = bodyText;
      } else {
        const templateComponents = [];
        if (variables && variables.length > 0) {
          templateComponents.push({
            type: 'body',
            parameters: variables.map((v) => ({ type: 'text', text: v }))
          });
        }

        result = await whatsapp.sendTemplateMessage(
          waAccount.phoneNumberId,
          token,
          contact.phone,
          tmpl.name,
          tmpl.language || 'en',
          templateComponents
        );

        // Resolve template text for visual chat bubbles
        let templateText = '';
        const bodyComp = tmpl.components?.find(c => c.type === 'BODY' || c.type?.toLowerCase() === 'body');
        if (bodyComp && bodyComp.text) {
          templateText = bodyComp.text;
          if (variables && variables.length > 0) {
            templateText = templateText.replace(/\{\{([0-9]+)\}\}/g, (_, num) => {
              const idx = parseInt(num, 10) - 1;
              return variables[idx] !== undefined ? variables[idx] : `{{${num}}}`;
            });
          }
        }
        messageText = templateText || `[Template: ${tmpl.name}]`;
      }
    } else {
      result = await whatsapp.sendTextMessage(waAccount.phoneNumberId, token, contact.phone, text);
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({ userId, contactId: contact._id });
    if (!conversation) {
      conversation = await Conversation.create({ userId, contactId: contact._id, status: 'human', source: contact.source });
    }

    const message = await Message.create({
      userId,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'outbound',
      type,
      content: {
        text: type === 'contact' ? `${req.body.contactName} (${req.body.contactPhone})` : messageText,
        mediaUrl: (type === 'image' && result?.sentUrl) ? result.sentUrl : finalMediaUrl,
        caption,
        filename: filename || originalFilename,
        contactName: req.body.contactName,
        contactPhone: req.body.contactPhone
      },
      status: result.success ? 'sent' : 'failed',
      metaMessageId: result.data?.messages?.[0]?.id,
      sentBy: 'human',
      errorDetails: result.error,
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Log the action
    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'AGENT_MESSAGE_SENT',
      resource: 'Conversation',
      resourceId: conversation._id.toString(),
      newValue: { messageId: message._id.toString() },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    const { getOekForUser, decryptMessage } = require('../services/oekService');
    const rawOek = await getOekForUser(userId);
    const decryptedMsg = decryptMessage(message, rawOek);

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('new_message', {
        message: decryptedMsg,
        contact: contact.toObject(),
        conversationId: conversation._id,
      });
    }

    res.json({ success: true, data: { message: decryptedMsg }, message: 'Message sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send message', code: 'SEND_ERROR' });
  }
});

// POST /messages/bulk — send free-form message to multiple contacts
router.post('/bulk', async (req, res) => {
  try {
    const { contactIds, text, type = 'text', mediaUrl, caption } = req.body;
    const userId = req.userId;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Valid contactIds array required', code: 'INVALID_CONTACTS' });
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({ success: false, error: 'Message text or mediaUrl required', code: 'MISSING_CONTENT' });
    }

    const waAccount = await WhatsAppAccount.findOne({ userId, isActive: true });
    if (!waAccount) {
      return res.status(400).json({ success: false, error: 'No active WhatsApp account', code: 'NO_WA_ACCOUNT' });
    }

    const token = decryptField(waAccount.accessToken);
    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    // Resolve local /uploads/ path to a public URL once before the loop so we
    // don't re-upload the same file for every contact.
    let resolvedMediaUrl = mediaUrl;
    if (mediaUrl && mediaUrl.startsWith('/uploads')) {
      const filePath = path.join(__dirname, '..', mediaUrl);
      if (fs.existsSync(filePath)) {
        if (cloudinaryService.isConfigured()) {
          try {
            resolvedMediaUrl = await cloudinaryService.uploadStream(
              fs.readFileSync(filePath), 'messages', 'auto', path.basename(filePath)
            );
          } catch (cloudErr) {
            console.error('[BULK SEND] Cloudinary re-upload failed, using absolute host URL:', cloudErr.message);
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            resolvedMediaUrl = `${protocol}://${req.headers.host}${mediaUrl}`;
          }
        } else {
          const protocol = req.headers['x-forwarded-proto'] || req.protocol;
          resolvedMediaUrl = `${protocol}://${req.headers.host}${mediaUrl}`;
        }
      } else {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        resolvedMediaUrl = `${protocol}://${req.headers.host}${mediaUrl}`;
      }
    }

    const limit = 5;
    const activeTasks = [];

    const sendToContact = async (contactId) => {
      try {
        const contact = await Contact.findOne({ _id: contactId, userId, isDeleted: { $ne: true } });
        if (!contact) {
          results.push({ contactId, status: 'failed', error: 'Contact not found' });
          failedCount++;
          return;
        }

        if (contact.optedOut) {
          results.push({ contactId, name: contact.name, phone: contact.phone, status: 'failed', error: 'Contact opted out' });
          failedCount++;
          return;
        }

        let result;
        if (type === 'image' && resolvedMediaUrl) {
          result = await whatsapp.sendImageMessage(waAccount.phoneNumberId, token, contact.phone, resolvedMediaUrl, caption);
        } else if (type === 'video' && resolvedMediaUrl) {
          result = await whatsapp.sendVideoMessage(waAccount.phoneNumberId, token, contact.phone, resolvedMediaUrl, caption);
        } else if (type === 'document' && resolvedMediaUrl) {
          result = await whatsapp.sendDocumentMessage(waAccount.phoneNumberId, token, contact.phone, resolvedMediaUrl, caption);
        } else {
          result = await whatsapp.sendTextMessage(waAccount.phoneNumberId, token, contact.phone, text);
        }

        // Find or create conversation
        let conversation = await Conversation.findOne({ userId, contactId: contact._id });
        if (!conversation) {
          conversation = await Conversation.create({ userId, contactId: contact._id, status: 'human', source: contact.source });
        }

        const message = await Message.create({
          userId,
          conversationId: conversation._id,
          contactId: contact._id,
          direction: 'outbound',
          type,
          content: { text, mediaUrl: (type === 'image' && result?.sentUrl) ? result.sentUrl : resolvedMediaUrl, caption },
          status: result.success ? 'sent' : 'failed',
          metaMessageId: result.data?.messages?.[0]?.id,
          sentBy: 'human',
          errorDetails: result.error,
        });

        conversation.lastMessageAt = new Date();
        await conversation.save();

        // Emit via Socket.io
        const io = req.app.get('io');
        if (io) {
          const { getOekForUser, decryptMessage } = require('../services/oekService');
          const rawOek = await getOekForUser(userId);
          const decryptedMsg = decryptMessage(message, rawOek);
          io.to(`user_${userId}`).emit('new_message', {
            message: decryptedMsg,
            contact: contact.toObject(),
            conversationId: conversation._id,
          });
        }

        if (result.success) {
          results.push({ contactId, name: contact.name, phone: contact.phone, status: 'sent', messageId: message._id });
          sentCount++;
        } else {
          results.push({ contactId, name: contact.name, phone: contact.phone, status: 'failed', error: result.error || 'WhatsApp API Error', code: result.code });
          failedCount++;
        }
      } catch (err) {
        results.push({ contactId, status: 'failed', error: err.message });
        failedCount++;
      }
    };

    for (const contactId of contactIds) {
      const task = sendToContact(contactId);
      activeTasks.push(task);
      task.finally(() => {
        const idx = activeTasks.indexOf(task);
        if (idx !== -1) activeTasks.splice(idx, 1);
      });
      if (activeTasks.length >= limit) {
        await Promise.race(activeTasks);
      }
    }
    await Promise.all(activeTasks);

    res.json({
      success: true,
      data: {
        total: contactIds.length,
        sent: sentCount,
        failed: failedCount,
        details: results
      },
      message: `Direct bulk messaging completed. Succeeded: ${sentCount}, Failed: ${failedCount}`
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process direct bulk messages', code: 'BULK_SEND_ERROR' });
  }
});

// POST /messages/conversations/auto-assign-all — Distribute all unassigned conversations via Round Robin
router.post('/conversations/auto-assign-all', async (req, res) => {
  try {
    const { distributeUnassignedConversations } = require('../services/roundRobinService');
    const io = req.app.get('io');
    const result = await distributeUnassignedConversations(req.userId, req.user.organizationId, io);
    res.json({ success: true, message: `Successfully assigned ${result.assignedCount} conversations via Round-Robin.`, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to auto-assign conversations', details: error.message });
  }
});

// POST /messages/conversations/:id/assign
router.post('/conversations/:id/assign', ...validateObjectId('id'), async (req, res) => {
  try {
    const { agentId } = req.body;
    const User = require('../models/User');

    // Support explicit auto/round-robin assignment request
    if (agentId === 'auto' || agentId === 'round-robin') {
      const convToAssign = await Conversation.findOne({ _id: req.params.id, userId: req.userId }).populate('contactId');
      if (!convToAssign) {
        return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
      }
      const { assignConversationRoundRobin } = require('../services/roundRobinService');
      const io = req.app.get('io');
      const contactName = convToAssign.contactId ? (convToAssign.contactId.name || convToAssign.contactId.phone) : 'Contact';
      const result = await assignConversationRoundRobin({
        conversation: convToAssign,
        organizationId: req.user.organizationId,
        ownerId: req.userId,
        io,
        contactName
      });
      return res.json({ success: true, data: { conversation: result.conversation } });
    }

    // 1. Fetch current conversation state
    const oldConv = await Conversation.findOne({ _id: req.params.id, userId: req.userId }).populate('assignedAgent', 'name email');
    if (!oldConv) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    // 2. Determine target agent.
    // - Agents can only take over for themselves (req.user._id).
    // - Admins can assign to anyone explicitly (agentId).
    // - If Admin takes over without specifying agentId, restore previous_assigned_agent if exists, else assign to caller.
    let targetAgentId = req.user.role === 'agent' ? req.user._id : agentId;
    if (!targetAgentId) {
      const candidateAgent = oldConv.previous_assigned_agent || oldConv.assignedAgent?._id || oldConv.assignedAgent;
      if (candidateAgent) {
        const prevUser = await User.findById(candidateAgent);
        if (prevUser && !prevUser.isDeleted && !prevUser.isSuspended) {
          targetAgentId = candidateAgent;
        }
      }
      if (!targetAgentId) {
        targetAgentId = req.user._id;
      }
    }

    // 3. Fetch agent details
    const agentUser = await User.findById(targetAgentId);
    if (!agentUser || agentUser.isDeleted) {
      return res.status(400).json({ success: false, error: 'Target agent not found', code: 'AGENT_NOT_FOUND' });
    }
    if (agentUser.isSuspended) {
      return res.status(400).json({ success: false, error: 'Target agent is suspended', code: 'AGENT_SUSPENDED' });
    }

    // 4. Setup atomic query conditions
    let query = {
      _id: req.params.id,
      userId: req.userId
    };

    // If caller is an agent, they cannot steal a locked conversation assigned to someone else
    if (req.user.role === 'agent') {
      query.$or = [
        { lock_status: false },
        { lock_status: { $exists: false } },
        { assigned_agent_id: req.user._id },
        { assignedAgent: req.user._id }
      ];
    }

    // 5. Perform atomic update
    const conversation = await Conversation.findOneAndUpdate(
      query,
      {
        $set: {
          assignedAgent: targetAgentId,
          assigned_agent_id: targetAgentId,
          assigned_at: new Date(),
          lock_status: true,
          takeover_status: 'human',
          status: 'human',
          previous_assigned_agent: null,
          previous_status: null
        }
      },
      { new: true }
    ).populate('contactId').populate('assignedAgent', 'name email').populate('assigned_agent_id', 'name email');

    // 5. Handle atomic lock collision / failure
    if (!conversation) {
      return res.status(400).json({ success: false, error: 'Conversation already assigned to another agent', code: 'ALREADY_ASSIGNED' });
    }

    // Record activity for round-robin balancing
    const { recordAgentActivity } = require('../services/roundRobinService');
    await recordAgentActivity(targetAgentId);

    // 6. Real-time updates via Socket.io
    const io = req.app.get('io');
    if (io) {
      const payload = {
        conversationId: conversation._id,
        assignedAgent: conversation.assignedAgent ? {
          _id: conversation.assignedAgent._id,
          name: conversation.assignedAgent.name,
          email: conversation.assignedAgent.email
        } : null,
        assigned_agent_id: conversation.assigned_agent_id,
        lock_status: conversation.lock_status,
        takeover_status: conversation.takeover_status,
        status: conversation.status
      };

      // Emit to target agent's personal room
      io.to(`user_${targetAgentId}`).emit('conversation_assigned', payload);

      // Emit to tenant room if caller is an agent, otherwise to personal room
      const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
      io.to(roomId).emit('conversation_assigned', payload);
    }

    // 7. Audit log tracking
    const oldAgentId = oldConv.assignedAgent?._id?.toString() || oldConv.assignedAgent?.toString() || null;
    const isReassign = Boolean(oldAgentId && oldAgentId !== targetAgentId.toString());
    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: isReassign ? 'REASSIGN_CONVERSATION' : 'ASSIGN_CONVERSATION',
      resource: 'Conversation',
      resourceId: conversation._id.toString(),
      oldValue: oldAgentId ? { agentId: oldAgentId, agentName: oldConv.assignedAgent?.name || 'Agent' } : null,
      newValue: { agentId: targetAgentId, agentName: agentUser.name },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, data: { conversation }, message: 'Conversation assigned successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Assignment failed', code: 'ASSIGN_ERROR', details: error.message });
  }
});

// POST /messages/conversations/:id/resolve
router.post('/conversations/:id/resolve', ...validateObjectId('id'), async (req, res) => {
  try {
    const query = { _id: req.params.id, userId: req.userId };
    if (req.user.role === 'agent') {
      // Agents can only resolve their own assigned chats
      query.$or = [
        { assignedAgent: req.user._id },
        { assigned_agent_id: req.user._id }
      ];
    }

    const conversation = await Conversation.findOneAndUpdate(
      query,
      {
        $set: {
          status: 'resolved',
          resolvedAt: new Date(),
          lock_status: false,
          takeover_status: 'ai',
          assignedAgent: null,
          assigned_agent_id: null,
          assigned_at: null
        }
      },
      { new: true }
    ).populate('contactId').populate('assignedAgent', 'name email');

    if (!conversation) {
      return res.status(403).json({ success: false, error: 'Access denied or conversation not found', code: 'FORBIDDEN' });
    }

    const io = req.app.get('io');
    if (io) {
      // Emit to tenant room if user is an agent, otherwise to their personal room
      const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
      io.to(roomId).emit('conversation_assigned', {
        conversationId: conversation._id,
        assignedAgent: null,
        assigned_agent_id: null,
        lock_status: false,
        takeover_status: 'ai',
        status: 'resolved'
      });
    }

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'RESOLVE_CONVERSATION',
      resource: 'Conversation',
      resourceId: conversation._id.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Conversation resolved', data: { conversation } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Resolve failed', code: 'RESOLVE_ERROR' });
  }
});

// POST /messages/conversations/:id/transfer-to-ai
router.post('/conversations/:id/transfer-to-ai', ...validateObjectId('id'), async (req, res) => {
  try {
    const query = { _id: req.params.id, userId: req.userId };
    if (req.user.role === 'agent') {
      // Agents can only transfer their own assigned chats
      query.$or = [
        { assignedAgent: req.user._id },
        { assigned_agent_id: req.user._id }
      ];
    }

    const existingConv = await Conversation.findOne(query);
    if (!existingConv) {
      return res.status(403).json({ success: false, error: 'Access denied or conversation not found', code: 'FORBIDDEN' });
    }

    const currentAgent = existingConv.assignedAgent || existingConv.assigned_agent_id || null;
    const updateSet = {
      status: 'bot', // returns to bot mode
      lock_status: false,
      takeover_status: 'ai',
      assignedAgent: null,
      assigned_agent_id: null,
      assigned_at: null,
      currentNodeId: null,
      currentFlowId: null
    };

    if (currentAgent) {
      updateSet.previous_assigned_agent = currentAgent;
      updateSet.previous_status = 'human';
    }

    const conversation = await Conversation.findByIdAndUpdate(
      existingConv._id,
      { $set: updateSet },
      { new: true }
    ).populate('contactId').populate('assignedAgent', 'name email');

    if (!conversation) {
      return res.status(403).json({ success: false, error: 'Access denied or conversation not found', code: 'FORBIDDEN' });
    }

    const io = req.app.get('io');
    if (io) {
      // Emit to tenant room if user is an agent, otherwise to their personal room
      const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
      const payload = {
        conversationId: conversation._id,
        assignedAgent: null,
        assigned_agent_id: null,
        lock_status: false,
        takeover_status: 'ai',
        status: 'bot'
      };
      io.to(roomId).emit('conversation_assigned', payload);
      if (currentAgent) {
        io.to(`user_${currentAgent}`).emit('conversation_assigned', payload);
      }
    }

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'AI_RESUME',
      resource: 'Conversation',
      resourceId: conversation._id.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Transferred to AI', data: { conversation } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Transfer failed', code: 'TRANSFER_ERROR' });
  }
});

// GET /messages/ai-status — Check if AI assistant is configured and active
router.get('/ai-status', async (req, res) => {
  try {
    const Organization = require('../models/Organization');
    const { resolveAIConfig } = require('../services/aiAgent');

    let org = null;
    if (req.organizationId) {
      org = await Organization.findById(req.organizationId);
    }
    if (!org && req.user?.role === 'superadmin') {
      org = await Organization.findOne();
    }

    const aiConfig = resolveAIConfig(org);
    const isConfigured = Boolean(aiConfig && aiConfig.apiKey);

    res.json({
      success: true,
      data: {
        isConfigured,
        provider: aiConfig?.provider || null,
        model: aiConfig?.model || null,
        isEnabled: org?.aiConfig?.isEnabled !== false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check AI status', code: 'AI_STATUS_ERROR' });
  }
});

// POST /messages/conversations/:id/toggle-ai — Toggle Groq/Gemini/OpenAI Ask AI takeover mode
router.post('/conversations/:id/toggle-ai', ...validateObjectId('id'), async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.userId;

    let conversation = await Conversation.findOne({ _id: conversationId, userId })
      .populate('contactId')
      .populate('assignedAgent', 'name email');

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    const isCurrentlyAI = conversation.status === 'ai' || conversation.ai_active;

    if (!isCurrentlyAI) {
      // ACTIVATE ASK AI:
      // Verify AI is configured before allowing activation
      const Organization = require('../models/Organization');
      const { resolveAIConfig } = require('../services/aiAgent');
      let org = null;
      if (req.organizationId) {
        org = await Organization.findById(req.organizationId);
      }
      if (!org && req.user?.role === 'superadmin') {
        org = await Organization.findOne();
      }
      const aiConfig = resolveAIConfig(org);
      if (!aiConfig || !aiConfig.apiKey) {
        return res.status(400).json({
          success: false,
          error: 'AI Assistant is not configured. Please enter your API key in Settings > AI Integration.',
          code: 'AI_NOT_CONFIGURED'
        });
      }

      // 1. Snapshot previous state before AI takeover
      const currentStatus = conversation.status || 'bot';
      const currentAgent = conversation.assignedAgent?._id || conversation.assigned_agent_id || null;
      const currentLock = Boolean(conversation.lock_status);
      const currentTakeover = conversation.takeover_status || 'ai';

      conversation.previous_status = currentStatus === 'ai' ? 'bot' : currentStatus;
      conversation.previous_assigned_agent = currentAgent;
      conversation.previous_lock_status = currentLock;
      conversation.previous_takeover_status = currentTakeover;

      // 2. Set to AI takeover mode
      conversation.status = 'ai';
      conversation.ai_active = true;
      conversation.lock_status = true; // prevent automatic bot flow or round-robin interruption
      conversation.takeover_status = 'ai';
      conversation.assignedAgent = null;
      conversation.assigned_agent_id = null;
      await conversation.save();

      // Re-populate for response
      conversation = await Conversation.findById(conversation._id).populate('contactId');

      // 3. Emit real-time events via Socket.io
      const io = req.app.get('io');
      if (io) {
        const payload = {
          conversationId: conversation._id,
          status: 'ai',
          ai_active: true,
          lock_status: true,
          takeover_status: 'ai',
          assignedAgent: null,
          assigned_agent_id: null
        };
        const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
        io.to(roomId).emit('conversation_assigned', payload);
        io.to(roomId).emit('ai_mode_updated', payload);
        if (currentAgent) {
          io.to(`user_${currentAgent}`).emit('conversation_assigned', payload);
        }
      }

      await AuditLog.log({
        userId: req.userId,
        actorId: req.user._id,
        actorName: req.user.name,
        action: 'AI_ASSISTANT_ACTIVATED',
        resource: 'Conversation',
        resourceId: conversation._id.toString(),
        newValue: { status: 'ai', previousStatus: conversation.previous_status },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // 4. If the latest message in this conversation was inbound from customer, auto-reply immediately!
      const lastMsg = await Message.findOne({ conversationId: conversation._id, userId }).sort({ createdAt: -1 });
      if (lastMsg && lastMsg.direction === 'inbound') {
        const { triggerAIReply } = require('../services/aiAgent');
        triggerAIReply({ conversationId: conversation._id, userId, io, incomingText: lastMsg.content?.text || '' }).catch(err => {
          console.error('Failed to auto-trigger AI reply on takeover:', err.message);
        });
      }

      return res.json({
        success: true,
        message: 'Ask AI activated ✨ AI is now chatting with this contact.',
        data: { conversation, active: true }
      });
    } else {
      // DEACTIVATE ASK AI — RESTORE PREVIOUS HANDLER
      const prevStatus = conversation.previous_status || 'bot';
      const prevAgent = conversation.previous_assigned_agent || null;
      const prevLock = conversation.previous_lock_status ?? false;

      conversation.ai_active = false;

      if (prevStatus === 'human' && prevAgent) {
        conversation.status = 'human';
        conversation.assignedAgent = prevAgent;
        conversation.assigned_agent_id = prevAgent;
        conversation.lock_status = prevLock;
        conversation.takeover_status = 'human';
      } else {
        conversation.status = 'bot';
        conversation.assignedAgent = null;
        conversation.assigned_agent_id = null;
        conversation.lock_status = false;
        conversation.takeover_status = 'ai';
      }

      conversation.previous_status = null;
      conversation.previous_assigned_agent = null;
      await conversation.save();

      conversation = await Conversation.findById(conversation._id)
        .populate('contactId')
        .populate('assignedAgent', 'name email');

      const io = req.app.get('io');
      if (io) {
        const payload = {
          conversationId: conversation._id,
          status: conversation.status,
          ai_active: false,
          lock_status: conversation.lock_status,
          takeover_status: conversation.takeover_status,
          assignedAgent: conversation.assignedAgent ? {
            _id: conversation.assignedAgent._id,
            name: conversation.assignedAgent.name,
            email: conversation.assignedAgent.email
          } : null,
          assigned_agent_id: conversation.assigned_agent_id
        };
        const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
        io.to(roomId).emit('conversation_assigned', payload);
        io.to(roomId).emit('ai_mode_updated', payload);
        if (conversation.assigned_agent_id) {
          io.to(`user_${conversation.assigned_agent_id}`).emit('conversation_assigned', payload);
        }
      }

      await AuditLog.log({
        userId: req.userId,
        actorId: req.user._id,
        actorName: req.user.name,
        action: 'AI_ASSISTANT_DEACTIVATED',
        resource: 'Conversation',
        resourceId: conversation._id.toString(),
        newValue: { status: conversation.status, restoredTo: prevStatus },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: conversation.status === 'human' ? 'Ask AI stopped. Restored to Human agent.' : 'Ask AI stopped. Restored to Bot.',
        data: { conversation, active: false }
      });
    }
  } catch (error) {
    console.error('Failed to toggle AI mode:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle AI mode', details: error.message });
  }
});

// POST /messages/conversations/:id/trigger-ai — Generate an AI reply on demand
router.post('/conversations/:id/trigger-ai', ...validateObjectId('id'), async (req, res) => {
  try {
    const { prompt } = req.body;
    const { triggerAIReply } = require('../services/aiAgent');
    const io = req.app.get('io');
    const message = await triggerAIReply({
      conversationId: req.params.id,
      userId: req.userId,
      io,
      incomingText: prompt || ''
    });

    if (!message) {
      return res.status(400).json({ success: false, error: 'Failed to generate AI response' });
    }

    return res.json({ success: true, message: 'AI response generated successfully', data: { message } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /messages/conversations/:id — delete a conversation and its messages
router.delete('/conversations/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.userId;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    // Delete associated messages
    await Message.deleteMany({ conversationId, userId });

    // Delete conversation
    await Conversation.deleteOne({ _id: conversationId, userId });

    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete conversation', code: 'DELETE_ERROR' });
  }
});

// GET /messages/stats — dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [totalContacts, sentToday, activeConversations, campaignsRunning, totalTemplates, unreadCountResult] = await Promise.all([
      Contact.countDocuments({ userId, isDeleted: { $ne: true } }),
      Message.countDocuments({ userId, direction: 'outbound', timestamp: { $gte: today } }),
      Conversation.countDocuments({ userId, status: { $in: ['bot', 'human', 'ai', 'waiting'] } }),
      require('../models/Campaign').countDocuments({ userId, status: 'running' }),
      require('../models/Template').countDocuments({ userId }),
      Conversation.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, totalUnread: { $sum: '$unreadCount' } } }
      ])
    ]);

    const totalUnreadMessages = unreadCountResult[0]?.totalUnread || 0;

    // Messages last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyMessages = await Message.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), direction: 'outbound', timestamp: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Conversations by source
    const bySource = await Conversation.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);

    // Status breakdown
    const byStatus = await Conversation.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Delivery rate (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalSent, totalDelivered] = await Promise.all([
      Message.countDocuments({ userId, direction: 'outbound', timestamp: { $gte: thirtyDaysAgo } }),
      Message.countDocuments({ userId, direction: 'outbound', status: { $in: ['delivered', 'read'] }, timestamp: { $gte: thirtyDaysAgo } })
    ]);
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalContacts,
        sentToday,
        activeConversations,
        campaignsRunning,
        totalTemplates,
        totalUnreadMessages,
        deliveryRate,
        dailyMessages,
        conversationsBySource: bySource,
        conversationsByStatus: byStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats', code: 'STATS_ERROR' });
  }
});

module.exports = router;
