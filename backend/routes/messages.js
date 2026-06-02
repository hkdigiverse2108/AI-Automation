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

// Configure multer storage for local file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const cloudinaryService = require('../services/cloudinaryService');

const upload = multer({
  storage: cloudinaryService.isConfigured() ? multer.memoryStorage() : storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(verifyToken);

// POST /messages/upload — upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded', code: 'MISSING_FILE' });
    }

    let fileUrl = '';
    if (cloudinaryService.isConfigured()) {
      fileUrl = await cloudinaryService.uploadStream(req.file.buffer, 'messages');
    } else {
      fileUrl = `/uploads/${req.file.filename}`;
    }

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

    if (status) query.status = status;

    if (req.user.role === 'agent') {
      if (assignedAgent) {
        if (assignedAgent === 'unassigned' || assignedAgent === 'null') {
          query.$or = [
            { assignedAgent: { $exists: false } },
            { assignedAgent: null }
          ];
        } else if (assignedAgent.toString() === req.user._id.toString()) {
          query.assignedAgent = req.user._id;
        } else {
          // Block access to other agent's conversations by forcing the query to match self
          query.assignedAgent = req.user._id;
        }
      } else {
        // Show only their own conversations + unassigned ones
        query.$or = [
          { assignedAgent: req.user._id },
          { assignedAgent: { $exists: false } },
          { assignedAgent: null }
        ];
      }
    } else {
      // Admin/Owner can view anything
      if (assignedAgent) {
        if (assignedAgent === 'unassigned' || assignedAgent === 'null') {
          query.$or = [
            { assignedAgent: { $exists: false } },
            { assignedAgent: null }
          ];
        } else {
          if (!mongoose.Types.ObjectId.isValid(assignedAgent)) {
            return res.status(400).json({ success: false, error: 'Invalid agent ID', code: 'INVALID_ID' });
          }
          query.assignedAgent = assignedAgent;
        }
      }
    }

    let contactIds = null;
    if (search) {
      const { getOekForUser, generateHMAC } = require('../services/oekService');
      const rawOek = await getOekForUser(userId);
      const searchCriteria = [];
      if (rawOek) {
        const hmacSearch = generateHMAC(search, rawOek);
        searchCriteria.push({ nameHash: hmacSearch });
        searchCriteria.push({ phoneHash: hmacSearch });
      } else {
        searchCriteria.push({ name: { $regex: search, $options: 'i' } });
        searchCriteria.push({ phone: { $regex: search, $options: 'i' } });
      }

      const contacts = await Contact.find({
        userId,
        isDeleted: { $ne: true },
        $or: searchCriteria,
      }).select('_id').lean();
      contactIds = contacts.map((c) => c._id);
      query.contactId = { $in: contactIds };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Conversation.countDocuments(query);

    const conversations = await Conversation.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('contactId', 'name phone profilePic source tags')
      .populate('assignedAgent', 'name email')
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
      .populate('assignedAgent', 'name email');

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    if (req.user.role === 'agent') {
      const assignedId = conversation.assigned_agent_id || (conversation.assignedAgent?._id || conversation.assignedAgent);
      if (assignedId && assignedId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Access denied: Conversation is assigned to another agent', code: 'FORBIDDEN' });
      }
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

    // Mark as read
    conversation.isRead = true;
    conversation.unreadCount = 0;
    await conversation.save();

    res.json({
      success: true,
      data: { conversation: conversationObj, messages: decryptedMessages },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch conversation', code: 'FETCH_ERROR' });
  }
});

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

          // Re-populate
          conversation = await Conversation.findById(conversation._id)
            .populate('contactId', 'name phone profilePic source tags')
            .populate('assignedAgent', 'name email');
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

      // Create conversation with auto-assignment if the creator is an agent
      conversation = await Conversation.create({
        userId,
        contactId: contact._id,
        status: 'human', // Default to human control when manually started
        source: contact.source || 'direct',
        lastMessageAt: new Date(),
        organization_id: adminUser ? adminUser.organizationId : null,
        assignedAgent: req.user.role === 'agent' ? req.user._id : null,
        assigned_agent_id: req.user.role === 'agent' ? req.user._id : null,
        assigned_at: req.user.role === 'agent' ? new Date() : null,
        lock_status: req.user.role === 'agent' ? true : false,
        takeover_status: req.user.role === 'agent' ? 'human' : 'ai',
      });

      conversation = await Conversation.findById(conversation._id)
        .populate('contactId', 'name phone profilePic source tags')
        .populate('assignedAgent', 'name email');
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

    // For local uploads, upload file to Meta's Media API first to get a media_id.
    // This avoids Meta needing to download from our server (which may be behind
    // ngrok or not publicly accessible), fixing "single tick" delivery issues.
    let finalMediaUrl = mediaUrl;
    let metaMediaId = null;

    if (mediaUrl && mediaUrl.startsWith('/uploads')) {
      const filePath = path.join(__dirname, '..', mediaUrl);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        // Determine MIME type from extension
        const ext = path.extname(filePath).toLowerCase();
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
        const mimeType = mimeMap[ext] || 'application/octet-stream';

        const uploadResult = await whatsapp.uploadMedia(waAccount.phoneNumberId, token, fileBuffer, mimeType);
        if (uploadResult.success && uploadResult.data?.id) {
          metaMediaId = uploadResult.data.id;
        }
      }

      // Keep the local URL as fallback reference for the message record
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      finalMediaUrl = `${protocol}://${req.headers.host}${mediaUrl}`;
    }

    // Extract original filename from the upload path
    const originalFilename = mediaUrl ? path.basename(mediaUrl) : 'document';

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
        text: type === 'contact' ? `${req.body.contactName} (${req.body.contactPhone})` : text,
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

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('new_message', {
        message: message.toObject(),
        contact: contact.toObject(),
        conversationId: conversation._id,
      });
    }

    res.json({ success: true, data: { message: message.toObject() }, message: 'Message sent' });
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
        if (type === 'image' && mediaUrl) {
          result = await whatsapp.sendImageMessage(waAccount.phoneNumberId, token, contact.phone, mediaUrl, caption);
        } else if (type === 'document' && mediaUrl) {
          result = await whatsapp.sendDocumentMessage(waAccount.phoneNumberId, token, contact.phone, mediaUrl, caption);
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
          content: { text, mediaUrl: (type === 'image' && result?.sentUrl) ? result.sentUrl : mediaUrl, caption },
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
          io.to(`user_${userId}`).emit('new_message', {
            message: message.toObject(),
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

// POST /messages/conversations/:id/assign
router.post('/conversations/:id/assign', ...validateObjectId('id'), async (req, res) => {
  try {
    const { agentId } = req.body;
    const User = require('../models/User');

    // 1. Determine target agent.
    // Agents can only take over for themselves. Admins can assign to anyone.
    const targetAgentId = req.user.role === 'agent' ? req.user._id : (agentId || req.user._id);

    // 2. Fetch agent details
    const agentUser = await User.findById(targetAgentId);
    if (!agentUser || agentUser.isDeleted) {
      return res.status(400).json({ success: false, error: 'Target agent not found', code: 'AGENT_NOT_FOUND' });
    }
    if (agentUser.isSuspended) {
      return res.status(400).json({ success: false, error: 'Target agent is suspended', code: 'AGENT_SUSPENDED' });
    }

    // 3. Setup atomic query conditions
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

    // 4. Perform atomic update
    const oldConv = await Conversation.findOne({ _id: req.params.id, userId: req.userId }).populate('assignedAgent', 'name email');
    if (!oldConv) {
      return res.status(404).json({ success: false, error: 'Conversation not found', code: 'NOT_FOUND' });
    }

    const conversation = await Conversation.findOneAndUpdate(
      query,
      {
        $set: {
          assignedAgent: targetAgentId,
          assigned_agent_id: targetAgentId,
          assigned_at: new Date(),
          lock_status: true,
          takeover_status: 'human',
          status: 'human'
        }
      },
      { new: true }
    ).populate('contactId').populate('assignedAgent', 'name email');

    // 5. Handle atomic lock collision / failure
    if (!conversation) {
      return res.status(400).json({ success: false, error: 'Conversation already assigned to another agent', code: 'ALREADY_ASSIGNED' });
    }

    // 6. Real-time updates via Socket.io
    const io = req.app.get('io');
    if (io) {
      // Emit to tenant room if user is an agent, otherwise to their personal room
      const roomId = req.user.ownerId ? `user_${req.user.ownerId}` : `user_${req.userId}`;
      io.to(roomId).emit('conversation_assigned', {
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
      });
    }

    // 7. Audit log tracking
    const isReassign = oldConv.assignedAgent && oldConv.assignedAgent._id.toString() !== targetAgentId.toString();
    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: isReassign ? 'REASSIGN_CONVERSATION' : 'ASSIGN_CONVERSATION',
      resource: 'Conversation',
      resourceId: conversation._id.toString(),
      oldValue: oldConv.assignedAgent ? { agentId: oldConv.assignedAgent._id, agentName: oldConv.assignedAgent.name } : null,
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

    const conversation = await Conversation.findOneAndUpdate(
      query,
      {
        $set: {
          status: 'bot', // returns to bot mode
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
        status: 'bot'
      });
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
