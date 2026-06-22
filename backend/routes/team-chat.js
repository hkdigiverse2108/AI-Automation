const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const TeamChat = require('../models/TeamChat');
const TeamChatMember = require('../models/TeamChatMember');
const TeamChatMessage = require('../models/TeamChatMessage');
const User = require('../models/User');
const Organization = require('../models/Organization');

const { verifyToken } = require('../middleware/auth');
const cloudinaryService = require('../services/cloudinaryService');
const { getOnlineUsers } = require('../services/socketService');
const { createNotification } = require('../services/notificationService');

// Multer Config for Team Chat Uploads (up to 15MB)
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

const upload = multer({
  storage: cloudinaryService.isConfigured() ? multer.memoryStorage() : storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

router.use(verifyToken);

// Helper: Determine User Privilege Level
function getUserPrivilegeLevel(user) {
  if (['superadmin', 'owner', 'admin'].includes(user.role)) {
    return 'admin';
  }
  // Check Manager keyword in designation or department
  const isManager = 
    (user.designation && /manager/i.test(user.designation)) || 
    (user.department && /manager/i.test(user.department));
  if (isManager) {
    return 'manager';
  }
  return 'agent';
}

// Helper: Get User's Chat Color
function getUserChatColor(user, orgConfig) {
  const roleColors = orgConfig?.chatConfig?.roleColors || {};
  const privilege = getUserPrivilegeLevel(user);
  
  // 1. Check custom organization mappings
  if (roleColors[privilege]) {
    return roleColors[privilege];
  }
  
  // 2. Check department specific mappings
  const dept = user.department?.toLowerCase() || '';
  if (dept.includes('sales') && roleColors['sales']) return roleColors['sales'];
  if (dept.includes('support') && roleColors['support']) return roleColors['support'];
  if (dept.includes('develop') && roleColors['developer']) return roleColors['developer'];
  
  // 3. Fallbacks
  if (privilege === 'admin') return '#22c55e'; // Green
  if (privilege === 'manager') return '#3b82f6'; // Blue
  const deptMatch = user.department?.toLowerCase();
  if (deptMatch?.includes('sales')) return '#f97316'; // Orange
  if (deptMatch?.includes('support')) return '#a855f7'; // Purple
  if (deptMatch?.includes('develop') || user.designation?.toLowerCase().includes('developer')) return '#ef4444'; // Red
  
  return '#64748b'; // Slate (Agent Default)
}

// GET /api/team-chat/users - List active team members in organization
router.get('/users', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const currentUserId = req.user._id.toString();

    const users = await User.find({
      organizationId: orgId,
      status: 'active',
      isDeleted: { $ne: true },
      _id: { $ne: req.user._id }
    }).select('name email role avatar department designation lastSeenAt');

    const org = await Organization.findById(orgId).lean();
    const onlineUserIds = await getOnlineUsers();

    const formattedUsers = users.map(u => {
      const uId = u._id.toString();
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatar: u.avatar || '',
        department: u.department || '',
        designation: u.designation || '',
        lastSeenAt: u.lastSeenAt || u.updatedAt,
        isOnline: onlineUserIds.includes(uId),
        chatColor: getUserChatColor(u, org)
      };
    });

    res.json({ success: true, data: { users: formattedUsers } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch team users', details: error.message });
  }
});

// GET /api/team-chat/chats - Fetch all conversations
router.get('/chats', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;

    // Find all memberships
    const memberships = await TeamChatMember.find({ userId });
    const chatIds = memberships.map(m => m.chatId);

    const chats = await TeamChat.find({
      _id: { $in: chatIds },
      organizationId: orgId
    }).lean();

    const onlineUserIds = await getOnlineUsers();
    const org = await Organization.findById(orgId).lean();

    const chatList = await Promise.all(
      chats.map(async (chat) => {
        const membership = memberships.find(m => m.chatId.toString() === chat._id.toString());
        
        // Find other members
        const membersData = await TeamChatMember.find({ chatId: chat._id }).populate('userId', 'name email role avatar department designation lastSeenAt').lean();

        const participants = membersData.map(m => {
          const u = m.userId;
          if (!u) return null;
          return {
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            avatar: u.avatar || '',
            department: u.department || '',
            designation: u.designation || '',
            lastSeenAt: u.lastSeenAt,
            isOnline: onlineUserIds.includes(u._id.toString()),
            chatColor: getUserChatColor(u, org),
            chatMemberRole: m.role
          };
        }).filter(Boolean);

        // Fetch last message
        const lastMsg = await TeamChatMessage.findOne({
          chatId: chat._id,
          deletedFor: { $ne: userId }
        })
          .sort({ createdAt: -1 })
          .populate('senderId', 'name')
          .lean();

        // Calculate unread count
        const unreadCount = await TeamChatMessage.countDocuments({
          chatId: chat._id,
          senderId: { $ne: userId },
          createdAt: { $gt: membership.lastReadAt },
          deletedFor: { $ne: userId }
        });

        // Resolve direct chat recipient details
        let displayTitle = chat.name || 'Group Chat';
        let displayAvatar = '';
        let displayColor = '#64748b';
        let directUserOnline = false;
        let lastSeenAt = null;

        if (chat.type === 'private') {
          const otherMember = participants.find(p => p._id.toString() !== userId.toString());
          if (otherMember) {
            displayTitle = otherMember.name;
            displayAvatar = otherMember.avatar;
            displayColor = otherMember.chatColor;
            directUserOnline = otherMember.isOnline;
            lastSeenAt = otherMember.lastSeenAt;
          }
        }

        return {
          _id: chat._id,
          type: chat.type,
          name: chat.name || '',
          title: displayTitle,
          avatar: displayAvatar,
          chatColor: displayColor,
          isOnline: directUserOnline,
          lastSeenAt,
          createdBy: chat.createdBy,
          createdAt: chat.createdAt,
          isPinned: membership.isPinned,
          isArchived: membership.isArchived,
          isMarkedUnread: membership.isMarkedUnread,
          lastReadAt: membership.lastReadAt,
          unreadCount: membership.isMarkedUnread ? Math.max(unreadCount, 1) : unreadCount,
          lastMessage: lastMsg ? {
            _id: lastMsg._id,
            senderId: lastMsg.senderId?._id,
            senderName: lastMsg.senderId?.name || 'Deleted User',
            message: lastMsg.message || '',
            messageType: lastMsg.messageType,
            fileUrl: lastMsg.fileUrl || '',
            createdAt: lastMsg.createdAt
          } : null,
          participants: chat.type === 'group' ? participants : []
        };
      })
    );

    // Sort: Pinned first, then by last message / creation date descending
    chatList.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
      const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(a.createdAt);
      const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(b.createdAt);
      return bTime - aTime;
    });

    res.json({ success: true, data: { chats: chatList } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch team chats', details: error.message });
  }
});

// GET /api/team-chat/chats/:chatId/messages - Fetch messages for a chat
router.get('/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { before, limit = 50 } = req.query;
    const userId = req.user._id;

    // Verify membership
    const membership = await TeamChatMember.findOne({ chatId, userId });
    if (!membership) {
      return res.status(403).json({ success: false, error: 'You are not a member of this chat' });
    }

    const query = {
      chatId,
      deletedFor: { $ne: userId }
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await TeamChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .populate('senderId', 'name email role avatar department designation')
      .populate('reactions.userId', 'name avatar')
      .populate({
        path: 'parentMessageId',
        select: 'message senderId messageType fileUrl',
        populate: { path: 'senderId', select: 'name' }
      })
      .lean();

    const org = await Organization.findById(req.user.organizationId).lean();

    const formattedMessages = messages.map(msg => {
      const sender = msg.senderId;
      return {
        ...msg,
        senderId: sender?._id,
        senderName: sender?.name || 'Deleted User',
        senderAvatar: sender?.avatar || '',
        senderColor: sender ? getUserChatColor(sender, org) : '#64748b',
        senderRole: sender?.role || 'agent',
        senderDepartment: sender?.department || '',
        senderDesignation: sender?.designation || ''
      };
    });

    // Return in chronological order
    formattedMessages.reverse();

    res.json({ success: true, data: { messages: formattedMessages } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch chat messages', details: error.message });
  }
});

// POST /api/team-chat/chats - Create a new chat (direct or group)
router.post('/chats', async (req, res) => {
  try {
    const { type, recipientId, name, memberIds = [] } = req.body;
    const orgId = req.user.organizationId;
    const creatorId = req.user._id;

    if (!type || !['private', 'group'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Valid chat type is required' });
    }

    if (type === 'private') {
      if (!recipientId) return res.status(400).json({ success: false, error: 'Recipient ID is required for direct chats' });
      if (recipientId === creatorId.toString()) return res.status(400).json({ success: false, error: 'You cannot chat with yourself' });

      // Verify recipient exists and is in the same organization
      const recipient = await User.findOne({ _id: recipientId, organizationId: orgId, isDeleted: { $ne: true } });
      if (!recipient) return res.status(404).json({ success: false, error: 'Recipient user not found' });

      // Check if direct chat already exists
      const existingDirects = await TeamChat.find({
        organizationId: orgId,
        type: 'private'
      });

      for (const chat of existingDirects) {
        const membersCount = await TeamChatMember.countDocuments({ chatId: chat._id });
        if (membersCount === 2) {
          const selfMember = await TeamChatMember.findOne({ chatId: chat._id, userId: creatorId });
          const otherMember = await TeamChatMember.findOne({ chatId: chat._id, userId: recipientId });
          if (selfMember && otherMember) {
            // Found existing chat, return it
            return res.json({ success: true, data: { chat, isNew: false } });
          }
        }
      }

      // Create new private chat
      const chat = await TeamChat.create({
        organizationId: orgId,
        type: 'private',
        createdBy: creatorId
      });

      // Add members
      await TeamChatMember.create([
        { chatId: chat._id, userId: creatorId, role: 'admin' },
        { chatId: chat._id, userId: recipientId, role: 'member' }
      ]);

      // Emit socket notification to recipient to join/refresh
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${recipientId}`).emit('team_chat_created', { chatId: chat._id });
      }

      return res.status(201).json({ success: true, data: { chat, isNew: true } });

    } else {
      // Group Chat
      if (!name) return res.status(400).json({ success: false, error: 'Group name is required' });

      // Verify Role Permissions
      const privilege = getUserPrivilegeLevel(req.user);
      if (privilege === 'agent') {
        return res.status(403).json({ success: false, error: 'Only admins and managers are authorized to create group chats' });
      }

      // Create new group chat
      const chat = await TeamChat.create({
        organizationId: orgId,
        type: 'group',
        name: name.trim(),
        createdBy: creatorId
      });

      // Add group creator as admin
      const memberInserts = [{ chatId: chat._id, userId: creatorId, role: 'admin' }];

      // Validate and add other group members
      const uniqueMemberIds = [...new Set(memberIds)].filter(id => id !== creatorId.toString());
      const verifiedMembers = await User.find({
        _id: { $in: uniqueMemberIds },
        organizationId: orgId,
        isDeleted: { $ne: true }
      });

      verifiedMembers.forEach(member => {
        memberInserts.push({ chatId: chat._id, userId: member._id, role: 'member' });
      });

      await TeamChatMember.create(memberInserts);

      // Emit socket notifications to all joined users
      const io = req.app.get('io');
      if (io) {
        verifiedMembers.forEach(member => {
          io.to(`user_${member._id.toString()}`).emit('team_chat_created', { chatId: chat._id });
        });
      }

      // Create persistent DB notifications for all joined users (except creator)
      for (const member of verifiedMembers) {
        await createNotification({
          userId: member._id,
          organizationId: orgId,
          type: 'team',
          title: 'Added to Chat Group 👥',
          message: `You were added to the group chat "${chat.name}" by ${req.user.name}.`,
          link: '/dashboard/team-chat',
          metadata: { chatId: chat._id }
        });
      }

      return res.status(201).json({ success: true, data: { chat } });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create chat', details: error.message });
  }
});

// PUT /api/team-chat/chats/:chatId - Update group settings, toggle pin/archive/unread
router.put('/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name, isPinned, isArchived, isMarkedUnread } = req.body;
    const userId = req.user._id;

    // Check membership
    const membership = await TeamChatMember.findOne({ chatId, userId });
    if (!membership) {
      return res.status(403).json({ success: false, error: 'You are not a member of this chat' });
    }

    const chat = await TeamChat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });

    // Handle Group Rename
    if (name !== undefined) {
      if (chat.type !== 'group') return res.status(400).json({ success: false, error: 'Only group chats can be renamed' });

      // Check permission: Admin, Manager, or Group Admin
      const privilege = getUserPrivilegeLevel(req.user);
      if (privilege === 'agent' && membership.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized to rename group' });
      }

      chat.name = name.trim();
      await chat.save();

      // Send Socket update
      const io = req.app.get('io');
      if (io) {
        io.to(`team_chat_${chatId}`).emit('team_group_updated', { chatId, name: chat.name });
      }
    }

    // Toggle Pin/Archive/Unread settings (User-specific)
    if (isPinned !== undefined) membership.isPinned = !!isPinned;
    if (isArchived !== undefined) membership.isArchived = !!isArchived;
    if (isMarkedUnread !== undefined) membership.isMarkedUnread = !!isMarkedUnread;

    await membership.save();

    res.json({ success: true, message: 'Chat preferences updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update chat', details: error.message });
  }
});

// POST /api/team-chat/chats/:chatId/members - Add members to group
router.post('/chats/:chatId/members', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { memberIds = [] } = req.body;
    const orgId = req.user.organizationId;
    const userId = req.user._id;

    // Verify chat
    const chat = await TeamChat.findOne({ _id: chatId, organizationId: orgId });
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });
    if (chat.type !== 'group') return res.status(400).json({ success: false, error: 'Members can only be added to group chats' });

    // Check permission: Admin, Manager, or Group Creator
    const creatorMembership = await TeamChatMember.findOne({ chatId, userId });
    const privilege = getUserPrivilegeLevel(req.user);
    if (privilege === 'agent' && creatorMembership?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized to add members to group' });
    }

    // Validate users and add
    const uniqueIds = [...new Set(memberIds)];
    const usersToAdd = await User.find({
      _id: { $in: uniqueIds },
      organizationId: orgId,
      isDeleted: { $ne: true }
    });

    const newInserts = [];
    const addedMemberObjects = [];
    const onlineUserIds = await getOnlineUsers();
    const orgConfig = await Organization.findById(orgId).lean();

    for (const u of usersToAdd) {
      // Check duplicate membership
      const exists = await TeamChatMember.findOne({ chatId, userId: u._id });
      if (!exists) {
        newInserts.push({ chatId, userId: u._id, role: 'member' });
        addedMemberObjects.push({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar || '',
          department: u.department || '',
          designation: u.designation || '',
          isOnline: onlineUserIds.includes(u._id.toString()),
          chatColor: getUserChatColor(u, orgConfig),
          chatMemberRole: 'member'
        });
      }
    }

    if (newInserts.length > 0) {
      await TeamChatMember.create(newInserts);

      const io = req.app.get('io');
      if (io) {
        // Emit event to new members
        newInserts.forEach(member => {
          io.to(`user_${member.userId.toString()}`).emit('team_chat_created', { chatId });
        });
        // Emit group updated to existing members
        io.to(`team_chat_${chatId}`).emit('team_members_added', { chatId, members: addedMemberObjects });
      }

      // Create persistent DB notifications for the newly added members
      for (const newMember of addedMemberObjects) {
        await createNotification({
          userId: newMember._id,
          organizationId: orgId,
          type: 'team',
          title: 'Added to Chat Group 👥',
          message: `You were added to the group chat "${chat.name || 'Group Chat'}" by ${req.user.name}.`,
          link: '/dashboard/team-chat',
          metadata: { chatId }
        });
      }
    }

    res.json({ success: true, addedCount: newInserts.length, message: 'Members added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add group members', details: error.message });
  }
});

// DELETE /api/team-chat/chats/:chatId/members/:targetUserId - Remove member or leave group
router.delete('/chats/:chatId/members/:targetUserId', async (req, res) => {
  try {
    const { chatId, targetUserId } = req.params;
    const userId = req.user._id;
    const orgId = req.user.organizationId;

    // Check chat
    const chat = await TeamChat.findOne({ _id: chatId, organizationId: orgId });
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });
    if (chat.type !== 'group') return res.status(400).json({ success: false, error: 'Member operations only apply to group chats' });

    const targetMembership = await TeamChatMember.findOne({ chatId, userId: targetUserId });
    if (!targetMembership) return res.status(404).json({ success: false, error: 'Member not found in this group' });

    const actionIsLeave = userId.toString() === targetUserId;

    if (!actionIsLeave) {
      // Admin/Manager permission check to remove members
      const operatorMembership = await TeamChatMember.findOne({ chatId, userId });
      const privilege = getUserPrivilegeLevel(req.user);
      if (privilege === 'agent' && operatorMembership?.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized to remove group members' });
      }
    }

    // Delete membership
    await TeamChatMember.deleteOne({ _id: targetMembership._id });

    // Notify other group members
    const io = req.app.get('io');
    if (io) {
      io.to(`team_chat_${chatId}`).emit('team_member_removed', { chatId, userId: targetUserId, isLeave: actionIsLeave });
      io.to(`user_${targetUserId}`).emit('team_chat_removed', { chatId });
    }

    // Create persistent DB notifications
    const targetUser = await User.findById(targetUserId).select('name').lean();
    if (actionIsLeave) {
      // Notify group admin or remaining members that someone left
      const remainingAdmins = await TeamChatMember.find({ chatId, role: 'admin' }).select('userId').lean();
      for (const admin of remainingAdmins) {
        await createNotification({
          userId: admin.userId,
          organizationId: orgId,
          type: 'team',
          title: 'Member Left Group 🚪',
          message: `"${targetUser?.name || 'Someone'}" left the group "${chat.name}".`,
          link: '/dashboard/team-chat',
          metadata: { chatId }
        });
      }
    } else {
      // Someone was removed by admin. Notify the removed user.
      await createNotification({
        userId: targetUserId,
        organizationId: orgId,
        type: 'team',
        title: 'Removed from Chat Group 🚪',
        message: `You were removed from the group "${chat.name}" by ${req.user.name}.`,
        link: '/dashboard/team-chat',
        metadata: { chatId }
      });
    }

    res.json({ success: true, message: actionIsLeave ? 'Left group successfully' : 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove group member', details: error.message });
  }
});

// DELETE /api/team-chat/chats/:chatId - Delete group (Admin only) or clear chat history (User-specific)
router.delete('/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const orgId = req.user.organizationId;
    const userId = req.user._id;

    const chat = await TeamChat.findOne({ _id: chatId, organizationId: orgId });
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });

    if (chat.type === 'group') {
      // Group deletion requires Admin privileges
      const privilege = getUserPrivilegeLevel(req.user);
      if (privilege !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only administrators can delete group chats' });
      }

      // Delete group completely
      await TeamChatMember.deleteMany({ chatId });
      await TeamChatMessage.deleteMany({ chatId });
      await TeamChat.deleteOne({ _id: chatId });

      // Notify all users via socket
      const io = req.app.get('io');
      if (io) {
        io.to(`team_chat_${chatId}`).emit('team_chat_deleted', { chatId });
      }

      return res.json({ success: true, message: 'Group deleted successfully' });
    } else {
      // For private chats, delete messages for the current user (soft delete)
      const messages = await TeamChatMessage.find({ chatId });
      for (const msg of messages) {
        if (!msg.deletedFor.includes(userId)) {
          msg.deletedFor.push(userId);
          await msg.save();
        }
      }

      res.json({ success: true, message: 'Chat history cleared for you' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete chat', details: error.message });
  }
});

// POST /api/team-chat/messages - Send a message
router.post('/messages', async (req, res) => {
  try {
    const { chatId, messageType = 'text', message, fileUrl, parentMessageId } = req.body;
    const orgId = req.user.organizationId;
    const userId = req.user._id;

    if (!chatId) return res.status(400).json({ success: false, error: 'Chat ID is required' });

    // Verify membership
    const membership = await TeamChatMember.findOne({ chatId, userId });
    if (!membership) {
      return res.status(403).json({ success: false, error: 'You are not a member of this chat' });
    }

    if (messageType === 'text' && !message) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    if (messageType !== 'text' && !fileUrl) {
      return res.status(400).json({ success: false, error: 'Attachment URL is required for non-text messages' });
    }

    // Create message
    const newMsg = await TeamChatMessage.create({
      organizationId: orgId,
      chatId,
      senderId: userId,
      messageType,
      message: message || '',
      fileUrl: fileUrl || '',
      parentMessageId: parentMessageId || undefined,
      readReceipts: [{ userId, status: 'read', timestamp: new Date() }]
    });

    // Update chat updatedAt field
    await TeamChat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

    // Update sender's last read timestamp
    membership.lastReadAt = new Date();
    membership.isMarkedUnread = false;
    await membership.save();

    // Populate sender details for Socket broadcast
    const populatedMsg = await TeamChatMessage.findById(newMsg._id)
      .populate('senderId', 'name email role avatar department designation')
      .populate('reactions.userId', 'name avatar')
      .populate({
        path: 'parentMessageId',
        select: 'message senderId messageType fileUrl',
        populate: { path: 'senderId', select: 'name' }
      })
      .lean();

    const orgConfig = await Organization.findById(orgId).lean();
    const formattedMsg = {
      ...populatedMsg,
      senderId: populatedMsg.senderId?._id,
      senderName: populatedMsg.senderId?.name || 'Deleted User',
      senderAvatar: populatedMsg.senderId?.avatar || '',
      senderColor: populatedMsg.senderId ? getUserChatColor(populatedMsg.senderId, orgConfig) : '#64748b',
      senderRole: populatedMsg.senderId?.role || 'agent',
      senderDepartment: populatedMsg.senderId?.department || '',
      senderDesignation: populatedMsg.senderId?.designation || ''
    };

    // Socket.io Real-Time Broadcast
    const io = req.app.get('io');
    if (io) {
      // 1. Broadcast inside chat room
      io.to(`team_chat_${chatId}`).emit('team_new_message', { chatId, message: formattedMsg });

      // 2. Notify other members (updates unread count in sidebar/dashboard)
      const otherMembers = await TeamChatMember.find({ chatId, userId: { $ne: userId } });
      otherMembers.forEach(member => {
        io.to(`user_${member.userId.toString()}`).emit('team_chat_activity', {
          chatId,
          message: {
            ...formattedMsg,
            unreadCountUpdate: true
          }
        });
      });

      // 3. Create persistent DB notifications for other members
      const allOrgUsers = await User.find({
        organizationId: orgId,
        status: 'active',
        isDeleted: { $ne: true }
      }).select('name username').lean();

      const mentionedUserIds = new Set();
      const msgText = message || '';
      for (const orgUser of allOrgUsers) {
        if (orgUser._id.toString() === userId.toString()) continue;
        const nameMatch = orgUser.name && msgText.includes(`@${orgUser.name}`);
        const usernameMatch = orgUser.username && msgText.includes(`@${orgUser.username}`);
        if (nameMatch || usernameMatch) {
          mentionedUserIds.add(orgUser._id.toString());
        }
      }

      // Determine if file/image was shared
      let titleText = `New message from ${req.user.name}`;
      let bodyText = message || '';
      if (messageType === 'image') {
        titleText = `📷 Image from ${req.user.name}`;
        bodyText = 'Shared an image';
      } else if (messageType === 'file') {
        titleText = `📁 File from ${req.user.name}`;
        bodyText = 'Shared a file';
      }

      for (const member of otherMembers) {
        const targetUserIdStr = member.userId.toString();
        const isMentioned = mentionedUserIds.has(targetUserIdStr);
        
        const type = isMentioned ? 'team' : 'message';
        const notifTitle = isMentioned ? `You were mentioned in chat by ${req.user.name} 💬` : titleText;
        const notifMsg = isMentioned ? `Mentioned you: "${bodyText}"` : bodyText;

        await createNotification({
          userId: member.userId,
          organizationId: orgId,
          type,
          title: notifTitle,
          message: notifMsg,
          link: '/dashboard/team-chat',
          metadata: { chatId, messageId: newMsg._id }
        });
      }
    }

    res.status(201).json({ success: true, data: { message: formattedMsg } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send message', details: error.message });
  }
});

// PUT /api/team-chat/messages/:messageId - Edit message
router.put('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    if (!message) return res.status(400).json({ success: false, error: 'Message content is required' });

    const msg = await TeamChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });

    // Verify Sender
    if (msg.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, error: 'You are only authorized to edit your own messages' });
    }

    msg.message = message.trim();
    msg.isEdited = true;
    msg.editedAt = new Date();
    await msg.save();

    // Broadcast Update
    const io = req.app.get('io');
    if (io) {
      io.to(`team_chat_${msg.chatId.toString()}`).emit('team_message_edited', {
        chatId: msg.chatId,
        messageId,
        message: msg.message,
        editedAt: msg.editedAt
      });
    }

    res.json({ success: true, data: { message: msg } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to edit message', details: error.message });
  }
});

// DELETE /api/team-chat/messages/:messageId - Delete message
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteFor = 'me' } = req.body; // 'me' or 'everyone'
    const userId = req.user._id;

    const msg = await TeamChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });

    if (deleteFor === 'me') {
      if (!msg.deletedFor.includes(userId)) {
        msg.deletedFor.push(userId);
        await msg.save();
      }
      return res.json({ success: true, message: 'Message deleted for you' });
    } else {
      // Delete for Everyone: Sender or Admin only
      const privilege = getUserPrivilegeLevel(req.user);
      const isSender = msg.senderId.toString() === userId.toString();
      
      if (!isSender && privilege !== 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized to delete this message for everyone' });
      }

      msg.message = '[This message was deleted]';
      msg.messageType = 'text';
      msg.fileUrl = '';
      msg.isEdited = true;
      msg.editedAt = new Date();
      await msg.save();

      // Broadcast update
      const io = req.app.get('io');
      if (io) {
        io.to(`team_chat_${msg.chatId.toString()}`).emit('team_message_deleted_everyone', {
          chatId: msg.chatId,
          messageId
        });
      }

      res.json({ success: true, message: 'Message deleted for everyone' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete message', details: error.message });
  }
});

// POST /api/team-chat/messages/:messageId/read - Mark messages as read
router.post('/messages/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const msg = await TeamChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });

    const chatId = msg.chatId;

    const membership = await TeamChatMember.findOne({ chatId, userId });
    if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this chat' });

    // Update lastReadAt
    membership.lastReadAt = new Date();
    membership.isMarkedUnread = false;
    await membership.save();

    // Mark user status as read in receipts for this chat up to this message's timestamp
    await TeamChatMessage.updateMany(
      {
        chatId,
        createdAt: { $lte: msg.createdAt },
        'readReceipts.userId': { $ne: userId }
      },
      {
        $push: { readReceipts: { userId, status: 'read', timestamp: new Date() } }
      }
    );

    // Broadcast read receipt
    const io = req.app.get('io');
    if (io) {
      io.to(`team_chat_${chatId.toString()}`).emit('team_read_receipt', {
        chatId,
        userId,
        readAt: membership.lastReadAt
      });
    }

    res.json({ success: true, message: 'Chat marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark as read', details: error.message });
  }
});

// POST /api/team-chat/upload - Upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    let fileUrl = '';
    if (cloudinaryService.isConfigured()) {
      // Determine resource type: image, video, or raw (for documents/pdfs)
      let resourceType = 'raw';
      if (req.file.mimetype.startsWith('image/')) resourceType = 'image';
      else if (req.file.mimetype.startsWith('video/')) resourceType = 'video';
      else if (req.file.mimetype.startsWith('audio/')) resourceType = 'video'; // Cloudinary handles audio as video resource

      fileUrl = await cloudinaryService.uploadStream(req.file.buffer, 'team_chat', resourceType, req.file.originalname);
    } else {
      fileUrl = `/uploads/${req.file.filename}`;
    }

    res.status(201).json({ success: true, data: { url: fileUrl } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
  }
});

// GET /api/team-chat/settings - Fetch color configurations
router.get('/settings', async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId).lean();
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

    const roleColors = org.chatConfig?.roleColors || {
      'admin': '#22c55e',
      'owner': '#22c55e',
      'superadmin': '#10b981',
      'manager': '#3b82f6',
      'sales': '#f97316',
      'support': '#a855f7',
      'developer': '#ef4444',
      'agent': '#64748b'
    };

    res.json({ success: true, data: { roleColors } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch settings', details: error.message });
  }
});

// PUT /api/team-chat/settings - Update color configurations (Admin only)
router.put('/settings', async (req, res) => {
  try {
    const privilege = getUserPrivilegeLevel(req.user);
    if (privilege !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only organization administrators can configure chat settings' });
    }

    const { roleColors } = req.body;
    if (!roleColors) return res.status(400).json({ success: false, error: 'roleColors configuration is required' });

    const org = await Organization.findById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

    org.chatConfig = org.chatConfig || {};
    org.chatConfig.roleColors = {
      ...org.chatConfig.roleColors,
      ...roleColors
    };

    await org.save();

    res.json({ success: true, data: { roleColors: org.chatConfig.roleColors }, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update settings', details: error.message });
  }
});

// POST /api/team-chat/messages/:messageId/reactions - Add or update a reaction to a message
router.post('/messages/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji || !emoji.trim()) {
      return res.status(400).json({ success: false, error: 'Emoji is required' });
    }

    const msg = await TeamChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });

    // Verify membership
    const membership = await TeamChatMember.findOne({ chatId: msg.chatId, userId });
    if (!membership) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Check if user already reacted
    const existingIndex = msg.reactions.findIndex(r => r.userId.toString() === userId.toString());
    if (existingIndex > -1) {
      // Update existing reaction
      msg.reactions[existingIndex].emoji = emoji;
    } else {
      // Add new reaction
      msg.reactions.push({ userId, emoji });
    }

    await msg.save();

    // Populate user details for reaction response
    const populatedMsg = await TeamChatMessage.findById(messageId)
      .populate('reactions.userId', 'name avatar')
      .lean();

    // Broadcast reaction update
    const io = req.app.get('io');
    if (io) {
      io.to(`team_chat_${msg.chatId.toString()}`).emit('team_message_reaction_updated', {
        chatId: msg.chatId,
        messageId,
        reactions: populatedMsg.reactions
      });
    }

    res.json({ success: true, data: { reactions: populatedMsg.reactions } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to react to message', details: error.message });
  }
});

// DELETE /api/team-chat/messages/:messageId/reactions - Remove a reaction from a message
router.delete('/messages/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const msg = await TeamChatMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, error: 'Message not found' });

    // Verify membership
    const membership = await TeamChatMember.findOne({ chatId: msg.chatId, userId });
    if (!membership) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Filter out user's reaction
    msg.reactions = msg.reactions.filter(r => r.userId.toString() !== userId.toString());
    await msg.save();

    // Populate user details for response
    const populatedMsg = await TeamChatMessage.findById(messageId)
      .populate('reactions.userId', 'name avatar')
      .lean();

    // Broadcast reaction update
    const io = req.app.get('io');
    if (io) {
      io.to(`team_chat_${msg.chatId.toString()}`).emit('team_message_reaction_updated', {
        chatId: msg.chatId,
        messageId,
        reactions: populatedMsg.reactions
      });
    }

    res.json({ success: true, data: { reactions: populatedMsg.reactions } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove reaction', details: error.message });
  }
});

module.exports = router;
